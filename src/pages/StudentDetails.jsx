import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import { getStudentById, sendStudentNotification } from "../services/studentService";
import "../App.css";
import toast from "react-hot-toast";
import { getThumbnailUrl } from "../utils/cloudinaryImage";

function StudentDetails() {
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const user = useSelector((state) => state.auth.user);

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
            src={getThumbnailUrl(student.profilePic)}
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
