import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { config } from "../config";
import { cache } from "./cache";
import { debug, warn } from "../utils/logging";

const REDIS_KEY = "nitrocraft:metrics:api_calls_total";

type CounterBackend = "redis" | "file" | "memory";

type CounterPayload = {
  apiCalls?: unknown;
  total?: unknown;
};

function parseStoredCount(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? "0"), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

class ApiCallCounter {
  private total = 0;
  private pendingDelta = 0;
  private initialized = false;
  private backend: CounterBackend = "memory";
  private flushTimer: NodeJS.Timeout | null = null;
  private flushPromise: Promise<void> | null = null;

  private flushIntervalMs(): number {
    const raw = config.metrics.apiCallCountFlushMs;
    if (!Number.isFinite(raw) || raw <= 0) {
      return 2_000;
    }
    return Math.max(250, Math.floor(raw));
  }

  private filePath(): string {
    return resolve(config.metrics.apiCallCountFile);
  }

  private async readFromFile(): Promise<number> {
    try {
      const raw = await readFile(this.filePath(), "utf8");
      const payload = JSON.parse(raw) as CounterPayload;
      if (typeof payload.apiCalls !== "undefined") {
        return parseStoredCount(payload.apiCalls);
      }
      return parseStoredCount(payload.total);
    } catch (err) {
      const code = String((err as { code?: unknown })?.code || "");
      if (code === "ENOENT") {
        return 0;
      }
      throw err;
    }
  }

  private async writeToFile(): Promise<void> {
    const path = this.filePath();
    await mkdir(dirname(path), { recursive: true });
    const payload = JSON.stringify({
      apiCalls: this.total,
      updatedAt: new Date().toISOString(),
    });
    await writeFile(path, `${payload}\n`, "utf8");
  }

  private scheduleFlush(): void {
    if (!this.initialized || this.backend === "memory" || this.flushTimer) {
      return;
    }

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, this.flushIntervalMs());
    if (typeof this.flushTimer.unref === "function") {
      this.flushTimer.unref();
    }
  }

  private async persistDelta(delta: number): Promise<void> {
    if (delta <= 0) {
      return;
    }

    if (this.backend === "redis") {
      const redis = cache.getRedis();
      if (redis && redis.isOpen) {
        await redis.incrBy(REDIS_KEY, delta);
        return;
      }
      warn("api call counter redis unavailable, falling back to file persistence");
      this.backend = "file";
    }

    if (this.backend === "file") {
      await this.writeToFile();
    }
  }

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const preInitDelta = this.pendingDelta;
    let stored = 0;
    const redis = cache.getRedis();

    if (redis && redis.isOpen) {
      this.backend = "redis";
      try {
        stored = parseStoredCount(await redis.get(REDIS_KEY));
      } catch (err) {
        warn("api call counter redis init failed, using file persistence", err);
        this.backend = "file";
      }
    } else {
      this.backend = "file";
    }

    if (this.backend === "file") {
      try {
        stored = await this.readFromFile();
      } catch (err) {
        warn("api call counter file init failed, using memory only", err);
        this.backend = "memory";
      }
    }

    this.total = Math.max(0, stored + preInitDelta);
    this.initialized = true;

    if (this.pendingDelta > 0) {
      this.scheduleFlush();
    }
  }

  recordApiCall(): void {
    this.total += 1;
    this.pendingDelta += 1;
    this.scheduleFlush();
  }

  getTotal(): number {
    return Math.max(0, Math.trunc(this.total));
  }

  async flush(): Promise<void> {
    if (!this.initialized || this.backend === "memory" || this.flushPromise) {
      return this.flushPromise || Promise.resolve();
    }

    const delta = this.pendingDelta;
    if (delta <= 0) {
      return;
    }
    this.pendingDelta = 0;

    const task = this.persistDelta(delta)
      .catch((err) => {
        this.pendingDelta += delta;
        debug("api call counter flush failed", err);
      })
      .finally(() => {
        this.flushPromise = null;
        if (this.pendingDelta > 0) {
          this.scheduleFlush();
        }
      });

    this.flushPromise = task;
    await task;
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flush();
  }
}

export const apiCallCounter = new ApiCallCounter();
