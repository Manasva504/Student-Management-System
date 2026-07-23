# Week in Review — student-management-system

**Covers:** 2026-07-10 through 2026-07-16 (7 commits), plus a 2026-07-20 follow-up on file storage

This document walks through everything that changed in the backend over the
past week, in the order it happened, and explains *why* each change was
made — not just what the diff says. It's written to be read start to
finish, but each phase stands on its own if you want to jump to one topic.

Every technical term is defined in plain language the first time it shows
up, then used freely afterward.

## Timeline at a glance

| Date | Commit | What |
|---|---|---|
| 2026-07-10 | `93f6ea4` | Test suite (backend + frontend) |
| 2026-07-12 | `affafb4` | Docker support |
| 2026-07-15 | `953ff6e` | Repository/Service architecture, Singleton, Factory, Strategy, Observer |
| 2026-07-15 | `ff814aa` | Response handler / constants / validators extraction |
| 2026-07-15 | `59e26e7` | Docs consolidation (housekeeping) |
| 2026-07-16 | `6e563a7` | Winston/Morgan logging + OWASP security hardening |
| 2026-07-16 | `452775b` | Redis: caching, invalidation, JWT blacklist |
| 2026-07-20 | *(uncommitted — pending manual credential testing)* | Cloudinary: profile picture storage migration |

---

## Phase 0 — Testing infrastructure (2026-07-10, `93f6ea4`)

Not one of the five areas you asked about in detail, but worth a paragraph
since it's the commit everything else this week was built on top of.

**What changed:** `server.js` (previously one ~800-line file holding
routes, Socket.IO setup, the cron job, and the actual `server.listen()`
call) was split into `app.js` (routes, middleware, Socket.IO — builds the
Express app but never connects to a database or binds a port) and a slim
`server.js` (calls `connectDB()`, schedules the cron job, and calls
`server.listen()`). The `Student` model was pulled out of `server.js` into
its own `models/Student.js`, matching how `User.js` and `Auditlog.js` were
already organized.

**Why it was needed:** the testing library used for the backend
(**Supertest** — lets you fire fake HTTP requests at your Express app in a
test, without a real network socket) needs to `require()` the app to test
it. The old `server.js` connected to the real production MongoDB and
opened a real port the moment it was loaded — you can't safely `require()`
that in an automated test. Splitting the "build the app" part from the
"actually start it" part is what made automated testing possible at all.

**Concept:** this is a form of **separation of concerns** — code that 
*configures* something (the Express app) shouldn't be tangled up with code
that *runs* it (opening a real network connection). This exact split
(`app.js` / `server.js`) is why every later commit this week — the
security hardening, the Redis integration — could be verified with a real
test suite instead of "looks right, ship it."

**Also in this commit:** Jest + Supertest + `mongodb-memory-server` (a
temporary, in-process MongoDB used only for tests, so tests never touch
your real database) for the backend; Vitest + React Testing Library for
the frontend, chosen over Jest specifically because the frontend uses
`import.meta.env` (Vite's way of exposing environment variables to
frontend code) in files the component tests needed to render for real,
and Jest's default tooling can't parse that syntax without extra setup —
Vitest reuses Vite's own build pipeline, so it's a non-issue there.

---

## Phase 1 — Docker / Infrastructure (2026-07-12, `affafb4`)

### What changed

**`docker-compose.yml`** (new, 28 lines) defines four things that run
together as one system:

```yaml
volumes:
  mongo-data:          # a named, persistent disk area Docker manages for you
services:
  mongo:
    image: mongo                    # pull the official MongoDB image, don't build one
    container_name: mongo
    ports:
      - "27017:27017"               # host:container — reach Mongo at localhost:27017
    volumes:
      - mongo-data:/data/db         # Mongo's data directory lives on the named volume

  backend:
    build: ./student-management-backend   # build from the Dockerfile in this folder
    container_name: backend
    ports:
      - "5000:5000"
    depends_on:
      - mongo                       # start mongo before backend
    env_file:
      ./student-management-backend/.env   # load secrets/config from this file

  frontend:
    build: .                        # build from the Dockerfile in the repo root
    container_name: frontend
    ports:
      - "8081:80"
    depends_on:
      - backend
```

