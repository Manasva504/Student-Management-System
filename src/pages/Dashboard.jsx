import students from "../data/students";
import { Link } from "react-router-dom";

function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>

      <p>Welcome back, Admin!</p>

      <h2>Total Students: {students.length}</h2>

      <div>
        <Link to="/add-student">
          <button>Add Student</button>
        </Link>

        <Link to="/students">
          <button>View Students</button>
        </Link>
      </div>
    </div>
  );
}

export default Dashboard;
