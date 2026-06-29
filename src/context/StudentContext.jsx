import { createContext, useState, useEffect } from "react";
import { getStudents } from "../services/studentService";

export const StudentContext = createContext();

function StudentProvider({ children }) {
  const [students, setStudents] = useState([]);

  useEffect(() => {
    fetchStudents();
  }, []);

  async function fetchStudents() {
  try {
    const response = await getStudents();
    setStudents(response.data.data);
  } catch (error) {
    console.log("Error fetching students:", error);
    setStudents([]);
  }

}

  return (
    <StudentContext.Provider value={{ students, setStudents, fetchStudents }}>
      {children}
    </StudentContext.Provider>
  );
}

export default StudentProvider;
