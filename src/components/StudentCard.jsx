import "../App.css";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { deleteStudentThunk, fetchStudents } from "../redux/studentSlice";
import toast from "react-hot-toast";
import { confirmDelete } from "../utils/confirm";
import { Pencil, Trash2, Eye } from "lucide-react";

// FIX: profile picture URLs were hardcoded to localhost, so they'd 404 in
// production (Vercel frontend, Render backend). Same fix applied in
// EditStudent.jsx and StudentDetails.jsx.
const BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:5000"
    : "https://student-management-system-zk2b.onrender.com";

function StudentCard({ student }) {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();

  async function deleteStudent() {
    const confirmed = await confirmDelete(student.name);

    if (!confirmed) {
      return;
    }

    try {
      await dispatch(deleteStudentThunk(student.id)).unwrap();

      dispatch(fetchStudents());

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
        <button className="primary-btn">
          <Eye size={16} /> View Details
        </button>
      </Link>
      {user?.role === "Admin" && (
        <>
          <Link to={`/edit-student/${student.id}`}>
            <button className="primary-btn">
              <Pencil size={16} /> Edit
            </button>
          </Link>
          <button className="delete-btn" onClick={deleteStudent}>
            <Trash2 size={16} /> Delete
          </button>
        </>
      )}
    </div>
  );
}

export default StudentCard;
