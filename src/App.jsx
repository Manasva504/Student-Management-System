import Login from "./pages/Login";
import Register from "./pages/Register";
import { Navigate } from "react-router-dom";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";
import EditStudent from "./pages/EditStudent";
import Dashboard from "./pages/Dashboard";
import AddStudent from "./pages/AddStudent";
import StudentList from "./pages/StudentList";
import StudentDetails from "./pages/StudentDetails";
import Navbar from "./components/Navbar";
import { useLocation } from "react-router-dom";
import ManageBranches from "../pages/ManageBranches";
import { Toaster } from "react-hot-toast";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");

  return token ? children : <Navigate to="/login" />;
}

function AppContent() {
  const location = useLocation();

  const hideNavbar =
    location.pathname === "/login" || location.pathname === "/register";

  return (
    <>
      {!hideNavbar && <Navbar />}

      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/add-student"
          element={
            <ProtectedRoute>
              <AddStudent />
            </ProtectedRoute>
          }
        />

        <Route
          path="/students"
          element={
            <ProtectedRoute>
              <StudentList />
            </ProtectedRoute>
          }
        />

        <Route
          path="/students/:id"
          element={
            <ProtectedRoute>
              <StudentDetails />
            </ProtectedRoute>
          }
        />

        <Route
          path="/edit-student/:id"
          element={
            <ProtectedRoute>
              <EditStudent />
            </ProtectedRoute>
          }
        />

        <Route path="/manage-branches" element={<ManageBranches />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <>

     <Toaster position="top-right" />
     
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </>
  );
}
export default App;
