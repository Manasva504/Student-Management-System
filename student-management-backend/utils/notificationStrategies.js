// utils/notificationStrategies.js
const sendEmail = require("./sendEmail");

const strategies = {
  email: sendEmail,
  // sms: sendSms,  ← future: just add one line here, nothing else changes
};

function getNotificationStrategy(type) {
  return strategies[type] || strategies.email; // default to email
}

module.exports = { getNotificationStrategy };