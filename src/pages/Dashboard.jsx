import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDashboardStats } from "../services/studentService";
import "../App.css";

function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const response = await getDashboardStats();
      setStats(response.data);
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
    }
  }

  if (!stats) {
    return <h2>Loading...</h2>;
  }

  return (
    <div className="dashboard-card">
      <h1>Dashboard Analytics</h1>

      <h2>Total Students: {stats.totalStudents}</h2>

      <h2>Average CGPA: {stats.averageCGPA}</h2>

      <h2>Highest CGPA Student: {stats.highestCGPAStudent.name}</h2>

      <h3>Students Per Branch:</h3>

      {Object.entries(stats.studentsPerBranch).map(([branch, count]) => (
        <p key={branch}>
          {branch}: {count}
        </p>
      ))}

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
