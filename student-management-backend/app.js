const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
dotenv.config();
const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./routes/authRoutes");
const authMiddleware = require("./middleware/authMiddleware");
const mongoose = require("mongoose");
const adminOnly = require("./middleware/rolemiddleware");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("./utils/cloudinary");
const Auditlog = require("./models/Auditlog");
const Student = require("./models/Student");
// KNOWN ACCEPTED RISK: xlsx has two unpatched high-severity CVEs
// (GHSA-4r6h-8v6p-xvw6 prototype pollution, GHSA-5pgg-2g8v-p4x9 ReDoS),
// neither fixable via `npm audit fix` — SheetJS never published a patched
// version to npm for either. Accepted rather than migrated because this
// app only ever calls xlsx.write() on server-generated data built from
// buildStudentQuery() results (see /students/export/excel below) — it
// never calls xlsx.read()/parse on attacker-controlled input, which is
// the vector both CVEs require. Re-evaluate if this ever starts parsing
// uploaded spreadsheets.
const xlsx = require("xlsx");
const PDFDocument = require("pdfkit");
const sendNotificationEmail = require("./utils/sendNotificationEmail");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");
const logger = require("./utils/logger");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const { cacheGet, cacheSet, invalidateStudentCaches } = require("./utils/cache");
const { CACHE_TTL_SECONDS } = require("./utils/constants");

// This file only builds and exports the app/server/io — it has no startup
// side effects (no DB connection, no cron scheduling, no port binding), so
// it can be require()'d cleanly by Supertest in tests. server.js is the
// only file that actually starts anything.
const app = express();

// Render sits directly in front of this app as a single reverse-proxy
// hop. Without this, Express computes req.ip from the raw socket, which
// resolves to Render's proxy IP for every request — collapsing every
// real user into one shared rate-limit bucket instead of limiting each
// of them individually. The literal 1 means "trust exactly one hop";
// `true` would trust an unbounded chain and accept a spoofed
// X-Forwarded-For from anywhere.
app.set("trust proxy", 1);

// Helmet first, before anything else — including cors(). If it ran after
// cors() (as it used to), a rejected CORS origin calls next(err) inside
// the cors middleware, which skips every subsequent non-error middleware
// (helmet included) and jumps straight to errorHandler at the bottom —
// meaning CORS-rejected responses would go out with no security headers
// at all. Running helmet first guarantees every response gets them.
app.use(helmet());

// ── Middlewares ──────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:5173", // Vite dev server (npm run dev, outside Docker)
  "http://localhost:8081", // Dockerized frontend (docker compose up)
  /^https:\/\/student-management-system.*\.vercel\.app$/,
];

// Shared by both Express's cors() middleware below and the Socket.IO
// server's cors option further down — one origin list, one place that
// decides who's allowed, instead of the same allowlist copy-pasted twice.
function corsOriginCheck(origin, callback) {
  if (!origin) return callback(null, true);

  const isAllowed = allowedOrigins.some((o) =>
    o instanceof RegExp ? o.test(origin) : o === origin,
  );

  if (isAllowed) {
    callback(null, true);
  } else {
    console.log("CORS blocked origin:", origin);
    callback(new Error("CORS: origin not allowed"));
  }
}

app.use(
  cors({
    origin: corsOriginCheck,
    credentials: true,
  }),
);
app.use(express.json());

app.use(mongoSanitize());
// Request logging — Morgan formats each request line ("combined" includes
// method/URL/status/response time/remote addr/user-agent), piped through
// the shared Winston logger instead of writing straight to console, so
// request logs end up in the same place (console + logs/app.log) as every
// other logger.info/warn call in the app. Placed before any routes are
// registered so every request gets logged, including ones that 404.
app.use(
  morgan("combined", {
    stream: { write: (message) => logger.info(message.trim()) },
  }),
);

// ── Socket.IO ────────────────────────────────────────────────
// Wrap the Express app in a plain HTTP server so Socket.IO can attach to
// it — this is required because Socket.IO needs to hijack the raw HTTP
// upgrade handshake to open a WebSocket, which app.listen() alone doesn't
// expose. Constructing http.createServer/new Server here does no I/O and
// binds no port by itself — server.listen() (in server.js) is what
// actually starts listening, so this stays safe to import in tests.
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOriginCheck,
    credentials: true,
  },
});

