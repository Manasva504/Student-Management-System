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
- Redis / Caching
- Performance: Redis Caching
- Cloudinary Setup
- Screenshots
- License


## Features

- User authentication using JWT
- Student CRUD operations
- Dashboard for student management
- Email notifications using Resend
- MongoDB database integration
- Redis caching for list/dashboard endpoints and JWT logout blacklist
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
- Redis (caching + JWT logout blacklist)

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

## Redis / Caching

Redis (`redis:7-alpine` in Docker Compose, the official [`redis`](https://www.npmjs.com/package/redis) npm package / node-redis v4 client) is used for two unrelated things: caching read-heavy Mongo queries, and blacklisting logged-out JWTs. Both are designed so a Redis outage degrades the app rather than breaking it — every cache/blacklist call in `utils/cache.js` catches its own errors, logs a Winston warning, and falls back to the pre-Redis behavior (hit Mongo directly / treat the token as not blacklisted).

### Setup
- `docker-compose.yml` adds a `redis` service alongside `mongo`, with a named volume (`redis-data`) and `--save 60 1` for basic RDB persistence — nice-to-have for surviving a container restart, not required, since this is a cache, not a system of record.
- `utils/redisClient.js` exports one configured node-redis `createClient()` instance (`url: redis://${REDIS_HOST}:${REDIS_PORT}`), reading `REDIS_HOST`/`REDIS_PORT` from the environment (`localhost:6379` default for running the backend directly outside Docker; `.env.example` ships `REDIS_HOST=redis`/`REDIS_PORT=6379` to match the Compose service name, the same pattern `MONGO_URI` already uses for `mongo`). Unlike ioredis, node-redis has no `lazyConnect` — `connect()` is called explicitly at module load (skipped under `NODE_ENV=test`, see below), with a top-level `.catch()` that logs a startup failure via Winston instead of crashing the process. `disableOfflineQueue: true` makes a command sent while disconnected reject immediately rather than queue indefinitely, so `utils/cache.js`'s try/catch actually catches a dead Redis fast instead of hanging.
- `utils/cache.js` wraps the client with `cacheGet`/`cacheSet`/`deleteByPattern`/`invalidateStudentCaches`/`blacklistToken`/`isTokenBlacklisted` — every one of them catches its own errors and logs via Winston rather than throwing, so a dead Redis never crashes a request; it just always misses. Written against node-redis v4's API: `client.set(key, value, { EX: ttlSeconds })` (an options object, not ioredis's positional `("EX", ttl)`), and `client.scanIterator({ MATCH: pattern, COUNT: 100 })` (an async generator yielding one key at a time) instead of ioredis's `scanStream`.

### API response caching (cache-aside)
- `GET /students` — key is `students:${JSON.stringify(req.query)}` (the full query string, since search/branch/CGPA-range/sort/page/limit all produce different result sets), TTL 60s.
- `GET /dashboard/stats`, `GET /dashboard/branch-chart`, `GET /dashboard/registration-trend` — fixed keys (`dashboard:stats`, `dashboard:branch-chart`, `dashboard:registration-trend`), no query params to vary on, TTL 60s.
- TTL lives in one place — `CACHE_TTL_SECONDS` in `utils/constants.js` — rather than a magic `60` scattered across five routes.
- Cache-aside, not write-through: check Redis first and return on a hit; on a miss, run the real Mongo query, write the result to Redis, then return it. Error responses are never cached — `cacheSet` is only ever called on the success path inside the `try` block, before the response is sent.

### Cache invalidation
`POST /students`, `PUT /students/:id`, and `DELETE /students/:id` all call `invalidateStudentCaches()` right after their Mongo write succeeds (and after the audit log write, before the response). It does two things:
1. `deleteByPattern("students:*")` — clears every cached `/students` query variant, using Redis `SCAN` (cursor-paginated, non-blocking) rather than `KEYS` (a single blocking call that walks the whole keyspace and stalls every other client on a busy Redis).
2. Deletes all three fixed `dashboard:*` keys — adding/editing/deleting a student changes the aggregate stats too, not just the list.

One call at each of the three mutation sites, rather than duplicating the same key-clearing logic three times.

### JWT logout blacklist
`POST /api/auth/logout` computes how many seconds are left before the token's own `exp` claim (`req.user.exp - Math.floor(Date.now() / 1000)`) and writes `blacklist:<token>` to Redis with that as the TTL — a token blacklisted a minute before it would've expired anyway doesn't sit in Redis for hours; the entry expires exactly when the token would have stopped working regardless. `middleware/authMiddleware.js` checks `isTokenBlacklisted(token)` right after `jwt.verify()` succeeds (checked after, not before, so a malformed/expired/wrongly-signed token never costs a Redis round trip) and returns `401` if it's blacklisted.

The blacklist check **fails open**: if Redis is unreachable, `isTokenBlacklisted` returns `false` (logging a warning) rather than rejecting the request. A brief window where a just-logged-out token still works during a Redis outage is a far smaller problem than every authenticated user in the app being locked out until Redis comes back — the same "degrade, don't crash" principle as the caching layer.

### Test-mode behavior
Every function in `utils/cache.js` short-circuits to a no-op (or a safe default, e.g. `isTokenBlacklisted` returning `false`) when `NODE_ENV === "test"` — the same pattern the auth rate limiter already uses (`middleware/rateLimiter.js`'s `skip`). This was a deliberate call, not an oversight: the existing Jest suite asserts directly against mocked Mongoose calls with fresh state every test (`jest.clearAllMocks()` in `beforeEach`, no equivalent Redis reset), so a cache hit left over from an earlier test would silently return stale data instead of exercising the route logic under test. Skipping also means running the suite never opens a real Redis connection — `redisClient.js` skips calling `connect()` entirely under `NODE_ENV=test` — **the test suite does not exercise real cache-hit or real blacklist-rejection behavior**; that's covered by the manual benchmark run below and by exploratory testing (login → logout → re-use the same token → confirm `401`), not by an automated test. Flagging this explicitly rather than leaving it implicit.

## Performance: Redis Caching

Measured with `scripts/benchmark.js` against 500 seeded student documents (`scripts/seedBenchmarkData.js`), 50 requests per phase, backend and Redis running locally (not on Render/Vercel, to remove network variance from the numbers):

| Endpoint | Without cache (cold, avg / min / max) | With cache (warm, avg / min / max) | Speedup |
|---|---|---|---|
| `GET /students?page=1&limit=20` | 11.0ms / 5ms / 146ms | 2.7ms / 1ms / 5ms | ~4.1x |
| `GET /dashboard/stats` | 15.1ms / 9ms / 27ms | 2.1ms / 1ms / 4ms | ~7.2x |

"Cold" flushes Redis before *every single request* in that phase, so each one is genuinely forced through Mongo rather than measuring a cache that warms itself up after the first hit. "Warm" populates the cache once, then measures 50 requests that should all be served straight from Redis.

**Why the gap:** the cold path pays for a real Mongo round trip every time — for `/students`, a `countDocuments()` plus a `find().sort().skip().limit()` query over 500 documents; for `/dashboard/stats`, a full collection scan (`Student.find()` with no filter) plus in-process aggregation over all 500 documents on every request. The warm path skips Mongo entirely and returns the exact same JSON body straight from an in-memory Redis `GET` — no query planner, no disk/network I/O to the database, no aggregation work, just a key lookup. The gap would widen further on a larger collection or under concurrent load (the cold path scales with collection size and Mongo's current load; the warm path stays roughly constant), and would also be larger in production, where the backend and MongoDB are on separate hosts (Render + Atlas) rather than both local — this benchmark's cold numbers are a lower bound on the real-world gap, not an upper one.

Reproduce it: `node scripts/seedBenchmarkData.js` (seeds `MONGO_URI`), start the backend, then `BENCH_TOKEN=<a valid JWT> node scripts/benchmark.js`.

## Cloudinary Setup

Student and user profile pictures are stored in [Cloudinary](https://cloudinary.com) rather than on local disk — required because Render's filesystem is ephemeral (anything written to it, including `POST /upload`'s old `./uploads` folder, is wiped on every redeploy).

### Getting credentials

1. Create a free account at [cloudinary.com](https://cloudinary.com/users/register/free).
2. Once logged in, your **Dashboard** page shows all three values this app needs, under "Product Environment Credentials":
   - **Cloud Name**
   - **API Key**
   - **API Secret** (click "reveal" to see it)

### Environment variables

Add these three to `student-management-backend/.env` (already present, secret-free, in `.env.example`):

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

The backend fails loudly at startup (logs a clear error and exits) if any of these three are missing outside test mode — better than a confusing 500 on the first upload attempt in production.

### Image delivery convention

Every rendered profile picture URL runs through `src/utils/cloudinaryImage.js`'s `getThumbnailUrl()`, which inserts `q_auto,f_auto,w_200,h_200,c_fill` into the Cloudinary URL path (right after `/upload/`) — automatic quality/format selection per requesting browser, cropped to a consistent 200×200 square — instead of ever serving the original, full-size upload for what's always displayed as a small avatar.