import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import StudentProvider from "./context/StudentContext";
import SocketProvider from "./context/SocketContext";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <SocketProvider>
      <StudentProvider>
        <App />
      </StudentProvider>
    </SocketProvider>
  </StrictMode>,
);