// Reject anonymous socket connections — every client must present the same
// JWT it already uses for REST calls, verified the same way
// middleware/authMiddleware.js verifies it for Express routes. There's no
// req.header() here (this runs on the handshake, not an HTTP request), so
// the token travels in `auth` instead: io(url, { auth: { token } }) on the
// client, read back as socket.handshake.auth.token here.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error("Authentication required"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    socket.user = decoded;
    next();
  } catch (error) {
    next(new Error("Invalid token"));
  }
});

// Counts active socket connections per user (not per socket), so someone
// with two tabs open still counts as one online user. Module-level Map,
// same lifetime as the server process — this is in-memory presence, not
// persisted anywhere.
const onlineUsers = new Map(); // userId -> active socket count

io.on("connection", (socket) => {
  const { id: userId, email, role } = socket.user;

  if (role === "Admin") {
    socket.join("admins");
  }

  const previousCount = onlineUsers.get(userId) || 0;
  onlineUsers.set(userId, previousCount + 1);

  // Only a 0 → 1 transition is a genuinely new online user — a second tab
  // from the same person shouldn't move the count or spam the activity feed.
  if (previousCount === 0) {
    io.emit("presence:count", onlineUsers.size);
    io.to("admins").emit("activity:new", {
      user: email,
      action: "Came online",
      createdAt: new Date(),
    });
  }

  socket.on("disconnect", () => {
    const currentCount = onlineUsers.get(userId) || 0;
    const newCount = currentCount - 1;

    if (newCount <= 0) {
      onlineUsers.delete(userId);
      io.emit("presence:count", onlineUsers.size);
      io.to("admins").emit("activity:new", {
        user: email,
        action: "Went offline",
        createdAt: new Date(),
      });
    } else {
      onlineUsers.set(userId, newCount);
    }
  });
});

app.use("/api/auth", authRoutes);

// ── File Upload (Cloudinary) ────────────────────────────────
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_UPLOAD_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "student-profiles",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  // This is a profile picture upload — restrict to actual image types so
  // an authenticated user can't stash arbitrary files (or an unbounded
  // amount of data) in Cloudinary storage under this app's account.
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, and WEBP images are allowed"));
    }

    cb(null, true);
  },
});

