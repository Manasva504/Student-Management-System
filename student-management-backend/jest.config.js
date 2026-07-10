module.exports = {
  testEnvironment: "node",
  setupFiles: ["./jest.setup.js"],
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverageFrom: [
    "app.js",
    "routes/**/*.js",
    "middleware/**/*.js",
    "models/**/*.js",
    "utils/**/*.js",
    "!**/node_modules/**",
  ],
  // Integration tests spin up mongodb-memory-server, which can take longer
  // than Jest's 5s default on a cold run (first-time binary download).
  testTimeout: 20000,
};
