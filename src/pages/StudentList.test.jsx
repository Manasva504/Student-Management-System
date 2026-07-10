import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test-utils/renderWithProviders";
import StudentList from "./StudentList";

// getStudents is the network boundary; the export functions are mocked too
// purely because mocking the whole module replaces all of its exports at
// once — they aren't exercised by these two tests. StudentCard, the child
// component rendered per row, is deliberately left real (not mocked/
// stubbed): it does its own import.meta.env-driven profile-pic URL
// construction, which Vitest handles natively (the concrete reason this
// project uses Vitest over Jest for component tests) — stubbing it out
// would dodge that scenario and make this test assert "a child component
// was invoked" instead of "a student's name is visible on screen".
vi.mock("../services/studentService", () => ({
  getStudents: vi.fn(),
  exportStudentsExcel: vi.fn(),
  exportStudentsCSV: vi.fn(),
  exportStudentsPDF: vi.fn(),
}));

import { getStudents } from "../services/studentService";

describe("StudentList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders visible student data a user could actually read on screen", async () => {
    getStudents.mockResolvedValue({
      data: {
        data: [
          { id: "1", name: "Asha Kapoor", email: "asha@x.com", course: "Computer Science", age: 20, cgpa: 8.7, profilePic: "" },
          { id: "2", name: "Ben Rivera", email: "ben@x.com", course: "Information Technology", age: 22, cgpa: 7.9, profilePic: "" },
        ],
        totalStudents: 2,
        currentPage: 1,
        totalPages: 1,
      },
    });

    renderWithProviders(<StudentList />);

    expect(await screen.findByText("Asha Kapoor")).toBeInTheDocument();
    expect(screen.getByText("Ben Rivera")).toBeInTheDocument();
  });

  it("renders the empty state when there are no results", async () => {
    getStudents.mockResolvedValue({
      data: { data: [], totalStudents: 0, currentPage: 1, totalPages: 1 },
    });

    renderWithProviders(<StudentList />);

    expect(await screen.findByText("No students found.")).toBeInTheDocument();
  });
});