app.post("/upload", authMiddleware, (req, res) => {
  // Wrapped manually (instead of passing upload.single(...) as route
  // middleware directly) so fileFilter/size-limit rejections come back as
  // a clean 400 with the specific reason, instead of falling through to
  // errorHandler's generic production-gated message.
  upload.single("profilePic")(req, res, (err) => {
    if (err) {
      logger.error(`Upload rejected: ${err.message}`);
      return res.status(400).json({ success: false, message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    // multer-storage-cloudinary maps Cloudinary's upload result onto
    // multer's file object: `path` is the asset's secure_url, `filename`
    // is its public_id — the public_id is what a later replace/delete
    // needs to clean the old asset up (see PUT/DELETE /students/:id).
    res.json({ imageUrl: req.file.path, publicId: req.file.filename });
  });
});

app.get("/", (req, res) => {
  res.send("Backend Running");
});

// Shared by GET /students and the /students/export/* routes below, so the
// same search/branch/cgpa filters apply whether the request is paginated
// or exporting every matching row.
function buildStudentQuery({ search, branch, minCgpa, maxCgpa }) {
  let query = {};

  // SEARCH
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { _id: mongoose.Types.ObjectId.isValid(search) ? search : null },
    ];
  }

  // FILTER BY BRANCH
  if (branch) {
    query.course = branch;
  }

  // FILTER BY CGPA RANGE
  if (minCgpa || maxCgpa) {
    query.cgpa = {};

    if (minCgpa) query.cgpa.$gte = Number(minCgpa);

    if (maxCgpa) query.cgpa.$lte = Number(maxCgpa);
  }

  return query;
}

// GET all students with search, filter, sort and pagination
app.get("/students", authMiddleware, async (req, res) => {
  // Every filter/sort/page combination is a different result set, so the
  // full query string is part of the key — a search for "asha" and a
  // search for "ben" must never collide on the same cache entry.
  const cacheKey = `students:${JSON.stringify(req.query)}`;

  try {
    const cached = await cacheGet(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    const { sortBy, page = 1, limit = 5 } = req.query;

    let query = buildStudentQuery(req.query);

    // SORTING
    let sortOptions = {};

    if (sortBy === "name") sortOptions.name = 1;

    if (sortBy === "cgpa") sortOptions.cgpa = -1;

    if (sortBy === "course") sortOptions.course = 1;

    const totalStudents = await Student.countDocuments(query);

    const students = await Student.find(query)
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const formatted = students.map((s) => ({
      id: s._id,
      name: s.name,
      email: s.email,
      course: s.course,
      age: s.age,
      cgpa: s.cgpa,
      profilePic: s.profilePic,
    }));

    const responseBody = {
      success: true,
      message: "Students fetched successfully",
      data: formatted,
      totalStudents,
      currentPage: Number(page),
      totalPages: Math.ceil(totalStudents / limit),
    };

    await cacheSet(cacheKey, responseBody, CACHE_TTL_SECONDS);

    res.json(responseBody);
  } catch (error) {
    logger.error(error.stack || error.message);
    res.status(500).json({
      success: false,
      message: "Server Error",
      data: null,
    });
  }
});

// GET single student
app.get("/students/:id", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid student ID" });
    }

    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json({
      id: student._id,
      name: student.name,
      email: student.email,
      course: student.course,
      age: student.age,
      cgpa: student.cgpa,
      profilePic: student.profilePic,
      profilePicPublicId: student.profilePicPublicId,
    });
  } catch (error) {
    logger.error(error.stack || error.message);
    res.status(500).json({
      success: false,
      message: "Server Error",
      data: null,
    });
  }
});

// POST add student
app.post("/students", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, email, course, age, cgpa, profilePic, profilePicPublicId } = req.body;

    if (!name || !email || !course || age === undefined || cgpa === undefined) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (age <= 0) {
      return res.status(400).json({ message: "Age must be greater than 0" });
    }

    if (cgpa < 0 || cgpa > 10) {
      return res.status(400).json({ message: "CGPA must be between 0 and 10" });
    }

    const newStudent = new Student({
      name,
      email,
      course,
      age,
      cgpa,
      profilePic,
      profilePicPublicId,
    });
    await newStudent.save();
    await Auditlog.create({
      user: req.user.email,
      action: `Added student: ${newStudent.name}`,
    });

    // A new student changes both the list (every students:* key, since the
    // query string varies the key) and every aggregate stat, so both go.
    await invalidateStudentCaches();

    logger.info(
      `Student created: name=${newStudent.name} email=${newStudent.email} by user=${req.user.email}`,
    );

    io.emit("student:added", { id: newStudent._id, name: newStudent.name });
    io.to("admins").emit("activity:new", {
      user: req.user.email,
      action: `Added student: ${newStudent.name}`,
      createdAt: new Date(),
    });

    // Fire-and-forget: never let a flaky email hold up the response or
    // fail an otherwise-successful add, same principle as audit logging.
    sendNotificationEmail(
      newStudent.email,
      "Welcome to Student Management System",
      `Hi ${newStudent.name},\n\nYour student record has been added to the Student Management System.\n\nCourse: ${newStudent.course}\nCGPA: ${newStudent.cgpa}\n\nIf you have any questions, contact your administrator.`,
    ).catch((err) => logger.error(`Notification email failed: ${err.message}`));

    res.status(201).json({
      message: "Student added successfully",
      student: { id: newStudent._id, ...newStudent._doc },
    });
  } catch (error) {
    logger.error(error.stack || error.message);
    res.status(500).json({
      success: false,
      message: "Server Error",
      data: null,
    });
  }
});

