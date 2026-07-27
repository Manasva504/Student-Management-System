import axios from "axios";

// FIX: was hardcoded to localhost only (or, in other branches of this file,
// hardcoded straight to the Render URL only) — meaning whichever one was
// committed is the only environment this worked in. This now matches the
// pattern already used in Profile.jsx: dev uses your local backend, a real
// build (Vercel) uses Render, automatically.
//
// VITE_API_BASE_URL wins when it's set (Docker passes it as a build arg —
// see the root Dockerfile/docker-compose.yml — because a Docker build and
// a real Vercel production build both look identical to Vite otherwise:
// neither one is "dev mode"). Without it, falls back to the original
// dev-vs-not-dev guess, so the real Vercel deployment is unaffected.
const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.MODE === "development"
    ? "http://localhost:5000"
    : "https://student-management-system-zk2b.onrender.com");

const API_URL = `${BASE_URL}/api/v1/auth`;

export const registerUser = (userData) => {
  return axios.post(`${API_URL}/register`, userData);
};

export const loginUser = (userData) => {
  return axios.post(`${API_URL}/login`, userData);
};

export const forgotPassword = (email) => {
  return axios.post(`${API_URL}/forgot-password`, { email });
};

export const verifyOtp = (email, otp) => {
  return axios.post(`${API_URL}/verify-otp`, { email, otp });
};

// FIX (security): reset-password now requires the OTP too — see
// authRoutes.js. Previously this endpoint accepted just email+password,
// which meant the OTP verification step could be skipped entirely.
export const resetPassword = (email, password, otp) => {
  return axios.post(`${API_URL}/reset-password`, { email, password, otp });
};

export const getProfile = () => {
  const token = localStorage.getItem("token");

  return axios.get(`${API_URL}/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const updateProfile = (data) => {
  const token = localStorage.getItem("token");

  return axios.put(`${API_URL}/profile`, data, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const changePassword = (oldPassword, newPassword) => {
  const token = localStorage.getItem("token");

  return axios.put(
    `${API_URL}/change-password`,
    {
      oldPassword,
      newPassword,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
};

export const deleteAccount = () => {
  const token = localStorage.getItem("token");

  return axios.delete(`${API_URL}/delete-account`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const logoutUser = () => {
  const token = localStorage.getItem("token");

  return axios.post(
    `${API_URL}/logout`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
};

export const getActivityLogs = () => {
  const token = localStorage.getItem("token");

  return axios.get(`${API_URL}/activity-logs`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};