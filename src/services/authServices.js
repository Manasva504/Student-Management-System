import axios from "axios";

const API_URL = "https://student-management-system-zk2b.onrender.com/api/auth";
export const registerUser = (userData) => {
  return axios.post(`${API_URL}/register`, userData);
};

// export const loginUser = (userData) => {
//   return axios.post(`${API_URL}/login`, userData);
// };

export const loginUser = (userData) => {
  console.log("Calling:", `${API_URL}/login`);
  return axios.post(`${API_URL}/login`, userData);
};

export const forgotPassword = (email) => {
  return axios.post(`${API_URL}/forgot-password`, { email });
};

export const verifyOtp = (email, otp) => {
  return axios.post(`${API_URL}/verify-otp`, { email, otp });
};

export const resetPassword = (email, password) => {
  return axios.post(`${API_URL}/reset-password`, { email, password });
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
