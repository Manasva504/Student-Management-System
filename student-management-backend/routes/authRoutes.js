const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Please provide Email and Password",
      });
    }
    //find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message: "Invalid Credentials",
      });
    }

    //compare passwords
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid Credentials",
      });
    }
    console.log("USER FROM DB:");
    //generate JWT Tokens
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      },
    );

    res.status(200).json({
      message: "Login successful",
      token,
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

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
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

    const savedUser = await User.findById(user._id);

    console.log("Saved user:", await User.findOne({ email }));

    res.status(201).json({
      message: "User registered successfully",
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
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetOtp = otp;
    user.resetOtpExpiry = Date.now() + 5 * 60 * 1000;

    await user.save();
    console.log("EMAIL USER:", process.env.EMAIL_USER);
    console.log("EMAIL PASS EXISTS:", !!process.env.EMAIL_PASS);
    console.log("Sending OTP to:", email);
    console.log("OTP:", otp);
    await sendEmail(
      email,
      "Password Reset OTP",
      `Your OTP is ${otp}. It is valid for 5 minutes.`,
    );

    res.json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.resetOtp !== otp || user.resetOtpExpiry < Date.now()) {
      return res.status(400).json({
        message: "Invalid or Expired OTP",
      });
    }

    res.json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    const isSamePassword = await bcrypt.compare(password, user.password);

    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password cannot be the same as your current password.",
      });
    }
    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password
    user.password = hashedPassword;

    // Clear OTP fields
    user.resetOtp = undefined;
    user.resetOtpExpiry = undefined;

    await user.save();

    res.json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
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
    console.log(user);

    res.json(user);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
});

router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const { name, email, profilePic } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    user.name = name || user.name;
    user.email = email || user.email;
    user.profilePic = profilePic || user.profilePic;

    await user.save();

    res.json({
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
});

router.put("/change-password", authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        message: "Both passwords are required",
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Current password is incorrect",
      });
    }

    const samePassword = await bcrypt.compare(newPassword, user.password);

    if (samePassword) {
      return res.status(400).json({
        message: "New password cannot be same as old password",
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);

    await user.save();

    res.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
});

router.delete("/delete-account", authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user.id);

    res.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
});
module.exports = router;
