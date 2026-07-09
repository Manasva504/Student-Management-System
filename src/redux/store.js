import { configureStore } from "@reduxjs/toolkit";
import studentsReducer from "./studentSlice";
import authReducer from "./authSlice";
import dashboardReducer from "./dashboardSlice";

// RTK's default middleware already includes redux-thunk, so the thunks in
// each slice above work with no extra setup here.
export const store = configureStore({
  reducer: {
    students: studentsReducer,
    auth: authReducer,
    dashboard: dashboardReducer,
  },
});

export default store;
