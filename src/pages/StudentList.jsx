import { useState, useEffect } from "react";
import StudentCard from "../components/StudentCard";
import {
  getStudents,
  exportStudentsExcel,
  exportStudentsCSV,
  exportStudentsPDF,
} from "../services/studentService";
import "../App.css";
import { SearchX } from "lucide-react";
import toast from "react-hot-toast";

function StudentList() {
  const token = localStorage.getItem("token");
  const user = token ? JSON.parse(atob(token.split(".")[1])) : null;

  const [students, setStudents] = useState([]);
  const [branchFilter, setBranchFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState("default");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [branches, setBranches] = useState([]);
  const [minCgpa, setMinCgpa] = useState("");
  const [maxCgpa, setMaxCgpa] = useState("");

  useEffect(() => {
    fetchStudents();
  }, [search, page, minCgpa, maxCgpa]);

  useEffect(() => {
    const savedBranches = JSON.parse(localStorage.getItem("branches")) || [];
    setBranches(savedBranches);
  }, []);

  const fetchStudents = async () => {
    try {
      const response = await getStudents(search, page, 6, minCgpa, maxCgpa);

      console.log("FULL RESPONSE:", response.data);

      setStudents(response.data.data || []);
      setTotalPages(response.data.totalPages || 1);
    } catch (error) {
      console.log(error);
      setStudents([]);
      setTotalPages(1);
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

  // Same filters currently applied to the list, so exports match what's on
  // screen rather than always dumping every student.
  const currentFilters = {
    search: search || undefined,
    branch: branchFilter !== "All" ? branchFilter : undefined,
    minCgpa: minCgpa || undefined,
    maxCgpa: maxCgpa || undefined,
  };

  const handleExport = async (format) => {
    const exporters = {
      excel: exportStudentsExcel,
      csv: exportStudentsCSV,
      pdf: exportStudentsPDF,
    };

    try {
      await exporters[format](currentFilters);
      toast.success(`Exported students as ${format.toUpperCase()}`);
    } catch (error) {
      console.log(error);
      toast.error(`Failed to export ${format.toUpperCase()}`);
    }
  };

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

        <input
          type="number"
          placeholder="Min CGPA"
          className="student-filter"
          value={minCgpa}
          onChange={(e) => setMinCgpa(e.target.value)}
        />

        <input
          type="number"
          placeholder="Max CGPA"
          className="student-filter"
          value={maxCgpa}
          onChange={(e) => setMaxCgpa(e.target.value)}
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

      {user?.role === "Admin" && (
        <div className="filter-controls">
          <button className="primary-btn" onClick={() => handleExport("excel")}>
            Export Excel
          </button>
          <button className="primary-btn" onClick={() => handleExport("csv")}>
            Export CSV
          </button>
          <button className="primary-btn" onClick={() => handleExport("pdf")}>
            Export PDF
          </button>
        </div>
      )}

      <div className="student-grid">
        {sortedStudents.length === 0 ? (
          <div className="empty-state">
            <SearchX size={20} />
            <p>No students found.</p>
          </div>
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
