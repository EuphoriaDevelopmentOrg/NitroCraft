import { config } from "../config";
import { getClientIp } from "../utils/request";
import { respond } from "../utils/response";

type Bucket = {
  count: number;
  resetAt: number;
};

// In-memory per-IP bucket store (sliding fixed window by reset timestamp).
const buckets = new Map<string, Bucket>();
// Sweep periodically instead of on every request to keep overhead low.
const SWEEP_INTERVAL_MS = 30_000;
let lastSweep = 0;

// Raw max requests allowed per window.
function limiterMax(): number {
  return config.server.requestsRateLimit.max;
}
 
// Guard against invalid config and ensure a sane window fallback.
function limiterWindowMs(): number {
  const raw = config.server.requestsRateLimit.windowMs;
  if (!Number.isFinite(raw) || raw <= 0) {
    return 1000;
  }
  return raw;
}

// Cap total active keys to avoid unbounded memory growth.
function limiterMaxKeys(): number {
  const raw = config.server.requestsRateLimit.maxKeys;
  if (!Number.isFinite(raw) || raw <= 0) {
    return 10_000;
  }
  return Math.floor(raw);
}

// Feature flag behavior: any non-positive max effectively disables limiting.
function limiterEnabled(): boolean {
  return Number.isFinite(limiterMax()) && limiterMax() > 0;
}

// Normalize event path and strip query params for path-based exclusions.
function requestPath(event: any): string {
  return String(event.path || event.node?.req?.url || "/").split("?")[0];
}

// Prefix matching allows excluding full path trees (e.g. /status).
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

// Support both Node-style and Fetch-style response objects.
function setHeader(event: any, name: string, value: string): void {
  if (event.node?.res && typeof event.node.res.setHeader === "function") {
    event.node.res.setHeader(name, value);
    return;
  }

  if (event.res?.headers?.set) {
    event.res.headers.set(name, value);
  }
}

// Opportunistically delete expired buckets to reclaim memory.
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

// Keep the bucket map bounded even under high-cardinality abusive traffic.
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
  // Short-circuit quickly when feature is disabled.
  if (!limiterEnabled()) {
    return;
  }

  // Ignore preflight requests so CORS negotiation isn't rate-limited.
  const method = String(event.method || event.node?.req?.method || "GET").toUpperCase();
  if (method === "OPTIONS") {
    return;
  }

  // Skip configured paths (health checks, internal routes, etc).
  const path = requestPath(event);
  if (isExcluded(path)) {
    return;
  }

  const now = Date.now();
  sweep(now);
  enforceBucketLimit(now);

  const max = Math.floor(limiterMax());
  const windowMs = limiterWindowMs();
  // Keying by resolved client IP is consistent with configured proxy trust.
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

  // Emit standard rate-limit headers for both allowed and blocked requests.
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
