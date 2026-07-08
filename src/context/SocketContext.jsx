import { createContext, useEffect, useState } from "react";
import { io as ioClient } from "socket.io-client";
import toast from "react-hot-toast";

// Same MODE-based pattern as authServices.js / studentService.js.
const BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:5000"
    : "https://student-management-system-zk2b.onrender.com";

export const SocketContext = createContext({ socket: null, onlineCount: 0 });

function connect(token) {
  const socketInstance = ioClient(BASE_URL, {
    auth: { token },
  });

  socketInstance.on("student:added", (payload) => {
    toast.success(`${payload.name} was added`);
  });

  socketInstance.on("student:updated", (payload) => {
    toast(`${payload.name} was updated`);
  });

  socketInstance.on("student:deleted", (payload) => {
    toast(`${payload.name} was removed`, { icon: "🗑️" });
  });

  return socketInstance;
}

function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    let socketInstance = null;
    let lastToken = null;

    function syncWithToken() {
      const token = localStorage.getItem("token");

      if (token === lastToken) return;

      // Token changed (login, logout, or a different account) — tear down
      // whatever connection we had, if any.
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
        setSocket(null);
        setOnlineCount(0);
      }

      lastToken = token;

      if (token) {
        socketInstance = connect(token);
        socketInstance.on("presence:count", setOnlineCount);
        setSocket(socketInstance);
      }
    }

    // localStorage doesn't emit an event in the tab that made the change
    // (only in *other* tabs), so login/logout in this same tab can't be
    // detected by listening for one. Polling is the pragmatic fix that
    // doesn't require touching Login.jsx/Navbar.jsx/Profile.jsx just to
    // announce "the token changed" — see the judgment-call note in chat.
    syncWithToken();
    const intervalId = setInterval(syncWithToken, 1000);

    return () => {
      clearInterval(intervalId);
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, onlineCount }}>
      {children}
    </SocketContext.Provider>
  );
}

export default SocketProvider;
