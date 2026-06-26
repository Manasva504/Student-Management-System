import { useState, useEffect } from "react";
import toast from "react-hot-toast";

function ManageBranches() {
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    const savedBranches = JSON.parse(localStorage.getItem("branches")) || [
      "Computer Science",
      "Information Technology",
      "Electronics",
    ];
    setBranches(savedBranches);
  }, []);

  useEffect(() => {
    localStorage.setItem("branches", JSON.stringify(branches));
  }, [branches]);

  const addBranch = () => {
    if (!branch.trim()) return;
    if (branches.includes(branch.trim())) {
      toast.error("Branch already exists");
      return;
    }
    setBranches([...branches, branch.trim()]);
    setBranch("");
    toast.success("Branch added");
  };

  const deleteBranch = (branchToDelete) => {
    setBranches(branches.filter((b) => b !== branchToDelete));
    toast.success("Branch removed");
  };

  return (
    <div className="manage-branches-page">
      <div className="manage-branches-card">
        <h1>Manage Branches</h1>

        <div className="branch-input-section">
          <input
            type="text"
            placeholder="Enter branch name"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addBranch()}
          />
          <button onClick={addBranch}>Add Branch</button>
        </div>

        <ul className="branch-list">
          {branches.map((b, index) => (
            <li key={index} className="branch-item">
              <span>{b}</span>
              <button className="delete-btn" onClick={() => deleteBranch(b)}>
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
