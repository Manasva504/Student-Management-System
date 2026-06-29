import { useState, useEffect } from "react";
import StudentCard from "../components/StudentCard";
import { getStudents } from "../services/studentService";
import "../App.css";

function StudentList() {
  const [students, setStudents] = useState([]);
  const [branchFilter, setBranchFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState("default");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    fetchStudents();
  }, [search, page]);

  useEffect(() => {
    const savedBranches = JSON.parse(localStorage.getItem("branches")) || [];
    setBranches(savedBranches);
  }, []);

  const fetchStudents = async () => {
  try {
    const response = await getStudents(search, page, 5);

    console.log("FULL RESPONSE:", response.data);

    setStudents(response.data);
setTotalPages(Math.ceil(response.data.length / 5));
  } catch (error) {
    console.log(error);
    setStudents([]);
  }
};

  const filteredStudents =
    branchFilter === "All"
      ? students || []
      : (students || []).filter((student) => student.course === branchFilter);
  const sortedStudents = [...(filteredStudents || [])];

  if (sortOrder === "asc") {
    sortedStudents.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortOrder === "desc") {
    sortedStudents.sort((a, b) => b.name.localeCompare(a.name));
  } else if (sortOrder === "cgpa-high") {
    sortedStudents.sort((a, b) => b.cgpa - a.cgpa);
  } else if (sortOrder === "cgpa-low") {
    sortedStudents.sort((a, b) => a.cgpa - b.cgpa);
  }
  return (
    <div className="student-list-container">
      <h1>Student List</h1>

      <div className="filter-controls">
        <input
          type="text"
          placeholder="Search by name or email..."
          className="student-filter"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="student-filter"
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
        >
          <option value="All">All Branches</option>
          {branches.map((branch) => (
            <option key={branch} value={branch}>
              {branch}
            </option>
          ))}
        </select>

        <select
          className="student-filter"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        >
          <option value="default">Sort</option>
          <option value="asc">Name A–Z</option>
          <option value="desc">Name Z–A</option>
          <option value="cgpa-high">CGPA High → Low</option>
          <option value="cgpa-low">CGPA Low → High</option>
        </select>
      </div>

      <div className="student-grid">
        {sortedStudents.length === 0 ? (
          <p
            style={{ color: "white", textAlign: "center", gridColumn: "1/-1" }}
          >
            No students found.
          </p>
        ) : (
          sortedStudents.map((student) => (
            <StudentCard key={student.id} student={student} />
          ))
        )}
      </div>

      {(students || []).length > 0 && (
        <div className="pagination">
          <button
            className="primary-btn"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            Previous
          </button>

          <span style={{ color: "white" }}>
            Page {page} of {totalPages}
          </span>

          <button
            className="primary-btn"
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
export default StudentList;
