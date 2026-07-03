import { useState, useEffect } from "react";
import { getActivityLogs } from "../services/authServices";
import "../App.css";

function ActivityHistory() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    try {
      setLoading(true);
      setError(false);

      const response = await getActivityLogs();

      setLogs(response.data.logs || []);
    } catch (err) {
      console.log(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="activity-history-page">
      <h1>Activity History</h1>

      <div className="activity-history-card">
        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <div>
            <p>Could not load activity logs.</p>
            <button className="primary-btn" onClick={fetchLogs}>
              Retry
            </button>
          </div>
        ) : logs.length === 0 ? (
          <p>No activity recorded yet.</p>
        ) : (
          <table className="activity-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Action</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id}>
                  <td>{log.user}</td>
                  <td>{log.action}</td>
                  <td>{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default ActivityHistory;