// PUT update student
app.put("/students/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid student ID" });
    }

    const { name, email, course, age, cgpa, profilePic, profilePicPublicId } = req.body;

    if (age !== undefined && age <= 0) {
      return res.status(400).json({ message: "Age must be greater than 0" });
    }

    if (cgpa !== undefined && (cgpa < 0 || cgpa > 10)) {
      return res.status(400).json({ message: "CGPA must be between 0 and 10" });
    }

    // Captured before the write so there's something to compare the new
    // value against afterward — findByIdAndUpdate below only ever hands
    // back one snapshot (the updated doc), not both.
    const existing = await Student.findById(req.params.id);

    const updated = await Student.findByIdAndUpdate(
      req.params.id,
      { name, email, course, age, cgpa, profilePic, profilePicPublicId },
      { new: true },
    );

    if (!updated) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Only clean up Cloudinary once the new value is confirmed saved, and
    // only when this update actually swapped in a different image —
    // editing just the name/course/etc. shouldn't touch an existing photo.
    // A Cloudinary hiccup here is logged, not thrown: it must never block
    // a student-record update that already succeeded.
    if (
      existing?.profilePicPublicId &&
      profilePicPublicId &&
      profilePicPublicId !== existing.profilePicPublicId
    ) {
      try {
        await cloudinary.uploader.destroy(existing.profilePicPublicId);
      } catch (err) {
        logger.warn(
          `Failed to delete old Cloudinary asset ${existing.profilePicPublicId}: ${err.message}`,
        );
      }
    }

    await Auditlog.create({
      user: req.user.email,
      action: `Edited student: ${updated.name}`,
    });

    await invalidateStudentCaches();

    logger.info(
      `Student updated: name=${updated.name} id=${updated._id} by user=${req.user.email}`,
    );

    io.emit("student:updated", { id: updated._id, name: updated.name });
    io.to("admins").emit("activity:new", {
      user: req.user.email,
      action: `Edited student: ${updated.name}`,
      createdAt: new Date(),
    });

    sendNotificationEmail(
      updated.email,
      "Your Student Record Was Updated",
      `Hi ${updated.name},\n\nYour student record in the Student Management System has been updated.\n\nCourse: ${updated.course}\nCGPA: ${updated.cgpa}\n\nIf you didn't expect this change, contact your administrator.`,
    ).catch((err) => logger.error(`Notification email failed: ${err.message}`));

    res.json({
      message: "Student updated successfully",
      student: { id: updated._id, ...updated._doc },
    });
  } catch (error) {
    logger.error(error.stack || error.message);
    res.status(500).json({
      success: false,
      message: "Server Error",
      data: null,
    });
  }
});

// DELETE student
app.delete("/students/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid student ID" });
    }

    const deleted = await Student.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Don't leave the photo orphaned in Cloudinary storage once the student
    // record it belonged to is gone. Same defensive try/catch as the PUT
    // route above — a Cloudinary failure must never block a delete that
    // already succeeded against the database.
    if (deleted.profilePicPublicId) {
      try {
        await cloudinary.uploader.destroy(deleted.profilePicPublicId);
      } catch (err) {
        logger.warn(
          `Failed to delete Cloudinary asset ${deleted.profilePicPublicId}: ${err.message}`,
        );
      }
    }

    await Auditlog.create({
      user: req.user.email,
      action: `Deleted student: ${deleted.name}`,
    });

    await invalidateStudentCaches();

    logger.info(
      `Student deleted: name=${deleted.name} id=${deleted._id} by user=${req.user.email}`,
    );

    io.emit("student:deleted", { id: deleted._id, name: deleted.name });
    io.to("admins").emit("activity:new", {
      user: req.user.email,
      action: `Deleted student: ${deleted.name}`,
      createdAt: new Date(),
    });

    res.json({
      message: "Student deleted successfully",
      student: { id: deleted._id, ...deleted._doc },
    });
  } catch (error) {
    logger.error(error.stack || error.message);
    res.status(500).json({
      success: false,
      message: "Server Error",
      data: null,
    });
  }
});

