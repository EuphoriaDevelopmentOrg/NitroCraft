import { defineNitroPlugin } from "nitropack/runtime";
import { config } from "../config";
import { cache } from "../services/cache";
import { startRetention, stopRetention } from "../services/retention";
import { ensureImageDirectories } from "../utils/paths";
import { error, log, warn } from "../utils/logging";

function requestId(): string {
  return Math.random().toString(36).slice(2, 14);
}

function installProcessHooks(): void {
  const key = "__nitrocraftProcessHooksInstalled__";
  const globalRef = globalThis as Record<string, unknown>;
  if (globalRef[key]) {
    return;
  }
  globalRef[key] = true;

  process.on("unhandledRejection", (reason) => {
    error("process", "unhandledRejection", reason);
  });

  process.on("uncaughtExceptionMonitor", (err, origin) => {
    error("process", "uncaughtException", origin, err);
  });
}

export default defineNitroPlugin(async (nitroApp) => {
  installProcessHooks();

  if (config.server.corsWarning) {
    warn(config.server.corsWarning);
  }

  await ensureImageDirectories();
  await cache.init();
  startRetention();

  nitroApp.hooks.hook("request", (event) => {
    event.context.requestId = requestId();
    event.context.requestStart = Date.now();
  });

  nitroApp.hooks.hook("error", (err) => {
    error("nitro", err);
  });

  nitroApp.hooks.hook("close", async () => {
    stopRetention();
    try {
      await cache.close();
      log("cache closed");
    } catch (err) {
      warn("cache close failed", err);
    }
  });
});
