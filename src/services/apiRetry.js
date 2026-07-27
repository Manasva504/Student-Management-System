// src/services/apiRetry.js
// The backend runs on Render's free tier, which idles the instance out
// after inactivity. The first request after that pays a 30-60 second cold
// start, during which requests fail outright — which previously surfaced
// to the user as "Could not load stats", i.e. indistinguishable from a
// genuinely broken app.
//
// This installs a single global axios interceptor rather than wrapping
// each service function, so every API call in the app is covered — login,
// dashboard, student list, uploads — instead of only the screens someone
// remembered to update. Installed once from main.jsx.
import axios from "axios";

// Cold starts fail as a network error (no response at all) or as one of
// the gateway statuses Render's proxy returns while the instance boots.
// A 4xx is a real answer from a running server and must never be retried —
// retrying a 400 "Invalid Credentials" would just hammer the login route.
const RETRYABLE_STATUSES = [502, 503, 504];
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1500;

const listeners = new Set();
let wakingCount = 0;

// Minimal pub/sub so the UI can show a "waking up" state. Kept here rather
// than in Redux because it's transport-level, not application state — no
// reducer, slice, or dispatch needs to know about it.
export function onServerWaking(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function emit() {
  const isWaking = wakingCount > 0;
  listeners.forEach((cb) => cb(isWaking));
}

// Each request counts toward "waking" at most once, however many times it
// gets retried, so the counter reflects in-flight requests rather than
// total attempts. Released on success, on giving up, or on a
// non-retryable error.
function markWaking(config) {
  if (config && !config.__countedAsWaking) {
    config.__countedAsWaking = true;
    wakingCount += 1;
    emit();
  }
}

function releaseWaking(config) {
  if (config && config.__countedAsWaking) {
    config.__countedAsWaking = false;
    wakingCount = Math.max(0, wakingCount - 1);
    emit();
  }
}

function isRetryable(error) {
  if (error.response) {
    return RETRYABLE_STATUSES.includes(error.response.status);
  }

  // No response at all — network error / DNS / connection refused, which
  // is exactly what a sleeping Render instance looks like. Excludes
  // explicit cancellations, which aren't failures.
  return error.code !== "ERR_CANCELED";
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function installApiRetry() {
  axios.interceptors.response.use(
    (response) => {
      releaseWaking(response.config);
      return response;
    },
    async (error) => {
      const config = error.config;

      if (!config || !isRetryable(error)) {
        releaseWaking(config);
        return Promise.reject(error);
      }

      config.__retryCount = config.__retryCount || 0;

      if (config.__retryCount >= MAX_RETRIES) {
        // Give up and let the real error surface, so the UI can show a
        // genuine failure instead of spinning forever.
        releaseWaking(config);
        return Promise.reject(error);
      }

      markWaking(config);
      config.__retryCount += 1;

      // Exponential backoff: 1.5s, 3s, 6s, 12s, 24s — ~46s of total wait
      // across 5 attempts, which covers Render's cold start without
      // hammering the instance while it boots.
      await delay(BASE_DELAY_MS * 2 ** (config.__retryCount - 1));

      // Re-enters this same interceptor chain on failure, so the retry
      // count keeps incrementing and the success handler above is what
      // clears the waking flag. No manual recursion needed.
      return axios(config);
    },
  );
}
