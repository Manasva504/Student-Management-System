// Covers the hosted-demo affordances: the seeded demo account, the guard
// that stops any visitor from breaking that shared account for the next
// one, and the unauthenticated health endpoint an external pinger uses to
// keep Render's free instance warm.
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

jest.mock("../../utils/sendNotificationEmail", () =>
  jest.fn().mockResolvedValue(undefined),
);
jest.mock("../../utils/cloudinary", () => ({
  uploader: { destroy: jest.fn().mockResolvedValue({ result: "ok" }) },
}));

const { app } = require("../../app");
const User = require("../../models/User");
const { DEMO_USER, seedDemoUser } = require("../../utils/demoAccount");

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe("seedDemoUser", () => {
  it("creates the demo account with the Student role and a usable password", async () => {
    await seedDemoUser();

    const user = await User.findOne({ email: DEMO_USER.email });

    expect(user).not.toBeNull();
    expect(user.role).toBe("Student");
    // Stored hashed, not in plaintext, and matching the advertised password.
    expect(user.password).not.toBe(DEMO_USER.password);
    expect(await bcrypt.compare(DEMO_USER.password, user.password)).toBe(true);
  });

  it("is idempotent — a second run neither duplicates nor overwrites", async () => {
    await seedDemoUser();

    const first = await User.findOne({ email: DEMO_USER.email });

    // Simulate the account having drifted since it was seeded (e.g. an
    // admin renamed it): a re-run on the next boot must leave it alone
    // rather than resetting it.
    await User.updateOne(
      { email: DEMO_USER.email },
      { $set: { name: "Renamed By Admin" } },
    );

    await seedDemoUser();

    const all = await User.find({ email: DEMO_USER.email });

    expect(all).toHaveLength(1);
    expect(all[0]._id.toString()).toBe(first._id.toString());
    expect(all[0].name).toBe("Renamed By Admin");
  });
});

describe("demo account restrictions", () => {
  let demoToken;

  beforeEach(async () => {
    await seedDemoUser();

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: DEMO_USER.email, password: DEMO_USER.password });

    expect(res.status).toBe(200);

    demoToken = res.body.token;
  });

  it("can log in with the advertised credentials", () => {
    expect(typeof demoToken).toBe("string");
  });

  it("can still read student data", async () => {
    const res = await request(app)
      .get("/api/v1/students")
      .set("Authorization", `Bearer ${demoToken}`);

    expect(res.status).toBe(200);
  });

  it("cannot change its own password", async () => {
    const res = await request(app)
      .put("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${demoToken}`)
      .send({ oldPassword: DEMO_USER.password, newPassword: "SomethingElse123" });

    expect(res.status).toBe(403);

    // The password genuinely still works afterward.
    const stillWorks = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: DEMO_USER.email, password: DEMO_USER.password });

    expect(stillWorks.status).toBe(200);
  });

  it("cannot change its own email via profile update", async () => {
    const res = await request(app)
      .put("/api/v1/auth/profile")
      .set("Authorization", `Bearer ${demoToken}`)
      .send({ email: "hijacked@example.com" });

    expect(res.status).toBe(403);

    const user = await User.findOne({ email: DEMO_USER.email });

    expect(user).not.toBeNull();
  });

  it("cannot delete itself", async () => {
    const res = await request(app)
      .delete("/api/v1/auth/delete-account")
      .set("Authorization", `Bearer ${demoToken}`);

    expect(res.status).toBe(403);

    const user = await User.findOne({ email: DEMO_USER.email });

    expect(user).not.toBeNull();
  });

  it("cannot create students (Student role, adminOnly route)", async () => {
    const res = await request(app)
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${demoToken}`)
      .send({
        name: "Should Not Exist",
        email: "nope@example.com",
        course: "Computer Science",
        age: 20,
        cgpa: 8,
      });

    expect(res.status).toBe(403);
  });
});

describe("a non-demo user is unaffected by the guard", () => {
  it("can change their own password", async () => {
    await User.create({
      name: "Real User",
      email: "real@example.com",
      password: await bcrypt.hash("OriginalPass123", 10),
      role: "Student",
    });

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "real@example.com", password: "OriginalPass123" });

    expect(login.status).toBe(200);

    const res = await request(app)
      .put("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${login.body.token}`)
      .send({ oldPassword: "OriginalPass123", newPassword: "BrandNewPass123" });

    expect(res.status).toBe(200);
  });
});

describe("GET /api/v1/health", () => {
  it("responds without authentication", async () => {
    const res = await request(app).get("/api/v1/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.uptime).toBe("number");
    expect(typeof res.body.timestamp).toBe("string");
  });
});
