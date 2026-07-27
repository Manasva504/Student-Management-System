import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test-utils/renderWithProviders";
import Dashboard from "./Dashboard";

vi.mock("../services/studentService", () => ({
  getDashboardStats: vi.fn(),
  getBranchChart: vi.fn(),
  getRegistrationTrend: vi.fn(),
}));

import {
  getDashboardStats,
  getBranchChart,
  getRegistrationTrend,
} from "../services/studentService";

// <ActivityFeed /> only renders admin-only, so it needs an Admin user in
// the preloaded auth state to be reachable at all — otherwise this file
// would only ever exercise the non-admin branch regardless of intent.
const adminPreloadedState = {
  auth: {
    user: { id: "admin-1", email: "admin@example.com", role: "Admin" },
    token: "fake-token",
    isAuthenticated: true,
  },
};

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBranchChart.mockResolvedValue({ data: { data: [] } });
    getRegistrationTrend.mockResolvedValue({ data: { data: [] } });
  });

  it("renders the three stat chips with the right numbers on success", async () => {
    getDashboardStats.mockResolvedValue({
      data: {
        totalStudents: 12,
        averageCGPA: "8.20",
        highestCGPAStudent: { name: "Top Student" },
        studentsPerBranch: { "Computer Science": 12 },
      },
    });

    renderWithProviders(<Dashboard />, { preloadedState: adminPreloadedState });

    expect(await screen.findByText(/Total Students: 12/)).toBeInTheDocument();
    expect(screen.getByText(/Average CGPA:\s*8.20/)).toBeInTheDocument();
    expect(
      screen.getByText(/Highest CGPA Student:\s*Top Student/),
    ).toBeInTheDocument();
  });

  it("renders the existing error/retry UI when the stats fetch fails", async () => {
    getDashboardStats.mockRejectedValue(new Error("network error"));

    renderWithProviders(<Dashboard />, { preloadedState: adminPreloadedState });

    expect(
      await screen.findByText(/Could not load dashboard data/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
