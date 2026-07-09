import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  getDashboardStats,
  getBranchChart,
  getRegistrationTrend,
} from "../services/studentService";

export const fetchDashboardStats = createAsyncThunk(
  "dashboard/fetchStats",
  async () => {
    const response = await getDashboardStats();

    return response.data;
  },
);

export const fetchBranchChart = createAsyncThunk(
  "dashboard/fetchBranchChart",
  async () => {
    const response = await getBranchChart();

    return response.data.data || [];
  },
);

export const fetchRegistrationTrend = createAsyncThunk(
  "dashboard/fetchRegistrationTrend",
  async () => {
    const response = await getRegistrationTrend();

    return response.data.data || [];
  },
);

const initialState = {
  stats: null,
  branchChart: [],
  trend: [],
  loading: false,
  error: null,
};

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Stats are load-bearing (Dashboard.jsx shows a full error screen if
      // this fails) — kept on its own loading/error flags.
      .addCase(fetchDashboardStats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDashboardStats.fulfilled, (state, action) => {
        state.loading = false;
        state.stats = action.payload;
      })
      .addCase(fetchDashboardStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })

      // Charts are a bonus on top of stats — a failure here just leaves the
      // chart sections empty, it doesn't set the page-level error state.
      .addCase(fetchBranchChart.fulfilled, (state, action) => {
        state.branchChart = action.payload;
      })
      .addCase(fetchBranchChart.rejected, (state, action) => {
        console.error("Failed to fetch chart data:", action.error.message);
      })

      .addCase(fetchRegistrationTrend.fulfilled, (state, action) => {
        state.trend = action.payload;
      })
      .addCase(fetchRegistrationTrend.rejected, (state, action) => {
        console.error("Failed to fetch chart data:", action.error.message);
      });
  },
});

export default dashboardSlice.reducer;
