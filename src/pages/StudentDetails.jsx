import { useParams } from "react-router-dom";
import students from "../data/students";
import "../App.css";

function StudentDetails() {
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
      </div>
    </div>
  );
}

export default StudentDetails;
