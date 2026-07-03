import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { resetPassword } from "../services/authServices";
import { Lock } from "lucide-react";

function ResetPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(localStorage.getItem("resetEmail") || "");
  const [password, setPassword] = useState("");

  // FIX: this used to hit a hardcoded "http://localhost:5000/api/auth" via
  // a raw fetch(), so resetting a password was broken on the deployed site.
  // Now goes through authServices.js (localhost in dev, Render in prod),
  // and sends the OTP stashed by VerifyOtp.jsx since the backend now
  // requires it here too.
  const handleResetPassword = async () => {
    try {
      const otp = localStorage.getItem("resetOtp") || "";

      const response = await resetPassword(email, password, otp);

      toast.success(response.data.message || "Password reset successful");

      localStorage.removeItem("resetEmail");
      localStorage.removeItem("resetOtp");

      navigate("/login");
    } catch (error) {
      console.log(error);
      toast.error(error.response?.data?.message || "Failed to reset password");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-icon-wrap">
          <Lock size={20} />
        </div>
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
