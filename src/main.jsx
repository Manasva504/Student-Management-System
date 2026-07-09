import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import "./index.css";
import App from "./App.jsx";
import SocketProvider from "./context/SocketContext";
import store from "./redux/store";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <SocketProvider>
      <Provider store={store}>
        <App />
      </Provider>
    </SocketProvider>
  </StrictMode>,
);