// POST manually trigger a notification email for one student — unlike the
// fire-and-forget emails on add/edit above, this one is a direct user
// action, so it awaits the send and reports success/failure honestly.
app.post("/students/:id/notify", authMiddleware, adminOnly, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid student ID" });
    }

    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    await sendNotificationEmail(
      student.email,
      "Update from Student Management System",
      `Hi ${student.name},\n\nThis is a notification regarding your student record.\n\nCourse: ${student.course}\nCGPA: ${student.cgpa}`,
    );

    res.json({ success: true, message: "Notification email sent" });
  } catch (error) {
    logger.error(error.stack || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to send notification email",
    });
  }
});

// Row shape shared by all three export formats below.
function formatStudentForExport(s) {
  return {
    Name: s.name,
    Email: s.email,
    Course: s.course,
    Age: s.age,
    CGPA: s.cgpa,
    "Registration Date": s.createdAt
      ? s.createdAt.toISOString().slice(0, 10)
      : "",
  };
}

// GET export all matching students as an Excel workbook (no pagination —
// exports are meant to cover everything the filters match, not one page).
app.get(
  "/students/export/excel",
  authMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const query = buildStudentQuery(req.query);
      const students = await Student.find(query).sort({ name: 1 });

      const rows = students.map(formatStudentForExport);

      const worksheet = xlsx.utils.json_to_sheet(rows);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, "Students");

      const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", "attachment; filename=students.xlsx");
      res.send(buffer);
    } catch (error) {
      logger.error(error.stack || error.message);
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },
);

