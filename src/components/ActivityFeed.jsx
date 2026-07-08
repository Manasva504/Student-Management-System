import { useContext, useEffect, useState } from "react";
import { SocketContext } from "../context/SocketContext";
import "../App.css";

const MAX_ENTRIES = 20;

// Live, in-memory feed pushed over the socket as events happen — NOT a
// query against the persisted AuditLog collection the way
// pages/ActivityHistory.jsx is. Refresh this page and the feed is empty
// again; that's the trade-off for being real-time instead of durable.
// Only Admins ever receive "activity:new" (server only emits it to the
// "admins" room), so this component doesn't need its own extra check
// beyond the one gating whether it renders at all.
function ActivityFeed() {
  const { socket } = useContext(SocketContext);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!socket) return;

    function handleActivity(entry) {
      setEvents((prev) => [entry, ...prev].slice(0, MAX_ENTRIES));
    }

    socket.on("activity:new", handleActivity);

    return () => {
      socket.off("activity:new", handleActivity);
    };
  }, [socket]);

  return (
    <div className="dashboard-card chart-card">
      <h1>Live Activity Feed</h1>

      {events.length === 0 ? (
        <p>No activity yet — this fills in live as it happens.</p>
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
            {events.map((event, index) => (
              <tr key={`${event.createdAt}-${index}`}>
                <td>{event.user}</td>
                <td>{event.action}</td>
                <td>{new Date(event.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default ActivityFeed;
