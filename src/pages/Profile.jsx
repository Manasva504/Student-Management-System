import { useState } from "react";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { getProfile, updateProfile } from "../services/authServices";
import { uploadProfilePic } from "../services/studentService";
import "../App.css";
import { deleteAccount } from "../services/authServices";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { confirmAction } from "../utils/confirm";
import { logoutThunk } from "../redux/authSlice";

const BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:5000"
    : "https://student-management-system-zk2b.onrender.com";

function Profile() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

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

    // FIX (preserved): logging out is best-effort cleanup after a
    // successful delete, isolated from the try/catch above so a logout
    // hiccup can never misreport a successful deletion as a failure.
    // logoutThunk() is fail-open by construction (see redux/authSlice.js)
    // — it always clears state/localStorage, so no extra try/catch needed
    // here either.
    await dispatch(logoutThunk());

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
