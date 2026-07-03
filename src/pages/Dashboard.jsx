import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getDashboardStats,
  getBranchChart,
  getRegistrationTrend,
} from "../services/studentService";
import "../App.css";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function Dashboard() {
  const token = localStorage.getItem("token");

  const user = token ? JSON.parse(atob(token.split(".")[1])) : null;
  const [stats, setStats] = useState(null);
  const [branchChart, setBranchChart] = useState([]);
  const [trend, setTrend] = useState([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchCharts();
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

  async function fetchCharts() {
    try {
      const [branchRes, trendRes] = await Promise.all([
        getBranchChart(),
        getRegistrationTrend(),
      ]);

      setBranchChart(branchRes.data.data || []);
      setTrend(trendRes.data.data || []);
    } catch (error) {
      // Charts are a bonus on top of the core stats above, so a failure
      // here just means the chart sections stay hidden — it shouldn't
      // block the rest of the dashboard from rendering.
      console.error("Failed to fetch chart data:", error);
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
    <>
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

      {branchChart.length > 0 && (
        <div className="dashboard-card chart-card">
          <h1>Students per Branch</h1>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={branchChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="branch" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="totalStudents" fill="#6366f1" name="Students" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {branchChart.length > 0 && (
        <div className="dashboard-card chart-card">
          <h1>Average CGPA by Branch</h1>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={branchChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="branch" />
              <YAxis domain={[0, 10]} />
              <Tooltip />
              <Bar dataKey="avgCgpa" fill="#06b6d4" name="Avg CGPA" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {trend.length > 0 && (
        <div className="dashboard-card chart-card">
          <h1>Student Registration Trend</h1>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#8b5cf6"
                name="New Students"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}

export default Dashboard;
