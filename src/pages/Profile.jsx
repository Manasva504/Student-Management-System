import { useState } from "react";
import { useEffect } from "react";
import { getProfile, updateProfile } from "../services/authServices";
import { uploadProfilePic } from "../services/studentService";
import "../App.css";
import { deleteAccount } from "../services/authServices";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { confirmAction } from "../utils/confirm";
import { logoutUser } from "../services/authServices";

const BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:5000"
    : "https://student-management-system-zk2b.onrender.com";

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
    const confirmed = await confirmAction({
      title: "Delete Account?",
      text: "This action cannot be undone.",
      confirmText: "Yes, delete it",
      danger: true,
    });

    if (!confirmed) return;

    try {
      await deleteAccount();

      toast.success("Account deleted successfully");
    } catch (error) {
      console.log(error);
      toast.error("Failed to delete account");
      return;
    }

    // FIX: logging out is best-effort cleanup after a successful delete —
    // this used to be inside the same try block as deleteAccount(), so if
    // this call failed (cold start, network blip, etc.) the catch below
    // would report "Failed to delete account" even though the account had
    // already been deleted. Isolating it means a logout hiccup can no
    // longer misreport a successful deletion as a failure.
    try {
      await logoutUser();
    } catch (error) {
      console.log(error);
    }

    localStorage.removeItem("token");

    navigate("/login");
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
            src={`${BASE_URL}${profilePic}`}
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
      </div>
    </div>
  );
}

export default Profile;
