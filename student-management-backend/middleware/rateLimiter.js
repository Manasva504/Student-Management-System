const rateLimit = require("express-rate-limit");
const logger = require("../utils/logger");

// Applies only to auth routes (login/register) — these are the endpoints
// someone would actually brute-force, unlike GET /students or dashboard
// routes which don't need this.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts, please try again later." },
  // The in-memory counter persists for the life of the process. Without
  // this, a test file that grows past ~10 login/register calls would
  // start failing on rate limiting rather than on what it's actually
  // testing — Jest sets NODE_ENV=test automatically, so this needs no
  // extra config on the test side.
  skip: (req) => process.env.NODE_ENV === "test",
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded: ip=${req.ip} path=${req.originalUrl}`);
    res.status(options.statusCode).json(options.message);
  },
});

module.exports = authLimiter;