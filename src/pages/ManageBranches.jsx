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
    <div className="branch-page">
      <h2>Manage Branches</h2>

      <input
        type="text"
        placeholder="Enter branch"
        value={branch}
        onChange={(e) => setBranch(e.target.value)}
      />

      <button onClick={addBranch}>Add Branch</button>

      <ul>
        {branches.map((b) => (
          <li key={b}>
            {b}

            <button onClick={() => deleteBranch(b)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ManageBranches;
