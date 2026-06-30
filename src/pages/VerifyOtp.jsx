import { useState } from "react";
import { useNavigate } from "react-router-dom";

function VerifyOtp() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(localStorage.getItem("resetEmail") || "");
  const [otp, setOtp] = useState("");

  const handleVerifyOtp = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/verify-otp",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, otp }),
        },
      );

      const data = await response.json();

      alert(data.message);

      navigate("/reset-password");
    } catch (error) {
      alert("Something went wrong");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Verify OTP</h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleVerifyOtp();
          }}
        >
          <input
            type="text"
            placeholder="Enter OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />

          <button type="submit">Verify OTP</button>
        </form>
      </div>
    </div>
  );
}

export default VerifyOtp;
