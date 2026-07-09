import { useContext, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import {
  fetchDashboardStats,
  fetchBranchChart,
  fetchRegistrationTrend,
} from "../redux/dashboardSlice";
import "../App.css";
import { SocketContext } from "../context/SocketContext";
import ActivityFeed from "../components/ActivityFeed";
import { Users, TrendingUp, Award } from "lucide-react";
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
  const user = useSelector((state) => state.auth.user);
  const { socket } = useContext(SocketContext);
  const dispatch = useDispatch();
  const { stats, branchChart, trend, error } = useSelector(
    (state) => state.dashboard,
  );

  useEffect(() => {
    dispatch(fetchDashboardStats());
    dispatch(fetchBranchChart());
    dispatch(fetchRegistrationTrend());
  }, [dispatch]);

  // Live updates: re-run the same fetches on any student mutation, from
  // any connected client, so the stat chips and charts update without a
  // page refresh.
  useEffect(() => {
    if (!socket) return;

    function refresh() {
      dispatch(fetchDashboardStats());
      dispatch(fetchBranchChart());
      dispatch(fetchRegistrationTrend());
    }

    socket.on("student:added", refresh);
    socket.on("student:updated", refresh);
    socket.on("student:deleted", refresh);

    return () => {
      socket.off("student:added", refresh);
      socket.off("student:updated", refresh);
      socket.off("student:deleted", refresh);
    };
  }, [socket, dispatch]);

  if (error) {
    return (
      <div className="dashboard-card">
        <h1>Dashboard Analytics</h1>
        <p>
          Could not load stats. The server may be starting up — try refreshing
          in a moment.
        </p>
        <div className="dashboard-buttons">
          <button
            onClick={() => dispatch(fetchDashboardStats())}
            className="primary-btn"
          >
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

        <h2>
          <Users size={16} /> Total Students: {stats.totalStudents}
        </h2>

        <h2>
          <TrendingUp size={16} /> Average CGPA:{" "}
          {stats.totalStudents > 0 ? stats.averageCGPA : "N/A"}
        </h2>

        {/* FIX: highestCGPAStudent is null when there are no students */}
        <h2>
          <Award size={16} /> Highest CGPA Student:{" "}
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

      {user?.role === "Admin" && <ActivityFeed />}
    </>
  );
}

export default Dashboard;
