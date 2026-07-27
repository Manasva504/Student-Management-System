const express = require("express");
const mongoose = require("mongoose");
const authMiddleware = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/rolemiddleware");
const Auditlog = require("../models/Auditlog");
const Student = require("../models/Student");
// KNOWN ACCEPTED RISK: xlsx has two unpatched high-severity CVEs
// (GHSA-4r6h-8v6p-xvw6 prototype pollution, GHSA-5pgg-2g8v-p4x9 ReDoS),
// neither fixable via `npm audit fix` — SheetJS never published a patched
// version to npm for either. Accepted rather than migrated because this
// app only ever calls xlsx.write() on server-generated data built from
// buildStudentQuery() results (see /export/excel below) — it never calls
// xlsx.read()/parse on attacker-controlled input, which is the vector
// both CVEs require. Re-evaluate if this ever starts parsing uploaded
// spreadsheets.
const xlsx = require("xlsx");
const PDFDocument = require("pdfkit");
const sendNotificationEmail = require("../utils/sendNotificationEmail");
const logger = require("../utils/logger");
const cloudinary = require("../utils/cloudinary");
const { cacheGet, cacheSet, invalidateStudentCaches } = require("../utils/cache");
const { CACHE_TTL_SECONDS } = require("../utils/constants");

// io is injected rather than imported, since it's constructed in app.js
// after Socket.IO wraps the HTTP server — this router is built once, at
// mount time, with that same io instance closed over by every handler
// below, same as when these were inline in app.js.
module.exports = function studentRoutes(io) {
  const router = express.Router();

  // Shared by GET / and the /export/* routes below, so the same
  // search/branch/cgpa filters apply whether the request is paginated or
  // exporting every matching row.
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
  router.get("/", authMiddleware, async (req, res) => {
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
  router.get("/:id", authMiddleware, async (req, res) => {
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
  router.post("/", authMiddleware, adminOnly, async (req, res) => {
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
  router.put("/:id", authMiddleware, adminOnly, async (req, res) => {
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
  router.delete("/:id", authMiddleware, adminOnly, async (req, res) => {
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
  router.post("/:id/notify", authMiddleware, adminOnly, async (req, res) => {
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
  router.get(
    "/export/excel",
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
  router.get("/export/csv", authMiddleware, adminOnly, async (req, res) => {
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
  router.get("/export/pdf", authMiddleware, adminOnly, async (req, res) => {
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

  return router;
};
