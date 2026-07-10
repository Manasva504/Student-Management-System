import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test-utils/renderWithProviders";
import Login from "./Login";

// Hoisted so the vi.mock factories below (which Vitest hoists to the top
// of the file) can reference these without a temporal-dead-zone error.
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

vi.mock("../services/authServices", () => ({
  loginUser: vi.fn(),
}));

import { loginUser } from "../services/authServices";

// loginThunk decodes the returned token the same way every other part of
// this app does — a real-shaped (if unsigned) JWT is needed for that
// decode to succeed, not just any string.
function fakeToken(payload) {
  return `header.${btoa(JSON.stringify(payload))}.signature`;
}

async function openLoginForm(user) {
  const lampButton = await screen.findByRole("button", {
    name: /pull to turn on lamp/i,
  });

  await user.click(lampButton);
}

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("on valid credentials: logs in, toasts success, navigates, and updates real auth state", async () => {
    const user = userEvent.setup();

    loginUser.mockResolvedValue({
      data: {
        token: fakeToken({ id: "u1", email: "admin@example.com", role: "Admin" }),
      },
    });

    const { store } = renderWithProviders(<Login />);

    await openLoginForm(user);

    await user.type(await screen.findByLabelText("Email"), "admin@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await vi.waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Login Successful");
    });

    expect(mockNavigate).toHaveBeenCalledWith("/");
    expect(store.getState().auth.isAuthenticated).toBe(true);
    expect(store.getState().auth.user).toMatchObject({ role: "Admin" });
  });

  it("on invalid credentials: shows the backend's real error message and does not navigate", async () => {
    const user = userEvent.setup();

    loginUser.mockRejectedValue({
      response: { data: { message: "Invalid Credentials" } },
    });

    const { store } = renderWithProviders(<Login />);

    await openLoginForm(user);

    await user.type(await screen.findByLabelText("Email"), "wrong@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await vi.waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Invalid Credentials");
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(store.getState().auth.isAuthenticated).toBe(false);
  });
});
