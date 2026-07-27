// middleware/demoGuard.js
// The demo account is shared by every visitor to the hosted demo. The
// "Student" role already blocks it from touching student records (those
// routes are all adminOnly), but three self-service routes would still let
// any visitor permanently break the demo for everyone after them:
//
//   PUT    /auth/change-password  → locks everyone else out
//   PUT    /auth/profile          → changing the email breaks the login
//   DELETE /auth/delete-account   → deletes the demo account outright
//
// This blocks those three for the demo account only. Every other user is
// unaffected and passes straight through.
const { DEMO_USER } = require("../utils/demoAccount");

const blockForDemoAccount = (req, res, next) => {
  if (req.user?.email === DEMO_USER.email) {
    return res.status(403).json({
      success: false,
      message:
        "This action is disabled for the shared demo account. Register your own account to try it.",
    });
  }

  next();
};

module.exports = blockForDemoAccount;
