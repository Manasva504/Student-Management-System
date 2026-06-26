import { useContext } from "react";
import { StudentContext } from "../context/StudentContext";
import { useParams } from "react-router-dom";
import "../App.css";

function StudentDetails() {
  const { students } = useContext(StudentContext);
  const { id } = useParams();

  // FIX: MongoDB _id is a string, Number(id) would return NaN and always fail
  const student = students.find((s) => String(s.id) === String(id));

  if (!student) {
    return (
      <div className="student-details-page">
        <h1>Student Details</h1>
        <div className="student-details-card">
          <h2>Student not found.</h2>
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
            src={`https://student-management-system-zk2b.onrender.com${student.profilePic}`}
            alt={student.name}
            className="profile-image"
          />
        )}

        <p><strong>Email: </strong>{student.email}</p>
        <p><strong>Course: </strong>{student.course}</p>
        <p><strong>Age: </strong>{student.age}</p>
        <p><strong>CGPA: </strong>{student.cgpa}</p>
      </div>
    </div>
  );
}

export default StudentDetails;
