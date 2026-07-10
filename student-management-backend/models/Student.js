const mongoose = require("mongoose");

// NOTE: added { timestamps: true } so we get createdAt/updatedAt on every
// student doc. This is required for the "Student Registration Trend" chart,
// which groups students by their createdAt date. Students that were
// already in the DB before this change won't have a createdAt field, so
// they simply won't show up in the trend chart until re-saved — see the
// note on the /dashboard/registration-trend route in app.js.
const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    course: { type: String, required: true },
    age: { type: Number, required: true },
    cgpa: { type: Number, required: true },
    profilePic: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Student", studentSchema);
