import { config } from "../config";

const WINDOW_MS = 1000;
const sessionRequestTimes: number[] = [];

type RateLimitError = Error & {
  code: "RATELIMIT";
  statusCode: 429;
};

function limit(): number {
  return config.server.sessionsRateLimit;
}

function enabled(): boolean {
  return Number.isFinite(limit()) && limit() > 0;
}

function prune(now: number): void {
  const minTime = now - WINDOW_MS;
  while (sessionRequestTimes.length > 0 && sessionRequestTimes[0] <= minTime) {
    sessionRequestTimes.shift();
  }
}

export function tryConsumeSessionRequest(now = Date.now()): boolean {
  if (!enabled()) {
    return true;
  }

  prune(now);
  if (sessionRequestTimes.length >= limit()) {
    return false;
  }

  sessionRequestTimes.push(now);
  return true;
}

export function createSessionRateLimitError(): RateLimitError {
  const err = new Error("Skipped, session rate limit exceeded") as RateLimitError;
  err.name = "HTTP";
  err.code = "RATELIMIT";
  err.statusCode = 429;
  return err;
}

