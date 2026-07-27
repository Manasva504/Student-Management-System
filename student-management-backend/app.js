const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
dotenv.config();
const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./routes/authRoutes");
const studentRoutes = require("./routes/studentRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const adminRoutes = require("./routes/adminRoutes");
const Student = require("./models/Student");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");
const logger = require("./utils/logger");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");

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

// ── Routes ───────────────────────────────────────────────────
// Versioned under /api/v1/ — a versioned API is a contract: a future
// breaking change gets a new /api/v2/ prefix instead of mutating what
// existing callers (the frontend, anyone else's integration) already
// depend on out from under them. GET / stays unversioned on purpose —
// it's a health check, not part of the API contract itself.
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/students", studentRoutes(io));
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/upload", uploadRoutes);
app.use("/api/v1/admin", adminRoutes(logDailySummary));

app.get("/", (req, res) => {
  res.send("Backend Running");
});

// Machine-readable liveness check, deliberately unauthenticated and
// uncached so an external pinger (cron-job.org, UptimeRobot) can hit it on
// a schedule to keep Render's free instance from idling into a 30-60s cold
// start. Kept cheap on purpose — no database or Redis round trip, so it
// answers even while those are still connecting, and a ping can never add
// load to Mongo.
app.get("/api/v1/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ── Scheduled Job ────────────────────────────────────────────
// Counts total students and logs a one-line summary. Used by both
// server.js's cron.schedule callback and the POST /api/v1/admin/daily-summary
// route (routes/adminRoutes.js, injected above); the actual
// cron.schedule(...) registration lives in server.js only, so importing
// app.js for tests never silently starts a background timer.
async function logDailySummary() {
  const totalStudents = await Student.countDocuments();

  console.log(`[Daily Summary] Total students: ${totalStudents}`);

  return totalStudents;
}

app.use(errorHandler);

module.exports = { app, server, io, logDailySummary };
