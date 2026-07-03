import { Link, useNavigate } from "react-router-dom";
import "../App.css";
import toast from "react-hot-toast";
import { logoutUser } from "../services/authServices";
import {
  LayoutDashboard,
  UserPlus,
  Users,
  GitBranch,
  History,
  User,
  KeyRound,
  LogOut,
} from "lucide-react";

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
            <Link to="/">
              <LayoutDashboard size={16} /> Dashboard
            </Link>
          </li>

          {user?.role === "Admin" && (
            <li>
              <Link to="/add-student">
                <UserPlus size={16} /> Add Student
              </Link>
            </li>
          )}

          <li>
            <Link to="/students">
              <Users size={16} /> Student List
            </Link>
          </li>

          {user?.role === "Admin" && (
            <li>
              <Link to="/manage-branches">
                <GitBranch size={16} /> Manage Branches
              </Link>
            </li>
          )}

          {user?.role === "Admin" && (
            <li>
              <Link to="/activity-history">
                <History size={16} /> Activity History
              </Link>
            </li>
          )}

          <li>
            <Link to="/profile">
              <User size={16} /> Profile
            </Link>
          </li>

          <li>
            <Link to="/change-password">
              <KeyRound size={16} /> Change Password
            </Link>
          </li>

          <li>
            <button onClick={handleLogout} className="logout-btn">
              <LogOut size={16} /> Logout
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export default Navbar;
