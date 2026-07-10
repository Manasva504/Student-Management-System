import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";
import studentsReducer from "../redux/studentSlice";
import authReducer from "../redux/authSlice";
import dashboardReducer from "../redux/dashboardSlice";
import { SocketContext } from "../context/SocketContext";

// One place builds the test store instead of repeating it in every test
// file — and because these are the *real* reducers (not fakes), dispatched
// actions genuinely update state the way they would in the running app.
// socket is always null here: every socket-subscription effect in this
// app already guards on `if (!socket) return`, so this cleanly opts a
// rendered component out of needing a real/mocked Socket.IO client at all.
export function renderWithProviders(
  ui,
  { preloadedState = {}, route = "/" } = {},
) {
  const store = configureStore({
    reducer: {
      students: studentsReducer,
      auth: authReducer,
      dashboard: dashboardReducer,
    },
    preloadedState,
  });

  function Wrapper({ children }) {
    return (
      <Provider store={store}>
        <MemoryRouter initialEntries={[route]}>
          <SocketContext.Provider value={{ socket: null, onlineCount: 0 }}>
            {children}
          </SocketContext.Provider>
        </MemoryRouter>
      </Provider>
    );
  }

  return { store, ...render(ui, { wrapper: Wrapper }) };
}
