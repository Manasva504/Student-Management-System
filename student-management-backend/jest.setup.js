// Runs before any test file is required. Loads .env.test (committed, safe
// dummy values) so the suite is self-contained and portable — it never
// depends on the real, git-ignored .env file existing, and runs the same
// on a fresh clone or in CI. dotenv doesn't overwrite an already-set env
// var by default, so this wins over app.js's own dotenv.config() call
// (which loads the real .env) as long as this runs first — which Jest's
// setupFiles guarantees.
require("dotenv").config({ path: ".env.test" });
