import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { loginUser, logoutUser } from "../services/authServices";

// The one place in the app that decodes a JWT — every component that used
// to do its own JSON.parse(atob(token.split(".")[1])) now reads
// state.auth.user instead. Wrapped in try/catch: a malformed or expired
// token should leave the user logged out, not crash the app on load.
function decodeToken(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch (error) {
    console.log("Failed to decode token:", error);
    return null;
  }
}

function loadInitialAuthState() {
  const token = localStorage.getItem("token");
  const user = token ? decodeToken(token) : null;

  return {
    user,
    token: user ? token : null,
    isAuthenticated: Boolean(user),
  };
}

export const loginThunk = createAsyncThunk(
  "auth/login",
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await loginUser(credentials);

      return response.data;
    } catch (error) {
      // createAsyncThunk only serializes name/message/stack/code onto
      // action.error by default, dropping axios's error.response entirely
      // — rejectWithValue is what lets .unwrap() in Login.jsx still see
      // the backend's actual error message instead of a generic one.
      return rejectWithValue(error.response?.data);
    }
  },
);

// logoutUser() must stay fail-open (matching the existing fix in
// Navbar.jsx) — a failed logout API call (cold start, network blip) must
// never prevent the user from actually being logged out client-side. This
// thunk never rejects on its own: the API failure is swallowed here so the
// reducers below only ever see "fulfilled", and clear state unconditionally.
export const logoutThunk = createAsyncThunk("auth/logout", async () => {
  try {
    await logoutUser();
  } catch (error) {
    console.log(error);
  }
});

const authSlice = createSlice({
  name: "auth",
  initialState: loadInitialAuthState(),
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.fulfilled, (state, action) => {
        const token = action.payload.token;
        const user = decodeToken(token);

        state.user = user;
        state.token = token;
        state.isAuthenticated = Boolean(user);

        localStorage.setItem("token", token);
      })
      .addCase(logoutThunk.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;

        localStorage.removeItem("token");
      });
  },
});

export default authSlice.reducer;
