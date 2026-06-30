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
  resetOtp: {
    type: String,
  },

  resetOtpExpiry: {
    type: Date,
  },
});

module.exports = mongoose.model("User", userSchema);
