import { useContext } from "react";
import { StudentContext } from "../context/StudentContext";
import { Link } from "react-router-dom";
import "../App.css";

function Dashboard() {
  const { students } = useContext(StudentContext);

  return (
    <div className="dashboard-card">
      <h1>Dashboard</h1>

      <p>Welcome back, Admin!</p>

      <h2>Total Students: {students.length}</h2>

      <div className="dashboard-buttons">
        <Link to="/add-student">
          <button className="primary-btn">Add Student</button>
        </Link>

        <Link to="/students">
          <button className="primary-btn">View Students</button>
        </Link>
      </div>
    </div>
  );
}

export default Dashboard;