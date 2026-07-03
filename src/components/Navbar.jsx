import { Link, useNavigate } from "react-router-dom";
import "../App.css";
import toast from "react-hot-toast";
import { logoutUser } from "../services/authServices";

function Navbar() {
  const token = localStorage.getItem("token");
  const user = token ? JSON.parse(atob(token.split(".")[1])) : null;

  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logoutUser(); // records the Logout audit entry server-side
    } catch (error) {
      // FIX: this call used to be un-caught. If it failed (cold start,
      // network blip, or previously the missing /logout route entirely),
      // the function threw before ever clearing the token or navigating —
      // the user stayed stuck in a logged-in-looking state with no way out.
      // The client-side logout (below) is what actually matters for the
      // user, so it now always happens regardless of the API call's result.
      console.log(error);
    }

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

          {user?.role === "Admin" && (
            <li>
              <Link to="/activity-history">Activity History</Link>
            </li>
          )}

          <li>
            <Link to="/profile">Profile</Link>
          </li>

          <li>
            <Link to="/change-password">Change Password</Link>
          </li>

          <li>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export default Navbar;
