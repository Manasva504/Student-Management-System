import { useContext } from "react";
import { StudentContext } from "../context/StudentContext";
import StudentCard from "../components/StudentCard";
import "../App.css";

function StudentList() {
  const { students } = useContext(StudentContext);
  return (
    <div className="student-list-container">
      <h1>Student List</h1>
      <div className="student-grid">
        {students.map((student) => (
          <StudentCard key={student.id} student={student} />
        ))}
      </div>
    </div>
  );
}

export default StudentList;
