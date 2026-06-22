import { addStudent } from "../services/studentService";
import { StudentContext } from "../context/StudentContext";
import "../App.css";
import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";

function AddStudent() {
  const navigate = useNavigate();
  const { fetchStudents } = useContext(StudentContext);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [course, setCourse] = useState("");
  const [age, setAge] = useState("");
  const [cgpa, setCgpa] = useState("");

  async function handleSubmit() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!name.trim() || !email.trim() || !course.trim() || !age || !cgpa) {
      alert("Please fill all fields");
      return;
    }

    if (!emailRegex.test(email)) {
      alert("Please enter a valid email address");
      return;
    }
    if (cgpa < 0 || cgpa > 10) {
      alert("CGPA must be between 0 and 10");
      return;
    }

    const newStudent = {
      id: Date.now(),
      name,
      email,
      course,
      age: Number(age),
      cgpa: Number(cgpa),
    };

    try {
      await addStudent(newStudent);

      await fetchStudents();

      alert("Student Added Successfully");

      setName("");
      setEmail("");
      setCourse("");
      setAge("");
      setCgpa("");

      navigate("/students");
    } catch (error) {
      console.log(error);
      alert("Failed to add student");
    }
  }

  return (
    <div className="form-page">
      <h1>Add Student</h1>

      <form
        className="form-card"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <label>Name</label>
        <input
          type="text"
          placeholder="Enter student name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label>Course</label>
        <input
          type="text"
          placeholder="Enter course"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
        />

        <label>Age</label>
        <input
          type="number"
          placeholder="Enter age"
          value={age}
          onChange={(e) => setAge(e.target.value)}
        />
        <label>Cgpa</label>
        <input
          type="text"
          placeholder="Enter CGPA"
          value={cgpa}
          onChange={(e) => {
            const value = e.target.value;

            if (/^\d*\.?\d*$/.test(value)) {
              if (value === "" || (Number(value) >= 0 && Number(value) <= 10)) {
                setCgpa(value);
              }
            }
          }}
        />

        <button type="submit" className="primary-btn">
          Add Student
        </button>
      </form>
    </div>
  );
}

export default AddStudent;
