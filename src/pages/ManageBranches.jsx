import { useState, useEffect } from "react";
import toast from "react-hot-toast";

function ManageBranches() {
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState([]);

  // Load branches when page loads
  useEffect(() => {
    const savedBranches = JSON.parse(localStorage.getItem("branches")) || [
      "Computer Science",
      "Information Technology",
      "Electronics",
    ];

    setBranches(savedBranches);
  }, []);

  // Save branches whenever they change
  useEffect(() => {
    localStorage.setItem("branches", JSON.stringify(branches));
  }, [branches]);

  const addBranch = () => {
    if (!branch.trim()) return;

    if (branches.includes(branch)) {
      toast.error("Branch already exists");
      return;
    }

    setBranches([...branches, branch]);
    setBranch("");
  };

  const deleteBranch = (branchToDelete) => {
    setBranches(branches.filter((b) => b !== branchToDelete));
  };

  return (
    <div className="manage-branches-page">
      <div className="manage-branches-card">
        <h1>Manage Branches</h1>

        <div className="branch-input-section">
          <input
            type="text"
            placeholder="Enter branch"
            value={newBranch}
            onChange={(e) => setNewBranch(e.target.value)}
          />

          <button onClick={handleAddBranch}>Add Branch</button>
        </div>

        <ul className="branch-list">
          {branches.map((branch, index) => (
            <li key={index} className="branch-item">
              <span>{branch}</span>

              <button
                className="delete-btn"
                onClick={() => handleDeleteBranch(branch)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
export default ManageBranches;
