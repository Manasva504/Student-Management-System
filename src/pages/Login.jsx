import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { loginUser } from "../services/authServices";
import toast from "react-hot-toast";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin(e) {
    e.preventDefault();

    try {
      const response = await loginUser({
        email,
        password,
      });

      // Save token in localStorage
      localStorage.setItem("token", response.data.token);

      toast.success("Login Successful");

      navigate("/");
    } catch (error) {
      console.log(error);

      toast.error(error.response?.data?.message || "Login Failed");
    }
  }

  return (
    <div className="form-page">
      <h1>Login</h1>

      <form className="form-card" onSubmit={handleLogin}>
        <label>Email</label>
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label>Password</label>
        <input
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button type="submit" className="primary-btn">
          Login
        </button>

        <p>
          Don't have an account? <Link to="/register">Register</Link>
        </p>
        <p>
          <Link to="/forgot-password">Forgot Password?</Link>
        </p>
      </form>
    </div>
  );
}

export default Login;
