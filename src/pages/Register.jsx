import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerUser } from "../services/authServices";
import toast from "react-hot-toast";

function Register(){
    const navigate = useNavigate();

    const[name, setName]=useState("");
    const[email, setEmail]=useState("");
    const[password, setPassword]=useState("");

    async function handleRegister(e){
        e.preventDefault();

        try{
            await registerUser({
                name,
                email,
                password,
            })

            toast.success("Registration Successful");

            setName("");
            setEmail("");
            setPassword("");

            navigate("/login");
        }catch(error){
            console.log(error);

            toast.error(
                error.response?.data?.message ||"Registration Failed"
            );
        }
    }
    
 return (
    <div className="form-page">
      <h1>Register</h1>

      <form className="form-card" onSubmit={handleRegister}>
        <label>Name</label>
        <input
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

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
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button type="submit" className="primary-btn">
          Register
        </button>
      </form>
    </div>
  );
}

export default Register;