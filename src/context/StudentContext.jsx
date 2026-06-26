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
      setStudents(response.data);
    } catch (error) {
      // FIX: silently fail instead of crashing the whole app
      // This happens when the token is missing/expired on first load
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
