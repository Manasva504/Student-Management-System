// utils/tokenFactory.js
const jwt = require("jsonwebtoken");

function createAuthToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
}

module.exports = { createAuthToken };