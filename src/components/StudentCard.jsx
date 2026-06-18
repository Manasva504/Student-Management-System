import "../App.css";
import { useContext } from "react";
import { StudentContext } from "../context/StudentContext";
import { Link } from "react-router-dom";

function StudentCard({ student }) {
  const { students, setStudents } = useContext(StudentContext);
  function deleteStudent() {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${student.name}?`,
    );

    if (!confirmDelete) {
      return;
    }

    const updatedStudents = students.filter((s) => s.id !== student.id);

    setStudents(updatedStudents);

    alert("Student Deleted Successfully");
  }
  return (
    <div className="student-card">
      <h3>{student.name}</h3>

      <p>Email: {student.email}</p>

      <p>Course: {student.course}</p>

      <p>Cgpa: {student.cgpa}</p>

      <Link to={`/students/${student.id}`}>
        <button className="primary-btn">View Details</button>
      </Link>
      <button className="delete-btn" onClick={deleteStudent}>
        Delete
      </button>
      <Link to={`/edit-student/${student.id}`}>
        <button className="primary-btn">Edit</button>
      </Link>
    </div>
  );
}

export default StudentCard;
