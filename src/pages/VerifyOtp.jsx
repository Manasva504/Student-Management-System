import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { verifyOtp } from "../services/authServices";
import { ShieldCheck } from "lucide-react";

function VerifyOtp() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(localStorage.getItem("resetEmail") || "");
  const [otp, setOtp] = useState("");

  // FIX: this used to hit a hardcoded "http://localhost:5000/api/auth" via
  // a raw fetch(), so OTP verification was broken on the deployed site no
  // matter what. Now goes through authServices.js, which already knows how
  // to pick localhost vs. Render.
  const handleVerifyOtp = async () => {
    try {
      const response = await verifyOtp(email, otp);

      toast.success(response.data.message || "OTP verified successfully");

      // Reset-password now re-validates this OTP server-side too, so it
      // needs to travel along with us to that page.
      localStorage.setItem("resetOtp", otp);

      navigate("/reset-password");
    } catch (error) {
      toast.error(error.response?.data?.message || "Invalid OTP");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-icon-wrap">
          <ShieldCheck size={20} />
        </div>
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
  