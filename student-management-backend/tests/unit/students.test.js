// Unit tests for the student CRUD routes — the Student/Auditlog models and
// the notification email are mocked so these run fast, with no real
// database, and verify only the *handler's own logic*: validation
// branches, status codes, response shapes, and the adminOnly check.
// authMiddleware/adminOnly and JWT signing/verifying are NOT mocked —
// they're cheap, deterministic, and "does adminOnly actually block a
// non-admin" is one of the things this file is specifically meant to
// prove. io.emit(...) also runs for real and unmocked: with no connected
// sockets in a test process it's an authentic no-op, nothing to fake.
const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../../models/Auditlog", () => ({ create: jest.fn() }));
jest.mock("../../utils/sendNotificationEmail", () =>
  jest.fn().mockResolvedValue(undefined),
);
// Real Cloudinary credentials never exist in a test run, and nothing here
// should ever make a real network call to Cloudinary's API — only
// uploader.destroy() is used by the routes under test (PUT/DELETE), so
// that's the only method this needs to fake.
jest.mock("../../utils/cloudinary", () => ({
  uploader: { destroy: jest.fn().mockResolvedValue({ result: "ok" }) },
}));
jest.mock("../../models/Student", () => {
  const mockSave = jest.fn().mockImplementation(function () {
    if (!this._id) this._id = "mocked-student-id";
    return Promise.resolve(this);
  });

  function MockStudent(data) {
    Object.assign(this, data);
    this._doc = { ...data };
    this.save = mockSave;
  }

  MockStudent.find = jest.fn();
  MockStudent.countDocuments = jest.fn();
  MockStudent.findById = jest.fn();
  MockStudent.findByIdAndUpdate = jest.fn();
  MockStudent.findByIdAndDelete = jest.fn();
  MockStudent.__mockSave = mockSave;

  return MockStudent;
});

const { app } = require("../../app");
const Student = require("../../models/Student");
const Auditlog = require("../../models/Auditlog");
const cloudinary = require("../../utils/cloudinary");

function signToken(role) {
  return jwt.sign(
    { id: "test-user-id", email: "tester@example.com", role },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );
}

const adminToken = signToken("Admin");
const studentToken = signToken("Student");

// GET /api/v1/students chains .find(query).sort().skip().limit() — this builds a
// mock that supports that exact chain and resolves to `students` at the end.
function mockFindChain(students) {
  const chain = {
    sort: jest.fn(function () {
      return this;
    }),
    skip: jest.fn(function () {
      return this;
    }),
    limit: jest.fn().mockResolvedValue(students),
  };

  Student.find.mockReturnValue(chain);

  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/v1/students", () => {
  it("returns 401 with no token", async () => {
    const res = await request(app).get("/api/v1/students");

    expect(res.status).toBe(401);
  });

  it("returns the paginated response shape on success", async () => {
    Student.countDocuments.mockResolvedValue(2);
    mockFindChain([
      { _id: "1", name: "Asha", email: "asha@x.com", course: "CS", age: 20, cgpa: 8.1, profilePic: "" },
      { _id: "2", name: "Ben", email: "ben@x.com", course: "IT", age: 21, cgpa: 7.4, profilePic: "" },
    ]);

    const res = await request(app)
      .get("/api/v1/students")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({ id: "1", name: "Asha" });
    expect(res.body.totalStudents).toBe(2);
    expect(res.body.totalPages).toBe(1);
  });
});

