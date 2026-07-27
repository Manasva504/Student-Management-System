# Student Management System

A full-stack web application for managing student records, built during an internship at Adnate IT Solutions. Administrators can create, search, filter, and export student data; view dashboard analytics; and track administrative actions through an audit log. Authentication is JWT-based with two roles (Admin and Student), and the backend uses Redis for response caching and logout token invalidation.

The project is split into a React frontend at the repository root and an Express/MongoDB backend under `student-management-backend/`.

---

## Live demo

**https://student-management-system-ivory-phi.vercel.app**

Backend API: https://student-management-system-zk2b.onrender.com

### Demo account

No signup needed — the login screen has a **"Sign in as demo user"** button, or enter these directly:

| Email | Password |
|---|---|
| `demo@example.com` | `DemoPass123` |

The demo account uses the `Student` role, so it can browse students and dashboard analytics but cannot create, edit, delete, or export records — those routes are Admin-only. It also can't change its own password, email, or delete itself, since that would break the demo for the next visitor. Register your own account to see the Admin side.

### First load may be slow

The backend is on Render's free tier and sleeps after inactivity. The first request can take 30–60 seconds while it wakes. The app detects this and retries automatically with backoff, showing a "Waking the server" banner rather than an error.

> **Note:** the previously circulated URL `student-management-system-drab-eta.vercel.app` returns `404` and is not a valid deployment. Use the link above.

---

## Screenshots

<!-- TODO: add screenshots.
     Suggested: login screen, student list with filters, dashboard analytics,
     add/edit student form, activity history.
     Place image files under docs/screenshots/ and link them here. -->

_Screenshots not yet added._

---

## Tech stack

Only packages actually present in `package.json` / `student-management-backend/package.json` are listed.

### Frontend
| Package | Purpose |
|---|---|
| React 19 | UI |
| Vite 8 | Build tool / dev server |
| Redux Toolkit + React Redux | State management |
| React Router 7 | Routing |
| Axios | HTTP client |
| Socket.IO Client | Real-time updates |
| Recharts | Dashboard charts |
| Framer Motion | Animation |
| Lucide React | Icons |
| React Hot Toast, SweetAlert2 | Notifications / confirm dialogs |

### Backend
| Package | Purpose |
|---|---|
| Express 4 | HTTP server |
| Mongoose 9 | MongoDB ODM |
| redis (node-redis v4) | Caching + JWT blacklist |
| Socket.IO | Real-time server |
| jsonwebtoken, bcryptjs | Auth and password hashing |
| Helmet, express-mongo-sanitize, express-rate-limit | Security middleware |
| Multer + multer-storage-cloudinary, cloudinary | Image upload and storage |
| xlsx, pdfkit | Excel and PDF export |
| Resend, Nodemailer | Transactional email |
| Winston, Morgan | Logging |
| node-cron | Scheduled daily summary job |

### Infrastructure
- Docker + Docker Compose (MongoDB, Redis, backend, frontend)
- nginx (serves the built frontend inside its container)
- Vercel (frontend hosting), Render (backend hosting)

### Testing
- Backend: Jest, Supertest, mongodb-memory-server
- Frontend: Vitest, React Testing Library, jsdom, `@vitest/coverage-v8`

---

## Features

### Student management
- Full CRUD via `/api/v1/students`
- Case-insensitive search across name, email, and `_id`
- Filter by branch (`course`) and CGPA range (`minCgpa` / `maxCgpa`)
- Sort by name, CGPA, or course; offset pagination via `page` / `limit`
- Export the current filtered result set as Excel, CSV, or PDF
- Per-student notification email, triggered manually by an admin

### Authentication and authorization
- JWT auth (`utils/tokenFactory.js`), 1-day expiry, payload `{ id, email, role }`
- Two roles — `Admin` and `Student` — enforced by `middleware/rolemiddleware.js`; all student writes, exports, and admin routes are Admin-only
- Registration always creates a `Student`; promotion to `Admin` is a manual database change
- Forgot-password flow: 6-digit OTP emailed to the user, 5-minute expiry, re-verified server-side on the actual reset (not just at the verify step)
- Email format and minimum 8-character password enforced on register, reset, and change-password

### Caching and sessions (Redis)
- Cache-aside caching on `GET /students` (keyed by the full query string) and all three dashboard endpoints (fixed keys), 60-second TTL from `CACHE_TTL_SECONDS`
- Cache invalidation on every student create/update/delete, clearing `students:*` via non-blocking `SCAN` plus the three `dashboard:*` keys
- Logout writes the JWT to a Redis blacklist with a TTL equal to the token's own remaining lifetime; `authMiddleware` rejects blacklisted tokens with `401`
- Every Redis call degrades gracefully — on an outage the app falls back to querying MongoDB directly and treats tokens as not blacklisted, logging a warning rather than failing the request

