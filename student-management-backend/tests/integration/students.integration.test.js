// Integration tests: real Mongoose models, a real (in-memory) MongoDB, real
// HTTP requests via request(app). Where the unit tests answer "does the
// handler branch correctly" against mocks, these answer "does the whole
// stack actually work" — real schema validation, real persistence, and
// specifically that adminOnly blocking a request also means nothing was
// actually written, not just that the right status code came back while a
// mock silently would have written anyway.
const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

// Not what this file is testing, and the real implementation would try (and
// fail) a live Nodemailer call on every add/update against no configured
// credentials — mocked purely to keep this file focused and quiet.
jest.mock("../../utils/sendNotificationEmail", () =>
  jest.fn().mockResolvedValue(undefined),
);
// None of the fixtures below set a profilePicPublicId, so the PUT/DELETE
// routes' cleanup calls never actually fire in this file today — mocked
// anyway so a real Cloudinary network call is never even possible here,
// now or if a future test in this file adds one.
jest.mock("../../utils/cloudinary", () => ({
  uploader: { destroy: jest.fn().mockResolvedValue({ result: "ok" }) },
}));

const { app } = require("../../app");
const Student = require("../../models/Student");
const User = require("../../models/User");
const Auditlog = require("../../models/Auditlog");

let mongod;
let adminToken;
let studentToken;
let seededStudentId;

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // Real bcrypt hashes, matching exactly what authRoutes.js's register
  // handler does — this is what lets the auth integration file's login
  // tests exercise the real hash/compare round trip.
  const adminUser = await User.create({
    name: "Integration Admin",
    email: "integration-admin@example.com",
    password: await bcrypt.hash("adminPass123", 10),
    role: "Admin",
  });
  const studentUser = await User.create({
    name: "Integration Student",
    email: "integration-student@example.com",
    password: await bcrypt.hash("studentPass123", 10),
    role: "Student",
  });

  adminToken = signToken(adminUser);
  studentToken = signToken(studentUser);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Student.deleteMany({});
  await Auditlog.deleteMany({});

  const seeded = await Student.create({
    name: "Existing Student",
    email: "existing@example.com",
    course: "Computer Science",
    age: 20,
    cgpa: 7.5,
  });

  seededStudentId = seeded._id.toString();
});

describe("GET /api/v1/students", () => {
  it("returns real paginated data from the real seeded collection", async () => {
    const res = await request(app)
      .get("/api/v1/students")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe("Existing Student");
    expect(res.body.totalStudents).toBe(1);
  });
});

describe("POST /api/v1/students", () => {
  const payload = {
    name: "Real New Student",
    email: "realnew@example.com",
    course: "Information Technology",
    age: 22,
    cgpa: 8.9,
  };

  it("as Admin: creates a real document and a real audit log entry", async () => {
    const res = await request(app)
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(payload);

    expect(res.status).toBe(201);

    const inDb = await Student.findOne({ email: "realnew@example.com" });

    expect(inDb).not.toBeNull();
    expect(inDb.name).toBe("Real New Student");

    const logs = await Auditlog.find({ action: /Added student/ });

    expect(logs).toHaveLength(1);
  });

  it("as Student: is rejected with 403 and writes nothing", async () => {
    const res = await request(app)
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${studentToken}`)
      .send(payload);

    expect(res.status).toBe(403);

    const inDb = await Student.findOne({ email: "realnew@example.com" });

    expect(inDb).toBeNull();

    const countAfter = await Student.countDocuments();

    expect(countAfter).toBe(1); // only the beforeEach-seeded student
  });
});

describe("PUT /api/v1/students/:id", () => {
  it("as Admin: really updates the document", async () => {
    const res = await request(app)
      .put(`/api/v1/students/${seededStudentId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cgpa: 9.9 });

    expect(res.status).toBe(200);

    const inDb = await Student.findById(seededStudentId);

    expect(inDb.cgpa).toBe(9.9);
  });

  it("as Student: is rejected with 403 and leaves the document unchanged", async () => {
    const res = await request(app)
      .put(`/api/v1/students/${seededStudentId}`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ cgpa: 1.1 });

    expect(res.status).toBe(403);

    const inDb = await Student.findById(seededStudentId);

    expect(inDb.cgpa).toBe(7.5); // still the seeded value
  });
});

describe("DELETE /api/v1/students/:id", () => {
  it("as Admin: really removes the document", async () => {
    const res = await request(app)
      .delete(`/api/v1/students/${seededStudentId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const inDb = await Student.findById(seededStudentId);

    expect(inDb).toBeNull();
  });

  it("as Student: is rejected with 403 and the document still exists", async () => {
    const res = await request(app)
      .delete(`/api/v1/students/${seededStudentId}`)
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(403);

    const inDb = await Student.findById(seededStudentId);

    expect(inDb).not.toBeNull();
  });
});
