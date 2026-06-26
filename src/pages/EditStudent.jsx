import { useContext, useState } from "react";
import { StudentContext } from "../context/StudentContext";
import { useParams, useNavigate } from "react-router-dom";
import { updateStudent, uploadProfilePic } from "../services/studentService";
import toast from "react-hot-toast";

function EditStudent() {
  const navigate = useNavigate();
  const { id } = useParams();

  const { students, fetchStudents } = useContext(StudentContext);

  const student = students.find((s) => String(s.id) === String(id));

  const [name, setName] = useState(student?.name || "");
  const [email, setEmail] = useState(student?.email || "");
  const [course, setCourse] = useState(student?.course || "");
  const [age, setAge] = useState(student?.age || "");
  const [cgpa, setCgpa] = useState(student?.cgpa || "");
  const [profilePic, setProfilePic] = useState(null);

  if (!student) {
    return <h2>Student Not Found</h2>;
  }

  async function handleUpdate() {
    if (cgpa < 0 || cgpa > 10) {
      toast.error("CGPA must be between 0 and 10");
      return;
    }

    let imageUrl = student.profilePic;

    try {
      // Upload new image if user selected one
      if (profilePic) {
        const formData = new FormData();

        formData.append("profilePic", profilePic);

        const uploadResponse = await uploadProfilePic(formData);

        imageUrl = uploadResponse.data.imageUrl;
      }

      const updatedStudent = {
        name,
        email,
        course,
        age: Number(age),
        cgpa: Number(cgpa),
        profilePic: imageUrl,
      };

      await updateStudent(id, updatedStudent);

      await fetchStudents();

      toast.success("Student Updated Successfully");

      navigate("/students");
    } catch (error) {
      console.log(error);
      toast.error("Failed to update student");
    }
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

        <label>Cgpa</label>
        <input
          type="text"
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

        {student.profilePic && (
          <img
            src={`https://student-management-system-zk2b.onrender.com${student.profilePic}`}
            alt={student.name}
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
