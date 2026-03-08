import { writeFile } from "node:fs/promises";
import { extractTextureHash, resolvePlayer } from "minecraft-toolkit";
import { config } from "../config";
import { cache, type CacheDetails } from "./cache";
import { extractFace, extractHelm, openImage, resizeImage, saveImage } from "./images";
import { capePath, exists, facePath, helmPath, renderPath, skinPath } from "../utils/paths";
import { createSessionRateLimitError, tryConsumeSessionRequest } from "../utils/session-rate-limit";

type TextureType = "skin" | "cape";

type TextureLookup = {
  hash: string | null;
  slim: boolean;
  status: number;
  err?: unknown;
};

type BinaryResult = {
  status: number;
  hash: string | null;
  buffer: Buffer | null;
  slim: boolean;
  err?: unknown;
};

const TEXTURE_BASE = "https://textures.minecraft.net/texture/";
const ALLOWED_TEXTURE_HOSTS = new Set(["textures.minecraft.net"]);
const inflight = new Map<string, Promise<CacheDetails>>();
const inflightRenders = new Map<string, Promise<Buffer>>();
const inflightTextures = new Map<string, Promise<Buffer>>();

function normalizeTextureUrl(input: string): URL {
  const parsed = new URL(input);
  const hostname = parsed.hostname.toLowerCase();

  // Mojang can occasionally return http://textures.minecraft.net URLs.
  // We keep host allowlisting strict and force these to HTTPS.
  if (parsed.protocol === "http:" && ALLOWED_TEXTURE_HOSTS.has(hostname)) {
    parsed.protocol = "https:";
    parsed.port = "";
  }

  return parsed;
}

function toolkitStatusCode(err: unknown): number | undefined {
  if (!err || typeof err !== "object") {
    return undefined;
  }
  const status = (err as { statusCode?: unknown }).statusCode;
  return typeof status === "number" ? status : undefined;
}

function isRateLimitedError(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }

  const code = String((err as { code?: unknown }).code || "").toUpperCase();
  if (code === "RATELIMIT") {
    return true;
  }

  return toolkitStatusCode(err) === 429;
}

async function fetchBuffer(url: string): Promise<Buffer | null> {
  const parsed = normalizeTextureUrl(url);
  const requestUrl = parsed.toString();
  const hostname = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "https:" || !ALLOWED_TEXTURE_HOSTS.has(hostname)) {
    const err = new Error(`Blocked texture URL: ${url}`) as Error & { code?: string };
    err.code = "URLBLOCKED";
    throw err;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.server.httpTimeout);

  try {
    const response = await fetch(requestUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "NitroCraft (+https://github.com/EuphoriaDevelopmentOrg/NitroCraft)",
      },
    });

    if (response.status === 404 || response.status === 204) {
      return null;
    }

    if (!response.ok) {
      const err = new Error(`HTTP ${response.status} for ${requestUrl}`) as Error & {
        code?: string;
        statusCode?: number;
      };
      err.code = "HTTPERROR";
      err.statusCode = response.status;
      throw err;
    }

    const contentLength = Number.parseInt(response.headers.get("content-length") || "", 10);
    if (Number.isFinite(contentLength) && contentLength > config.server.maxTextureBytes) {
      const err = new Error(`Texture too large: ${contentLength} bytes`) as Error & { code?: string };
      err.code = "MAXSIZE";
      throw err;
    }

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (contentType && !contentType.startsWith("image/") && !contentType.includes("octet-stream")) {
      const err = new Error(`Unexpected texture content-type: ${contentType}`) as Error & { code?: string };
      err.code = "BADTYPE";
      throw err;
    }

    const body = response.body;
    if (!body) {
      return Buffer.alloc(0);
    }

    const reader = body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }

      total += value.byteLength;
      if (total > config.server.maxTextureBytes) {
        try {
          await reader.cancel();
        } catch {}

        const err = new Error(`Texture exceeded maximum size (${config.server.maxTextureBytes} bytes)`) as Error & {
          code?: string;
        };
        err.code = "MAXSIZE";
        throw err;
      }

      chunks.push(Buffer.from(value));
    }

    return Buffer.concat(chunks, total);
  } finally {
    clearTimeout(timer);
  }
}

async function ensureSkinAssets(hash: string, skinUrl: string): Promise<void> {
  const skinFile = skinPath(hash);
  const faceFile = facePath(hash);
  const helmFile = helmPath(hash);

  const [hasSkin, hasFace, hasHelm] = await Promise.all([
    exists(skinFile),
    exists(faceFile),
    exists(helmFile),
  ]);

  if (hasSkin && hasFace && hasHelm) {
    return;
  }

  const skinBuffer = hasSkin ? await openImage(skinFile) : await fetchBuffer(skinUrl);
  if (!skinBuffer) {
    throw new Error("Failed to download skin texture");
  }

  if (!hasSkin) {
    await saveImage(skinBuffer, skinFile);
  }

  if (!hasFace) {
    await extractFace(skinBuffer, faceFile);
  }

  if (!hasHelm) {
    await extractHelm(faceFile, skinBuffer, helmFile);
  }
}

