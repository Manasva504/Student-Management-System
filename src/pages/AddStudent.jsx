import { useState } from "react";
import "../App.css";

function AddStudent() {
  const [email, setEmail] = useState("");

  function handleSubmit() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      alert("Please enter a valid email address");
      return;
    }

    alert("Student Added Successfully");
  }

  return (
    <div className="form-page">
      <h1>Add Student</h1>

      <div className="form-card">
        <label>Name</label>
        <input type="text" placeholder="Enter student name" />

        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label>Course</label>
        <input type="text" placeholder="Enter course" />

        <label>Age</label>
        <input type="number" placeholder="Enter age" />

        <button className="primary-btn" onClick={handleSubmit}>
          Add Student
        </button>
      </div>
    </div>
  );
}

export default AddStudent;
