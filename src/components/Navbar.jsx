import { Link } from "react-router-dom";
import "../App.css"

function Navbar() {
  return (
    <div className="navibar">
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
    </div>
  );
}

export default Navbar;
