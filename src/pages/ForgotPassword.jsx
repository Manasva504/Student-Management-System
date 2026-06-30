import { useState } from "react";
import { forgotPassword } from "../services/authServices";
import { useNavigate, Link } from "react-router-dom";
import "../App.css";
import toast from "react-hot-toast";

function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendOtp = async () => {
    if (!email.trim()) {
      toast.error("Please enter your email address");
      return;
    }

    try {
      setLoading(true);
      const response = await forgotPassword(email);
      toast.success(response.data.message || "OTP sent!");
      localStorage.setItem("resetEmail", email);
      setSent(true);

      // Navigate after short delay so user sees success state
      setTimeout(() => navigate("/verify-otp"), 1200);
    } catch (error) {
      console.log(error);
      toast.error(error.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card auth-card--enhanced">

        {/* Animated icon */}
        <div className={`auth-icon-wrap ${sent ? "auth-icon-wrap--success" : ""}`}>
          {sent ? (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          )}
        </div>

        <h2>{sent ? "Check your email" : "Forgot Password"}</h2>

        <p className="auth-subtitle">
          {sent
            ? `We've sent a 6-digit OTP to ${email}`
            : "Enter your email and we'll send you a one-time password to reset your account."}
        </p>

        {!sent && (
          <form onSubmit={(e) => { e.preventDefault(); handleSendOtp(); }}>
            <div className="auth-input-group">
              <span className="auth-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </span>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? (
                <span className="auth-btn-loader">
                  <span className="auth-spinner" />
                  Sending OTP…
                </span>
              ) : (
                "Send OTP"
              )}
            </button>
          </form>
        )}

        <p className="auth-back-link">
          <Link to="/login">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "4px", verticalAlign: "middle" }}>
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
            Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPassword;
