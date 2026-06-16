import students from "../data/students";
import StudentCard from "../components/StudentCard";

function StudentList() {
  return (
    <div>
      <h1>Student List</h1>

      {students.map((student) => (
        <StudentCard
          key={student.id}
          student={student}
        />
      ))}
    </div>
  );
}

export default StudentList;