describe("POST /api/v1/students", () => {
  const validBody = {
    name: "New Student",
    email: "new@x.com",
    course: "Computer Science",
    age: 20,
    cgpa: 8.5,
  };

  it("returns 401 with no token", async () => {
    const res = await request(app).post("/api/v1/students").send(validBody);

    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-Admin token (the adminOnly check)", async () => {
    const res = await request(app)
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${studentToken}`)
      .send(validBody);

    expect(res.status).toBe(403);
    expect(Student.__mockSave).not.toHaveBeenCalled();
  });

  it("returns 400 and never saves when a required field is missing", async () => {
    const res = await request(app)
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...validBody, email: undefined });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("All fields are required");
    expect(Student.__mockSave).not.toHaveBeenCalled();
  });

  it("returns 400 for an out-of-range CGPA", async () => {
    const res = await request(app)
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...validBody, cgpa: 11 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("CGPA must be between 0 and 10");
    expect(Student.__mockSave).not.toHaveBeenCalled();
  });

  it("returns 201 and the created student on success, and logs it", async () => {
    const res = await request(app)
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.student).toMatchObject({ name: "New Student" });
    expect(Student.__mockSave).toHaveBeenCalledTimes(1);
    expect(Auditlog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: "Added student: New Student" }),
    );
  });
});

describe("PUT /api/v1/students/:id", () => {
  it("returns 403 for a non-Admin token", async () => {
    const res = await request(app)
      .put("/api/v1/students/507f1f77bcf86cd799439011")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ cgpa: 9 });

    expect(res.status).toBe(403);
    expect(Student.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed ID", async () => {
    const res = await request(app)
      .put("/api/v1/students/not-a-valid-id")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cgpa: 9 });

    expect(res.status).toBe(400);
    expect(Student.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 when the student doesn't exist", async () => {
    Student.findByIdAndUpdate.mockResolvedValue(null);

    const res = await request(app)
      .put("/api/v1/students/507f1f77bcf86cd799439099")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cgpa: 9 });

    expect(res.status).toBe(404);
  });

  it("returns 200 and the updated student on success", async () => {
    Student.findByIdAndUpdate.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      _doc: { name: "Updated Name", cgpa: 9 },
      name: "Updated Name",
      cgpa: 9,
    });

    const res = await request(app)
      .put("/api/v1/students/507f1f77bcf86cd799439011")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cgpa: 9 });

    expect(res.status).toBe(200);
    expect(res.body.student).toMatchObject({ name: "Updated Name" });
    expect(Auditlog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: "Edited student: Updated Name" }),
    );
  });

  it("deletes the old Cloudinary asset when the image is actually replaced", async () => {
    Student.findById.mockResolvedValue({ profilePicPublicId: "old-public-id" });
    Student.findByIdAndUpdate.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      _doc: { name: "Updated Name" },
      name: "Updated Name",
    });

    const res = await request(app)
      .put("/api/v1/students/507f1f77bcf86cd799439011")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ profilePic: "https://res.cloudinary.com/x/new.jpg", profilePicPublicId: "new-public-id" });

    expect(res.status).toBe(200);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("old-public-id");
  });

  it("does not touch Cloudinary when the update doesn't change the image", async () => {
    Student.findById.mockResolvedValue({ profilePicPublicId: "old-public-id" });
    Student.findByIdAndUpdate.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      _doc: { name: "Renamed Only" },
      name: "Renamed Only",
    });

    const res = await request(app)
      .put("/api/v1/students/507f1f77bcf86cd799439011")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Renamed Only" });

    expect(res.status).toBe(200);
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/v1/students/:id", () => {
  it("returns 403 for a non-Admin token", async () => {
    const res = await request(app)
      .delete("/api/v1/students/507f1f77bcf86cd799439011")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
    expect(Student.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed ID", async () => {
    const res = await request(app)
      .delete("/api/v1/students/not-a-valid-id")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(Student.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it("returns 404 when the student doesn't exist", async () => {
    Student.findByIdAndDelete.mockResolvedValue(null);

    const res = await request(app)
      .delete("/api/v1/students/507f1f77bcf86cd799439099")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it("returns 200 and confirms deletion on success, without touching Cloudinary when there's no stored asset", async () => {
    Student.findByIdAndDelete.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      _doc: { name: "Gone Student" },
      name: "Gone Student",
    });

    const res = await request(app)
      .delete("/api/v1/students/507f1f77bcf86cd799439011")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Student deleted successfully");
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
    expect(Auditlog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: "Deleted student: Gone Student" }),
    );
  });

  it("deletes the Cloudinary asset when the removed student had one", async () => {
    Student.findByIdAndDelete.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      _doc: { name: "Gone Student" },
      name: "Gone Student",
      profilePicPublicId: "some-public-id",
    });

    const res = await request(app)
      .delete("/api/v1/students/507f1f77bcf86cd799439011")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("some-public-id");
  });
});
