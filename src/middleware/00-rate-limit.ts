import { config } from "../config";
import { getClientIp } from "../utils/request";
import { respond } from "../utils/response";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const SWEEP_INTERVAL_MS = 30_000;
let lastSweep = 0;

function limiterMax(): number {
  return config.server.requestsRateLimit.max;
}

function limiterWindowMs(): number {
  const raw = config.server.requestsRateLimit.windowMs;
  if (!Number.isFinite(raw) || raw <= 0) {
    return 1000;
  }
  return raw;
}

function limiterMaxKeys(): number {
  const raw = config.server.requestsRateLimit.maxKeys;
  if (!Number.isFinite(raw) || raw <= 0) {
    return 10_000;
  }
  return Math.floor(raw);
}

function limiterEnabled(): boolean {
  return Number.isFinite(limiterMax()) && limiterMax() > 0;
}

function requestPath(event: any): string {
  return String(event.path || event.node?.req?.url || "/").split("?")[0];
}

function isExcluded(path: string): boolean {
  const patterns = config.server.requestsRateLimit.excludePaths;
  if (!patterns.length) {
    return false;
  }

  return patterns.some((pattern) => {
    if (!pattern) {
      return false;
    }
    return path.startsWith(pattern);
  });
}

function setHeader(event: any, name: string, value: string): void {
  if (event.node?.res && typeof event.node.res.setHeader === "function") {
    event.node.res.setHeader(name, value);
    return;
  }

  if (event.res?.headers?.set) {
    event.res.headers.set(name, value);
  }
}

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) {
    return;
  }

  lastSweep = now;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function enforceBucketLimit(now: number): void {
  const maxKeys = limiterMaxKeys();
  if (buckets.size <= maxKeys) {
    return;
  }

  sweep(now);
  if (buckets.size <= maxKeys) {
    return;
  }

  // Drop oldest entries first to keep limiter memory bounded during abusive traffic.
  while (buckets.size > maxKeys) {
    const first = buckets.keys().next();
    if (first.done) {
      break;
    }
    buckets.delete(first.value);
  }
}

export default defineEventHandler((event) => {
  if (!limiterEnabled()) {
    return;
  }

  const method = String(event.method || event.node?.req?.method || "GET").toUpperCase();
  if (method === "OPTIONS") {
    return;
  }

  const path = requestPath(event);
  if (isExcluded(path)) {
    return;
  }

  const now = Date.now();
  sweep(now);
  enforceBucketLimit(now);

  const max = Math.floor(limiterMax());
  const windowMs = limiterWindowMs();
  const key = getClientIp(event, config.server.requestsRateLimit.trustProxy);
  const current = buckets.get(key);

  let next: Bucket;
  if (!current || current.resetAt <= now) {
    next = {
      count: 1,
      resetAt: now + windowMs,
    };
  } else {
    next = {
      count: current.count + 1,
      resetAt: current.resetAt,
    };
  }

  buckets.set(key, next);

  const remaining = Math.max(0, max - next.count);
  const retryAfterSeconds = Math.max(1, Math.ceil((next.resetAt - now) / 1000));
  setHeader(event, "X-RateLimit-Limit", String(max));
  setHeader(event, "X-RateLimit-Remaining", String(remaining));
  setHeader(event, "X-RateLimit-Reset", String(Math.floor(next.resetAt / 1000)));

  if (next.count > max) {
    setHeader(event, "Retry-After", String(retryAfterSeconds));
    return respond(event, {
      status: -2,
      code: 429,
      body: "Too Many Requests",
      type: "text/plain; charset=utf-8",
      cacheControl: "no-cache, max-age=0",
    });
  }
});
