import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { verifyOtp } from "../services/authServices";
import toast from "react-hot-toast";
import "../App.css";

function VerifyOtp() {
  const navigate = useNavigate();
  const [email] = useState(localStorage.getItem("resetEmail") || "");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      toast.error("Please enter the OTP");
      return;
    }

    try {
      setLoading(true);
      const response = await verifyOtp(email, otp);
      toast.success(response.data.message || "OTP verified successfully");
      navigate("/reset-password");
    } catch (error) {
      console.log(error);
      toast.error(error.response?.data?.message || "Invalid or expired OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card auth-card--enhanced">
        {/* Icon */}
        <div className="auth-icon-wrap">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>

        <h2>Enter OTP</h2>
        <p className="auth-subtitle">
          We sent a 6-digit code to<br />
          <strong>{email}</strong>
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleVerifyOtp();
          }}
        >
          <div className="auth-input-group">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="otp-input"
              autoFocus
            />
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? (
              <span className="auth-btn-loader">
                <span className="auth-spinner" />
                Verifying…
              </span>
            ) : (
              "Verify OTP"
            )}
          </button>
        </form>

        <p className="auth-back-link">
          Wrong email?{" "}
          <a href="/forgot-password">Go back</a>
        </p>
      </div>
    </div>
  );
}

export default VerifyOtp;
