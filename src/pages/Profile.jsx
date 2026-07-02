import { useState } from "react";
import { useEffect } from "react";
import { getProfile, updateProfile } from "../services/authServices";
import { uploadProfilePic } from "../services/studentService";
import "../App.css";
import { deleteAccount } from "../services/authServices";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import toast from "react-hot-toast";

function Profile() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const user = token ? JSON.parse(atob(token.split(".")[1])) : null;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profilePic, setProfilePic] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [role, setRole] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  async function handleDeleteAccount() {
    const result = await Swal.fire({
      title: "Delete Account?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    });

    if (!result.isConfirmed) return;

    try {
      await deleteAccount();

      toast.success("Account deleted successfully");

      localStorage.removeItem("token");

      navigate("/login");
    } catch (error) {
      console.log(error);
      toast.error("Failed to delete account");
    }
  }
  async function handleUpdateProfile() {
    try {
      let imageUrl = profilePic;

      if (selectedFile) {
        const formData = new FormData();
        formData.append("profilePic", selectedFile);

        const uploadResponse = await uploadProfilePic(formData);

        imageUrl = uploadResponse.data.imageUrl;
      }

      await updateProfile({
        name,
        email,
        profilePic: imageUrl,
      });

      setProfilePic(imageUrl);

      toast.success("Profile updated successfully");
    } catch (error) {
      console.log(error);
      toast.error("Failed to update profile");
    }
  }

  async function fetchProfile() {
    try {
      const response = await getProfile();

      setName(response.data.name);
      setEmail(response.data.email);
      setRole(response.data.role);
      setProfilePic(response.data.profilePic);
    } catch (error) {
      console.log(error);
    }
  }
  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>My Profile</h2>
        <p>
          <strong>Role:</strong> {role}
        </p>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {profilePic && (
          <img
            src={`https://student-management-system-zk2b.onrender.com${profilePic}`}
            alt="Profile"
            className="profile-image"
          />
        )}
        <input
          type="file"
          onChange={(e) => setSelectedFile(e.target.files[0])}
        />
        <button onClick={handleUpdateProfile}>Update Profile</button>{" "}
        <button
          type="button"
          className="delete-btn"
          onClick={handleDeleteAccount}
        >
          Delete Account
        </button>
        ;
      </div>
    </div>
  );
}

export default Profile;
