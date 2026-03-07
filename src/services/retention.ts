import { readdir, stat, unlink } from "node:fs/promises";
import { extname, join } from "node:path";
import { config } from "../config";
import { cache } from "./cache";
import { error, log, warn } from "../utils/logging";

let running = false;
let timer: NodeJS.Timeout | null = null;

function thresholdMs(): number {
  const days = Number.isFinite(config.caching.retentionDays) && config.caching.retentionDays > 0
    ? config.caching.retentionDays
    : 30;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

async function cleanupRedis(threshold: number): Promise<number> {
  const redis = cache.getRedis();
  if (!redis || !redis.isOpen) {
    return 0;
  }

  const uuidKey = /^[a-f0-9]{32}$/;
  let removed = 0;

  for await (const key of redis.scanIterator({ MATCH: "*", COUNT: 100 })) {
    if (!uuidKey.test(key)) {
      continue;
    }

    try {
      const keyType = await redis.type(key);
      if (keyType !== "hash") {
        continue;
      }
      const data = await redis.hGetAll(key);
      const timestamp = Number(data?.t || 0);
      if (timestamp && timestamp < threshold) {
        await redis.del(key);
        removed += 1;
      }
    } catch (err) {
      warn("retention redis cleanup error", key, err);
    }
  }

  return removed;
}

async function cleanupDirectory(path: string, threshold: number): Promise<number> {
  let removed = 0;

  try {
    const entries = await readdir(path, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || extname(entry.name).toLowerCase() !== ".png") {
        continue;
      }
      const filePath = join(path, entry.name);
      try {
        const fileStats = await stat(filePath);
        if (fileStats.mtimeMs < threshold) {
          await unlink(filePath);
          removed += 1;
        }
      } catch (err) {
        warn("retention file cleanup error", filePath, err);
      }
    }
  } catch (err) {
    warn("retention read directory error", path, err);
  }

  return removed;
}

async function cleanupFiles(threshold: number): Promise<number> {
  const directories = [
    config.directories.faces,
    config.directories.helms,
    config.directories.skins,
    config.directories.renders,
    config.directories.capes,
  ];

  let total = 0;
  for (const directory of directories) {
    total += await cleanupDirectory(directory, threshold);
  }

  return total;
}

async function runCleanup(trigger: "startup" | "interval"): Promise<void> {
  if (running) {
    return;
  }
  running = true;

  try {
    const threshold = thresholdMs();
    const removedKeys = await cleanupRedis(threshold);
    const removedFiles = await cleanupFiles(threshold);
    log("retention cleanup", trigger, "removed", removedKeys, "redis keys and", removedFiles, "files");
  } catch (err) {
    error("retention cleanup failed", err);
  } finally {
    running = false;
  }
}

export function startRetention(): void {
  const retentionDays = Number.isFinite(config.caching.retentionDays) ? config.caching.retentionDays : 0;
  if (!config.caching.retentionEnabled || retentionDays <= 0) {
    log("retention cleanup disabled");
    return;
  }

  if (timer) {
    return;
  }

  const configuredIntervalHours = Number.isFinite(config.caching.retentionIntervalHours)
    ? config.caching.retentionIntervalHours
    : 24;
  const intervalHours = Math.max(1 / 60, configuredIntervalHours);
  log(
    "retention cleanup enabled",
    `max-age=${retentionDays.toFixed(2)}d`,
    `interval=${intervalHours.toFixed(2)}h`,
  );

  runCleanup("startup").catch((err) => {
    error("retention startup cleanup failed", err);
  });

  const intervalMs = intervalHours * 60 * 60 * 1000;
  timer = setInterval(() => {
    runCleanup("interval").catch((err) => {
      error("retention interval cleanup failed", err);
    });
  }, intervalMs);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
}

export function stopRetention(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  running = false;
}
