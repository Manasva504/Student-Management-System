const authEvents = require("../events/authEvents");
const Auditlog = require("../models/Auditlog");

authEvents.on("userLoggedIn", async (user) => {
  await Auditlog.create({ user: user.email, action: "Login" });
});