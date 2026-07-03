const nodemailer = require("nodemailer");

// Separate from utils/sendEmail.js (Resend) on purpose — that one handles
// OTP emails and shouldn't be touched. This one covers student-record and
// welcome notifications, over Nodemailer/Gmail SMTP, so the two concerns
// don't share a sender or a quota.
const hasEmailCredentials = Boolean(
  process.env.EMAIL_USER && process.env.EMAIL_PASS,
);

if (!hasEmailCredentials) {
  console.warn(
    "[sendNotificationEmail] EMAIL_USER/EMAIL_PASS not set — notification emails will fail until these are configured.",
  );
}

const transporter = hasEmailCredentials
  ? nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })
  : null;

const sendNotificationEmail = async (to, subject, text) => {
  if (!transporter) {
    throw new Error(
      "Email service not configured (EMAIL_USER/EMAIL_PASS missing)",
    );
  }

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
  });

  console.log("Notification email sent:", to, subject);
};

module.exports = sendNotificationEmail;
