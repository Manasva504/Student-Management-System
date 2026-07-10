// Real entry point — the only file with actual startup side effects
// (DB connection, cron scheduling, port binding). app.js has none of
// these, which is what lets Supertest require() it cleanly in tests.
const { server, logDailySummary } = require("./app");
const connectDB = require("./config/db");
const cron = require("node-cron");

connectDB();

// Runs once a day at midnight server time.
cron.schedule("0 0 * * *", () => {
  logDailySummary().catch((err) =>
    console.error("Daily summary cron failed:", err.message),
  );
});

const PORT = process.env.PORT || 5000;

// server.listen, not app.listen — the HTTP server wrapping app is what
// Socket.IO attached to in app.js, so it has to be the thing actually
// bound to the port, or every socket connection attempt fails silently.
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