### Real-time (Socket.IO)
- JWT-authenticated socket handshake; anonymous connections are rejected
- Live online-user count (`presence:count`), de-duplicated per user so multiple tabs count once
- Admin-only activity feed (`activity:new`) covering student add/edit/delete and user online/offline events
- Client-side toasts on `student:added` / `student:updated` / `student:deleted`

### Dashboard analytics
- `GET /dashboard/stats` — total students, per-branch counts, average CGPA, highest-CGPA student
- `GET /dashboard/branch-chart` — MongoDB aggregation pipeline (`$group` / `$project` / `$sort`) producing per-branch student counts and average CGPA
- `GET /dashboard/registration-trend` — aggregation pipeline bucketing registrations by month via `$dateToString`

### Auditing and logging
- `AuditLog` model records `{ user, action }` with timestamps for logins, student create/edit/delete, password changes, and logout
- Login audit entries are written by an event listener (`events/authEvents.js` → `listeners/authListeners.js`) rather than inline in the route
- Admin-only `GET /auth/activity-logs` returns the 200 most recent entries
- Winston logging to console plus `logs/app.log`, with a separate `logs/error.log`; Morgan request logs are piped through the same Winston instance
- `node-cron` job logs a daily student-count summary at midnight; also exposed on demand at `POST /admin/daily-summary`

