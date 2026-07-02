import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDashboardStats } from "../services/studentService";
import "../App.css";

function Dashboard() {
  const token = localStorage.getItem("token");

  const user = token ? JSON.parse(atob(token.split(".")[1])) : null;
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const response = await getDashboardStats();
      setStats(response.data);
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
      setError(true);
    }
  }

  if (error) {
    return (
      <div className="dashboard-card">
        <h1>Dashboard Analytics</h1>
        <p>
          Could not load stats. The server may be starting up — try refreshing
          in a moment.
        </p>
        <div className="dashboard-buttons">
          <button onClick={fetchStats} className="primary-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="dashboard-card">
        <h2>Loading...</h2>
      </div>
    );
  }

  return (
    <div className="dashboard-card">
      <h1>Dashboard Analytics</h1>

      <h2>Total Students: {stats.totalStudents}</h2>

      <h2>
        Average CGPA: {stats.totalStudents > 0 ? stats.averageCGPA : "N/A"}
      </h2>

      {/* FIX: highestCGPAStudent is null when there are no students */}
      <h2>
        Highest CGPA Student:{" "}
        {stats.highestCGPAStudent ? stats.highestCGPAStudent.name : "N/A"}
      </h2>

      <h3>Students Per Branch:</h3>

      {Object.keys(stats.studentsPerBranch).length === 0 ? (
        <p>No students added yet.</p>
      ) : (
        Object.entries(stats.studentsPerBranch).map(([branch, count]) => (
          <p key={branch}>
            {branch}: {count}
          </p>
        ))
      )}

      <div className="dashboard-buttons">
        {user?.role === "Admin" && (
          <Link to="/add-student">
            <button className="primary-btn">Add Student</button>
          </Link>
        )}
        <Link to="/students">
          <button className="primary-btn">View Students</button>
        </Link>
      </div>
    </div>
  );
}

export default Dashboard;
