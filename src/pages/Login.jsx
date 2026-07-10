import { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { loginThunk } from "../redux/authSlice";
import toast from "react-hot-toast";
import LampToggle from "../components/LampToggle";
import "../App.css";

function Login() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [isOn, setIsOn] = useState(false);
  const [swingKey, setSwingKey] = useState(0);

  function toggleLamp() {
    setIsOn((prev) => !prev);
    setSwingKey((prev) => prev + 1);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);

    try {
      await dispatch(loginThunk({ email, password })).unwrap();

      toast.success("Login Successful");

      navigate("/");
    } catch (error) {
      console.log(error);

      // .unwrap() throws the rejectWithValue payload directly here
      // (authSlice.js) — already the shape { message } from the backend,
      // not a raw axios error with .response anymore.
      toast.error(error?.message || "Login Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lamp-login-page">
      <LampToggle isOn={isOn} onToggle={toggleLamp} swingKey={swingKey} />

      <div className={`lamp-light-cone ${isOn ? "is-on" : ""}`} />

      <p className="lamp-hint">
        {isOn ? "Pull the cord to hide the form" : "Pull the cord to sign in"}
      </p>

      <AnimatePresence>
        {isOn && (
          <motion.form
            className="auth-card auth-card--enhanced lamp-form-card"
            onSubmit={handleLogin}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
          >
            <h2>Welcome Back</h2>
            <p className="auth-subtitle">Sign in to manage your students</p>

            <div className="auth-input-group">
              <span className="auth-input-icon">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 6.75A2.25 2.25 0 0 1 5.25 4.5h13.5A2.25 2.25 0 0 1 21 6.75v10.5A2.25 2.25 0 0 1 18.75 19.5H5.25A2.25 2.25 0 0 1 3 17.25V6.75Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m3.5 6 8.5 6 8.5-6"
                  />
                </svg>
              </span>
              <label htmlFor="login-email" className="sr-only">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="auth-input-group auth-input-group--icon">
              <span className="auth-input-icon">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 10.5V7.5a4.5 4.5 0 1 0-9 0v3M6 10.5h12A1.5 1.5 0 0 1 19.5 12v6a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18v-6A1.5 1.5 0 0 1 6 10.5Z"
                  />
                </svg>
              </span>
              <label htmlFor="login-password" className="sr-only">
                Password
              </label>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="auth-eye-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.98 8.22A10.5 10.5 0 0 0 2.25 12S5.25 18 12 18s9.75-6 9.75-6-.6-1.06-1.73-2.28M9.9 9.9a3 3 0 1 0 4.24 4.24M6.6 6.6 3 3m3.6 3.6L9.9 9.9m4.24 4.24L18 18m-3.86-3.86L21 21"
                    />
                  </svg>
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 12S5.25 18 12 18s9.75-6 9.75-6-3-6-9.75-6-9.75 6-9.75 6Z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                    />
                  </svg>
                )}
              </button>
            </div>

            <div className="forgot-password-link">
              <Link to="/forgot-password">Forgot Password?</Link>
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <span className="auth-btn-loader">
                  <span className="auth-spinner" />
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>

            <p>
              Don't have an account? <Link to="/register">Register</Link>
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Login;
