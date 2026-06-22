import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";
import EditStudent from "./pages/EditStudent";
import Dashboard from "./pages/Dashboard";
import AddStudent from "./pages/AddStudent";
import StudentList from "./pages/StudentList";
import StudentDetails from "./pages/StudentDetails";
import Navbar from "./components/Navbar";

function App() {
  return (
    <>
      <BrowserRouter>
        <div>
          <Navbar />

          <Routes>
            <Route path="/" element={<Dashboard />} />

            <Route path="/add-student" element={<AddStudent />} />

            <Route path="/students" element={<StudentList />} />

            <Route path="/students/:id" element={<StudentDetails />} />
            <Route path="/edit-student/:id" element={<EditStudent />} />
          </Routes>
        </div>
      </BrowserRouter>
    </>
  );
}
export default App;
