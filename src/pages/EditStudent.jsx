import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { updateStudentThunk, fetchStudents } from "../redux/studentSlice";
import { useParams, useNavigate } from "react-router-dom";
import { uploadProfilePic, getStudentById } from "../services/studentService";
import toast from "react-hot-toast";
import { getThumbnailUrl } from "../utils/cloudinaryImage";

function EditStudent() {
  const navigate = useNavigate();
  const { id } = useParams();
  const dispatch = useDispatch();

  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [course, setCourse] = useState("");
  const [age, setAge] = useState("");
  const [cgpa, setCgpa] = useState("");
  const [oldProfilePic, setOldProfilePic] = useState("");
  const [oldProfilePicPublicId, setOldProfilePicPublicId] = useState("");
  const [profilePic, setProfilePic] = useState(null);

  useEffect(() => {
    fetchStudent();
  }, []);

  async function fetchStudent() {
    try {
      const response = await getStudentById(id);

      const student = response.data;

      setName(student.name);
      setEmail(student.email);
      setCourse(student.course);
      setAge(student.age);
      setCgpa(student.cgpa);
      setOldProfilePic(student.profilePic);
      setOldProfilePicPublicId(student.profilePicPublicId);

      setLoading(false);
    } catch (error) {
      console.log(error);
      toast.error("Student not found");
      navigate("/students");
    }
  }

  async function handleUpdate() {
    if (cgpa < 0 || cgpa > 10) {
      toast.error("CGPA must be between 0 and 10");
      return;
    }

    let imageUrl = oldProfilePic;
    let publicId = oldProfilePicPublicId;

    try {
      if (profilePic) {
        const formData = new FormData();
        formData.append("profilePic", profilePic);

        const uploadResponse = await uploadProfilePic(formData);

        imageUrl = uploadResponse.data.imageUrl;
        publicId = uploadResponse.data.publicId;
      }

      const updatedStudent = {
        name,
        email,
        course,
        age: Number(age),
        cgpa: Number(cgpa),
        profilePic: imageUrl,
        profilePicPublicId: publicId,
      };

      await dispatch(updateStudentThunk({ id, student: updatedStudent })).unwrap();

      dispatch(fetchStudents());

      toast.success("Student Updated Successfully");

      navigate("/students");
    } catch (error) {
      console.log(error);
      toast.error("Failed to update student");
    }
  }

  if (loading) {
    return (
      <div className="form-page">
        <div className="form-card">
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="form-page">
      <h1>Edit Student</h1>

      <form
        className="form-card"
        onSubmit={(e) => {
          e.preventDefault();
          handleUpdate();
        }}
      >
        <label>Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label>Course</label>
        <input
          type="text"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
        />

        <label>Age</label>
        <input
          type="number"
          value={age}
          onChange={(e) => setAge(e.target.value)}
        />

        <label>CGPA</label>
        <input
          type="text"
          value={cgpa}
          onChange={(e) => setCgpa(e.target.value)}
        />

        {oldProfilePic && (
          <img
            src={getThumbnailUrl(oldProfilePic)}
            alt="Student"
            className="profile-image"
          />
        )}

        <label>Update Profile Picture</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setProfilePic(e.target.files[0])}
        />

        <button type="submit" className="primary-btn">
          Update Student
        </button>
      </form>
    </div>
  );
}

export default EditStudent;
