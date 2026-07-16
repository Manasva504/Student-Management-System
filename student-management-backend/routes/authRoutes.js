const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const sendNotificationEmail = require("../utils/sendNotificationEmail");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/rolemiddleware");
const Auditlog = require("../models/Auditlog");
const { getNotificationStrategy } = require("../utils/notificationStrategies");
const userService = require("../services/userService");
const { sendSuccess, sendError } = require("../utils/responseHandler");
const { OTP_EXPIRY_MS, MESSAGES } = require("../utils/constants");
const { hasRequiredFields, isValidEmail, isValidPassword } = require("../utils/validators");
const logger = require("../utils/logger");
const authLimiter = require("../middleware/rateLimiter");
const { blacklistToken } = require("../utils/cache");

router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await userService.login(email, password);
    res.status(200).json(result);
  } catch (error) {
    // error.message here comes from userService.login, which today only
    // ever throws controlled, user-safe messages (e.g. "Invalid
    // Credentials") — but gating it the same way errorHandler.js gates its
    // own message means a future change to userService.login can't quietly
    // start leaking internals through this route without also being caught
    // in production.
    const clientMessage =
      process.env.NODE_ENV === "production"
        ? error.statusCode
          ? error.message
          : MESSAGES.SERVER_ERROR
        : error.message;

    res.status(error.statusCode || 500).json({ message: clientMessage });
  }
});

router.post("/register", authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!hasRequiredFields(req.body, ["name", "email", "password"])) {
      return sendError(res, 400, "All fields are required");
    }

    if (!isValidEmail(email)) {
      return sendError(res, 400, MESSAGES.INVALID_EMAIL);
    }

    if (!isValidPassword(password)) {
      return sendError(res, 400, MESSAGES.WEAK_PASSWORD);
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return sendError(res, 400, "User already exists");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: "Student",
    });

    await user.save();

    // Fire-and-forget — same principle as the audit logging in server.js:
    // a flaky email must never turn a successful registration into an error.
    sendNotificationEmail(
      user.email,
      "Welcome to Student Management System",
      `Hi ${user.name},\n\nYour account has been created successfully. You can now log in and get started.`,
    ).catch((err) => logger.error(`Welcome email failed: ${err.message}`));

    sendSuccess(res, 201, "User registered successfully");
  } catch (error) {
    logger.error(error.stack || error.message);

    sendError(res, 500, MESSAGES.SERVER_ERROR);
  }
});
router.post("/forgot-password", authLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return sendError(res, 404, MESSAGES.USER_NOT_FOUND);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetOtp = otp;
    user.resetOtpExpiry = Date.now() + OTP_EXPIRY_MS;

    await user.save();

    // FIX: removed `console.log("OTP:", otp)` that used to be here — it was
    // printing the live password-reset OTP straight into Render's log
    // stream, which is a real leak (logs are visible to anyone with
    // dashboard access and often persist/get shipped elsewhere).
    const sendOtp = getNotificationStrategy("email"); // hardcoded for now, dynamic later
    await sendOtp(
      email,
      "Password Reset OTP",
      `Your OTP is ${otp}. It is valid for 5 minutes.`,
    );

    sendSuccess(res, 200, "OTP sent successfully");
  } catch (error) {
    logger.error(error.stack || error.message);

    sendError(res, 500, MESSAGES.SERVER_ERROR);
  }
});

router.post("/verify-otp", authLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return sendError(res, 404, MESSAGES.USER_NOT_FOUND);
    }

    if (user.resetOtp !== otp || user.resetOtpExpiry < Date.now()) {
      return sendError(res, 400, "Invalid or Expired OTP");
    }

    sendSuccess(res, 200, "OTP verified successfully");
  } catch (error) {
    logger.error(error.stack || error.message);

    sendError(res, 500, MESSAGES.SERVER_ERROR);
  }
});

