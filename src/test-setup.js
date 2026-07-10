import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Without this, each test's rendered DOM stays mounted into the next
// test's document.body, producing "multiple elements found" failures for
// anything reused across tests in the same file.
afterEach(() => {
  cleanup();
});
