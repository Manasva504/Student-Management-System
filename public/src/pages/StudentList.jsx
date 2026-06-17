import students from "../data/students";
import StudentCard from "../components/StudentCard";
import "../App.css";

function StudentList() {
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
