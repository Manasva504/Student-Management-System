import axios from "axios";

const API_URL = "http://localhost:5000/students";

export const getStudents = () => {
  return axios.get(API_URL);
};

export const getStudentById = (id) => {
  return axios.get(`${API_URL}/${id}`);
};

export const addStudent = (student) => {
  return axios.post(API_URL, student);
};

export const updateStudent = (id, student) => {
  return axios.put(`${API_URL}/${id}`, student);
};

export const deleteStudent = (id) => {
  return axios.delete(`${API_URL}/${id}`);
};