### Image handling
- Profile pictures upload to Cloudinary under a `student-profiles` folder (local disk storage was removed — Render's filesystem is ephemeral)
- Uploads restricted to JPEG/PNG/WebP with a 5 MB limit; rejections return a clean `400`
- Old Cloudinary assets are deleted when a photo is replaced or a student is removed, so images don't orphan
- Images render through `q_auto,f_auto,w_200,h_200,c_fill` URL transformations for automatic format/quality selection and consistent thumbnail sizing

---

## Architecture

### Layering

The backend is organized in layers, though the layering is applied **unevenly** — this is worth stating plainly:

- **`User` domain** — fully layered: routes → `services/userService.js` → `repositories/userRepository.js` → Mongoose model. `BaseService` and `BaseRepository` provide generic CRUD; both receive their dependency (repository / model) via constructor injection.
- **`Student` domain** — **not** layered. Route handlers in `routes/studentRoutes.js` call Mongoose directly. There is no `StudentRepository` or `StudentService`.

There is no `controllers/` directory; handler logic lives inside the route files. Calling this a strict MVC implementation would overstate it — it is layered where the login/auth refactor reached, and route-centric elsewhere.

`app.js` builds and exports the Express app, HTTP server, and Socket.IO instance but performs **no startup side effects** — no DB connection, no port binding, no cron scheduling. `server.js` is the only file that starts anything. That split is what allows Supertest to import the app cleanly in tests.

### Design patterns

| Pattern | Location | What it does |
|---|---|---|
| Singleton | `config/db.js` | An `isConnected` flag makes `connectDB()` a no-op after the first call, guaranteeing one shared MongoDB connection |
| Factory | `utils/tokenFactory.js` | `createAuthToken(user)` centralizes JWT payload shape, secret, and expiry in one place |
| Strategy | `utils/notificationStrategies.js` | `getNotificationStrategy(type)` selects a notification sender at runtime; adding SMS is a one-line change |
| Observer | `events/authEvents.js` + `listeners/authListeners.js` | Login emits `userLoggedIn`; a listener writes the audit log, decoupling the event from its consequences |
| Adapter | `utils/sendEmail.js` (Resend), `utils/sendNotificationEmail.js` (Nodemailer) | Two different email providers behind one identical `(to, subject, text)` interface |
| Dependency Injection | `repositories/BaseRepository.js`, `services/BaseService.js` | Model and repository are constructor-injected rather than hardcoded, so they can be swapped for testing |

Route modules also use injection where they need something built in `app.js`: `studentRoutes(io)` and `adminRoutes(logDailySummary)` are factory functions that receive their dependency at mount time.

SOLID shows up most clearly as Single Responsibility (the layer split above) and Open/Closed (the Strategy registry, and extending `BaseRepository`/`BaseService` rather than modifying them).

### Directory structure

```
student-management-system/
├── src/                              # React frontend
│   ├── components/                   # ActivityFeed, Navbar, StudentCard, ProtectedRoute, LampToggle
│   ├── context/SocketContext.jsx     # Socket.IO connection + presence
│   ├── pages/                        # Login, Register, Dashboard, StudentList, AddStudent,
│   │                                 #   EditStudent, StudentDetails, Profile, ForgotPassword,
│   │                                 #   VerifyOtp, ResetPassword, ChangePassword,
│   │                                 #   ManageBranches, ActivityHistory
│   ├── redux/                        # store, authSlice, studentSlice, dashboardSlice
│   ├── services/                     # authServices.js, studentService.js (API layer)
│   ├── test-utils/                   # renderWithProviders.jsx
│   └── utils/                        # cloudinaryImage.js, confirm.js
│
├── student-management-backend/
│   ├── app.js                        # Express app + Socket.IO (no side effects)
│   ├── server.js                     # Entry point: DB connect, cron, listen
│   ├── config/db.js                  # Singleton connection
│   ├── routes/                       # authRoutes, studentRoutes, dashboardRoutes,
│   │                                 #   uploadRoutes, adminRoutes
│   ├── services/                     # BaseService, userService
│   ├── repositories/                 # BaseRepository, userRepository
│   ├── models/                       # User, Student, Auditlog
│   ├── middleware/                   # authMiddleware, rolemiddleware, rateLimiter, errorHandler
│   ├── events/ + listeners/          # Observer pattern for login auditing
│   ├── utils/                        # cache, redisClient, cloudinary, logger, tokenFactory,
│   │                                 #   notificationStrategies, validators, constants, ...
│   ├── scripts/                      # benchmark.js, seedBenchmarkData.js
│   └── tests/                        # unit/ and integration/
│
├── docker-compose.yml                # mongo, redis, backend, frontend
├── Dockerfile                        # Frontend build → nginx
└── vercel.json                       # SPA rewrite rule
```

---

## API

All API routes are versioned under `/api/v1`. `GET /` is deliberately left unversioned as a health check (`Backend Running`) — health checks aren't part of the API contract.

**There is no Swagger/OpenAPI documentation in this repository.** The table below is the reference; adding OpenAPI is listed under [Roadmap](#limitations-and-roadmap).

| Group | Base path | Endpoints | Auth |
|---|---|---|---|
| Auth | `/api/v1/auth` | `POST /register`, `POST /login`, `POST /forgot-password`, `POST /verify-otp`, `POST /reset-password` | Public (rate-limited) |
| Account | `/api/v1/auth` | `GET /profile`, `PUT /profile`, `PUT /change-password`, `POST /logout`, `DELETE /delete-account` | JWT |
| Audit | `/api/v1/auth` | `GET /activity-logs` | JWT + Admin |
| Students | `/api/v1/students` | `GET /`, `GET /:id` | JWT |
| Students | `/api/v1/students` | `POST /`, `PUT /:id`, `DELETE /:id`, `POST /:id/notify` | JWT + Admin |
| Exports | `/api/v1/students` | `GET /export/excel`, `GET /export/csv`, `GET /export/pdf` | JWT + Admin |
| Dashboard | `/api/v1/dashboard` | `GET /stats`, `GET /branch-chart`, `GET /registration-trend` | JWT |
| Upload | `/api/v1/upload` | `POST /` | JWT |
| Admin | `/api/v1/admin` | `POST /daily-summary` | JWT + Admin |
| Health | — | `GET /` (plain text), `GET /api/v1/health` (JSON) | Public |

`GET /api/v1/health` returns `{ status, uptime, timestamp }` and touches neither MongoDB nor Redis, so it stays cheap enough to poll on a schedule. Pointing an external pinger at it every 10 minutes keeps the Render free instance from idling into a cold start.

`GET /api/v1/students` accepts `search`, `branch`, `minCgpa`, `maxCgpa`, `sortBy` (`name` \| `cgpa` \| `course`), `page`, and `limit`. The export endpoints accept the same filters and ignore pagination.

Authenticate by sending `Authorization: Bearer <token>`.

---

## Getting started

### Prerequisites
- Node.js 20+ (Docker images use `node:20-alpine`)
- Docker Desktop, for MongoDB and Redis
- A Cloudinary account (free tier) — the backend **exits at startup** if Cloudinary variables are missing outside test mode
- A Resend API key, for password-reset emails

### 1. Clone and configure

```bash
git clone https://github.com/Manasva504/Student-Management-System.git
cd Student-Management-System
cp student-management-backend/.env.example student-management-backend/.env
```

On Windows PowerShell:
```powershell
Copy-Item student-management-backend\.env.example student-management-backend\.env
```

Fill in `student-management-backend/.env`:

```env
MONGO_URI=mongodb://mongo:27017/studentmanagement
JWT_SECRET=<a long random string>
PORT=5000
RESEND_API_KEY=<your resend api key>
REDIS_HOST=redis
REDIS_PORT=6379
CLOUDINARY_CLOUD_NAME=<your cloudinary cloud name>
CLOUDINARY_API_KEY=<your cloudinary api key>
CLOUDINARY_API_SECRET=<your cloudinary api secret>
```

Cloudinary credentials come from your Cloudinary dashboard under "Product Environment Credentials".

> The `MONGO_URI` and `REDIS_HOST` values above use Docker service names (`mongo`, `redis`) and only resolve **inside** the Compose network. If you run the backend directly on your host instead, use `mongodb://localhost:27017/studentmanagement` and `REDIS_HOST=localhost`.

### 2. Run everything with Docker Compose

```bash
docker compose up --build
```

This starts four containers:

| Service | Port | Notes |
|---|---|---|
| `frontend` | 8081 | Built with Vite, served by nginx |
| `backend` | 5000 | Express API |
| `mongo` | 27017 | Persisted to the `mongo-data` volume |
| `redis` | 6379 | Persisted to `redis-data`, RDB snapshot every 60s |

Open **http://localhost:8081**.

The frontend image is built with `VITE_API_BASE_URL=http://localhost:5000` (a Docker build argument), because the browser reaches the backend through the published host port, not the Compose service name.

Stop with:
```bash
docker compose down
```

### 3. Or run the services individually

Start only the databases:
```bash
docker compose up mongo redis
```

Backend (from `student-management-backend/`, with `MONGO_URI` and `REDIS_HOST` pointed at `localhost`):
```bash
cd student-management-backend
npm install
npm start          # node server.js — http://localhost:5000
```

Frontend (from the repository root, in a second terminal):
```bash
npm install
npm run dev        # Vite dev server — http://localhost:5173
```

Both `http://localhost:5173` and `http://localhost:8081` are in the backend's CORS allowlist.

### 4. Create an admin account

A demo user (`demo@example.com` / `DemoPass123`, `Student` role) is seeded automatically on every backend start — the seed is idempotent and leaves an existing demo user untouched.

Registration always creates a `Student`. To grant yourself Admin, update the user directly in MongoDB:

```bash
docker exec -it mongo mongosh studentmanagement
```
```javascript
db.users.updateOne({ email: "you@example.com" }, { $set: { role: "Admin" } })
```

Log out and back in afterwards — the role is embedded in the JWT, so an existing token keeps the old role.

### Available scripts

**Root (frontend)**
| Command | Description |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest (single run) |
| `npm run test:coverage` | Vitest with V8 coverage |

**`student-management-backend/`**
| Command | Description |
|---|---|
| `npm start` | Start the API server |
| `npm test` | Jest |
| `npm run test:coverage` | Jest with coverage |

---

## Testing

```bash
# Backend — 42 tests across 5 files
cd student-management-backend
npm test

# Frontend — 8 tests across 4 files
npm test
```

**Backend (Jest + Supertest + mongodb-memory-server).** Unit tests mock the Mongoose models, Cloudinary, and the email sender to exercise handler logic — validation branches, status codes, response shapes, and the `adminOnly` block — while leaving JWT signing/verification real. Integration tests run the same flows against a real in-memory MongoDB through `request(app)` and assert on actual database state, including that a rejected write leaves the collection unchanged. `jest.config.js` sets a 20-second timeout, since the in-memory MongoDB binary can be slow to start on a cold run.

`tests/integration/demoAccount.integration.test.js` additionally covers the hosted-demo behaviour: that the demo seed is idempotent (a re-run leaves a drifted account untouched rather than resetting it), that the demo account can read but cannot change its own password, email, or delete itself, that a non-demo user is unaffected by that guard, and that `/api/v1/health` answers unauthenticated.

**Frontend (Vitest + React Testing Library).** Component tests render pages with the real Redux store and reducers via `renderWithProviders`, mocking only the service-layer network calls.

Two known caveats, stated rather than hidden:

- **Redis is bypassed under `NODE_ENV=test`.** Every function in `utils/cache.js` short-circuits in test mode, and `redisClient.js` never calls `connect()`. This keeps tests independent of a running Redis and prevents cross-test cache pollution — but it also means **real cache hits and real blacklist rejections are not covered by automated tests**.
- **On Windows, running the full suite in parallel can fail intermittently.** `mongodb-memory-server` spawns a real `mongod` per Jest worker, and under CPU contention those can exceed the startup timeout. If integration tests fail with `Instance failed to start`, re-run, or use `npx jest --runInBand`.

---

## Performance

The repository includes benchmarking scripts, so these numbers are reproducible rather than claimed.

Measured locally against 500 seeded students, 50 requests per phase, with both the backend and Redis on the same machine:

| Endpoint | Cache cold (avg / min / max) | Cache warm (avg / min / max) | Ratio |
|---|---|---|---|
| `GET /students?page=1&limit=20` | 11.0 ms / 5 ms / 146 ms | 2.7 ms / 1 ms / 5 ms | ~4.1× |
| `GET /dashboard/stats` | 15.1 ms / 9 ms / 27 ms | 2.1 ms / 1 ms / 4 ms | ~7.2× |

"Cold" flushes Redis before *every* request, forcing each one through MongoDB; "warm" primes the cache once and then measures. These are small-dataset numbers from a single local machine — they demonstrate the caching layer works, not production throughput.

Reproduce:
```bash
cd student-management-backend
node scripts/seedBenchmarkData.js                      # seeds 500 students into MONGO_URI
npm start                                              # in another terminal
BENCH_TOKEN=<a valid JWT> node scripts/benchmark.js
```

---

## Security

- **Helmet** registered as the first middleware, before CORS — a CORS rejection calls `next(err)` and skips later non-error middleware, so ordering it first ensures rejected responses still carry security headers
- **NoSQL injection sanitization** via `express-mongo-sanitize`, stripping `$`-prefixed and dotted keys from body, query, and params
- **Rate limiting** on the five brute-forceable auth routes: 10 requests per IP per 15 minutes, returning `429` and logging a warning; disabled under `NODE_ENV=test`
- **`trust proxy` set to `1`** (not `true`) so `req.ip` resolves to the real client behind Render's single proxy hop, without honouring a spoofed `X-Forwarded-For` chain
- **Passwords** hashed with bcrypt (cost 10); minimum length 8
- **Error responses gated on `NODE_ENV`** — the real error is logged via Winston, but production clients receive a generic `Server Error` instead of Mongoose internals that could be used to probe the schema
- **ObjectId validation** on every `:id` route before it reaches Mongoose, returning `400` instead of an unhandled `CastError`
- **Upload restrictions** — MIME allowlist (JPEG/PNG/WebP) and a 5 MB cap
- **OTP re-verification** on password reset, so the reset endpoint can't be called directly while skipping the verify step
- **JWT blacklisting** on logout, so a token can be invalidated before its natural expiry

### Known accepted risks

- **`xlsx`** carries two unpatched high-severity advisories ([GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6), [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9)) with no npm-published fix. Both require parsing attacker-controlled spreadsheets; this app only ever calls `xlsx.write()` on server-generated data, never `xlsx.read()`.
- **`cloudinary@1.x`** has an argument-injection advisory ([GHSA-g4mf-96x5-5m2c](https://github.com/advisories/GHSA-g4mf-96x5-5m2c)) fixed only in 2.7+, a major version `multer-storage-cloudinary` does not support. No user-controlled input reaches a Cloudinary API parameter here — the upload folder is a hardcoded constant and public IDs are Cloudinary-generated.

Both should be revisited if the relevant usage patterns ever change.

---

## Limitations and roadmap

Honest list of what is not done:

- **The hosted demo is out of sync** — the Render backend needs a redeploy from `master` to serve `/api/v1` routes (see [Live demo](#live-demo))
- **No Swagger/OpenAPI documentation.** The API table above is the only reference
- **Layering is inconsistent** — only the `User` domain uses the repository/service layers; `Student` CRUD talks to Mongoose directly from route handlers
- **No admin UI for role management** — promoting a user to Admin requires a manual database update
- **No refresh tokens** — a single 1-day JWT, with logout handled by blacklisting
- **No CI pipeline** — no GitHub Actions workflow, so tests are not run automatically on push
- **Test coverage is partial** — 50 tests total, focused on student CRUD, login, and the demo account; the OTP flow, exports, uploads, dashboard endpoints, and Socket.IO events have no automated coverage
- **Real cache hits and blacklist rejections are untested**, since Redis is bypassed in test mode
- **Branch list is stored in `localStorage`**, not in the database, so it doesn't sync across devices or users
- **Socket.IO presence is in-memory**, so counts reset on restart and would not be shared across multiple backend instances
- **Pagination is offset-based**, which degrades on large collections compared to cursor pagination
- **Unused dependencies** remain in `package.json` — `otp-generator`, `recharts`, and `sweetalert2` in the backend; `express` and `multer` at the frontend root

---

## License

No license file is currently present in this repository.
