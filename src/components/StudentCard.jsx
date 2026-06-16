import { Link } from "react-router-dom";

function StudentCard({ student }) {
  return (
    <div className="student-card">
      <h3>{student.name}</h3>

      <p>Email: {student.email}</p>

      <p>Course: {student.course}</p>

      <Link to={`/students/${student.id}`}>
        <button>View Details</button>
      </Link>
    </div>
  );
}

export default StudentCard;