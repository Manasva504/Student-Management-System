# Student Management System (MERN Stack)
A full-stack Student Management System built with React, Node.js, Express, and MongoDB. The application enables administrators to securely manage student records through authentication, CRUD operations, dashboard analytics, and email notifications. It also includes Docker support and automated testing using Jest and Supertest.

## Table of Contents

- Features
- Tech Stack
- Installation
- Docker Setup
- Environment Variables
- Design Patterns Used
- Security & Logging
- Screenshots
- License


## Features

- User authentication using JWT
- Student CRUD operations
- Dashboard for student management
- Email notifications using Resend
- MongoDB database integration
- Docker support
- Unit and integration testing with Jest and Supertest

## Tech Stack

### Frontend
- React
- Vite

### Backend
- Node.js
- Express.js

### Database
- MongoDB

### Testing
- Jest
- Supertest

### Containerization
- Docker
- Docker Compose


## Installation

### Backend

```bash
cd student-management-backend
npm install
```

### Frontend

```bash
npm install
npm run dev
```


## Docker Setup

### Prerequisites
- Docker Desktop installed and running

### Environment Variables

Inside `student-management-backend`, copy the example file:

```bash
cp .env.example .env
```


Update the values in `.env` with your own credentials.

Required variables:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
PORT=5000
RESEND_API_KEY=your_resend_api_key
```

On Windows (PowerShell):

```powershell
Copy-Item .env.example .env
```

### Running with Docker Compose (recommended)
From the project root:
```bash
docker compose up
```

This builds and starts three containers:
- `mongo` — official MongoDB image, exposed on port 27017
- `backend` — Node/Express API, exposed on port 5000
- `frontend` — React app, built and served via nginx on port 8081

Once running, open `http://localhost:8081` in your browser.

To stop:

```bash
docker compose down
```

### Running Services Individually

**Backend**

```bash
cd student-management-backend

docker build -t student-backend .
docker run -p 5000:5000 --env-file .env student-backend
```

**Frontend**

```bash

docker build -t student-frontend .
docker run -p 8081:80 student-frontend
```


## Design Patterns Used

### Singleton — config/db.js
An isConnected flag guards connectDB() against opening a second MongoDB connection if called more than once. Guarantees exactly one shared connection for the app's lifetime.

### Factory — utils/tokenFactory.js
createAuthToken(user) centralizes JWT creation in one place. Any part of the app needing a token calls this function instead of duplicating jwt.sign(...) details (secret, algorithm, payload shape).

### Strategy — utils/notificationStrategies.js
getNotificationStrategy(type) picks which notification implementation to use at runtime. Callers (e.g. forgot-password) always call the same interface regardless of which concrete sender they get back.

### Observer — events/authEvents.js + listeners/authListeners.js
Login emits a "userLoggedIn" event instead of directly writing an audit log. A separate listener reacts to it. Decouples "what happened" from "what should happen as a result," so new reactions can be added without touching the login route.

### Adapter — utils/sendEmail.js (Resend) and utils/sendNotificationEmail.js (Nodemailer/Gmail)
Two different email providers, each wrapped behind the identical (to, subject, text) interface. Callers never know or care which provider is underneath — this uniformity is what made Strategy Pattern possible on top of them.

### Dependency Injection — repositories/BaseRepository.js + services/BaseService.js
Generic CRUD/business-logic classes that receive their Model/Repository via constructor injection rather than hardcoding it. UserRepository/UserService extend these bases, so common logic is written once and reused, and dependencies can be swapped (e.g., for testing) without changing the base classes.

### DRY / Clean Code — utils/responseHandler.js, utils/constants.js, utils/validators.js
Extracted repeated response-shaping, hardcoded strings, and field-validation logic out of authRoutes.js into shared modules, removing duplication across routes.

## Security & Logging

The backend went through an OWASP-basics hardening pass covering HTTP headers, injection protection, brute-force protection, input validation, error-handling hygiene, and centralized logging.

### HTTP security headers — Helmet
`helmet()` is the very first middleware registered in `app.js`, before CORS. It has to run first: `corsOriginCheck`'s rejection path calls `next(err)`, which skips every subsequent non-error middleware and jumps straight to the error handler — so if Helmet ran after CORS, a CORS-rejected response would go out with no security headers at all. Running it first guarantees every response gets them, rejected or not.

