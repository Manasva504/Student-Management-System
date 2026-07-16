// utils/redisClient.js
const { createClient } = require("redis");
const logger = require("./logger");

// localhost:6379 is the sensible default for running the backend directly
// (npm start, outside Docker) — REDIS_HOST=redis (the Compose service name)
// is what .env.example ships for the Docker Compose topology, the same
// pattern MONGO_URI already uses for `mongo`.
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;

const redisClient = createClient({
  url: `redis://${REDIS_HOST}:${REDIS_PORT}`,
  socket: {
    // Capped backoff, retried forever — a genuinely dead Redis shouldn't
    // get hammered, but it's still worth reconnecting to once it recovers.
    reconnectStrategy: (retries) => Math.min(retries * 200, 2000),
  },
  // node-redis queues commands while disconnected by default, which would
  // make every await in utils/cache.js hang until a (possibly nonexistent)
  // reconnect succeeds. Disabling the offline queue makes a command sent
  // while disconnected reject immediately instead, so cache.js's try/catch
  // actually catches it and falls back to Mongo right away.
  disableOfflineQueue: true,
});

redisClient.on("connect", () => logger.info("Redis connected"));
redisClient.on("error", (err) => logger.warn(`Redis connection error: ${err.message}`));

// node-redis has no lazyConnect option (unlike ioredis) — connect() has to
// be called explicitly. Skipped under NODE_ENV=test: every call site in
// utils/cache.js already short-circuits to a no-op in tests (see that
// file's header comment for why), so there's nothing in a test run that
// would ever use this connection — attempting it anyway would mean every
// Jest run either needs a real Redis reachable at REDIS_HOST/PORT or pays
// for a connection attempt (and, without disableOfflineQueue's fast-reject,
// a hanging one) for no benefit. Outside tests, a failure here is caught
// and logged rather than thrown, so a dead/unreachable Redis at boot
// doesn't crash the app.
if (process.env.NODE_ENV !== "test") {
  redisClient.connect().catch((err) => {
    logger.warn(`Redis initial connection failed: ${err.message}`);
  });
}

module.exports = redisClient;
