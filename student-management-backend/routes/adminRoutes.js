const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/rolemiddleware");
const logger = require("../utils/logger");

// logDailySummary is injected rather than imported — it's defined in
// app.js and also used directly by server.js's cron job, so app.js stays
// the one place that owns it; this router just needs a reference to call
// on request, same as the io-injection pattern in studentRoutes.js.
module.exports = function adminRoutes(logDailySummary) {
  const router = express.Router();

  router.post("/daily-summary", authMiddleware, adminOnly, async (req, res) => {
    try {
      const totalStudents = await logDailySummary();

      res.json({ success: true, totalStudents });
    } catch (error) {
      logger.error(error.stack || error.message);
      res.status(500).json({ success: false, message: "Server Error" });
    }
  });

  return router;
};
