import "dotenv/config";
import { parseCorsOrigins } from "./utils/cors";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseFloat(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }
  return raw === "true";
}

function envCsv(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function envString(name: string, fallback: string): string {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }
  const value = String(raw).trim();
  return value || fallback;
}

function parseRedisUrl(value: string | undefined): { url: string | null; enabled: boolean; warning: string | null } {
  const raw = String(value || "").trim();
  if (!raw) {
    return {
      url: "redis://localhost:6379",
      enabled: true,
      warning: null,
    };
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
      return {
        url: null,
        enabled: false,
        warning: "REDIS_URL must use redis:// or rediss://. Redis cache will be disabled.",
      };
    }
  } catch {
    return {
      url: null,
      enabled: false,
      warning: "REDIS_URL is not a valid URL. Redis cache will be disabled.",
    };
  }

  return {
    url: raw,
    enabled: true,
    warning: null,
  };
}

type CacheBackend = "redis" | "memory" | "none";

function parseCacheBackend(value: string | undefined, fallback: CacheBackend): {
  backend: CacheBackend;
  warning: string | null;
} {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) {
    return {
      backend: fallback,
      warning: null,
    };
  }

  if (raw === "redis" || raw === "memory" || raw === "none") {
    return {
      backend: raw,
      warning: null,
    };
  }

  return {
    backend: fallback,
    warning: `CACHE_BACKEND=${raw} is invalid. Falling back to ${fallback}.`,
  };
}

const redisConfig = parseRedisUrl(process.env.REDIS_URL);
const defaultCacheBackend: CacheBackend = process.env.NODE_ENV === "production" ? "redis" : "memory";
const cacheBackendConfig = parseCacheBackend(process.env.CACHE_BACKEND, defaultCacheBackend);
const corsConfig = parseCorsOrigins(process.env.CORS_ORIGIN ?? process.env.CORS_ORIGINS);

function parseRetentionMaxAgeDays(): number {
  const explicitDays = envNumber("RETENTION_DAYS", Number.NaN);
  if (Number.isFinite(explicitDays)) {
    return explicitDays;
  }

  const fallbackDays = envNumber("RETENTION_MAX_AGE_DAYS", Number.NaN);
  if (Number.isFinite(fallbackDays)) {
    return fallbackDays;
  }

  const fallbackHours = envNumber("RETENTION_MAX_AGE_HOURS", Number.NaN);
  if (Number.isFinite(fallbackHours)) {
    return fallbackHours / 24;
  }

  return 30;
}

function parseRetentionIntervalHours(): number {
  const explicitHours = envNumber("RETENTION_INTERVAL_HOURS", Number.NaN);
  if (Number.isFinite(explicitHours)) {
    return explicitHours;
  }

  const fallbackDays = envNumber("RETENTION_INTERVAL_DAYS", Number.NaN);
  if (Number.isFinite(fallbackDays)) {
    return fallbackDays * 24;
  }

  return 24;
}

type SponsorCard = {
  url: string;
  image: string;
  alt: string;
};

function parseSponsorCards(value: string | undefined, fallbackAlt: string): SponsorCard[] {
  const raw = String(value || "").trim();
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const cards: SponsorCard[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      const record = entry as Record<string, unknown>;
      const url = String(record.url || "").trim();
      const image = String(record.image || "").trim();
      const alt = String(record.alt || "").trim() || fallbackAlt;

      if (!url || !image) {
        continue;
      }

      cards.push({ url, image, alt });
    }

    return cards;
  } catch {
    return [];
  }
}

const sponsorCardAlt = envString("SPONSOR_CARD_ALT", "Sponsor");
const sponsorCards = parseSponsorCards(process.env.SPONSOR_CARDS, sponsorCardAlt);

export const config = {
  avatars: {
    minSize: envInt("AVATAR_MIN", 1),
    maxSize: envInt("AVATAR_MAX", 512),
    defaultSize: envInt("AVATAR_DEFAULT", 160),
  },
  renders: {
    minScale: envInt("RENDER_MIN", 1),
    maxScale: envInt("RENDER_MAX", 10),
    defaultScale: envInt("RENDER_DEFAULT", 6),
  },
  directories: {
    faces: process.env.FACE_DIR || "./images/faces/",
    helms: process.env.HELM_DIR || "./images/helms/",
    skins: process.env.SKIN_DIR || "./images/skins/",
    renders: process.env.RENDER_DIR || "./images/renders/",
    capes: process.env.CAPE_DIR || "./images/capes/",
  },
  caching: {
    localSeconds: envInt("CACHE_LOCAL", 1200),
    browserSeconds: envInt("CACHE_BROWSER", 3600),
    ephemeral: envBool("EPHEMERAL_STORAGE", false),
    cloudflare: envBool("CLOUDFLARE", false),
    retentionEnabled: process.env.RETENTION_ENABLED !== "false",
    retentionDays: parseRetentionMaxAgeDays(),
    retentionIntervalHours: parseRetentionIntervalHours(),
    memoryMaxKeys: envInt("MEMORY_CACHE_MAX_KEYS", 50_000),
    memoryTtlSeconds: envInt("MEMORY_CACHE_TTL_SECONDS", Math.max(envInt("CACHE_LOCAL", 1200) * 2, 300)),
    backend: cacheBackendConfig.backend,
    backendWarning: cacheBackendConfig.warning,
  },
  redis: redisConfig.url,
  redisEnabled: redisConfig.enabled,
  redisWarning: redisConfig.warning,
  metrics: {
    apiCallCountFile: envString("API_CALL_COUNT_FILE", "./data/api-call-count.json"),
    apiCallCountFlushMs: envInt("API_CALL_COUNT_FLUSH_MS", 2000),
  },
  sponsors: {
    cardUrl: envString("SPONSOR_CARD_URL", ""),
    cardImage: envString("SPONSOR_CARD_IMAGE", ""),
    cardAlt: sponsorCardAlt,
    cards: sponsorCards,
  },
  server: {
    port: envInt("PORT", envInt("SERVER_PORT", 3000)),
    bind: process.env.BIND || "0.0.0.0",
    httpTimeout: envInt("EXTERNAL_HTTP_TIMEOUT", 2000),
    statusProbeCacheTtlMs: envInt("STATUS_PROBE_CACHE_TTL_MS", 10_000),
    debugEnabled: envBool("DEBUG", false),
    logTime: envBool("LOG_TIME", true),
    sessionsRateLimit: envInt("SESSIONS_RATE_LIMIT", Number.NaN),
    requestsRateLimit: {
      max: envInt("REQUESTS_RATE_LIMIT", Number.NaN),
      windowMs: envInt("REQUESTS_RATE_LIMIT_WINDOW_MS", 1000),
      maxKeys: envInt("REQUESTS_RATE_LIMIT_MAX_KEYS", 10_000),
      trustProxy: envBool("REQUESTS_RATE_LIMIT_TRUST_PROXY", false),
      excludePaths: envCsv("REQUESTS_RATE_LIMIT_EXCLUDE", []),
    },
    allowPrivateStatusTargets: envBool("STATUS_ALLOW_PRIVATE_TARGETS", false),
    defaultRedirectAllowlist: envCsv("DEFAULT_REDIRECT_ALLOWLIST", []),
    maxTextureBytes: envInt("MAX_TEXTURE_BYTES", 1_048_576),
    corsAllowAll: corsConfig.allowAll,
    corsOrigins: corsConfig.origins,
    corsWarning: corsConfig.warning,
    externalUrl: (process.env.EXTERNAL_URL || "").trim(),
  },
} as const;

export type AppConfig = typeof config;