**`student-management-backend/Dockerfile`** — a two-line-summary recipe for
building the backend's container image: start from `node:20-alpine` (a
minimal Linux image with Node.js pre-installed — "alpine" images are
built on a stripped-down Linux distribution to keep the image small),
copy in `package*.json`, run `npm install --omit=dev` (skip devDependencies
like Jest — they're not needed to *run* the app, only to test it), copy
the rest of the source, expose port 5000, and run `node server.js`.

**Root `Dockerfile`** — a **multi-stage build** for the frontend: stage
one (`node:20-alpine`) installs dependencies and runs `npm run build` to
produce a static `dist/` folder; stage two starts fresh from `nginx:alpine`
(a tiny web server) and copies *only* the built `dist/` output into it.
The Node.js toolchain, source files, and `node_modules` from stage one
never make it into the final image — only the compiled static files do.
This is why the frontend container just serves files via nginx rather than
running a Node dev server in production.

**`.dockerignore`** (both root and backend) — tells Docker not to copy
`node_modules`, `coverage`, `tests`, `.env`, `.env.test`, and `.git` into
the build context. Without this, `.env` (which holds real secrets) could
end up baked into a container image layer — images are often pushed to a
registry or shared, so a secret baked into one is effectively leaked.

**`.env.example`** (new) — a secret-free template showing which
environment variables the backend expects (`MONGO_URI`, `JWT_SECRET`,
`PORT`, `RESEND_API_KEY` at this point in the week), so a new clone of the
repo tells you exactly what to fill in rather than leaving you to guess by
reading the source.

### Why containerization was used here

Before this, running the project meant: install MongoDB yourself, get the
version right, start it, hope your Node version matches, set up `.env` by
hand, and repeat all of that on every machine you develop on. **Docker**
packages an application together with everything it needs to run (its own
tiny Linux environment, exact dependency versions) into a single,
portable unit called an **image** — and **Docker Compose** is a way to
describe *multiple* related containers (here: database, backend, frontend)
and their relationships (`depends_on`, shared networking, port mappings)
in one file, so `docker compose up` boots the entire stack — database
included — with one command, identically on any machine.

**Tradeoff considered:** you could run MongoDB as a cloud-hosted service
(MongoDB Atlas) instead of a local container, and in fact the real
production deployment (Render + Vercel) *does* use Atlas — `docker-compose.yml`
is specifically for local development and testing, not production. Running
Mongo in a container locally means development never depends on network
access to a cloud database, and never risks a developer accidentally
running commands against production data while testing something locally.

---

## Phase 2 — Architecture refactor (2026-07-15, three commits)

This phase touched the *shape* of the backend's code more than its
behavior — the login flow works the same from the outside, but how it's
built internally changed a lot. This is the part of the week that's most
about software design, so it gets the longest treatment.

### 2.1 — Repository pattern (`953ff6e`)

**What changed:** two new files.

`repositories/BaseRepository.js`:
```js
class BaseRepository {
  constructor(model) {
    this.model = model; // <-- injected, not hardcoded — this IS the DI
  }
  async findById(id) { return this.model.findById(id); }
  async findOne(filter) { return this.model.findOne(filter); }
  async findAll(filter = {}) { return this.model.find(filter); }
  async create(data) { return this.model.create(data); }
  async updateById(id, data) { return this.model.findByIdAndUpdate(id, data, { new: true }); }
  async deleteById(id) { return this.model.findByIdAndDelete(id); }
}
```

`repositories/userRepository.js`:
```js
class UserRepository extends BaseRepository {
  constructor() {
    super(User); // hands the User model down to BaseRepository — DI happening right here
  }
  async findByEmail(email) { return this.model.findOne({ email }); }
}
module.exports = new UserRepository();
```

**What a Repository is:** a thin layer whose only job is "get data in and
out of the database." It doesn't know about passwords, tokens, or HTTP —
it just wraps the six basic operations (`findById`, `findOne`, `findAll`,
`create`, `updateById`, `deleteById`) around whatever database library
you're actually using (here, Mongoose).

**Why it was needed:** before this, every route in `authRoutes.js` called
`User.findOne(...)`, `user.save()`, etc. directly. That's not wrong for a
small app, but it means "how do I look up a user" is a decision repeated
in every route instead of made once. `UserRepository.findByEmail(email)`
is now the one place that knows what "look up a user by email" means.

**Tradeoff / what wasn't done:** this pattern was applied to `User` only.
`Student` (in `app.js`'s CRUD routes) still calls `Student.find()`,
`Student.findByIdAndUpdate()`, etc. directly, with no `StudentRepository`.
That's a real inconsistency worth noticing — the refactor started with
auth because that's what was being worked on, not because Student data
access is somehow simpler. If this pattern gets extended later, Student
CRUD is the natural next candidate.

### 2.2 — Service layer pattern (`953ff6e`)

**What changed:** `services/BaseService.js` and `services/userService.js`.

```js
class BaseService {
  constructor(repository) {
    this.repository = repository; // injected, same idea as BaseRepository
  }
  async getById(id) {
    const item = await this.repository.findById(id);
    if (!item) throw new AppError("Not found", 404);
    return item;
  }
  // ...updateById, deleteById follow the same "throw AppError if missing" shape
}
```

```js
class UserService extends BaseService {
  constructor() { super(userRepository); }

  async login(email, password) {
    if (!email || !password) {
      throw new AppError("Please provide Email and Password", 400);
    }
    const user = await this.repository.findByEmail(email);
    if (!user) throw new AppError("Invalid Credentials", 400);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new AppError("Invalid Credentials", 400);

    const token = createAuthToken(user);
    authEvents.emit("userLoggedIn", user);
    return { message: "Login successful", token };
  }
}
```

**What a Service is:** the layer above the Repository that holds
*business logic* — the actual rules ("a login needs both an email and a
password," "a wrong password means the same error as no such user," "a
successful login should create a token and record the fact"). The Service
calls the Repository for data access but never touches Mongoose directly
itself.

**`utils/AppError.js`** is a small supporting piece — a custom `Error`
subclass that carries an HTTP status code alongside the message:
```js
class AppError extends Error {
  constructor(message, statusCode) { super(message); this.statusCode = statusCode; }
}
```
This is what lets `userService.login()` say "this should be a 400" without
knowing anything about Express's `res.status().json()` — the *route*
decides how to turn that into an HTTP response, the *service* just decides
what went wrong and how bad it is.

**Before vs. after in `routes/authRoutes.js`'s `/login` route** — this is
the clearest before/after in the whole week. Before, the route was ~50
lines: validate input, query the database, compare the password with
bcrypt, sign a JWT, write an audit log entry, all inline. After:

```js
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await userService.login(email, password);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});
```

**Why it was needed:** the old version mixed three different concerns in
one function — parsing an HTTP request, deciding business rules, and
talking to the database — which meant you couldn't test "does the
password-check logic work" without also spinning up Express and firing a
real HTTP request at it. Now `userService.login()` can be tested on its
own, and the route's only job is translating between HTTP and the service.

**Concept — the SOLID principles that show up here** (SOLID is a set of
five widely-used object-oriented design guidelines; the acronym is what
each letter stands for):

- **Single Responsibility Principle** — each layer has exactly one reason
  to change. `BaseRepository` changes only if *how data is fetched*
  changes; `BaseService` changes only if *business rules* change; the
  route changes only if *the HTTP shape* changes. Before the refactor, all
  three reasons to change lived in one function.
- **Open/Closed Principle** ("open for extension, closed for
  modification") — shows up most clearly in the Strategy pattern below
  (§2.3), but also here: adding a `StudentRepository` later means writing
  a new small class that extends `BaseRepository`, not editing
  `BaseRepository` itself.
- **Liskov Substitution Principle** — `UserRepository extends
  BaseRepository` and `UserService extends BaseService` without
  overriding or breaking any inherited method's behavior; anywhere code
  expects "a repository with `findById`/`findAll`/etc." a `UserRepository`
  instance works correctly, because it only *adds* `findByEmail` rather
  than changing what the inherited methods do.
- **Dependency Inversion Principle** — see the **Dependency Injection**
  callout right below; this is the principle DI is the concrete technique
  for.

### 2.3 — Dependency Injection, concretely

**Dependency Injection (DI)** means: instead of a class reaching out and
constructing (or importing) the exact thing it depends on, that thing is
*handed to it* from outside — usually via the constructor.

**Where it's actually used in this codebase:**

```js
// repositories/BaseRepository.js
constructor(model) {
  this.model = model; // <-- injected
}
// repositories/userRepository.js
constructor() {
  super(User); // <-- User model passed in here
}
```
```js
// services/BaseService.js
constructor(repository) {
  this.repository = repository; // <-- injected
}
// services/userService.js
constructor() {
  super(userRepository); // <-- userRepository instance passed in here
}
```

**Where it's *not* used, for contrast** — the naive/hardcoded alternative
would look like this (not real code, just what it would look like if DI
*weren't* used):
```js
// hypothetical, NOT what the code does
class UserRepository {
  async findById(id) {
    const User = require("../models/User"); // reaches out and grabs it itself
    return User.findById(id);
  }
}
```
The actual `app.js` still does something close to this for `Student` —
every student route (`app.js:371`, `app.js:439`, `app.js:504`, etc.)
calls `Student.findById(...)` / `Student.findByIdAndUpdate(...)` directly,
with `Student` imported once at the top of the file and used everywhere,
rather than injected into anything.

**Why DI is better than the hardcoded version, specifically:**
1. **Testability** — `tests/unit/students.test.js` mocks the `Student`
   model directly with `jest.mock("../../models/Student", ...)` because
   there's no injection point to swap in a fake one; the auth unit tests
   can mock at a cleaner boundary because `userService` receives its
   repository rather than importing a model directly.
2. **Reuse** — `BaseRepository`/`BaseService` are written once and reused
   by handing them a *different* model/repository, instead of copy-pasting
   the same CRUD methods for every new entity.

**Tradeoff:** DI adds a layer of indirection — to understand what
`userService.login()` actually queries, you now have to follow
`userService → userRepository → BaseRepository → User model`, instead of
seeing `User.findOne(...)` directly in the route. For a small app, this is
a real cost; it pays off as the number of entities and the amount of
business logic per entity grows, which is why it's a defensible call for
`User` (which now has login, password reset, OTP, profile logic) but a
genuinely debatable one for something as simple as `Student`'s current
CRUD.

### 2.4 — Design patterns, one by one

A **design pattern** is a named, reusable solution to a recurring
software design problem — not a library you install, but a shape of code
that experienced developers recognize on sight.

**Singleton** — a pattern that guarantees only one instance of something
exists and is reused everywhere, instead of creating a fresh one every
time it's needed.
- **File:** `config/db.js`
- **Implementation:**
  ```js
  let isConnected = false;
  const connectDB = async () => {
    if (isConnected) { console.log("Using existing MongoDB connection"); return; }
    try {
      await mongoose.connect(process.env.MONGO_URI);
      isConnected = true;
    } catch (error) { process.exit(1); }
  };
  ```
- **Why it fit better than the naive alternative:** the naive alternative
  is calling `mongoose.connect(...)` wherever a connection is needed,
  trusting that nothing ever calls it twice. Opening a second connection
  to the same database wastes a connection-pool slot for no benefit, and
  in some drivers can cause subtle race conditions during startup. The
  `isConnected` flag makes "only one real connection ever gets opened" a
  guarantee enforced by the code, not a convention someone has to remember.

**Factory** — a pattern where you call a function to *produce* a
fully-formed object, rather than constructing it by hand at every call
site.
- **File:** `utils/tokenFactory.js`
  ```js
  function createAuthToken(user) {
    return jwt.sign({ id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET, { expiresIn: "1d" });
  }
  ```
- **Why it fit better than the naive alternative:** before this existed,
  the JWT payload shape (`{id, email, role}`), the secret, and the
  expiry were all typed out inline in the login route. If you needed a
  token anywhere else (which, by the end of the week, includes Socket.IO
  handshake verification reading `process.env.JWT_SECRET` too) you'd
  either copy that shape again or risk it drifting out of sync. One
  function, one definition of "what a valid auth token looks like."

**Strategy** — a pattern where you define a family of interchangeable
behaviors behind one common interface, and pick which one to use at
runtime.
- **File:** `utils/notificationStrategies.js`
  ```js
  const strategies = {
    email: sendEmail,
    // sms: sendSms,  ← future: just add one line here, nothing else changes
  };
  function getNotificationStrategy(type) {
    return strategies[type] || strategies.email;
  }
  ```
- **Why it fit better than the naive alternative:** the naive version is
  an `if (type === "email") { ... } else if (type === "sms") { ... }`
  block wherever a notification is sent. Every new channel means editing
  every call site that has that `if/else` chain. With Strategy, adding
  `"sms"` later is a one-line addition to the `strategies` object — this
  is the **Open/Closed Principle** from §2.2 in action: open for adding a
  new strategy, closed to modifying the code that picks one.

**Observer** — a pattern where one part of the system announces "this
happened" without knowing or caring who (if anyone) is listening, and
other parts subscribe to react to it.
- **Files:** `events/authEvents.js` (a plain Node.js `EventEmitter` — a
  built-in object you can `.emit()` named events on and `.on()` to
  subscribe to them) + `listeners/authListeners.js`
  ```js
  // authEvents.js
  const authEvents = new EventEmitter();
  // authListeners.js
  authEvents.on("userLoggedIn", async (user) => {
    await Auditlog.create({ user: user.email, action: "Login" });
  });
  // userService.js's login():
  authEvents.emit("userLoggedIn", user);
  ```
- **Why it fit better than the naive alternative:** before, the login
  route wrote its own audit log entry directly — "a login happened" and
  "record that a login happened" were the same piece of code. With
  Observer, `userService.login()` only announces the fact; a separate
  listener decides what to do about it. If you later want a second
  reaction to a login (say, a welcome-back email, or updating a
  "last seen" timestamp), you add a second `.on("userLoggedIn", ...)`
  listener without touching `userService.login()` at all.
- **A second, larger example of the same pattern, not new this week but
  worth naming:** Socket.IO's `io.emit("student:added", ...)` and
  `io.to("admins").emit("activity:new", ...)` calls throughout `app.js`
  are the same Observer idea at a bigger scale — the server announces
  "a student was added," and every connected browser tab that's
  subscribed reacts (updates its list, shows a toast) without the server
  knowing or caring how many tabs are listening or what they each do
  about it.

**Adapter** — a pattern where two things with completely different
underlying implementations are wrapped behind one identical interface, so
the code calling them doesn't need to know which one it's talking to.
- **Files:** `utils/sendEmail.js` (uses the **Resend** service's REST
  API) and `utils/sendNotificationEmail.js` (uses **Nodemailer** over
  Gmail SMTP) — completely different libraries, completely different
  protocols, but both exposed as `async (to, subject, text) => { ... }`.
- **Why it fit better than the naive alternative:** without this, every
  call site that sends an email would need to know *which* provider it's
  using and call that provider's specific API shape. Because both are
  adapted to the same interface, `notificationStrategies.js`'s Strategy
  pattern (above) can treat `"email"` as one interchangeable option —
  Strategy and Adapter are stacked here: Adapter makes the two email
  senders *look* the same; Strategy is what picks between them.

### 2.5 — Cleanup commits (`ff814aa`, `59e26e7`)

Two smaller, same-day follow-ups:

- **`ff814aa`** pulled repeated patterns out of `authRoutes.js` into three
  new small files: `utils/responseHandler.js` (`sendSuccess`/`sendError`
  helpers so every route doesn't repeat
  `res.status(x).json({success, message, data})` by hand), `utils/constants.js`
  (shared string/number constants like `MESSAGES.SERVER_ERROR`, so
  `"Server Error"` is spelled once instead of copy-pasted at every catch
  block), and `utils/validators.js` (`hasRequiredFields` for checking a
  request body has what it needs). This is the **DRY principle** ("Don't
  Repeat Yourself") — the same three lines of response-shaping code
  scattered across ten routes become one function call at each site.
- **`59e26e7`** moved a `DESIGN_PATTERNS.md` file's content into the main
  `README.md` under a "Design Patterns Used" heading and deleted the
  separate file — pure documentation housekeeping, so there's one place
  to read about the codebase's design instead of two.

---

## Phase 3 — Logging (part of `6e563a7`, 2026-07-16)

### What changed

**`utils/logger.js`** (new) sets up **Winston** (a popular Node.js logging
library that lets you send log messages to multiple destinations at once,
in a structured format, with severity levels):

```js
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/app.log" }),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
  ],
});
```

A **transport** in Winston is just "a destination a log message gets
sent to." This logger has three: the terminal (Console), a file that
gets *everything* at `info` level or above (`app.log`), and a second file
that only gets messages at `error` level (`error.log` — Winston's `level`
option on a transport means "this destination only wants messages at this
severity or worse").

**Why two files instead of one:** `app.log` is the full firehose — every
HTTP request, every login attempt, every student created/edited/deleted.
`error.log` is a filtered subset containing *only* what went wrong. During
a real incident, you want to open `error.log` and immediately see the
handful of things that broke, not scroll past thousands of routine
`"GET /students 200"` lines in `app.log` to find them. This is a standard
operations pattern: keep your "something is wrong" signal in its own place,
separate from routine noise.

**`morgan`** (a small, widely-used HTTP request-logging middleware for
Express) was added and piped through Winston instead of writing to the
console directly:

```js
app.use(morgan("combined", {
  stream: { write: (message) => logger.info(message.trim()) },
}));
```

`"combined"` is one of Morgan's built-in log line formats — roughly the
same shape as Apache's "combined" access log: method, URL, status code,
response time, remote address, and user agent, all in one line per
request.

**Why pipe it through Winston instead of letting Morgan write to the
console itself:** Morgan, left alone, writes straight to `stdout` (the
terminal) with no relationship to Winston at all — you'd end up with two
disconnected logging systems: request lines visible only in the terminal,
and everything else (`logger.info`/`logger.warn` calls) only in
`app.log`/`error.log`. Piping Morgan's output through
`(message) => logger.info(message.trim())` means every request line goes
through the exact same three transports as everything else — one unified
log stream, one format (JSON with a timestamp), for requests, business
events, and errors alike.

**This replaced an old inline logger** that used to sit in `app.js`:
```js
// removed
app.use((req, res, next) => { console.log(`${req.method} ${req.url}`); next(); });
```
— which only printed method and URL, with no status code, timing, or
destination beyond the terminal.

**`logger.info`/`logger.warn` calls added throughout**, each with enough
context to answer "who did what": login success/failure in
`services/userService.js` (`Login successful: user=${user.email}` /
`Login failed: invalid credentials for email=${email}`), student
created/updated/deleted in `app.js` (e.g. `app.js:405`:
`` `Student created: name=${newStudent.name} email=${newStudent.email} by user=${req.user.email}` ``),
and logout in `authRoutes.js:325`.

**How this relates to the existing `Auditlog` model (not new this week,
but worth distinguishing):** the app already had `Auditlog.create({user,
action})` writing permanent records to MongoDB for things like logins,
password changes, and student edits. That's a structured, permanent,
queryable audit trail — meant for "who did what, ever," and shown to
admins in the app itself (`GET /activity-logs`). Winston's logs are a
different, complementary tool: operational, file-based, meant for
debugging and ops visibility, not a compliance record — and unlike
`Auditlog`, nothing in the app currently reads `app.log`/`error.log` back
programmatically; they're for a human (or a future log-aggregation tool)
to read directly.

---

## Phase 4 — Security hardening (part of `6e563a7`, 2026-07-16)

This phase added four new pieces of protection from a starting point of
*none of them existing*, then ran a follow-up audit that found and fixed
five more specific gaps in code that had just been written. All of it
landed in one commit.

### 4.1 — Helmet

**What it is:** `helmet()` is Express middleware that sets a collection of
HTTP response headers that browsers use to make security decisions.
Concretely, it sets things like:
- `X-Content-Type-Options: nosniff` — tells the browser "trust the
  `Content-Type` header I sent you, don't try to guess the file type
  yourself," which closes off a class of attack where a browser
  misinterprets an uploaded file as, say, executable HTML/JS because it
  *looks* like one even though it was labeled as an image.
- `X-Frame-Options` / frame-ancestors — prevents the site from being
  loaded inside an `<iframe>` on someone else's page, which is the
  building block of **clickjacking** (tricking a user into clicking
  something on your real site that's invisibly stacked under a
  attacker-controlled page).
- Removing the `X-Powered-By: Express` header — a small thing, but it
  stops the server from volunteering "I'm running Express" to anyone
  probing it, which is one less piece of free reconnaissance for an
  attacker looking for known Express-specific vulnerabilities.
- A restrictive default `Content-Security-Policy` and several other
  headers covering DNS prefetching, referrer leakage, and more.

**Where and why the ordering mattered:** `helmet()` was placed as the
very first middleware in `app.js`, immediately after `const app =
express()` (`app.js:57`), *before* CORS. The reason is subtle: this app's
CORS check (`corsOriginCheck`, `app.js:68`) rejects disallowed origins by
calling `next(new Error(...))` — and in Express, calling `next(err)`
skips every remaining *normal* middleware and jumps straight to the error
handler at the bottom. If Helmet had been registered *after* CORS (which
is how it originally was written before this commit), a request from a
disallowed origin would get rejected *before* Helmet ever ran — meaning
the error response sent back would have none of Helmet's protective
headers. Moving Helmet to run first guarantees every response, including
rejected ones, gets those headers.

### 4.2 — express-mongo-sanitize

**What NoSQL injection looks like without it, concretely:** MongoDB query
filters are just JSON objects, and Mongoose lets you pass user input
straight into one. If a login endpoint does
`User.findOne({ email: req.body.email, ... })` and the *email* field in
the JSON body isn't a plain string but an object like
`{"$gt": ""}` (a MongoDB **operator** meaning "greater than empty
string" — true for basically any real email in the database), the query
Mongoose actually runs becomes "find a user whose email is greater than
an empty string" — which matches *the first user in the collection*,
regardless of what real email exists. Depending on what else in the query
is also injectable, this can let an attacker log in as an arbitrary user,
or extract information about what data exists, without ever knowing a
real password. This is the NoSQL equivalent of classic SQL injection,
just using MongoDB's own query operators instead of SQL syntax.

**The fix:** `app.use(mongoSanitize())` (`app.js:91`) — this middleware
walks `req.body`, `req.query`, and `req.params` and strips out any key
that starts with `$` or contains a `.`, before your route ever sees it.
`{"$gt": ""}` becomes `{}` (an empty, harmless object) by the time your
`User.findOne(...)` call runs.

### 4.3 — express-rate-limit on auth routes

**What changed:** `middleware/rateLimiter.js` (new) defines `authLimiter`:
10 requests per IP address per 15-minute window, applied to exactly five
routes — `POST /login`, `/register`, `/forgot-password`, `/verify-otp`,
`/reset-password` (wired in at `routes/authRoutes.js:18,41,93,128,150`).
Going over the limit gets a `429 Too Many Requests` response and a
Winston warning logged (`rateLimiter.js:20`:
`` `Rate limit exceeded: ip=${req.ip} path=${req.originalUrl}` ``).

**Why only those five routes, and not e.g. `GET /students`:** rate
limiting exists to slow down someone *guessing* something — a password,
an OTP code. `GET /students` already requires a valid signed JWT via
`authMiddleware` — an attacker without valid credentials can't call it at
all, so limiting its request rate doesn't stop any attack, it just
inconveniences legitimate logged-in users clicking around the dashboard
quickly. The five auth routes are specifically the ones where the entire
point of the endpoint is "check if this guess is correct," which is
exactly what an attacker automating thousands of guesses would target.

**`skip: (req) => process.env.NODE_ENV === "test"`** — Jest automatically
sets `NODE_ENV=test` for every test run; without this, a test file that
calls `/login` more than 10 times (entirely plausible across a handful of
test cases) would start failing on rate limiting instead of testing what
it's actually meant to test. This exact "skip in test mode" pattern gets
reused later in the week by the Redis integration (§5.6).

### 4.4 — The `trust proxy` fix, and why it mattered specifically for Render

**The problem:** `express-rate-limit`'s default behavior identifies *who*
to rate-limit by reading `req.ip`. This app is deployed on **Render**,
which — like most hosting platforms — sits in front of your app as a
**reverse proxy**: every real visitor's request actually arrives at
Render's proxy first, and Render forwards it on to your app's container.
By default, Express computes `req.ip` from the raw TCP connection, which,
behind a proxy, is *always the proxy's own internal address* — not the
real visitor's. That means without any fix, every single visitor to the
site — regardless of who they actually are — looks identical to
`express-rate-limit`: they all appear to be "the proxy's IP." The
practical effect: the 10-request budget wouldn't be *10 per real user*,
it would be *10 total, shared across every visitor to the site combined*
— the tenth person to try logging in in a 15-minute window, anywhere,
would get rate-limited because of everyone else's requests, not their
own.

**The fix:** `app.set("trust proxy", 1)` (`app.js:49`), placed right
after `const app = express()`. This tells Express: "there is exactly one
reverse proxy in front of me — trust the `X-Forwarded-For` header it
sets, and use *that* as the real client IP instead of the raw socket
address." With this, `req.ip` correctly resolves to each real visitor's
own IP again, and rate limiting works per-person as intended.

**Why the value is `1` and not `true`:** `express-rate-limit`'s
documentation and Express's own docs both flag `true` as a footgun here —
it means "trust the entire `X-Forwarded-For` chain, however long it is."
`X-Forwarded-For` is a header that *anyone* can set on their own outgoing
request, including an attacker, listing whatever fake IP chain they want.
If you trust an unbounded chain, an attacker can simply prepend a fake IP
of their choosing to the header and have Express believe *that's* the
real client IP, defeating the rate limiter entirely (each attempt just
claims to come from a different fake IP). The literal `1` means "trust
exactly one hop" — Render's own proxy, and nothing an attacker appends
beyond it — matching Render's actual real-world network topology.

### 4.5 — The OWASP-basics audit: five specific findings, fixed

After the four protections above went in, a follow-up review specifically
looked for OWASP-style ("Open Web Application Security Project" — a
well-known nonprofit that publishes a widely-referenced list of common web
vulnerability categories) issues in what had just been written, plus a
few pre-existing gaps. Each finding below is described as: what an
attacker could actually do *before* the fix, and how the fix closes it.

**1. The error handler leaked internal details to the client.**
Before: `middleware/errorHandler.js` sent `err.message` straight back to
the client with no restriction —
```js
// before
res.status(err.status || 500).json({ message: err.message || "Server Error" });
```
For a raw, unexpected error (e.g. Mongoose's own validation or
type-casting errors), `err.message` often contains real internal detail
— field names, expected data types, sometimes fragments of the query
itself. An attacker deliberately sending malformed input to probe the API
(e.g. an obviously-wrong value in a field) could use these leaked details
to build up a map of your database's actual schema and internal
structure — information that should never be visible outside the server.

Fix (`errorHandler.js`, and the same principle applied at
`authRoutes.js:29-35` for the `/login` route specifically):
```js
const clientMessage =
  process.env.NODE_ENV === "production" ? "Server Error" : err.message || "Server Error";
```
The real error is still logged server-side via Winston either way — only
what's sent *back to the client* changes based on environment. In
production, an attacker gets a generic `"Server Error"` no matter what
actually broke; during local development, you still see the real message
to debug with.

**2. File uploads had no restrictions at all.**
Before: `POST /upload` accepted literally any file, of any size, any
type, via `multer({ storage })` with no filter or limit — and served it
right back out statically from `/uploads`. An attacker (any authenticated
user, since this route sits behind `authMiddleware`) could upload an
enormous file repeatedly to fill up server disk space (a denial-of-service
via storage exhaustion), or upload a non-image file — say, an HTML file
containing a script — which would then be served back from your own
server's origin, potentially usable for a stored cross-site-scripting-style
attack depending on how it's later linked to or embedded.

Fix (`app.js:198-213`):
```js
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, and WEBP images are allowed"));
    }
    cb(null, true);
  },
});
```
Only `image/jpeg`, `image/png`, and `image/webp` are accepted, capped at
5MB, with rejections returning a clean `400` (`app.js:217-234`) instead
of an unhandled crash.

**3. Malformed IDs caused unhandled database errors.**
Before: `GET/PUT/DELETE /students/:id` passed `req.params.id` straight
into Mongoose's `findById`/`findByIdAndUpdate`/`findByIdAndDelete`. A
MongoDB ObjectId has a specific required format (24 hexadecimal
characters); anything else — say, someone poking at the API with
`/students/not-an-id` — causes Mongoose to throw a `CastError`. Combined
with finding #1 above, that error's message (which includes the raw
invalid value and the expected type) would have been sent straight to the
client before the error-handler fix; even after that fix, it would still
be an ugly, generic `500` for what's really just bad input, not a server
malfunction.

Fix, applied identically at all four `:id` routes (e.g. `app.js:341`):
```js
if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
  return res.status(400).json({ message: "Invalid student ID" });
}
```
Bad input now gets a clean, correct `400` before it ever reaches the
database layer.

**4. No email format or password strength requirements.**
Before: `POST /register`, `/reset-password`, `PUT /change-password`, and
`PUT /profile` accepted any string at all as an email or password — a
one-character password, or an "email" that isn't shaped like one, would
be silently accepted. This isn't an exploit an attacker uses against
*others*, but it's a real weakness: it allows accounts to exist with
trivially guessable passwords, directly undermining every other piece of
auth security in the app (rate limiting, hashing, etc. don't help much if
the password itself is `"a"`).

Fix (`utils/validators.js`):
```js
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (email) => typeof email === "string" && EMAIL_REGEX.test(email);
const MIN_PASSWORD_LENGTH = 8;
const isValidPassword = (password) => typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH;
```
applied at all four call sites (e.g. `authRoutes.js:50-56` for
`/register`). The email check is deliberately a simple pattern, not a
fully spec-compliant one — a fully "correct" email regex is notoriously
complex and prone to rejecting valid-but-unusual real addresses; "good
enough to catch obvious garbage" was the actual goal.

**5. `xlsx`'s two unpatched CVEs — an accepted risk, not a fix.**
The `xlsx` package (used for the Excel export feature) has two real,
publicly known, high-severity vulnerabilities — a prototype pollution bug
and a Regular-Expression-Denial-of-Service (**ReDoS** — a maliciously
crafted input string that makes a regular expression take an
astronomically long time to evaluate, hanging the process) bug — and
`npm audit fix` cannot resolve either one, because the maintainers never
published a patched version to the public npm registry for these specific
advisories.

Rather than ripping out the export feature or rushing an untested library
migration, the decision documented in both the code
(`app.js:14-22`) and the README was to **accept the risk with a stated
reason**: both CVEs are only reachable through `xlsx`'s *parsing* code
path (feeding it untrusted spreadsheet data to read) — and this app never
calls that path. It only ever calls `xlsx.write()`, generating a
spreadsheet *from data the app's own database already trusts*. The
vulnerable code is present in the dependency, but the way this app uses
the library never exercises it. This is a legitimate, common category of
security decision — not every flagged vulnerability is actually
exploitable in every context it's installed in — but it only counts as
responsible if it's written down clearly enough that someone later (an
auditor, or a future version of the app that *does* start parsing
uploaded files) can see the reasoning and re-evaluate it.

---

## Phase 5 — Redis integration (2026-07-16, `452775b`)

This is the newest and, per your note, still-evolving piece — everything
described below reflects what's landed so far.

### 5.1 — What Redis is doing here, at a high level

**Redis** is an in-memory key-value data store — think of it as an
extremely fast dictionary that lives in RAM instead of on disk, usually
running as its own separate small server process. It's used for two
unrelated things in this app:
1. **Caching** results of expensive MongoDB reads, so repeated identical
   requests don't have to hit the real database every time.
2. **Blacklisting** JWTs (JSON Web Tokens — the signed tokens this app
   already used for login sessions) after logout, so a token that's been
   explicitly logged out can be rejected even though the token itself is
   still cryptographically valid until it expires.

Both are designed around one guiding rule, stated directly in the commit
message: **a Redis outage should degrade the app, never crash it.** Every
single Redis call in the app is wrapped so that if Redis is slow, down, or
unreachable, the app just falls back to its pre-Redis behavior (hit
MongoDB directly / treat a token as not blacklisted) and logs a warning,
rather than the request failing outright.

### 5.2 — Infrastructure: `docker-compose.yml`

```yaml
redis:
  image: redis:7-alpine
  container_name: redis
  ports:
    - "6379:6379"
  volumes:
    - redis-data:/data
  command: redis-server --save 60 1
```
`--save 60 1` tells Redis to write its in-memory data to disk (an RDB
snapshot) if at least 1 key changed in the last 60 seconds. This is
explicitly a "nice to have," not a requirement — since Redis here is only
ever a *cache*, losing it entirely (e.g. the container restarts and the
snapshot is stale or missing) is not a data-loss event; the app just
treats every cache lookup as a miss and repopulates it from MongoDB as
normal traffic comes in. `backend`'s `depends_on` list grew to include
`redis` alongside `mongo`, so Compose starts it in the right order.

### 5.3 — The client: `utils/redisClient.js`

Uses the official `redis` npm package (**node-redis**, v4). One
configured client is created and exported:
```js
const redisClient = createClient({
  url: `redis://${REDIS_HOST}:${REDIS_PORT}`,
  socket: { reconnectStrategy: (retries) => Math.min(retries * 200, 2000) },
  disableOfflineQueue: true,
});
redisClient.on("error", (err) => logger.warn(`Redis connection error: ${err.message}`));
if (process.env.NODE_ENV !== "test") {
  redisClient.connect().catch((err) => logger.warn(`Redis initial connection failed: ${err.message}`));
}
```
Three deliberate choices here:
- **`reconnectStrategy`** — if the connection drops, keep retrying with
  increasing delay, capped at 2 seconds between attempts, forever. A
  temporarily unreachable Redis (a restart, a network blip) should recover
  on its own once it's back.
- **`disableOfflineQueue: true`** — node-redis's *default* behavior, if
  you don't set this, is to queue up commands sent while disconnected and
  hold them until a connection comes back — which could mean an `await
  redisClient.get(...)` call just hangs indefinitely if Redis never
  reconnects. Disabling the queue makes a command sent while disconnected
  fail immediately instead, which is what lets the caching code's
  `try/catch` (§5.4) actually catch the failure and fall back to Mongo
  right away, rather than hanging the whole request.
- **Skipped `connect()` under `NODE_ENV=test`** — explained in §5.6.

### 5.4 — Cache-aside pattern

**Cache-aside** (also called "lazy loading") is a specific way of using a
cache: your application code checks the cache first; on a **hit** (the
data is there), it returns immediately without touching the real
database; on a **miss** (not there, or expired), it goes to the real
database, gets the answer, *writes it into the cache* for next time, then
returns it. The cache is never the source of truth — MongoDB always is —
the cache is just a shortcut that gets populated the first time each
distinct piece of data is asked for.

Implemented in `utils/cache.js`'s `cacheGet`/`cacheSet`, and used
identically at four routes:

- **`GET /students`** (`app.js:273-336`) — cache key is
  `` `students:${JSON.stringify(req.query)}` `` (`app.js:277`). The *entire
  query string* is part of the key deliberately, because search text,
  branch filter, CGPA range, sort order, page number, and page size all
  produce genuinely different result sets — a search for `"asha"` and a
  search for `"ben"` must never accidentally return each other's cached
  results, so they need different keys.
- **`GET /dashboard/stats`**, **`/dashboard/branch-chart`**,
  **`/dashboard/registration-trend`** (`app.js:733,794,844`) — these take
  no query parameters, so each uses one fixed key
  (`"dashboard:stats"`, etc., defined once in
  `utils/constants.js:5-9` as `DASHBOARD_CACHE_KEYS`).

Every one of these follows the same shape:
```js
const cached = await cacheGet(cacheKey);
if (cached) return res.json(cached);
// ...run the real Mongo query...
await cacheSet(cacheKey, responseBody, CACHE_TTL_SECONDS);
res.json(responseBody);
```
Note that `cacheSet` is only ever called from the success path, *inside*
the `try` block, right before the response is sent — an error response
(the `catch` block) never gets cached, so a temporary database hiccup
can't accidentally get "remembered" as the cached answer for the next 60
seconds.

**Cache-aside vs. write-through, and why this app uses the former:**
**write-through** caching is a different strategy where every *write* to
the database is also immediately written to the cache at the same moment,
so the cache is always kept perfectly up to date the instant data
changes. This app does **not** do that. Instead, when a student is
added/edited/deleted, the relevant cache entries are simply **deleted**
(§5.5) rather than recomputed and rewritten with the new correct value.
This is a deliberate simplification: at any given moment there could be
dozens of different cached `GET /students` entries in Redis, one for
every distinct combination of search/filter/sort/page a user has recently
requested — correctly recalculating *all* of them the moment one student
changes would be complex and expensive. It's simpler and safer to just
clear them and let the next request to each one recompute fresh from
Mongo and re-cache — at the cost of that next request being a normal,
uncached (slightly slower) one.

### 5.5 — Cache invalidation, and why SCAN instead of KEYS

**What changed:** `POST /students`, `PUT /students/:id`, and
`DELETE /students/:id` each call `invalidateStudentCaches()`
(`app.js:403,470,521`) right after their database write succeeds:
```js
async function invalidateStudentCaches() {
  await deleteByPattern("students:*");
  await redisClient.del(DASHBOARD_CACHE_KEYS);
}
```
This is one function, called from three places, instead of the same
key-clearing logic being duplicated at each of the three mutation routes
— a small but real application of the same DRY idea from §2.5.

**Why *both* `students:*` and the dashboard keys get cleared on every
single student change:** adding, editing, or deleting a student doesn't
just change the list of students (any cached `students:*` entry could now
be stale) — it also changes every aggregate number derived from the whole
collection (total count, average CGPA, per-branch breakdown,
registration trend). Both categories of cached data go stale together, so
both get cleared together.

**Why `SCAN` instead of `KEYS` for the pattern-matching part:** Redis is
single-threaded — it processes one command at a time. `KEYS pattern` finds
every matching key by walking the *entire* keyspace in one single,
uninterruptible, blocking call — on a Redis with only a handful of keys
(a dev machine) this is instant and harmless, but on a busy production
Redis holding potentially millions of keys, that one `KEYS` call would
freeze the entire Redis instance — and every other client trying to use
it — for as long as the scan takes. That's a self-inflicted denial of
service triggered by your own cache-clearing code. `SCAN` accomplishes the
same goal — "find every key matching this pattern" — but does it as a
series of small, **non-blocking** steps: each call returns a cursor and a
small batch of matches, and you keep calling it with the returned cursor
until it says "done." Redis stays responsive to every other client in
between batches. `utils/cache.js:46-65` implements this with node-redis's
`scanIterator({ MATCH: pattern, COUNT: 100 })` — an *async generator*
(a function you loop over with `for await`, that produces one result at a
time instead of returning everything at once) that yields matching keys
one by one, collected into a list, then deleted in a single `del()` call
once the scan is complete.

### 5.6 — JWT logout blacklist

**The problem it solves:** this app's JWTs are stateless — once a token
is signed, the server doesn't keep any record of it; verifying a request
just means checking the signature and expiry, nothing more. That's fast
and simple, but it means there was previously no way to make a token stop
working *before* it naturally expires — "logging out" only ever meant the
*frontend* discarding the token from wherever it stored it. If a token
had somehow been captured (a stolen laptop, a leaked browser storage
dump), logging out on the legitimate device did nothing to stop that
stolen copy from continuing to work until its natural expiry, up to a
full day later.

**The fix — two halves.** On logout (`routes/authRoutes.js:310-327`):
```js
const ttlSeconds = req.user.exp - Math.floor(Date.now() / 1000);
await blacklistToken(req.token, ttlSeconds);
```
`req.user.exp` is the token's own expiry timestamp, already present in
the decoded JWT payload (added automatically by the `jsonwebtoken`
library because `tokenFactory.js` signs tokens with `expiresIn: "1d"`).
`blacklistToken` writes a Redis key `blacklist:<the actual token>` with
that many seconds as its TTL (§5.7 explains why this specific TTL).

On every subsequent authenticated request
(`middleware/authMiddleware.js:26-33`):
```js
const decoded = jwt.verify(token, process.env.JWT_SECRET);
if (await isTokenBlacklisted(token)) {
  return res.status(401).json({ message: "Token has been invalidated" });
}
```
The blacklist check runs *after* signature verification, deliberately —
there's no point spending a Redis round-trip checking the blacklist for a
token that's already garbage (expired, tampered with, wrong secret); only
a token that's otherwise perfectly valid needs the extra check.

**A deliberate tradeoff — the blacklist check fails open.** If Redis is
unreachable when `isTokenBlacklisted` runs, it returns `false` (logging a
warning) rather than rejecting the request. That means during a Redis
outage, a token that *was* logged out might briefly work again — a real,
accepted gap. The alternative (fail *closed*: reject every request if the
blacklist can't be checked) would mean a Redis outage locks out every
single authenticated user in the entire app, for an action (checking if
*this specific* token was logged out) that's usually a non-event. A brief
window where a stale logged-out token still works during an outage is
judged a smaller problem than the whole app becoming unusable during that
same outage — consistent with the "Redis outage degrades, never crashes"
principle from §5.1.

### 5.7 — Two TTLs, two completely different purposes

Both the response cache and the blacklist entries expire automatically,
but for unrelated reasons:

- **Response cache TTL — a fixed 60 seconds** (`CACHE_TTL_SECONDS` in
  `utils/constants.js:4`, used identically for `/students` and all three
  dashboard endpoints). This exists as a **safety net against staleness**.
  Invalidation (§5.5) is supposed to clear stale cache entries the moment
  data changes — but TTL is the fallback for the cases where invalidation
  *doesn't* run: a bug in the invalidation logic, or data changed by some
  path that doesn't go through this API at all (an admin editing a
  document directly in MongoDB Atlas, for instance). Even in the worst
  case, a wrong cached answer can only survive for 60 seconds before it
  self-corrects, invalidation or not.
- **Blacklist entry TTL — dynamic, equal to the token's own remaining
  lifespan.** This exists for an entirely different reason: **not wasting
  space**. A blacklist entry only needs to exist for as long as the token
  it's blocking would otherwise still be usable — the moment the token's
  own `exp` claim passes, `jwt.verify()` rejects it on its own, blacklist
  or no blacklist, so keeping that Redis key around any longer is pure
  waste. And a *fixed* TTL (like the cache's 60 seconds) would be wrong
  here in both directions: a token that had 23 hours of life left when it
  was logged out needs to stay blocked for nearly a full day, while a
  token logged out one minute before its own natural expiry doesn't need
  to be remembered for more than that one minute. Computing
  `req.user.exp - Math.floor(Date.now() / 1000)` at logout time gets
  exactly the right number for each individual token, rather than a
  one-size-fits-all constant.

### 5.8 — Test-mode behavior, flagged deliberately

Every function in `utils/cache.js` (`cacheGet`, `cacheSet`,
`deleteByPattern`, `invalidateStudentCaches`, `blacklistToken`,
`isTokenBlacklisted`) starts with `if (isTestEnv()) return ...;` — a
no-op, or a safe default like `false` for the blacklist check — under
`NODE_ENV=test`. This mirrors the exact same pattern the rate limiter used
in §4.3.

**Why:** the existing Jest test suite asserts directly against *mocked*
Mongoose calls, with completely fresh state on every single test (via
`jest.clearAllMocks()` before each one) — but there's no equivalent reset
mechanism for Redis. Without the test-mode skip, a cache entry written by
one test could still be sitting in Redis when the *next* test runs,
causing that next test to silently get a stale cached response instead of
actually exercising the route logic it's meant to be testing — a subtle,
hard-to-diagnose source of flaky or wrong test results. Skipping entirely
in test mode also means `redisClient.js` never even calls `connect()`
during a test run (§5.3), so **running the test suite never requires a
real Redis instance to be available at all.**

**The explicit, honest gap this creates:** because of the above, **the
automated test suite does not exercise real cache-hit behavior or real
blacklist-rejection behavior** — those code paths are simply never
reached during `npm test`. That's a real coverage gap, not an oversight
being hidden — it's covered instead by a manual benchmark run (§5.9) and
by exploratory manual testing (log in, log out, try reusing the same
token, confirm it's rejected with a `401`).

### 5.9 — Measured performance impact

Using `scripts/benchmark.js` (a small script using nothing more
sophisticated than `Date.now()` timestamps around real HTTP requests) and
`scripts/seedBenchmarkData.js` (populates 500 test student records),
against a locally-running backend and Redis:

| Endpoint | Without cache (cold) | With cache (warm) | Speedup |
|---|---|---|---|
| `GET /students?page=1&limit=20` | 11.0ms avg | 2.7ms avg | ~4.1x |
| `GET /dashboard/stats` | 15.1ms avg | 2.1ms avg | ~7.2x |

"Cold" flushes Redis before *every single request* in that phase, so each
one is genuinely forced through MongoDB — not measuring a cache that
quietly warms itself up after the first request. "Warm" populates the
cache once, then measures 50 requests that should all be served straight
from Redis.

**Why the gap exists:** the cold path pays for a real MongoDB round trip
every time — for `/students`, a `countDocuments()` plus a filtered,
sorted, paginated `find()` over 500 documents; for `/dashboard/stats`, a
full unfiltered collection scan plus in-process aggregation across all
500 documents, on *every single request*. The warm path skips MongoDB
completely and returns the identical JSON straight from an in-memory
Redis key lookup — no query planning, no disk or network I/O to the
database, no aggregation math, just a dictionary lookup. This local
benchmark's cold numbers are likely a *lower bound* on the real-world
gap — in production, the backend and MongoDB run on separate hosts
(Render and Atlas) rather than both on the same machine, so the real
network round-trip cost the cache is saving is larger than what this
local test can measure.

### 5.10 — A mid-week course correction: ioredis → node-redis

Worth naming because it's a realistic, honest part of how this week
actually went: the Redis client library was originally **ioredis** (a
popular third-party Redis client, chosen initially for a simpler API and
built-in retry/reconnect behavior), then swapped mid-stream to the
**official `redis` package (node-redis v4)** per a later, more specific
requirement. The swap touched exactly three files —
`utils/redisClient.js`, `utils/cache.js`, and `scripts/benchmark.js` —
changing low-level API details (`client.set(key, value, {EX: ttl})`'s
object-style options instead of ioredis's positional
`("EX", ttl)` style; node-redis's `scanIterator()` async generator instead
of ioredis's `scanStream`; an explicit `.connect()` call instead of
ioredis's `lazyConnect` option, which node-redis doesn't have). **Nothing
about the actual design changed** — the cache-aside pattern, the TTL
values, the invalidation logic, and the blacklist approach are all
byte-for-byte the same ideas as before the swap. That's arguably the best
practical evidence in this whole review that `utils/cache.js` existing as
its own file, wrapping the raw client, actually did its job: swapping out
an entire underlying library touched three files instead of every route
in `app.js` that uses caching.

---

## Phase 6 — Cloudinary migration (2026-07-20, uncommitted)

A short follow-up, separate from the main week, that replaced how profile
pictures are stored end to end: local disk → **Cloudinary** (a
cloud-based image hosting and delivery service — you upload an image to
it, it hands back a permanent URL, and it can also resize/optimize that
image on the fly whenever the URL is requested, without you storing
multiple versions yourself).

### 6.1 — What was actually wrong with local disk storage

Before this change, `POST /upload` used `multer` (the standard Express
file-upload middleware) with `multer.diskStorage`, writing uploaded files
straight to a `./uploads` folder on the server's own filesystem, served
back out via `app.use("/uploads", express.static("uploads"))`, with
`Student.profilePic` storing a relative path like `/uploads/169....png`.
Three separate, real problems with this, not just one:

1. **Ephemeral storage on Render.** Render's filesystem is not
   persistent across deploys — anything written to disk while the app is
   running (including every uploaded photo) is wiped the next time the
   app redeploys. Every profile picture uploaded in production would
   silently vanish (the file gone, but `Student.profilePic` still
   pointing at a URL that now 404s) the next time the backend shipped a
   new commit — which, per this document, was multiple times a day this
   week.
2. **Orphaned files, forever.** Nothing ever deleted an old upload when a
   student's photo was replaced or the student record itself was deleted
   — the `uploads/` folder only ever grew. (Concretely: this repo's own
   `uploads/` folder had 7 real uploaded images **committed into git** by
   accident, found and removed as part of this migration — see §6.6.)
3. **No image optimization at all.** The exact bytes a user uploaded —
   however large, whatever format their phone or camera produced — were
   what got served back to every single visitor viewing that student's
   card, list row, or details page, every time, with no resizing or
   compression.

### 6.2 — Multer storage engines, and why swapping the backend was simple

**What a Multer storage engine is:** Multer (the upload-handling
middleware this app already used) doesn't hardcode *where* an uploaded
file ends up — it delegates that entirely to a pluggable "storage engine"
object you hand it, as long as that object implements two methods:
`_handleFile` (what to do with an incoming file) and `_removeFile` (how
to delete one). `multer.diskStorage(...)` — the old setup — is Multer's
own built-in engine that implements those two methods by writing to/from
the local filesystem. Swapping storage engines doesn't require touching
anything about *how* Multer parses the incoming upload request; only
*where the bytes end up* changes.

**What changed:** `app.js:194-215` replaced `multer.diskStorage({...})`
with `new CloudinaryStorage({ cloudinary, params: { folder:
"student-profiles", allowed_formats: [...] } })` — a third-party storage
engine, from the `multer-storage-cloudinary` package, that implements the
exact same `_handleFile`/`_removeFile` contract but uploads to Cloudinary
instead of writing to disk. Everything else about the route
(`app.js:217-236`: `upload.single("profilePic")(req, res, callback)`,
the `fileFilter`/`limits` validation) is untouched — this is the same
"one interchangeable piece behind a stable interface" idea as the
Adapter pattern from Phase 2 (§2.4), just applied to a piece of Express
middleware instead of application code.

**A new file, `utils/cloudinary.js`,** configures the Cloudinary SDK once
from three environment variables (`CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) and exports the configured
client for both the storage engine and the delete calls in §6.4 to share
— the same "one configured instance, required everywhere it's needed"
shape as `utils/redisClient.js` from Phase 5. It also **fails loudly at
boot** (logs a clear error via Winston, then `process.exit(1)`) if any of
the three env vars are missing outside test mode — the same "don't limp
along half-broken" philosophy `config/db.js` already used for a failed
MongoDB connection (Phase 2, §2.4's Singleton section).

### 6.3 — Secure upload validation (carried forward, not new)

The file-type and size restrictions added during last week's security
hardening pass (Phase 4, §4.5, finding #2) — `fileFilter` rejecting
anything that isn't `image/jpeg`/`image/png`/`image/webp`, and a 5MB
`limits.fileSize` cap — were kept **exactly as they were**, just pointed
at the new storage engine (`app.js:201-214`). Worth calling out precisely
*because* nothing needed to change here: validating the upload
(*is this actually an image, is it a reasonable size*) is a concern that
sits above the storage engine, not inside it — proof that last week's
validation was placed at the right layer.

### 6.4 — Replace-on-update and delete-on-remove: not leaving orphans this time

**The new field:** `models/Student.js` gained
`profilePicPublicId: { type: String, default: "" }` alongside the
existing `profilePic` field (which now holds a full Cloudinary URL
instead of a local relative path). Cloudinary identifies every asset by
a `public_id` — a value it either generates or you provide at upload
time — and that id, not the URL itself, is what a later delete call
needs.

**On `PUT /students/:id`** (`app.js:451-497`): before writing the
update, the route now fetches the student's *current* document
(`const existing = await Student.findById(req.params.id)`, `app.js:459`)
— specifically to capture the old `profilePicPublicId` before it gets
overwritten. After the update succeeds, if the request actually included
a *different* `profilePicPublicId` than the one that was there before
(`app.js:481-485`), the old asset is deleted:
`cloudinary.uploader.destroy(existing.profilePicPublicId)`. Editing a
student's name or CGPA without touching their photo leaves the existing
image alone — only an actual replacement triggers a delete.

**On `DELETE /students/:id`** (`app.js:540-558`): `findByIdAndDelete`
already returns the deleted document, so if it had a
`profilePicPublicId`, that asset is destroyed too, right after the
database delete succeeds. A removed student no longer leaves its photo
behind.

**Both deletes are wrapped in their own `try/catch`, deliberately failing
open:** a Cloudinary API hiccup during cleanup is logged via
`logger.warn` but never thrown — the student record update or delete
*has already succeeded* by the time the Cloudinary call runs, and a
slow/broken image-hosting API is not a reason to make that response look
like a failure. This is the same "a dependency being down shouldn't
break the request" principle Redis's cache and blacklist calls followed
in Phase 5 (§5.1, §5.6), applied to a third API dependency.

### 6.5 — Image optimization via URL transformation params

**What changed:** a new frontend file, `src/utils/cloudinaryImage.js`,
exports `getThumbnailUrl(url)`, which inserts `q_auto,f_auto,w_200,
h_200,c_fill` into a Cloudinary URL's path, immediately after
`/upload/`. This is used everywhere a profile picture actually renders:
`StudentCard.jsx`, `StudentDetails.jsx`, `EditStudent.jsx`'s preview, and
`Profile.jsx`.

**How Cloudinary transformations work, concretely:** unlike most image
hosts, Cloudinary doesn't require you to pre-generate a "thumbnail
version" and upload it separately — transformation instructions are
encoded directly into the URL's *path* (not query parameters), and
Cloudinary generates (and caches) the transformed image the first time
that exact URL is requested:
```
https://res.cloudinary.com/<cloud>/image/upload/v169.../student-profiles/x.jpg
                                        ↓ becomes ↓
https://res.cloudinary.com/<cloud>/image/upload/q_auto,f_auto,w_200,h_200,c_fill/v169.../student-profiles/x.jpg
```
- `q_auto` — Cloudinary picks the lowest quality level that still looks
  visually lossless, instead of always serving the original quality.
- `f_auto` — serves whichever image format the requesting browser
  supports best (e.g. WebP or AVIF where possible), instead of whatever
  format was originally uploaded.
- `w_200,h_200,c_fill` — resizes to a fixed 200×200 square, cropping
  (`c_fill`) to fill that square rather than distorting the aspect
  ratio, since every place this renders uses the same fixed-size
  `profile-image` CSS class regardless of the original photo's
  dimensions.

**Why this is meaningfully different from what local storage did:**
under the old setup, a user's 4MB phone photo was the *exact* file
served to every visitor, every time, at full resolution, even though it
only ever displayed in a small fixed-size circle/square. Cloudinary
transformation params mean the network only ever transfers a small,
already-cropped, already-compressed image — computed once by Cloudinary
and cached, not recomputed by this app on every request.

**Note — this only touches `Student.profilePic`.** `models/User.js`
(profile pictures for logins/admins, shown via `Profile.jsx`) was
deliberately left out of the `profilePicPublicId` tracking added in
§6.4 — out of scope for this pass, meaning a `User`'s old Cloudinary
photo isn't cleaned up when they upload a new one. `Profile.jsx`'s
*display* still benefits from `getThumbnailUrl()` (§6.5), but the
delete-on-replace behavior only exists for students today.

### 6.6 — A dependency tradeoff, decided the same way as last week's `xlsx` CVE

Installing `cloudinary` pulled in `cloudinary@1.41.3`, which carries a
real, high-severity CVE
([GHSA-g4mf-96x5-5m2c](https://github.com/advisories/GHSA-g4mf-96x5-5m2c) —
"arbitrary argument injection" through a parameter value containing an
`&` character), fixed only in `cloudinary@2.7.0+` — a major version. The
catch: `multer-storage-cloudinary` (the storage-engine package from
§6.2), even in its latest release, has never been updated to support
Cloudinary SDK v2 — its `peerDependencies` still require `cloudinary
^1.21.0`. Installing the patched v2 would silently break the upload
route this whole phase depends on.

This was a genuine decision point, resolved the same way Phase 4's
`xlsx` CVE was: **accept the risk, and write down exactly why**
(`utils/cloudinary.js`'s header comment, and this section). The reasoning
holds up the same way it did for `xlsx` — the vulnerable code path
requires attacker-controlled input to reach a Cloudinary API *parameter*,
and this app never does that: the upload `folder` is a hardcoded
constant (`"student-profiles"`), and every asset's `public_id` is
generated by Cloudinary itself, never supplied by a request. The
alternative — dropping `multer-storage-cloudinary` and hand-writing a
custom Multer storage engine directly against the patched
`cloudinary@2.x` SDK — was considered and explicitly set aside, since it
trades a documented, low-exploitability risk for new, unproven code
maintained by nobody but this project.

### 6.7 — Local storage, fully removed

`app.use("/uploads", express.static("uploads"))` and the
`multer.diskStorage` config are gone from `app.js` entirely — not left
alongside the new Cloudinary path, per the instruction that started this
migration. The `./uploads` folder itself was deleted, including 7 real
uploaded images that turned out to be **committed into git** (`uploads/`
was never in `.gitignore` or `.dockerignore`) — a second, independent
reason local storage needed to go: user-uploaded content had been ending
up in the repository's permanent history.

---

## Closing notes

A few threads that show up more than once across this week, if you're
looking for the "big ideas" to take away:

- **Fail gracefully, don't crash.** The rate limiter skips itself in
  tests; the cache layer catches its own errors and falls back to Mongo;
  the blacklist check fails open rather than locking everyone out. This
  is the same philosophy applied consistently across three completely
  different features.
- **Log the real thing internally, show a safe thing externally.** The
  error handler, the `/login` route's error path, and (implicitly)
  Winston's error-vs-info separation all follow this same shape: the full
  truth goes somewhere only the team can see; what the client/attacker
  sees is deliberately limited.
- **Small wrapper files pay for themselves.** `utils/cache.js`,
  `utils/notificationStrategies.js`, and `utils/responseHandler.js` all
  exist for the same underlying reason — put a low-level, swappable, or
  repeated detail behind one function/module, so the rest of the codebase
  depends on a stable shape instead of a specific implementation.