async function ensureCapeAsset(hash: string, capeUrl: string): Promise<void> {
  const file = capePath(hash);
  if (await exists(file)) {
    return;
  }

  const capeBuffer = await fetchBuffer(capeUrl);
  if (!capeBuffer) {
    return;
  }

  await saveImage(capeBuffer, file);
}

async function refreshDetails(userId: string, fallback: CacheDetails | null): Promise<CacheDetails> {
  try {
    if (!tryConsumeSessionRequest()) {
      throw createSessionRateLimitError();
    }

    const profile = await resolvePlayer(userId);
    const skinUrl = profile.skin?.url || null;
    const capeUrl = profile.cape?.url || null;
    const skinHash = extractTextureHash(skinUrl);
    const capeHash = extractTextureHash(capeUrl);
    const slim = profile.skin?.metadata?.model === "slim";

    const tasks: Promise<void>[] = [];
    if (skinHash && skinUrl) {
      tasks.push(ensureSkinAssets(skinHash, skinUrl));
    }
    if (capeHash && capeUrl) {
      tasks.push(ensureCapeAsset(capeHash, capeUrl));
    }
    if (tasks.length) {
      await Promise.all(tasks);
    }

    const details: CacheDetails = {
      skin: skinHash,
      cape: capeHash,
      slim,
      time: Date.now(),
    };

    await cache.saveDetails(userId, details);
    return details;
  } catch (err) {
    if (toolkitStatusCode(err) === 404) {
      const details: CacheDetails = {
        skin: null,
        cape: null,
        slim: fallback?.slim ?? false,
        time: Date.now(),
      };
      await cache.saveDetails(userId, details);
      return details;
    }

    throw err;
  }
}

async function fetchFreshDetails(userId: string, existing?: CacheDetails | null): Promise<CacheDetails> {
  const current = inflight.get(userId);
  if (current) {
    return current;
  }

  const fallback = existing === undefined ? await cache.getDetails(userId) : existing;
  const promise = refreshDetails(userId, fallback)
    .finally(() => {
      inflight.delete(userId);
    });

  inflight.set(userId, promise);
  return promise;
}

async function getTextureHash(userId: string, type: TextureType): Promise<TextureLookup> {
  const cached = await cache.getDetails(userId);
  const now = Date.now();
  const isFresh = Boolean(cached && cached.time + config.caching.localSeconds * 1000 >= now);

  if (cached && isFresh) {
    return {
      hash: cached[type],
      slim: cached.slim,
      status: cached[type] ? 1 : 0,
    };
  }

  try {
    const refreshed = await fetchFreshDetails(userId, cached);
    return {
      hash: refreshed[type],
      slim: refreshed.slim,
      status: cached && cached[type] === refreshed[type] ? 3 : 2,
    };
  } catch (err) {
    if (cached) {
      await cache.updateTimestamp(userId, !isRateLimitedError(err));
      return {
        hash: cached[type],
        slim: cached.slim,
        status: 4,
        err,
      };
    }

    throw err;
  }
}

async function loadTextureByHash(hash: string, filePath: string): Promise<Buffer> {
  try {
    return await openImage(filePath);
  } catch (err) {
    const code = String((err as { code?: unknown }).code || "").toUpperCase();
    if (code !== "ENOENT") {
      throw err;
    }
  }

  const existing = inflightTextures.get(filePath);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    const downloaded = await fetchBuffer(`${TEXTURE_BASE}${hash}`);
    if (!downloaded) {
      const err = new Error("Texture not found") as Error & { code?: string };
      err.code = "ENOENT";
      throw err;
    }

    await saveImage(downloaded, filePath);
    return downloaded;
  })();

  inflightTextures.set(filePath, promise);
  try {
    return await promise;
  } finally {
    if (inflightTextures.get(filePath) === promise) {
      inflightTextures.delete(filePath);
    }
  }
}

