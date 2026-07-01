import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

function ResetPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(localStorage.getItem("resetEmail") || "");
  const [password, setPassword] = useState("");
  const API_URL =
    "https://student-management-system-zk2b.onrender.com/api/auth";

  const handleResetPassword = async () => {
    try {
      const response = await fetch(`${API_URL}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      console.log("Status:", response.status);
      console.log("Response:", data);

      if (!response.ok) {
        alert(data.message);
        return;
      }

      if (response.ok) {
        toast.success(data.message || "Password reset successful");

        localStorage.removeItem("resetEmail");

        navigate("/login");
      } else {
        toast.error(data.message || "Failed to reset password");
      }

      navigate("/login");
    } catch (error) {
      console.log(error);
      toast.error("Something went wrong");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Reset Password</h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleResetPassword();
          }}
        >
          <input
            type="password"
            placeholder="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit">Reset Password</button>
        </form>
      </div>
    </div>
  );
}

export default ResetPassword;