router.post("/reset-password", authLimiter, async (req, res) => {
  try {
    const { email, password, otp } = req.body;

    if (!isValidPassword(password)) {
      return sendError(res, 400, MESSAGES.WEAK_PASSWORD);
    }

    const user = await User.findOne({ email });

    if (!user) {
      return sendError(res, 404, MESSAGES.USER_NOT_FOUND);
    }

    // FIX (security): this endpoint used to skip OTP verification entirely —
    // anyone who knew a user's email could reset their password just by
    // calling this route directly, without ever going through /verify-otp.
    // It now re-checks the same resetOtp/resetOtpExpiry fields /verify-otp
    // checks, so a valid, unexpired OTP is required here too.
    if (!otp || user.resetOtp !== otp || user.resetOtpExpiry < Date.now()) {
      return sendError(res, 400, "Invalid or expired OTP");
    }

    const isSamePassword = await bcrypt.compare(password, user.password);

    if (isSamePassword) {
      return sendError(
        res,
        400,
        "New password cannot be the same as your current password.",
      );
    }
    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password
    user.password = hashedPassword;

    // Clear OTP fields so this same OTP can't be replayed
    user.resetOtp = undefined;
    user.resetOtpExpiry = undefined;

    await user.save();

    sendSuccess(res, 200, "Password reset successful");
  } catch (error) {
    logger.error(error.stack || error.message);

    sendError(res, 500, MESSAGES.SERVER_ERROR);
  }
});

router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json(user);
  } catch (error) {
    logger.error(error.stack || error.message);

    res.status(500).json({
      message: "Server Error",
    });
  }
});

router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const { name, email, profilePic } = req.body;

    if (email && !isValidEmail(email)) {
      return sendError(res, 400, MESSAGES.INVALID_EMAIL);
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return sendError(res, 404, MESSAGES.USER_NOT_FOUND);
    }

    user.name = name || user.name;
    user.email = email || user.email;
    user.profilePic = profilePic || user.profilePic;

    await user.save();

    sendSuccess(res, 200, "Profile updated successfully", user);
  } catch (error) {
    logger.error(error.stack || error.message);

    sendError(res, 500, MESSAGES.SERVER_ERROR);
  }
});

router.put("/change-password", authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!hasRequiredFields(req.body, ["oldPassword", "newPassword"])) {
      return sendError(res, 400, "Both passwords are required");
    }

    if (!isValidPassword(newPassword)) {
      return sendError(res, 400, MESSAGES.WEAK_PASSWORD);
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return sendError(res, 404, MESSAGES.USER_NOT_FOUND);
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);

    if (!isMatch) {
      return sendError(res, 400, "Current password is incorrect");
    }

    const samePassword = await bcrypt.compare(newPassword, user.password);

    if (samePassword) {
      return sendError(res, 400, "New password cannot be same as old password");
    }

    user.password = await bcrypt.hash(newPassword, 10);

    await user.save();

    await Auditlog.create({
      user: user.email,
      action: "Changed Password",
    });

    sendSuccess(res, 200, "Password updated successfully");
  } catch (error) {
    logger.error(error.stack || error.message);

    sendError(res, 500, MESSAGES.SERVER_ERROR);
  }
});

router.delete("/delete-account", authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user.id);

    sendSuccess(res, 200, "Account deleted successfully");
  } catch (error) {
    logger.error(error.stack || error.message);

    sendError(res, 500, MESSAGES.SERVER_ERROR);
  }
});

router.post("/logout", authMiddleware, async (req, res) => {
  try {
    // req.user.exp comes straight from the verified JWT payload (tokenFactory
    // signs with expiresIn, so jwt.verify always attaches it) — the
    // blacklist entry only needs to outlive the token itself, not sit in
    // Redis for hours after a token that was already about to expire.
    const ttlSeconds = req.user.exp - Math.floor(Date.now() / 1000);

    await blacklistToken(req.token, ttlSeconds);

    await Auditlog.create({
      user: req.user.email,
      action: "Logout",
    });

    logger.info(`Logout: user=${req.user.email}`);

    sendSuccess(res, 200, "Logged out successfully");
  } catch (error) {
    logger.error(error.stack || error.message);

    sendError(res, 500, MESSAGES.SERVER_ERROR);
  }
});

router.get("/activity-logs", authMiddleware, adminOnly, async (req, res) => {
  try {
    const logs = await Auditlog.find().sort({ createdAt: -1 }).limit(200);

    res.json({
      success: true,
      logs,
    });
  } catch (error) {
    logger.error(error.stack || error.message);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

module.exports = router;
