const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (to, subject, text) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: [to],
      subject,
      text,
    });

    if (error) {
      console.log(error);
      throw error;
    }

    console.log("Email sent:", data);
  } catch (err) {
    console.error("Resend Error:", err);
    throw err;
  }
};

module.exports = sendEmail;