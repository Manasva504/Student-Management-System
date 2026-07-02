const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
  },

  password: {
    type: String,
    required: true,
  },

  role: {
    type: String,
    enum: ["Admin", "Student"],
    default: "Student",
  },

  profilePic: {
    type: String,
    default: "",
  },

  
  resetOtp: {
    type: String,
  },

  resetOtpExpiry: {
    type: Date,
  },
});

module.exports = mongoose.model("User", userSchema);
