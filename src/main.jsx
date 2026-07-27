import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import "./index.css";
import App from "./App.jsx";
import SocketProvider from "./context/SocketContext";
import store from "./redux/store";
import { installApiRetry } from "./services/apiRetry";

// Installed before the first render so the very first API call a page
// makes is already covered by cold-start retries.
installApiRetry();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <SocketProvider>
      <Provider store={store}>
        <App />
      </Provider>
    </SocketProvider>
  </StrictMode>,
);
