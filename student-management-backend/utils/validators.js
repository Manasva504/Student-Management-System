const hasRequiredFields = (obj, fields) => fields.every((f) => obj[f]);

// Simple format check, not a full RFC5322 validator — good enough to reject
// obviously-malformed input without the false-negative headaches a fully
// spec-compliant regex brings.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (email) => typeof email === "string" && EMAIL_REGEX.test(email);

const MIN_PASSWORD_LENGTH = 8;
const isValidPassword = (password) =>
  typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH;

module.exports = { hasRequiredFields, isValidEmail, isValidPassword, MIN_PASSWORD_LENGTH };
