import { uploadProfilePic } from "../services/studentService";
import { addStudentThunk, fetchStudents } from "../redux/studentSlice";
import "../App.css";
import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Plus } from "lucide-react";

function AddStudent() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [course, setCourse] = useState("");
  const [age, setAge] = useState("");
  const [cgpa, setCgpa] = useState("");
  const [profilePic, setProfilePic] = useState(null);

  const [branches, setBranches] = useState([]);

  useEffect(() => {
    const savedBranches = JSON.parse(localStorage.getItem("branches")) || [];

    setBranches(savedBranches);
  }, []);

  async function handleSubmit() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const nameRegex = /^[A-Za-z\s]+$/;

    if (!nameRegex.test(name)) {
      toast.error("Name can only contain letters");
      return;
    }

    if (!name.trim() || !email.trim() || !course.trim() || !age || !cgpa) {
      toast.error("Please fill all fields");
      return;
    }

    if (age <= 0) {
      toast.error("Age must be greater than 0");
      return;
    }

    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (cgpa < 0 || cgpa > 10) {
      toast.error("CGPA must be between 0 and 10");
      return;
    }

    let imageUrl = "";

    if (profilePic) {
      const formData = new FormData();

      formData.append("profilePic", profilePic);

      const uploadResponse = await uploadProfilePic(formData);

      imageUrl = uploadResponse.data.imageUrl;
    }

    const newStudent = {
      id: Date.now(),
      name,
      email,
      course,
      age: Number(age),
      cgpa: Number(cgpa),
      profilePic: imageUrl,
    };

    try {
      await dispatch(addStudentThunk(newStudent)).unwrap();

      dispatch(fetchStudents());

      toast.success("Student Added Successfully");

      setName("");
      setEmail("");
      setCourse("");
      setAge("");
      setCgpa("");

      navigate("/students");
    } catch (error) {
      console.log(error);
      toast.error("Failed to add student");
    }
  }

  return (
    <div className="form-page">
      <h1>Add Student</h1>

      <form
        className="form-card"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <label>Name</label>
        <input
          type="text"
          placeholder="Enter student name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label>Course</label>
        <select value={course} onChange={(e) => setCourse(e.target.value)}>
          <option value="">Select Branch</option>

          {branches.map((branch) => (
            <option key={branch} value={branch}>
              {branch}
            </option>
          ))}
        </select>

        <label>Age</label>
        <input
          type="number"
          placeholder="Enter your age"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          min="1"
        />
        <label>Cgpa</label>
        <input
          type="text"
          placeholder="Enter CGPA"
          value={cgpa}
          onChange={(e) => {
            const value = e.target.value;

            if (/^\d*\.?\d*$/.test(value)) {
              if (value === "" || (Number(value) >= 0 && Number(value) <= 10)) {
                setCgpa(value);
              }
            }
          }}
        />

        <label>Profile Picture</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setProfilePic(e.target.files[0])}
        />

        <button type="submit" className="primary-btn">
          <Plus size={16} /> Add Student
        </button>
      </form>
    </div>
  );
}

export default AddStudent;
