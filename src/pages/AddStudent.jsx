import { StudentContext } from "../context/StudentContext";
import "../App.css";
import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";

function AddStudent() {
  const navigate = useNavigate();
  const { students, setStudents } = useContext(StudentContext);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [course, setCourse] = useState("");
  const [age, setAge] = useState("");

  function handleSubmit() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!name || !email || !course || !age) {
      alert("Please fill all fields");
      return;
    }

    if (!emailRegex.test(email)) {
      alert("Please enter a valid email address");
      return;
    }

    const newStudent = {
      id: Date.now(),
      name,
      email,
      course,
      age: Number(age),
    };

    setStudents([...students, newStudent]);

    alert("Student Added Successfully");

    setName("");
    setEmail("");
    setCourse("");
    setAge("");
    navigate("/students");
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

        <button type="submit" className="primary-btn">
          Add Student
        </button>
      </form>
    </div>
  );
}

export default AddStudent;
