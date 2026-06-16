import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav>
      <h2>Student Management System</h2>

      <ul>
        <li>
          <Link to="/">Dashboard</Link>
        </li>

        <li>
          <Link to="/add-student">Add Student</Link>
        </li>

        <li>
          <Link to="/students">Student List</Link>
        </li>
      </ul>
    </nav>
  );
}

export default Navbar;