module.exports = {
  OTP_EXPIRY_MS: 5 * 60 * 1000,
  JWT_EXPIRY: "1d",
  MESSAGES: {
    INVALID_CREDENTIALS: "Invalid Credentials",
    SERVER_ERROR: "Server Error",
    USER_NOT_FOUND: "User not found",
    INVALID_EMAIL: "Please provide a valid email address",
    WEAK_PASSWORD: "Password must be at least 8 characters long",
  },
};
