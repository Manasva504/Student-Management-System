// Compares GET /students and GET /dashboard/stats response times with the
// Redis cache cold (every request forced to hit Mongo) vs warm (every
// request served straight from Redis). Not fancy — Date.now() timing
// around fetch calls, as specified — just enough to put real numbers next
// to the cache-aside implementation in app.js.
//
// Usage: backend must already be running and reachable at BENCH_BASE_URL.
//   BENCH_TOKEN=<a valid JWT> node scripts/benchmark.js
const { createClient } = require("redis");

const BASE_URL = process.env.BENCH_BASE_URL || "http://localhost:5000";
const TOKEN = process.env.BENCH_TOKEN;
const N = Number(process.env.BENCH_N) || 50;

if (!TOKEN) {
  console.error("Set BENCH_TOKEN to a valid JWT before running this script.");
  process.exit(1);
}

// A dedicated admin client (not utils/redisClient.js) so this script can
// explicitly await connect() before flushing — the app's shared client
// connects fire-and-forget at require time, which isn't a safe thing to
// race against for something as destructive as flushDb().
const redis = createClient({
  url: `redis://${process.env.REDIS_HOST || "localhost"}:${Number(process.env.REDIS_PORT) || 6379}`,
});

async function timeRequest(path) {
  const start = Date.now();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  await res.json();

  if (!res.ok) {
    throw new Error(`${path} returned ${res.status}`);
  }

  return Date.now() - start;
}

function summarize(times) {
  const avg = times.reduce((a, b) => a + b, 0) / times.length;

  return {
    avg: avg.toFixed(1),
    min: Math.min(...times),
    max: Math.max(...times),
  };
}

async function benchmarkEndpoint(path) {
  // Cold: flush Redis before every single request, so each one is forced
  // to hit Mongo — isolates "no cache at all" instead of "cache expired
  // once and warmed itself back up mid-run".
  const coldTimes = [];

  for (let i = 0; i < N; i++) {
    await redis.flushDb();
    coldTimes.push(await timeRequest(path));
  }

  // Warm: one throwaway request to populate the cache, then N more that
  // should all be served straight from Redis.
  await redis.flushDb();
  await timeRequest(path);

  const warmTimes = [];

  for (let i = 0; i < N; i++) {
    warmTimes.push(await timeRequest(path));
  }

  return { path, cold: summarize(coldTimes), warm: summarize(warmTimes) };
}

(async () => {
  await redis.connect();

  const paths = ["/students?page=1&limit=20", "/dashboard/stats"];
  const results = [];

  for (const path of paths) {
    console.log(`Benchmarking ${path} (${N} requests per phase)...`);
    results.push(await benchmarkEndpoint(path));
  }

  console.log("\n=== Results ===");

  for (const r of results) {
    console.log(`\n${r.path}`);
    console.log(
      `  Without cache (cold): avg=${r.cold.avg}ms  min=${r.cold.min}ms  max=${r.cold.max}ms`,
    );
    console.log(
      `  With cache (warm):    avg=${r.warm.avg}ms  min=${r.warm.min}ms  max=${r.warm.max}ms`,
    );
    console.log(
      `  Speedup: ${(r.cold.avg / r.warm.avg).toFixed(1)}x faster avg`,
    );
  }

  await redis.quit();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
