import { useState } from "react";
import { forgotPassword } from "../services/authServices";
import { useNavigate } from "react-router-dom";
import "../App.css";
import toast from "react-hot-toast";

function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  const handleSendOtp = async () => {
    console.log("Button clicked");

    try {
      console.log("Sending email:", email);

      const response = await forgotPassword(email);


      toast.success(response.data.message);

      localStorage.setItem("resetEmail", email);

      navigate("/verify-otp");
    } catch (error) {
      console.log(error);

      toast.error(error.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Forgot Password</h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendOtp();
          }}
        >
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button type="submit">Send OTP</button>
        </form>
      </div>
    </div>
  );
}

export default ForgotPassword;
