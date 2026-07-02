import { Link, useNavigate } from "react-router-dom";
import "../App.css";
import toast from "react-hot-toast";

function Navbar() {
  const token = localStorage.getItem("token");
  const user = token ? JSON.parse(atob(token.split(".")[1])) : null;

  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem("token");

    toast.success("Logged out successfully");

    navigate("/login");
  }

  return (
    <div className="navibar">
      <nav>
        <h2>Student Management System</h2>

        <ul>
          <li>
            <Link to="/">Dashboard</Link>
          </li>

          {user?.role === "Admin" && (
            <li>
              <Link to="/add-student">Add Student</Link>
            </li>
          )}

          <li>
            <Link to="/students">Student List</Link>
          </li>

          {user?.role === "Admin" && (
            <li>
              <Link to="/manage-branches">Manage Branches</Link>
            </li>
          )}

          <li>
            <Link to="/profile">Profile</Link>
          </li>

          <li>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </li>
          <li>
            <Link to="/change-password">Change Password</Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export default Navbar;
