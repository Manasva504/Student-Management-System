import { createContext, useContext, useState, useEffect } from "react";
import { getStudents } from "../services/studentService";
import { SocketContext } from "./SocketContext";

export const StudentContext = createContext();

function StudentProvider({ children }) {
  const { socket } = useContext(SocketContext);
  const [students, setStudents] = useState([]);

  useEffect(() => {
    fetchStudents();
  }, []);

  // Live updates: any connected client adding/editing/deleting a student
  // re-triggers the same fetchStudents() every manual mutation already
  // calls — no separate data-shaping logic, just re-run what's here.
  useEffect(() => {
    if (!socket) return;

    function refresh() {
      fetchStudents();
    }

    socket.on("student:added", refresh);
    socket.on("student:updated", refresh);
    socket.on("student:deleted", refresh);

    return () => {
      socket.off("student:added", refresh);
      socket.off("student:updated", refresh);
      socket.off("student:deleted", refresh);
    };
  }, [socket]);

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