export async function getAvatar(userId: string, size: number, overlay: boolean): Promise<BinaryResult> {
  let lookup: TextureLookup;
  try {
    lookup = await getTextureHash(userId, "skin");
  } catch (err) {
    return {
      status: -1,
      hash: null,
      buffer: null,
      slim: false,
      err,
    };
  }

  if (!lookup.hash) {
    return {
      status: lookup.status,
      hash: null,
      buffer: null,
      slim: lookup.slim,
      err: lookup.err,
    };
  }

  const faceFile = facePath(lookup.hash);
  const helmFile = helmPath(lookup.hash);
  const target = overlay && (await exists(helmFile)) ? helmFile : faceFile;

  try {
    const image = await resizeImage(target, size);
    return {
      status: lookup.status,
      hash: lookup.hash,
      buffer: image,
      slim: lookup.slim,
      err: lookup.err,
    };
  } catch (err) {
    await cache.removeHash(userId);
    return {
      status: -1,
      hash: lookup.hash,
      buffer: null,
      slim: lookup.slim,
      err: (lookup.err || err),
    };
  }
}

export async function getSkin(userId: string): Promise<BinaryResult> {
  let lookup: TextureLookup;
  try {
    lookup = await getTextureHash(userId, "skin");
  } catch (err) {
    return {
      status: -1,
      hash: null,
      buffer: null,
      slim: false,
      err,
    };
  }

  if (!lookup.hash) {
    return {
      status: lookup.status,
      hash: null,
      buffer: null,
      slim: lookup.slim,
      err: lookup.err,
    };
  }

  try {
    const skinFile = skinPath(lookup.hash);
    const buffer = await loadTextureByHash(lookup.hash, skinFile);

    const faceFile = facePath(lookup.hash);
    const helmFile = helmPath(lookup.hash);
    const [hasFace, hasHelm] = await Promise.all([
      exists(faceFile),
      exists(helmFile),
    ]);

    if (!hasFace) {
      await extractFace(buffer, faceFile);
    }

    if (!hasHelm) {
      await extractHelm(faceFile, buffer, helmFile);
    }

    return {
      status: lookup.status,
      hash: lookup.hash,
      buffer,
      slim: lookup.slim,
      err: lookup.err,
    };
  } catch (err) {
    await cache.removeHash(userId);
    return {
      status: -1,
      hash: lookup.hash,
      buffer: null,
      slim: lookup.slim,
      err: (lookup.err || err),
    };
  }
}

export async function getCape(userId: string): Promise<BinaryResult> {
  let lookup: TextureLookup;
  try {
    lookup = await getTextureHash(userId, "cape");
  } catch (err) {
    return {
      status: -1,
      hash: null,
      buffer: null,
      slim: false,
      err,
    };
  }

  if (!lookup.hash) {
    return {
      status: lookup.status,
      hash: null,
      buffer: null,
      slim: lookup.slim,
      err: lookup.err,
    };
  }

  try {
    const file = capePath(lookup.hash);
    const buffer = await loadTextureByHash(lookup.hash, file);
    return {
      status: lookup.status,
      hash: lookup.hash,
      buffer,
      slim: lookup.slim,
      err: lookup.err,
    };
  } catch (err) {
    await cache.removeHash(userId);
    return {
      status: -1,
      hash: lookup.hash,
      buffer: null,
      slim: lookup.slim,
      err: (lookup.err || err),
    };
  }
}

export async function getRender(
  userId: string,
  scale: number,
  overlay: boolean,
  body: boolean,
): Promise<BinaryResult> {
  const { drawModel, openRender } = await import("./renders");
  const skin = await getSkin(userId);
  if (!skin.hash || !skin.buffer) {
    return {
      status: skin.status,
      hash: skin.hash,
      buffer: null,
      slim: skin.slim,
      err: skin.err,
    };
  }

  const file = renderPath(skin.hash, scale, overlay, body, skin.slim);
  try {
    if (await exists(file)) {
      return {
        status: 1,
        hash: skin.hash,
        buffer: await openRender(file),
        slim: skin.slim,
        err: skin.err,
      };
    }

    const existingRender = inflightRenders.get(file);
    if (existingRender) {
      const rendered = await existingRender;
      return {
        status: skin.status,
        hash: skin.hash,
        buffer: rendered,
        slim: skin.slim,
        err: skin.err,
      };
    }

    const renderPromise = (async () => {
      const rendered = await drawModel(
        skin.buffer,
        scale,
        overlay,
        body,
        skin.slim || userId.toLowerCase() === "mhf_alex",
      );
      await writeFile(file, rendered);
      return rendered;
    })();

    inflightRenders.set(file, renderPromise);
    void renderPromise.finally(() => {
      if (inflightRenders.get(file) === renderPromise) {
        inflightRenders.delete(file);
      }
    });
    const rendered = await renderPromise;

    return {
      status: skin.status,
      hash: skin.hash,
      buffer: rendered,
      slim: skin.slim,
      err: skin.err,
    };
  } catch (err) {
    return {
      status: -1,
      hash: skin.hash,
      buffer: null,
      slim: skin.slim,
      err: (skin.err || err),
    };
  }
}
