import axios from "axios";

const API_URL = "https://student-management-system-zk2b.onrender.com/students";

export const getStudents = (search = "", page = 1, limit = 5) => {
  const token = localStorage.getItem("token");

  return axios.get(`${API_URL}?search=${search}&page=${page}&limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
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

  return axios.get(
    "https://student-management-system-zk2b.onrender.com/dashboard/stats",
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
};
export const uploadProfilePic = (formData) => {
  const token = localStorage.getItem("token");

  return axios.post(
    "https://student-management-system-zk2b.onrender.com/upload",
    formData,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    },
  );
};
