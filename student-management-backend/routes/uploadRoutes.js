const express = require("express");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../utils/cloudinary");
const authMiddleware = require("../middleware/authMiddleware");
const logger = require("../utils/logger");

const router = express.Router();

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

router.post("/", authMiddleware, (req, res) => {
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
    // needs to clean the old asset up (see PUT/DELETE /api/v1/students/:id).
    res.json({ imageUrl: req.file.path, publicId: req.file.filename });
  });
});

module.exports = router;
