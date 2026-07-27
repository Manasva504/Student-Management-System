import Login from "./pages/Login";
import Register from "./pages/Register";
import {
  Navigate,
  BrowserRouter,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import "./App.css";
import EditStudent from "./pages/EditStudent";
import Dashboard from "./pages/Dashboard";
import AddStudent from "./pages/AddStudent";
import StudentList from "./pages/StudentList";
import StudentDetails from "./pages/StudentDetails";
import Navbar from "./components/Navbar";
import ManageBranches from "./pages/ManageBranches";
import { Toaster } from "react-hot-toast";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyOtp from "./pages/VerifyOtp";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import ChangePassword from "./pages/ChangePassword";
import ActivityHistory from "./pages/ActivityHistory";
import ProtectedRoute from "./components/ProtectedRoute";
import ServerWakingBanner from "./components/ServerWakingBanner";

function AppContent() {
  const location = useLocation();
  const hideNavbar =
    location.pathname === "/login" || location.pathname === "/register";

  return (
    <>
      <ServerWakingBanner />

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
            <ProtectedRoute role="Admin">
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
            <ProtectedRoute role="Admin">
              <EditStudent />
            </ProtectedRoute>
          }
        />

        <Route
          path="/manage-branches"
          element={
            <ProtectedRoute role="Admin">
              <ManageBranches />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />

        {/* FIX: this page shows every user's audit trail (logins, password
            changes, student CRUD by anyone) and the Navbar link is only
            shown to Admins — but the route itself wasn't actually gated, so
            any logged-in user could reach it directly by URL. Now matches
            the backend, which also requires Admin (see authRoutes.js). */}
        <Route
          path="/activity-history"
          element={
            <ProtectedRoute role="Admin">
              <ActivityHistory />
            </ProtectedRoute>
          }
        />

        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* Catch-all: redirect unknown routes to login */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          className: "sms-toast",
          success: {
            className: "sms-toast sms-toast--success",
            iconTheme: { primary: "var(--success)", secondary: "#fff" },
          },
          error: {
            className: "sms-toast sms-toast--error",
            iconTheme: { primary: "var(--danger)", secondary: "#fff" },
          },
        }}
      />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </>
  );
}

export default App;
