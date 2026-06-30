import "../App.css";
import { useContext } from "react";
import { StudentContext } from "../context/StudentContext";
import { Link } from "react-router-dom";
import { deleteStudent as deleteStudentAPI } from "../services/studentService";
import toast from "react-hot-toast";

function StudentCard({ student }) {
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
      toast.success("Failed to delete student");
    }
  }
  console.log(student.profilePic);
  return (
    <div className="student-card">
      {student.profilePic && (
        <img
          src={
            student.profilePic
              ? `https://student-management-system-zk2b.onrender.com${student.profilePic}`
              : "/default-avatar.png"
          }
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
