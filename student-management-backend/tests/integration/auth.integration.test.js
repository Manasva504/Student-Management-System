// The one place in the whole suite that exercises real bcrypt.hash/
// bcrypt.compare together end-to-end — tests/unit/auth.test.js mocks
// bcrypt.compare away for speed, so only this file can actually catch a
// subtly-wrong hashing/comparison bug. Real in-memory MongoDB, real HTTP
// requests via request(app).
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { app } = require("../../app");
const User = require("../../models/User");
const Auditlog = require("../../models/Auditlog");

// The login route emits "userLoggedIn" rather than writing the audit log
// itself; this listener (normally registered once by server.js at real
// boot) is what actually does it. app.js deliberately never registers it
// (no startup side effects — see app.js's own comment), so this test has
// to register it explicitly to see the same behavior the real app has.
require("../../listeners/authListeners");

// The listener's Auditlog.create() is a real, unawaited write from the
// route's point of view (authEvents.emit() doesn't wait for listeners to
// finish) — the request can resolve before that write actually lands in
// the database. Polling briefly is what makes asserting on it reliable
// instead of flaky.
async function waitForAuditLog(query, { timeout = 1000, interval = 20 } = {}) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const logs = await Auditlog.find(query);

    if (logs.length > 0) return logs;

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  return Auditlog.find(query);
}

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  await User.create({
    name: "Real Login User",
    email: "real-login@example.com",
    password: await bcrypt.hash("correctPassword123", 10),
    role: "Student",
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Auditlog.deleteMany({});
});

describe("POST /api/auth/login", () => {
  it("succeeds with the real seeded password and writes a real Login audit entry", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "real-login@example.com", password: "correctPassword123" });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");

    const logs = await waitForAuditLog({
      user: "real-login@example.com",
      action: "Login",
    });

    expect(logs).toHaveLength(1);
  });

  it("fails with the wrong password and logs nothing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "real-login@example.com", password: "wrongPassword" });

    expect(res.status).toBe(400);

    const logs = await Auditlog.find({ user: "real-login@example.com", action: "Login" });

    expect(logs).toHaveLength(0);
  });

  it("fails for an email that was never registered", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "never-registered@example.com", password: "whatever123" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid Credentials");
  });
});
