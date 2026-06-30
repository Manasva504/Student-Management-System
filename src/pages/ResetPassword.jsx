import { useState } from "react";
import { useNavigate } from "react-router-dom";

function ResetPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(localStorage.getItem("resetEmail") || "");
  const [password, setPassword] = useState("");

  const handleResetPassword = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/reset-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        },
      );

      const data = await response.json();

      alert(data.message);

      localStorage.removeItem("resetEmail");

      navigate("/login");
    } catch (error) {
      alert("Something went wrong");
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

  <button type="submit">
    Reset Password
  </button>
</form>
      </div>
    </div>
  );
}

export default ResetPassword;
