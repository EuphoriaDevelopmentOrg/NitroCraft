import { cache } from "../src/services/cache";

const smokeKey = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

async function main(): Promise<void> {
  await cache.init();

  const redis = cache.getRedis();
  if (!redis || !redis.isOpen) {
    throw new Error("Redis cache backend is not connected.");
  }

  await cache.saveDetails(smokeKey, {
    skin: "redis-smoke",
    cape: null,
    slim: true,
    time: Date.now(),
  });

  const loaded = await cache.getDetails(smokeKey);
  if (!loaded || loaded.skin !== "redis-smoke" || loaded.slim !== true) {
    throw new Error("Redis round-trip validation failed.");
  }

  await cache.removeHash(smokeKey);
  await cache.close();
  console.log("redis-smoke-ok");
}

main().catch(async (err) => {
  try {
    await cache.close();
  } catch {}
  console.error(err);
  process.exit(1);
});

