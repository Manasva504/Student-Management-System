import axios from "axios";

const API_URL = "https://student-management-system-zk2b.onrender.com/api/auth";

export const registerUser = (userData) => {
  return axios.post(`${API_URL}/register`, userData);
};

export const loginUser = (userData) => {
  return axios.post(`${API_URL}/login`, userData);
};
