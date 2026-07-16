// One-off seed script for scripts/benchmark.js — inserts a realistic
// number of student documents so GET /students and GET /dashboard/stats
// have enough Mongo work to do that the cache actually matters. Not part
// of the app's runtime; run manually: node scripts/seedBenchmarkData.js
require("dotenv").config();
const mongoose = require("mongoose");
const Student = require("../models/Student");

const COURSES = ["Computer Science", "Information Technology", "Electronics", "Mechanical", "Civil"];
const COUNT = Number(process.env.SEED_COUNT) || 500;

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  await Student.deleteMany({});

  const docs = Array.from({ length: COUNT }, (_, i) => ({
    name: `Bench Student ${i}`,
    email: `bench-student-${i}@example.com`,
    course: COURSES[i % COURSES.length],
    age: 18 + (i % 10),
    cgpa: Number((4 + (i % 60) / 10).toFixed(2)),
  }));

  await Student.insertMany(docs);

  console.log(`Seeded ${docs.length} students.`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
