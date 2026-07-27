// utils/demoAccount.js
// The hosted demo needs a way in — a visitor landing on the login screen
// with no credentials has no way to see anything at all.
//
// These credentials are intentionally public: they're printed on the login
// screen and in the README. There is nothing to protect here, so they're
// plain constants rather than env vars — the frontend has to display the
// same values, and it can't read backend env vars.
//
// The account uses the existing "Student" role rather than a new one. That
// role already cannot create, edit, delete, or export student records, or
// read audit logs (every one of those routes sits behind adminOnly), so
// it's read-only for application data by construction. What it *can* still
// do is change its own password, edit its own email, and delete its own
// account — any of which would break the shared demo for everyone else.
// middleware/demoGuard.js blocks exactly those three.
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const logger = require("./logger");

const DEMO_USER = {
  name: "Demo User",
  email: "demo@example.com",
  password: "DemoPass123",
  role: "Student",
};

// Idempotent: if the demo user already exists, this leaves it completely
// untouched — no password reset, no role change, no profile overwrite.
// Safe to call on every boot, which is how it stays available on Render's
// free tier (no shell access there to run a one-off seed script).
async function seedDemoUser() {
  try {
    const existing = await User.findOne({ email: DEMO_USER.email });

    if (existing) {
      logger.info(`Demo account already present: ${DEMO_USER.email}`);
      return existing;
    }

    const created = await User.create({
      name: DEMO_USER.name,
      email: DEMO_USER.email,
      password: await bcrypt.hash(DEMO_USER.password, 10),
      role: DEMO_USER.role,
    });

    logger.info(`Demo account created: ${DEMO_USER.email}`);

    return created;
  } catch (err) {
    // Never let demo seeding take the server down — a failure here means
    // the demo login won't work, which is worth a loud log but not a crash.
    logger.error(`Demo account seeding failed: ${err.message}`);
    return null;
  }
}

module.exports = { DEMO_USER, seedDemoUser };
