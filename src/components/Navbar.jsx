import { useContext } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import "../App.css";
import toast from "react-hot-toast";
import { logoutThunk } from "../redux/authSlice";
import { SocketContext } from "../context/SocketContext";
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
  const user = useSelector((state) => state.auth.user);
  const { onlineCount } = useContext(SocketContext);
  const dispatch = useDispatch();

  const navigate = useNavigate();

  async function handleLogout() {
    // FIX (preserved): logoutThunk itself never rejects — it swallows its
    // own API-call failure (cold start, network blip) so state/localStorage
    // always get cleared client-side. dispatch(...) below is unconditional,
    // never wrapped in try/catch, on purpose.
    await dispatch(logoutThunk());

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
            <span className="online-indicator">
              <span className="dot" /> {onlineCount} online
            </span>
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
