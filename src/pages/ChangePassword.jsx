import { useState, useEffect } from "react";
import { changePassword } from "../services/authServices";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

function ChangePassword() {
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");

  async function handleChangePassword(e) {
    e.preventDefault();

    if (error) {
      toast.error(error);
      return;
    }

    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill all fields.");
      return;
    }

    try {
      await changePassword(oldPassword, newPassword);

      toast.success("Password changed successfully. Please login again.");

      localStorage.removeItem("token");

      setTimeout(() => {
        navigate("/login");
      }, 1500);

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");
    } catch (error) {
      setOldPassword("");
      toast.error(error.response?.data?.message || "Failed to change password");
    }
  }

  useEffect(() => {
    if (!newPassword && !confirmPassword) {
      setError("");
      return;
    }

    if (!newPassword) {
      setError("");
    } else if (newPassword === oldPassword) {
      setError("New password cannot be the same as current password.");
    } else if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
    } else if (confirmPassword && newPassword !== confirmPassword) {
      setError("Passwords do not match.");
    } else {
      setError("");
    }
  }, [oldPassword, newPassword, confirmPassword]);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Change Password</h2>

        <form onSubmit={handleChangePassword}>
          <input
            type="password"
            placeholder="Current Password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />

          <input
            type="password"
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <input
            type="password"
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {error && <p className="error-text">{error}</p>}
          <button
            type="submit"
            disabled={
              !!error || !oldPassword || !newPassword || !confirmPassword
            }
          >
            Change Password
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChangePassword;
