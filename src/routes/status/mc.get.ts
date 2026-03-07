import { config } from "../../config";
import { respond } from "../../utils/response";

const SESSION_HEALTH_URL = "https://sessionserver.mojang.com/session/minecraft/profile/069a79f444e94726a5befca90e38aaf5";
const SKINS_HEALTH_URL = "https://textures.minecraft.net/";
const STATUS_CACHE_TTL_MS = 60 * 1000;

let cachedStatus: unknown = null;
let cachedAt = 0;

async function checkHealth(url: string): Promise<{ status: "up" | "down"; code: number | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.server.httpTimeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return {
      status: response.status < 500 ? "up" : "down",
      code: response.status,
    };
  } catch {
    return {
      status: "down",
      code: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export default defineEventHandler(async (event) => {
  if (cachedStatus && Date.now() - cachedAt < STATUS_CACHE_TTL_MS) {
    return respond(event, {
      status: 1,
      body: JSON.stringify(cachedStatus),
      type: "application/json; charset=utf-8",
      cacheControl: "no-cache, max-age=0",
    });
  }

  const [session, skins] = await Promise.all([
    checkHealth(SESSION_HEALTH_URL),
    checkHealth(SKINS_HEALTH_URL),
  ]);

  const payload = {
    report: {
      session,
      skins,
    },
  };

  cachedStatus = payload;
  cachedAt = Date.now();

  return respond(event, {
    status: 1,
    body: JSON.stringify(payload),
    type: "application/json; charset=utf-8",
    cacheControl: "no-cache, max-age=0",
  });
});
