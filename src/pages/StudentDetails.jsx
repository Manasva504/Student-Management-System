import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getStudentById, sendStudentNotification } from "../services/studentService";
import "../App.css";
import toast from "react-hot-toast";

// FIX: was hardcoded to localhost, so profile pictures 404'd in production.
const BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:5000"
    : "https://student-management-system-zk2b.onrender.com";

function StudentDetails() {
  const { id } = useParams();
  const [student, setStudent] = useState(null);

  const token = localStorage.getItem("token");
  const user = token ? JSON.parse(atob(token.split(".")[1])) : null;

  useEffect(() => {
    fetchStudent();
  }, []);

  const fetchStudent = async () => {
    try {
      const response = await getStudentById(id);
      setStudent(response.data);
    } catch (error) {
      console.log(error);
    }
  };

  const handleSendEmail = async () => {
    try {
      await sendStudentNotification(id);
      toast.success("Notification email sent");
    } catch (error) {
      console.log(error);
      toast.error(
        error.response?.data?.message || "Failed to send notification email",
      );
    }
  };

  if (!student) {
    return (
      <div className="student-details-page">
        <h1>Student Details</h1>
        <div className="student-details-card">
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="student-details-page">
      <h1>Student Details</h1>

      <div className="student-details-card">
        <h2>{student.name}</h2>

        {student.profilePic && (
          <img
            src={`${BASE_URL}${student.profilePic}`}
            alt={student.name}
            className="profile-image"
          />
        )}

        <p>
          <strong>Email: </strong>
          {student.email}
        </p>

        <p>
          <strong>Course: </strong>
          {student.course}
        </p>

        <p>
          <strong>Age: </strong>
          {student.age}
        </p>

        <p>
          <strong>CGPA: </strong>
          {student.cgpa}
        </p>

        {user?.role === "Admin" && (
          <button className="primary-btn" onClick={handleSendEmail}>
            Send Email
          </button>
        )}
      </div>
    </div>
  );
}

export default StudentDetails;
