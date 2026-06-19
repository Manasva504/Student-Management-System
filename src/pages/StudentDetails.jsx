import { useContext } from "react";
import { StudentContext } from "../context/StudentContext";
import { useParams } from "react-router-dom";
import "../App.css";

function StudentDetails() {
  const { students } = useContext(StudentContext);
  const { id } = useParams();

  const student = students.find((student) => student.id === Number(id));

  if (!student) {
    return <h2>Student not found.</h2>;
  }

  return (
    <div className="student-details-page">
      <h1>Student Details</h1>
      <div className="student-details-card">
        <h2>{student.name}</h2>

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
          <strong>Cgpa: </strong>
          {student.cgpa}
        </p>
      </div>
    </div>
  );
}

export default StudentDetails;
