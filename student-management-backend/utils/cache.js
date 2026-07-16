// utils/cache.js — cache-aside helpers built on top of utils/redisClient.js.
// Every function here is a no-op (or a safe default) if Redis is down OR if
// NODE_ENV === "test": the existing test suite asserts directly against
// mocked Mongoose calls with fresh state every test (jest.clearAllMocks()
// in beforeEach, no equivalent Redis reset), so a cache hit from a previous
// test would silently return stale/wrong data instead of exercising the
// route logic under test — the same reasoning that made the rate limiter
// skip under NODE_ENV=test. redisClient.js also never calls connect() in
// test mode, so requiring this module during a Jest run never opens a real
// Redis socket either.
const redisClient = require("./redisClient");
const logger = require("./logger");
const { DASHBOARD_CACHE_KEYS } = require("./constants");

const isTestEnv = () => process.env.NODE_ENV === "test";

// Cache-aside read. Always resolves — a miss, a JSON parse failure, or a
// Redis outage all just look like "not cached" to the caller, so route
// handlers never need a separate error path for the cache layer.
async function cacheGet(key) {
  if (isTestEnv()) return null;

  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    logger.warn(`Redis GET failed for key=${key}: ${err.message}`);
    return null;
  }
}

async function cacheSet(key, value, ttlSeconds) {
  if (isTestEnv()) return;

  try {
    await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (err) {
    logger.warn(`Redis SET failed for key=${key}: ${err.message}`);
  }
}

// Deletes every key matching a glob pattern using SCAN (via node-redis's
// scanIterator), not KEYS — KEYS walks the entire keyspace in one blocking
// call, which stalls every other client on a busy Redis; SCAN does the
// same walk in small non-blocking cursor-paginated steps instead.
async function deleteByPattern(pattern) {
  if (isTestEnv()) return;

  try {
    const keysToDelete = [];

    for await (const key of redisClient.scanIterator({
      MATCH: pattern,
      COUNT: 100,
    })) {
      keysToDelete.push(key);
    }

    if (keysToDelete.length > 0) {
      await redisClient.del(keysToDelete);
    }
  } catch (err) {
    logger.warn(`Redis SCAN/DEL failed for pattern=${pattern}: ${err.message}`);
  }
}

// One call at each of the three student-mutation sites (POST/PUT/DELETE
// /students/:id) instead of duplicating the students:* + dashboard:* key
// list at each call site. Adding/editing/deleting a student changes both
// the list (any students:* key, since the query string varies the key)
// and every aggregate stat, so both get cleared together.
async function invalidateStudentCaches() {
  if (isTestEnv()) return;

  await deleteByPattern("students:*");

  try {
    await redisClient.del(DASHBOARD_CACHE_KEYS);
  } catch (err) {
    logger.warn(`Redis dashboard cache invalidation failed: ${err.message}`);
  }
}

async function blacklistToken(token, ttlSeconds) {
  if (isTestEnv() || ttlSeconds <= 0) return;

  try {
    await redisClient.set(`blacklist:${token}`, "1", { EX: ttlSeconds });
  } catch (err) {
    logger.warn(`Redis blacklist write failed: ${err.message}`);
  }
}

// Fails open (treats the token as not blacklisted) on a Redis outage rather
// than fail closed — a down cache degrading into "logged-out tokens work
// again for a bit" is a far smaller problem than it locking every
// authenticated user out of the app until Redis comes back.
async function isTokenBlacklisted(token) {
  if (isTestEnv()) return false;

  try {
    const result = await redisClient.exists(`blacklist:${token}`);
    return result === 1;
  } catch (err) {
    logger.warn(`Redis blacklist check failed: ${err.message}`);
    return false;
  }
}

module.exports = {
  cacheGet,
  cacheSet,
  deleteByPattern,
  invalidateStudentCaches,
  blacklistToken,
  isTokenBlacklisted,
};
