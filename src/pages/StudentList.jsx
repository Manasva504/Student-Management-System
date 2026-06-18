import { useContext, useState } from "react";
import { StudentContext } from "../context/StudentContext";
import StudentCard from "../components/StudentCard";
import "../App.css";

function StudentList() {
  const { students } = useContext(StudentContext);
  const [branchFilter, setBranchFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState("default");
  const filteredStudents =
    branchFilter === "All"
      ? students
      : students.filter((student) => student.course === branchFilter);
  const sortedStudents = [...filteredStudents];
  if (sortOrder === "asc") {
    sortedStudents.sort((a, b) => a.name.localeCompare(b.name));
  }

  if (sortOrder === "desc") {
    sortedStudents.sort((a, b) => b.name.localeCompare(a.name));
  }
  if (sortOrder === "cgpa-high") {
    sortedStudents.sort((a, b) => b.cgpa - a.cgpa);
  }

  if (sortOrder === "cgpa-low") {
    sortedStudents.sort((a, b) => a.cgpa - b.cgpa);
  }
  return (
    <div className="student-list-container">
      <h1>Student List</h1>
      <div className="filter-controls">
        <select
          className="student-filter"
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
        >
          <option value="All">All Branches</option>
          <option value="Computer Science">Computer Science</option>
          <option value="Mechanical Engineering">Mechanical Engineering</option>
          <option value="Electronics">Electronics</option>
        </select>
        <select
          className="student-filter"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        >
          <option value="default">Sort</option>

          <option value="asc">Name A-Z</option>

          <option value="desc">Name Z-A</option>
          <option value="cgpa-high">CGPA High → Low</option>

          <option value="cgpa-low">CGPA Low → High</option>
        </select>
      </div>
      <div className="student-grid">
        {sortedStudents.map((student) => (
          <StudentCard key={student.id} student={student} />
        ))}
      </div>
    </div>
  );
}

export default StudentList;
