import { useParams } from "react-router-dom";
import students from "../data/students";

function StudentDetails() {
  const { id } = useParams();

  const student = students.find(
    (student) => student.id === Number(id)
  );

  if (!student) {
    return <h2>Student not found.</h2>;
  }

  return (
    <div>
      <h1>Student Details</h1>

      <h2>{student.name}</h2>

      <p>Email: {student.email}</p>

      <p>Course: {student.course}</p>

      <p>Age: {student.age}</p>
    </div>
  );
}

export default StudentDetails;