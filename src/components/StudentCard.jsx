import "../App.css";
import { useContext } from "react";
import { StudentContext } from "../context/StudentContext";
import { Link } from "react-router-dom";
import { deleteStudent as deleteStudentAPI } from "../services/studentService";
import toast from "react-hot-toast";

// FIX: profile picture URLs were hardcoded to localhost, so they'd 404 in
// production (Vercel frontend, Render backend). Same fix applied in
// EditStudent.jsx and StudentDetails.jsx.
const BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:5000"
    : "https://student-management-system-zk2b.onrender.com";

function StudentCard({ student }) {
  const token = localStorage.getItem("token");

  const user = token ? JSON.parse(atob(token.split(".")[1])) : null;
  const { fetchStudents } = useContext(StudentContext);
  async function deleteStudent() {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${student.name}?`,
    );

    if (!confirmDelete) {
      return;
    }

    try {
      await deleteStudentAPI(student.id);

      await fetchStudents();

      toast.success("Student Deleted Successfully");
    } catch (error) {
      console.log(error);
      // FIX: this was toast.success(...) — a failed delete was showing a
      // success toast.
      toast.error("Failed to delete student");
    }
  }
  return (
    <div className="student-card">
      {student.profilePic && (
        <img
          src={
            student.profilePic
              ? `${BASE_URL}${student.profilePic}`
              : "/default-avatar.png"
          }
          className="profile-image"
          alt={student.name}
        />
      )}
      <h3>{student.name}</h3>

      <p>Email: {student.email}</p>

      <p>Course: {student.course}</p>

      <p>Age: {student.age}</p>

      <p>Cgpa: {student.cgpa}</p>

      <Link to={`/students/${student.id}`}>
        <button className="primary-btn">View Details</button>
      </Link>
      {user?.role === "Admin" && (
        <>
          <Link to={`/edit-student/${student.id}`}>
            <button className="primary-btn">Edit</button>
          </Link>
          <button className="delete-btn" onClick={deleteStudent}>
            Delete
          </button>
        </>
      )}
    </div>
  );
}

export default StudentCard;
