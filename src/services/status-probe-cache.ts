import { config } from "../config";
import { metrics } from "./metrics";

type CachedEntry = {
  value: unknown;
  expiresAt: number;
};

const entries = new Map<string, CachedEntry>();
const inflight = new Map<string, Promise<unknown>>();
let lastSweepAt = 0;
const SWEEP_INTERVAL_MS = 30_000;

function cacheTtlMs(overrideTtlMs?: number): number {
  if (overrideTtlMs !== undefined) {
    return Math.max(0, Math.floor(overrideTtlMs));
  }

  const raw = config.server.statusProbeCacheTtlMs;
  if (!Number.isFinite(raw) || raw < 0) {
    return 10_000;
  }
  return Math.floor(raw);
}

function normalizeKey(key: string): string {
  return String(key || "").trim().toLowerCase();
}

function maybeSweep(now: number): void {
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) {
    return;
  }

  lastSweepAt = now;
  for (const [key, entry] of entries.entries()) {
    if (entry.expiresAt <= now) {
      entries.delete(key);
    }
  }
}

export function statusProbeCacheKey(route: string, parts: Array<string | number | undefined | null>): string {
  const normalizedRoute = normalizeKey(route);
  const normalizedParts = parts.map((part) => String(part ?? "").trim().toLowerCase());
  return `${normalizedRoute}:${normalizedParts.join(":")}`;
}

export async function withStatusProbeCache<T>(
  route: string,
  key: string,
  loader: () => Promise<T>,
  overrideTtlMs?: number,
): Promise<T> {
  const now = Date.now();
  maybeSweep(now);
  const cacheKey = normalizeKey(key);
  const ttlMs = cacheTtlMs(overrideTtlMs);

  if (ttlMs > 0) {
    const existing = entries.get(cacheKey);
    if (existing && existing.expiresAt > now) {
      metrics.recordStatusProbeCache(route, "hit");
      return existing.value as T;
    }
  }

  const inflightProbe = inflight.get(cacheKey);
  if (inflightProbe) {
    metrics.recordStatusProbeCache(route, "inflight");
    return inflightProbe as Promise<T>;
  }

  metrics.recordStatusProbeCache(route, "miss");
  const startedAt = Date.now();
  const pending = loader()
    .then((value) => {
      metrics.recordStatusProbeDuration(route, "success", Date.now() - startedAt);
      if (ttlMs > 0) {
        entries.set(cacheKey, {
          value,
          expiresAt: Date.now() + ttlMs,
        });
      }
      return value;
    })
    .catch((err) => {
      metrics.recordStatusProbeDuration(route, "error", Date.now() - startedAt);
      throw err;
    })
    .finally(() => {
      inflight.delete(cacheKey);
    });

  inflight.set(cacheKey, pending as Promise<unknown>);
  return pending;
}
