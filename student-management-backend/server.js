const authRoutes = require("./routes/authRoutes");
const authMiddleware = require("./middleware/authMiddleware");
require("dotenv").config();

const connectDB = require("./config/db");

const cors = require("cors");

const express = require("express");

const app = express();

connectDB();

app.use(cors());

app.use(express.json());

app.use("/api/auth", authRoutes);

const students = [
  {
    id: 1,
    name: "John Doe",
    email: "johndoe@example.com",
    course: "Computer Science",
    age: 21,
    cgpa: 8.2,
  },
  {
    id: 2,
    name: "Jane Smith",
    email: "janesmith@example.com",
    course: "Mechanical Engineering",
    age: 19,
    cgpa: 9.4,
  },
  {
    id: 3,
    name: "Mike Johnson",
    email: "mikejohnson@example.com",
    course: "Electronics",
    age: 20,
    cgpa: 7.5,
  },
];

app.get("/", (req, res) => {
  res.send("Backend Running");
});

app.get("/students", authMiddleware, (req, res) => {
  res.json(students);
});

app.get("/students/:id",authMiddleware, (req, res) => {
  const id = Number(req.params.id);

  const student = students.find((student) => student.id === id);

  if (!student) {
    return res.status(404).json({
      message: "Student not found",
    });
  }

  res.json(student);
});

app.post("/students", authMiddleware,(req, res) => {
  const { id, name, course, cgpa } = req.body;

  if (!id || !name || !course || cgpa === undefined) {
    return res.status(400).json({
      message: "All fields are required",
    });
  }

  const newStudent = {
    id,
    name,
    course,
    cgpa,
  };

  students.push(newStudent);

  res.status(201).json({
    message: "Student added successfully",
    student: newStudent,
  });
});


app.put("/students/:id", authMiddleware, (req, res) => {
  const id = Number(req.params.id);

  const updatedData = req.body;

  const studentIndex = students.findIndex(
    (student) => student.id === id
  );

  if (studentIndex === -1) {
    return res.status(404).json({
      message: "Student not found",
    });
  }

  students[studentIndex] = {
    ...students[studentIndex],
    ...updatedData,
  };

  res.json({
    message: "Student updated successfully",
    student: students[studentIndex],
  });
});

app.delete("/students/:id", authMiddleware, (req, res) => {
  const id = Number(req.params.id);

  const studentIndex = students.findIndex(
    (student) => student.id === id
  );

  if (studentIndex === -1) {
    return res.status(404).json({
      message: "Student not found",
    });
  }

  const deletedStudent = students[studentIndex];

  students.splice(studentIndex, 1);

  res.json({
    message: "Student deleted successfully",
    student: deletedStudent,
  });
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});