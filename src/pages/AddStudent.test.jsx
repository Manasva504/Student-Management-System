import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test-utils/renderWithProviders";
import AddStudent from "./AddStudent";

const { mockNavigate, toastSuccess, toastError } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();

  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("react-hot-toast", () => ({
  default: { success: toastSuccess, error: toastError },
}));

// The component's real code dispatches fetchStudents() right after a
// successful add (mirroring the pre-Redux "await addStudent(); await
// fetchStudents();" shape) — that second real dispatch needs a mocked
// network response too, or it hits a real, unmocked call.
vi.mock("../services/studentService", () => ({
  addStudent: vi.fn(),
  getStudents: vi.fn(),
  uploadProfilePic: vi.fn(),
}));

import { addStudent, getStudents } from "../services/studentService";

describe("AddStudent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem(
      "branches",
      JSON.stringify(["Computer Science", "Information Technology"]),
    );
    getStudents.mockResolvedValue({
      data: { data: [], totalStudents: 0, currentPage: 1, totalPages: 1 },
    });
  });

  it("rejects a name with digits at submit time and never calls the network", async () => {
    // "invalid CGPA" (the assignment's own example) isn't reachable as a
    // submit-time failure — the CGPA input's onChange already blocks
    // out-of-range keystrokes, so an invalid value can't be typed in, the
    // same as a real user couldn't. The name field's letters-only regex is
    // the validation branch that's actually reachable at submit time.
    const user = userEvent.setup();

    renderWithProviders(<AddStudent />);

    // Email is the only field with an HTML `required` attribute — leaving
    // it empty blocks the browser's (and jsdom's) native form submission
    // before handleSubmit() ever runs, which would falsely look like the
    // name-regex check "didn't fire". Filling it is what lets the actual
    // JS validation (which checks name before completeness) run at all.
    await user.type(screen.getByLabelText("Name"), "Student123");
    await user.type(screen.getByLabelText("Email"), "valid@example.com");
    await user.click(screen.getByRole("button", { name: /add student/i }));

    await vi.waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Name can only contain letters");
    });

    expect(addStudent).not.toHaveBeenCalled();
  });

  it("on a valid submission: adds the student, shows success, navigates, and updates real state", async () => {
    const user = userEvent.setup();

    const savedStudent = {
      id: "new-id",
      name: "Valid Student",
      email: "valid@example.com",
      course: "Computer Science",
      age: 21,
      cgpa: 8.5,
    };

    addStudent.mockResolvedValue({
      data: { message: "Student added successfully", student: savedStudent },
    });

    // The component dispatches a real fetchStudents() right after the add
    // resolves (not awaited by the component, but real Redux state either
    // way) — mocking this to include the new student simulates what a
    // real re-fetch would actually show, which is what the store ends up
    // holding by the time this test's assertions run, not the
    // intermediate optimistic splice from addStudentThunk.fulfilled alone.
    getStudents.mockResolvedValue({
      data: {
        data: [savedStudent],
        totalStudents: 1,
        currentPage: 1,
        totalPages: 1,
      },
    });

    const { store } = renderWithProviders(<AddStudent />);

    await user.type(screen.getByLabelText("Name"), "Valid Student");
    await user.type(screen.getByLabelText("Email"), "valid@example.com");
    await user.selectOptions(
      screen.getByLabelText("Course"),
      "Computer Science",
    );
    await user.type(screen.getByLabelText("Age"), "21");
    await user.type(screen.getByLabelText("Cgpa"), "8.5");
    await user.click(screen.getByRole("button", { name: /add student/i }));

    await vi.waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Student Added Successfully");
    });

    expect(addStudent).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Valid Student", email: "valid@example.com" }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/students");

    // The follow-up fetchStudents() dispatch is fire-and-forget from the
    // component's own code (not awaited), so give it room to resolve
    // before asserting on the store it updates.
    await vi.waitFor(() => {
      expect(store.getState().students.list).toContainEqual(
        expect.objectContaining({ name: "Valid Student" }),
      );
    });
  });
});
