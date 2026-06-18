import { useContext, useState } from "react";
import { StudentContext } from "../context/StudentContext";
import { useParams, useNavigate } from "react-router-dom";

function EditStudent() {
  const navigate = useNavigate();
  const { id } = useParams();

  const { students, setStudents } = useContext(StudentContext);

  const student = students.find((s) => s.id === Number(id));

  const [name, setName] = useState(student?.name || "");
  const [email, setEmail] = useState(student?.email || "");
  const [course, setCourse] = useState(student?.course || "");
  const [age, setAge] = useState(student?.age || "");
  const [cgpa, setCgpa] = useState(student?.cgpa || "");

  if (!student) {
    return <h2>Student Not Found</h2>;
  }

  function handleUpdate() {
    if (cgpa < 0 || cgpa > 10) {
      alert("CGPA must be between 0 and 10");
      return;
    }
    const updatedStudents = students.map((s) =>
      s.id === Number(id)
        ? {
            ...s,
            name,
            email,
            course,
            age: Number(age),
            cgpa: Number(cgpa),
          }
        : s,
    );

    setStudents(updatedStudents);

    alert("Student Updated Successfully");
    navigate("/students");
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

        <button type="submit" className="primary-btn">
          Update Student
        </button>
      </form>
    </div>
  );
}

export default EditStudent;