// Quotes a CSV field only when it needs it (contains a comma, quote, or
// newline), doubling any internal quotes per the CSV spec.
function csvEscape(value) {
  const str = String(value ?? "");

  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

// GET export all matching students as CSV.
app.get("/students/export/csv", authMiddleware, adminOnly, async (req, res) => {
  try {
    const query = buildStudentQuery(req.query);
    const students = await Student.find(query).sort({ name: 1 });

    const header = ["Name", "Email", "Course", "Age", "CGPA", "Registration Date"];
    const lines = [header.join(",")];

    students.forEach((s) => {
      const row = Object.values(formatStudentForExport(s)).map(csvEscape);
      lines.push(row.join(","));
    });

    const csv = lines.join("\r\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=students.csv");
    res.send(csv);
  } catch (error) {
    logger.error(error.stack || error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// GET export all matching students as a PDF table — this doubles as the
// "Student Report" from the assignment, not a separate report mechanism.
app.get("/students/export/pdf", authMiddleware, adminOnly, async (req, res) => {
  try {
    const query = buildStudentQuery(req.query);
    const students = await Student.find(query).sort({ name: 1 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=students.pdf");

    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
    doc.pipe(res);

    doc.fontSize(16).text("Student Report", { align: "center" });
    doc.moveDown();

    const columns = [
      { label: "Name", width: 150 },
      { label: "Email", width: 210 },
      { label: "Course", width: 140 },
      { label: "Age", width: 50 },
      { label: "CGPA", width: 60 },
      { label: "Registration Date", width: 130 },
    ];
    const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);
    const startX = doc.page.margins.left;
    let y = doc.y;

    function drawRow(values, isHeader) {
      let x = startX;

      doc.fontSize(10).font(isHeader ? "Helvetica-Bold" : "Helvetica");

      values.forEach((value, i) => {
        doc.text(String(value), x, y, { width: columns[i].width, ellipsis: true });
        x += columns[i].width;
      });

      y += 20;

      if (y > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.page.margins.top;
      }
    }

    drawRow(
      columns.map((c) => c.label),
      true,
    );
    doc
      .moveTo(startX, y - 6)
      .lineTo(startX + tableWidth, y - 6)
      .stroke();

    students.forEach((s) => {
      drawRow(Object.values(formatStudentForExport(s)), false);
    });

    doc.end();
  } catch (error) {
    logger.error(error.stack || error.message);
    // The PDF may already be streaming by the time an error hits, in which
    // case headers are sent and a JSON error body would just crash again.
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  }
});

// GET dashboard stats
app.get("/dashboard/stats", authMiddleware, async (req, res) => {
  const cacheKey = "dashboard:stats";

  try {
    const cached = await cacheGet(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    const students = await Student.find();
    const totalStudents = students.length;

    if (totalStudents === 0) {
      const emptyBody = {
        totalStudents: 0,
        studentsPerBranch: {},
        averageCGPA: "0.00",
        highestCGPAStudent: null,
      };

      await cacheSet(cacheKey, emptyBody, CACHE_TTL_SECONDS);

      return res.json(emptyBody);
    }

    const studentsPerBranch = {};
    students.forEach((s) => {
      studentsPerBranch[s.course] = (studentsPerBranch[s.course] || 0) + 1;
    });

    const averageCGPA =
      students.reduce((sum, s) => sum + s.cgpa, 0) / totalStudents;

    const highestCGPAStudent = students.reduce((highest, s) =>
      s.cgpa > highest.cgpa ? s : highest,
    );

    const responseBody = {
      totalStudents,
      studentsPerBranch,
      averageCGPA: averageCGPA.toFixed(2),
      highestCGPAStudent,
    };

    await cacheSet(cacheKey, responseBody, CACHE_TTL_SECONDS);

    res.json(responseBody);
  } catch (error) {
    logger.error(error.stack || error.message);
    res.status(500).json({
      success: false,
      message: "Server Error",
      data: null,
    });
  }
});

// GET students per branch + average CGPA per branch (Dashboard charts)
// Powers two charts on the frontend: "Students per Branch" (totalStudents)
// and "Average CGPA by Branch" (avgCgpa) — one aggregation, one round trip.
app.get("/dashboard/branch-chart", authMiddleware, async (req, res) => {
  const cacheKey = "dashboard:branch-chart";

  try {
    const cached = await cacheGet(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    const data = await Student.aggregate([
      {
        $group: {
          _id: "$course",
          totalStudents: { $sum: 1 },
          avgCgpa: { $avg: "$cgpa" },
        },
      },
      {
        $project: {
          _id: 0,
          branch: "$_id",
          totalStudents: 1,
          avgCgpa: { $round: ["$avgCgpa", 2] },
        },
      },
      { $sort: { totalStudents: -1 } },
    ]);

    const responseBody = {
      success: true,
      data,
    };

    await cacheSet(cacheKey, responseBody, CACHE_TTL_SECONDS);

    res.json(responseBody);
  } catch (error) {
    logger.error(error.stack || error.message);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

// GET student registration trend, bucketed by month (Dashboard chart)
// NOTE: relies on the student's createdAt timestamp (see models/Student.js).
// Students created before { timestamps: true } was added won't have a
// createdAt field and are excluded here rather than crashing the pipeline.
app.get("/dashboard/registration-trend", authMiddleware, async (req, res) => {
  const cacheKey = "dashboard:registration-trend";

  try {
    const cached = await cacheGet(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    const data = await Student.aggregate([
      {
        $match: { createdAt: { $exists: true } },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          month: "$_id",
          count: 1,
        },
      },
    ]);

    const responseBody = {
      success: true,
      data,
    };

    await cacheSet(cacheKey, responseBody, CACHE_TTL_SECONDS);

    res.json(responseBody);
  } catch (error) {
    logger.error(error.stack || error.message);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

// ── Scheduled Job ────────────────────────────────────────────
// Counts total students and logs a one-line summary. The route lives here
// (used by both server.js's cron.schedule callback and this on-demand
// route); the actual cron.schedule(...) registration lives in server.js
// only, so importing app.js for tests never silently starts a background
// timer.
async function logDailySummary() {
  const totalStudents = await Student.countDocuments();

  console.log(`[Daily Summary] Total students: ${totalStudents}`);

  return totalStudents;
}

app.post("/admin/daily-summary", authMiddleware, adminOnly, async (req, res) => {
  try {
    const totalStudents = await logDailySummary();

    res.json({ success: true, totalStudents });
  } catch (error) {
    logger.error(error.stack || error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

app.use(errorHandler);

module.exports = { app, server, io, logDailySummary };
