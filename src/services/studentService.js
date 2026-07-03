import axios from "axios";

// FIX: dev uses the local backend, a real build uses Render — same pattern
// as authServices.js now.
const BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:5000"
    : "https://student-management-system-zk2b.onrender.com";

// FIX: this used to be "${BASE_URL}/api/auth", which is wrong — server.js
// mounts the student CRUD routes at the root ("/students", "/students/:id"),
// not under /api/auth. Every call below (getStudents, addStudent, etc.) was
// hitting a URL with no matching route on the backend.
const API_URL = `${BASE_URL}/students`;

export const getStudents = (
  search = "",
  page = 1,
  limit = 6,
  minCgpa = "",
  maxCgpa = "",
) => {
  const token = localStorage.getItem("token");

  return axios.get(
    `${API_URL}?search=${search}&page=${page}&limit=${limit}&minCgpa=${minCgpa}&maxCgpa=${maxCgpa}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
};

export const getStudentById = (id) => {
  const token = localStorage.getItem("token");
  return axios.get(`${API_URL}/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const addStudent = (student) => {
  const token = localStorage.getItem("token");
  return axios.post(API_URL, student, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const updateStudent = (id, student) => {
  const token = localStorage.getItem("token");
  return axios.put(`${API_URL}/${id}`, student, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const deleteStudent = (id) => {
  const token = localStorage.getItem("token");
  return axios.delete(`${API_URL}/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const getDashboardStats = () => {
  const token = localStorage.getItem("token");

  return axios.get(`${BASE_URL}/dashboard/stats`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

// Powers the "Students per Branch" + "Average CGPA by Branch" charts on the
// Dashboard.
export const getBranchChart = () => {
  const token = localStorage.getItem("token");

  return axios.get(`${BASE_URL}/dashboard/branch-chart`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

// Powers the "Student Registration Trend" chart on the Dashboard.
export const getRegistrationTrend = () => {
  const token = localStorage.getItem("token");

  return axios.get(`${BASE_URL}/dashboard/registration-trend`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const uploadProfilePic = (formData) => {
  const token = localStorage.getItem("token");

  return axios.post(`${BASE_URL}/upload`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
  });
};