### NoSQL injection protection — express-mongo-sanitize
`mongoSanitize()` strips any request key starting with `$` or containing a `.` from `req.body`/`req.query`/`req.params` before it reaches Mongoose, closing the classic `{ "$gt": "" }` operator-injection hole in login/search fields.

### Brute-force protection — express-rate-limit
`middleware/rateLimiter.js` defines `authLimiter`: 10 requests per IP per 15-minute window, applied to the five auth routes someone could actually brute-force — `POST /login`, `/register`, `/forgot-password`, `/verify-otp`, `/reset-password`. Exceeding the limit returns `429` and logs a Winston warning (`ip`, `path`). It's skipped entirely when `NODE_ENV === "test"` so the Jest suite's repeated login/register calls aren't throttled.

**`trust proxy`:** `app.set("trust proxy", 1)` is set right after `const app = express()`. Render sits in front of this app as a single reverse-proxy hop — without `trust proxy`, `express-rate-limit`'s default `keyGenerator` reads `req.ip` off the raw socket, which resolves to Render's proxy IP for *every* request, collapsing all real users into one shared rate-limit bucket. The value is the literal `1` (trust exactly one hop), not `true` (which would trust an unbounded chain and accept a spoofed `X-Forwarded-For` header from anywhere).

### Request/error logging — Morgan + Winston
Morgan logs every request (`combined` format: method, URL, status, response time, remote addr, user-agent) piped through the shared Winston logger (`utils/logger.js`) instead of straight to console, so it lands in the same place — console + `logs/app.log` — as every other log line. Winston also has a dedicated `logs/error.log` transport (level: `error`), and every remaining `catch` block across `app.js`/`authRoutes.js` (student CRUD, auth flows, exports, uploads) logs through `logger.error(...)` rather than raw `console.log`/`console.error`, so error visibility is consistent and queryable in one place instead of scattered across stdout.

### Error-handling hygiene
`middleware/errorHandler.js` and the `/login` route both log the real error (`err.stack`/`err.message`) via Winston, but gate what reaches the *client* on `NODE_ENV`: outside production the real message is returned (useful while developing), but in production a generic `"Server Error"` goes out instead. This prevents raw Mongoose/Mongo error internals — field names, query structure, cast-type details — from being usable as a probing surface by an attacker hitting malformed input against the live API. Routes that already return controlled, safe messages (e.g. `"Invalid Credentials"`, `"Invalid or expired OTP"`) are unaffected — the gate only kicks in for errors without an explicit, intentional status code, i.e. genuinely unexpected failures.

### Input validation
- **Student `:id` routes** (`GET/PUT/DELETE /students/:id`, `POST /students/:id/notify`) validate `req.params.id` with `mongoose.Types.ObjectId.isValid(...)` before it reaches Mongoose, returning a clean `400 "Invalid student ID"` instead of letting a malformed id throw an unhandled `CastError` that falls through to a generic `500`.
- **Email format** (`utils/validators.js`'s `isValidEmail`) and a **minimum 8-character password** (`isValidPassword`) are enforced on `POST /register`, `POST /reset-password`, `PUT /change-password` (new password), and `PUT /profile` (email field) — a simple regex check, not a full RFC 5322 validator, deliberately: good enough to reject obviously-malformed input without the false-negative headaches a fully spec-compliant email regex brings.
- **File uploads** (`POST /upload`) are restricted via `multer`'s `fileFilter` to `image/jpeg`, `image/png`, and `image/webp` only, with a `5MB` size limit (`limits.fileSize`). Rejections come back as a clean `400` with the specific reason instead of an unhandled multer crash or a silently-empty `req.file`.

### Known accepted risk — xlsx CVEs
`xlsx` (used by `GET /students/export/excel`) has two unpatched high-severity CVEs — [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) (prototype pollution) and [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) (ReDoS) — neither fixable via `npm audit fix`, since SheetJS never published a patched version to npm for either advisory. This is an **accepted risk, not a gap**: this app only ever calls `xlsx.write()` on server-generated data built from `buildStudentQuery()` results — it never calls `xlsx.read()`/parses attacker-controlled input, which is the vector both CVEs require. A library migration was considered out of scope for this pass since it risks breaking the Excel export feature for a CVE class that isn't reachable here; re-evaluate if this ever starts parsing uploaded spreadsheets.