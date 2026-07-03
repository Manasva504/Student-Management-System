import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getStudentById } from "../services/studentService";
import "../App.css";

// FIX: was hardcoded to localhost, so profile pictures 404'd in production.
const BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:5000"
    : "https://student-management-system-zk2b.onrender.com";

function StudentDetails() {
  const { id } = useParams();
  const [student, setStudent] = useState(null);

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
      </div>
    </div>
  );
}

export default StudentDetails;
