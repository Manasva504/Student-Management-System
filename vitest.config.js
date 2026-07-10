import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Separate from vite.config.js on purpose — keeps the dev/build config free
// of test-only concerns. Vitest reuses Vite's own transform pipeline, which
// is what makes import.meta.env work here with zero extra configuration
// (the concrete reason this project uses Vitest instead of Jest on the
// frontend — see the plan/chat for the full explanation).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.js"],
    css: false,
    // Without this, Vitest's default glob also picks up
    // student-management-backend/tests/**/*.test.js (Jest tests, not
    // Vitest — they fail here with "jest is not defined" and drag in
    // backend-only env/imports this project has no reason to load).
    exclude: ["**/node_modules/**", "**/student-management-backend/**"],
  },
});
