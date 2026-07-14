// Unit tests for POST /api/auth/login. User lookup and password
// comparison are mocked (bcrypt is deliberately slow, and comparing
// against a real hash would need one pre-computed just to drive branching
// logic that doesn't actually depend on bcrypt's real behavior). jwt.sign
// is left real — "did a real, decodable token with the right payload come
// back" is a genuinely useful assertion a mock would just assume away.
const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

jest.mock("../../models/User", () => ({ findOne: jest.fn() }));
jest.mock("../../models/Auditlog", () => ({ create: jest.fn() }));
jest.mock("bcryptjs", () => ({ compare: jest.fn() }));

const { app } = require("../../app");
const User = require("../../models/User");
const Auditlog = require("../../models/Auditlog");

// The login route no longer writes the audit log itself — it emits
// "userLoggedIn" and this listener (normally registered once by server.js
// at real boot) is what actually calls Auditlog.create. app.js never
// registers it (by design — see app.js's own comment on why it has no
// startup side effects), so tests have to register it explicitly to
// observe the same behavior the real running app has. Requiring it here
// resolves to the same mocked Auditlog module above (Jest's module
// registry is shared within this file), so the mock still sees the call.
require("../../listeners/authListeners");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/auth/login", () => {
  it("returns 400 when email or password is missing, without querying the DB", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "only-email@example.com" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Please provide Email and Password");
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it("returns 400 'Invalid Credentials' when the user doesn't exist", async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "whatever" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid Credentials");
  });

  it("returns 400 'Invalid Credentials' (same message) when the password is wrong", async () => {
    User.findOne.mockResolvedValue({
      _id: "user-1",
      email: "real@example.com",
      password: "hashed-password",
      role: "Student",
    });
    bcrypt.compare.mockResolvedValue(false);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "real@example.com", password: "wrong-password" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid Credentials");
  });

  it("returns 200 with a real, decodable JWT and logs the login on success", async () => {
    User.findOne.mockResolvedValue({
      _id: "user-1",
      email: "real@example.com",
      password: "hashed-password",
      role: "Admin",
    });
    bcrypt.compare.mockResolvedValue(true);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "real@example.com", password: "correct-password" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Login successful");
    expect(typeof res.body.token).toBe("string");

    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);

    expect(decoded).toMatchObject({
      id: "user-1",
      email: "real@example.com",
      role: "Admin",
    });

    expect(Auditlog.create).toHaveBeenCalledWith({
      user: "real@example.com",
      action: "Login",
    });
  });
});
