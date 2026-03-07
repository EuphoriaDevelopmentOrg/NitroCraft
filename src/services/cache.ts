import { createClient, type RedisClientType } from "redis";
import { config } from "../config";
import { debug, error, log, warn } from "../utils/logging";

export type CacheDetails = {
  skin: string | null;
  cape: string | null;
  slim: boolean;
  time: number;
};

class MetadataCache {
  private redis: RedisClientType | null = null;
  private redisDisabled = false;
  private memoryEnabled = false;
  private memory = new Map<string, CacheDetails>();
  private lastMemorySweep = 0;

  private memoryTtlMs(): number {
    const raw = config.caching.memoryTtlSeconds;
    if (!Number.isFinite(raw) || raw <= 0) {
      return Math.max(config.caching.localSeconds, 300) * 1000;
    }
    return raw * 1000;
  }

  private memoryMaxKeys(): number {
    const raw = config.caching.memoryMaxKeys;
    if (!Number.isFinite(raw) || raw <= 0) {
      return 50_000;
    }
    return Math.floor(raw);
  }

  private sweepMemory(now = Date.now()): void {
    if (now - this.lastMemorySweep < 30_000) {
      return;
    }

    this.lastMemorySweep = now;
    const ttlMs = this.memoryTtlMs();
    for (const [key, value] of this.memory.entries()) {
      if (now - value.time > ttlMs) {
        this.memory.delete(key);
      }
    }
  }

  private enforceMemoryLimit(): void {
    const limit = this.memoryMaxKeys();
    while (this.memory.size > limit) {
      const oldest = this.memory.keys().next();
      if (oldest.done) {
        break;
      }
      this.memory.delete(oldest.value);
    }
  }

  private memoryGet(userId: string): CacheDetails | null {
    this.sweepMemory();
    const value = this.memory.get(userId);
    if (!value) {
      return null;
    }

    if (Date.now() - value.time > this.memoryTtlMs()) {
      this.memory.delete(userId);
      return null;
    }

    return value;
  }

  private memorySet(userId: string, details: CacheDetails): void {
    // Refresh insertion order so frequently used keys are less likely to be evicted.
    this.sweepMemory();
    this.memory.delete(userId);
    this.memory.set(userId, details);
    this.enforceMemoryLimit();
  }

  private fallbackToMemory(reason: string): void {
    if (!this.memoryEnabled) {
      warn(`Using in-memory cache backend (${reason}).`);
    }
    this.memoryEnabled = true;
    this.redisDisabled = true;

    if (this.redis) {
      try {
        this.redis.destroy();
      } catch {}
    }
    this.redis = null;
  }

  async init(): Promise<void> {
    if (config.redisWarning) {
      warn(config.redisWarning);
    }
    if (config.caching.backendWarning) {
      warn(config.caching.backendWarning);
    }

    if (config.caching.backend === "none") {
      this.redisDisabled = true;
      log("Cache backend disabled (CACHE_BACKEND=none).");
      return;
    }

    if (config.caching.backend === "memory") {
      this.memoryEnabled = true;
      this.redisDisabled = true;
      warn("Using in-memory cache backend (CACHE_BACKEND=memory).");
      return;
    }

    if (!config.redisEnabled || !config.redis) {
      this.memoryEnabled = true;
      this.redisDisabled = true;
      warn("Redis disabled by configuration, falling back to in-memory cache.");
      return;
    }

    try {
      const client = createClient({
        url: config.redis,
        socket: {
          connectTimeout: config.server.httpTimeout,
          reconnectStrategy: () => false,
        },
      });
      client.on("error", (err) => {
        if (this.redisDisabled) {
          return;
        }
        const message = String((err as Error)?.message || err);
        if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET/i.test(message)) {
          this.fallbackToMemory("redis unavailable");
          return;
        }
        error("redis", err);
      });
      client.on("end", () => {
        if (!this.redisDisabled) {
          warn("Redis connection closed.");
        }
      });

      await client.connect();
      this.redis = client;
      log("Redis connection established.");

      if (config.caching.ephemeral) {
        log("Storage is ephemeral, flushing redis.");
        await client.flushAll();
      }
    } catch (err) {
      const message = String((err as Error)?.message || err);
      if (process.env.NODE_ENV === "production") {
        error("Failed to connect Redis.", err);
      } else {
        warn(`Redis unavailable (${message}). Falling back to in-memory cache.`);
      }
      this.fallbackToMemory("redis connect failed");
    }
  }

  async close(): Promise<void> {
    if (this.redis && this.redis.isOpen) {
      await this.redis.quit();
    }
    this.redis = null;
  }

  getRedis(): RedisClientType | null {
    return this.redis;
  }

  private normalize(userId: string): string {
    return userId.toLowerCase();
  }

  private async redisGet(userId: string): Promise<CacheDetails | null> {
    if (!this.redis || !this.redis.isOpen) {
      return null;
    }

    try {
      const raw = await this.redis.hGetAll(userId);
      if (!raw || Object.keys(raw).length === 0) {
        return null;
      }

      return {
        skin: raw.s === "" ? null : (raw.s ?? null),
        cape: raw.c === "" ? null : (raw.c ?? null),
        slim: raw.a === "1",
        time: Number(raw.t || 0),
      };
    } catch (err) {
      debug("redis get_details failed", err);
      return null;
    }
  }

  async getDetails(userId: string): Promise<CacheDetails | null> {
    const key = this.normalize(userId);

    if (this.memoryEnabled) {
      return this.memoryGet(key);
    }

    return this.redisGet(key);
  }

  async saveDetails(userId: string, patch: Partial<CacheDetails>): Promise<void> {
    const key = this.normalize(userId);
    const current = (await this.getDetails(key)) || {
      skin: null,
      cape: null,
      slim: false,
      time: Date.now(),
    };

    const next: CacheDetails = {
      skin: patch.skin === undefined ? current.skin : patch.skin,
      cape: patch.cape === undefined ? current.cape : patch.cape,
      slim: patch.slim === undefined ? current.slim : patch.slim,
      time: patch.time === undefined ? Date.now() : patch.time,
    };

    if (this.memoryEnabled) {
      this.memorySet(key, next);
      return;
    }

    if (!this.redis || !this.redis.isOpen) {
      return;
    }

    try {
      await this.redis.hSet(key, {
        s: next.skin ?? "",
        c: next.cape ?? "",
        a: next.slim ? 1 : 0,
        t: next.time,
      });
    } catch (err) {
      debug("redis save_details failed", err);
    }
  }

  async updateTimestamp(userId: string, temporary = false): Promise<void> {
    const offset = temporary ? (config.caching.localSeconds - 60) * 1000 : 0;
    await this.saveDetails(userId, { time: Date.now() - offset });
  }

  async removeHash(userId: string): Promise<void> {
    const key = this.normalize(userId);

    if (this.memoryEnabled) {
      this.memory.delete(key);
      return;
    }

    if (!this.redis || !this.redis.isOpen) {
      return;
    }

    try {
      await this.redis.del(key);
    } catch (err) {
      debug("redis remove_hash failed", err);
    }
  }
}

export const cache = new MetadataCache();
