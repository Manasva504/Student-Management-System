const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const Student = require("../models/Student");
const logger = require("../utils/logger");
const { cacheGet, cacheSet } = require("../utils/cache");
const { CACHE_TTL_SECONDS } = require("../utils/constants");

const router = express.Router();

// GET dashboard stats
router.get("/stats", authMiddleware, async (req, res) => {
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
router.get("/branch-chart", authMiddleware, async (req, res) => {
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
router.get("/registration-trend", authMiddleware, async (req, res) => {
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

module.exports = router;
