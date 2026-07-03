const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
dotenv.config();
const errorHandler = require("./middleware/errorHandler");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const authMiddleware = require("./middleware/authMiddleware");
const mongoose = require("mongoose");
const adminOnly = require("./middleware/rolemiddleware");
const multer = require("multer");
const path = require("path");
const Auditlog = require("./models/Auditlog");

const app = express();

connectDB();

// ── Student Schema (defined here, no separate file needed) ──
// NOTE: added { timestamps: true } so we get createdAt/updatedAt on every
// student doc. This is required for the "Student Registration Trend" chart
// below, which groups students by their createdAt date. Students that were
// already in the DB before this change won't have a createdAt field, so
// they simply won't show up in the trend chart until re-saved — see the
// note on the /dashboard/registration-trend route.
const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    course: { type: String, required: true },
    age: { type: Number, required: true },
    cgpa: { type: Number, required: true },
    profilePic: { type: String, default: "" },
  },
  { timestamps: true },
);

const Student = mongoose.model("Student", studentSchema);

// ── Middlewares ──────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:5173",
  /^https:\/\/student-management-system.*\.vercel\.app$/,
];

app.use(
  cors({
    origin: (origin, callback) => {
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
    },
    credentials: true,
  }),
);
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use("/api/auth", authRoutes);

// ── File Upload ──────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: "./uploads",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

app.use("/uploads", express.static("uploads"));

app.post("/upload", authMiddleware, upload.single("profilePic"), (req, res) => {
  res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

app.get("/", (req, res) => {
  res.send("Backend Running");
});

// GET all students with search, filter, sort and pagination
app.get("/students", authMiddleware, async (req, res) => {
  try {
    const {
      search,
      branch,
      minCgpa,
      maxCgpa,
      sortBy,
      page = 1,
      limit = 5,
    } = req.query;

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

    res.json({
      success: true,
      message: "Students fetched successfully",
      data: formatted,
      totalStudents,
      currentPage: Number(page),
      totalPages: Math.ceil(totalStudents / limit),
    });
  } catch (error) {
    console.log(error);
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
    });
  } catch (error) {
    console.log(error);
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
    const { name, email, course, age, cgpa, profilePic } = req.body;

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
    });
    await newStudent.save();
    await Auditlog.create({
      user: req.user.email,
      action: `Added student: ${newStudent.name}`,
    });

    res.status(201).json({
      message: "Student added successfully",
      student: { id: newStudent._id, ...newStudent._doc },
    });
  } catch (error) {
    console.log(error);
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
    const { name, email, course, age, cgpa, profilePic } = req.body;

    if (age !== undefined && age <= 0) {
      return res.status(400).json({ message: "Age must be greater than 0" });
    }

    if (cgpa !== undefined && (cgpa < 0 || cgpa > 10)) {
      return res.status(400).json({ message: "CGPA must be between 0 and 10" });
    }

    const updated = await Student.findByIdAndUpdate(
      req.params.id,
      { name, email, course, age, cgpa, profilePic },
      { new: true },
    );

    if (!updated) {
      return res.status(404).json({ message: "Student not found" });
    }

    await Auditlog.create({
      user: req.user.email,
      action: `Edited student: ${updated.name}`,
    });

    res.json({
      message: "Student updated successfully",
      student: { id: updated._id, ...updated._doc },
    });
  } catch (error) {
    console.log(error);
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
    const deleted = await Student.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Student not found" });
    }

    await Auditlog.create({
      user: req.user.email,
      action: `Deleted student: ${deleted.name}`,
    });

    res.json({
      message: "Student deleted successfully",
      student: { id: deleted._id, ...deleted._doc },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      data: null,
    });
  }
});

// GET dashboard stats
app.get("/dashboard/stats", authMiddleware, async (req, res) => {
  try {
    const students = await Student.find();
    const totalStudents = students.length;

    if (totalStudents === 0) {
      return res.json({
        totalStudents: 0,
        studentsPerBranch: {},
        averageCGPA: "0.00",
        highestCGPAStudent: null,
      });
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

    res.json({
      totalStudents,
      studentsPerBranch,
      averageCGPA: averageCGPA.toFixed(2),
      highestCGPAStudent,
    });
  } catch (error) {
    console.log(error);
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
  try {
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

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

// GET student registration trend, bucketed by month (Dashboard chart)
// NOTE: relies on the student's createdAt timestamp (see schema above).
// Students created before { timestamps: true } was added won't have a
// createdAt field and are excluded here rather than crashing the pipeline.
app.get("/dashboard/registration-trend", authMiddleware, async (req, res) => {
  try {
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

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

// ── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.use(errorHandler);
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});