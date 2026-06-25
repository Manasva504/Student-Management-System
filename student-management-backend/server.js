const dotenv = require("dotenv");

dotenv.config();

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const authMiddleware = require("./middleware/authMiddleware");

const multer = require("multer");
const path = require("path");

const app = express();

connectDB();

// Middlewares
app.use(cors());
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use("/api/auth", authRoutes);
<<<<<<< HEAD
const path = require("path");
=======
>>>>>>> 8d9dac8a50c62c9597611bc57da9ccac2eb39640

const storage = multer.diskStorage({
  destination: "./uploads",

  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
});

app.use("/uploads", express.static("uploads"));

app.post("/upload", authMiddleware, upload.single("profilePic"), (req, res) => {
  res.json({
    imageUrl: `/uploads/${req.file.filename}`,
  });
});

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

app.get("/students/:id", authMiddleware, (req, res) => {
  const id = Number(req.params.id);

  const student = students.find((student) => student.id === id);

  if (!student) {
    return res.status(404).json({
      message: "Student not found",
    });
  }

  res.json(student);
});

app.post("/students", authMiddleware, (req, res) => {
  const { id, name, email, course, age, cgpa, profilePic } = req.body;

  if (!id || !name || !course || cgpa === undefined) {
    return res.status(400).json({
      message: "All fields are required",
    });
  }

  const newStudent = {
    id,
    name,
    email,
    course,
    age,
    cgpa,
    profilePic,
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

  const studentIndex = students.findIndex((student) => student.id === id);

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

  const studentIndex = students.findIndex((student) => student.id === id);

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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.get("/dashboard/stats", authMiddleware, (req, res) => {
  const totalStudents = students.length;

  const studentsPerBranch = {};

  students.forEach((student) => {
    const branch = student.course;

    studentsPerBranch[branch] = (studentsPerBranch[branch] || 0) + 1;
  });

  const averageCGPA =
    students.reduce((sum, student) => sum + student.cgpa, 0) / totalStudents;

  const highestCGPAStudent = students.reduce((highest, student) =>
    student.cgpa > highest.cgpa ? student : highest,
  );

  res.json({
    totalStudents,
    studentsPerBranch,
    averageCGPA: averageCGPA.toFixed(2),
    highestCGPAStudent,
  });
});
