import { createContext, useState } from "react";
import studentsData from "../data/students";

export const StudentContext = createContext();

function StudentProvider({ children }) {
  const [students, setStudents] = useState(studentsData);

  return (
    <StudentContext.Provider
      value={{ students, setStudents }}
    >
      {children}
    </StudentContext.Provider>
  );
}

export default StudentProvider;