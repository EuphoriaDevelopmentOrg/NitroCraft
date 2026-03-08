import { crc32 } from "crc";
import { config } from "../config";
import { metrics } from "../services/metrics";
import { error, log, warn } from "./logging";
import { readHeader } from "./request";
import { resolveCorsOrigin } from "./cors";

const HUMAN_STATUS: Record<string, string> = {
  "-2": "user error",
  "-1": "server error",
  "0": "none",
  "1": "cached",
  "2": "downloaded",
  "3": "checked",
  "4": "server error;cached",
};

const SILENT_ERRORS = new Set([
  "ETIMEDOUT",
  "ESOCKETTIMEDOUT",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ECONNREFUSED",
  "HTTPERROR",
  "RATELIMIT",
]);

type ResponseResult = {
  status?: number;
  redirect?: string;
  body?: Buffer | string | null;
  type?: string;
  hash?: string | null;
  err?: unknown;
  code?: number;
  cacheControl?: string;
};

function bodyBuffer(body: Buffer | string | null | undefined): Buffer {
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (body === null || body === undefined) {
    return Buffer.alloc(0);
  }
  return Buffer.from(String(body));
}

function setHeaderSafe(event: any, name: string, value: string): void {
  if (event.node?.res && typeof event.node.res.setHeader === "function") {
    event.node.res.setHeader(name, value);
    return;
  }
  if (event.res?.headers?.set) {
    event.res.headers.set(name, value);
  }
}

function setStatusSafe(event: any, statusCode: number): void {
  if (event.node?.res) {
    event.node.res.statusCode = statusCode;
    return;
  }
  if (event.res) {
    event.res.status = statusCode;
  }
}

function applyCorsHeaders(event: any): void {
  setHeaderSafe(event, "Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  setHeaderSafe(event, "Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, If-None-Match");

  const corsOrigin = resolveCorsOrigin(readHeader(event, "origin"), config.server.corsAllowAll, config.server.corsOrigins);
  if (corsOrigin) {
    setHeaderSafe(event, "Access-Control-Allow-Origin", corsOrigin);
    if (corsOrigin !== "*") {
      setHeaderSafe(event, "Vary", "Origin");
    }
  }
}

function isHttpsRequest(event: any): boolean {
  const forwardedProto = String(readHeader(event, "x-forwarded-proto") || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (forwardedProto === "https") {
    return true;
  }

  if (event.node?.req?.socket?.encrypted) {
    return true;
  }

  return config.server.externalUrl.toLowerCase().startsWith("https://");
}

function applySecurityHeaders(event: any): void {
  setHeaderSafe(event, "X-Frame-Options", "DENY");
  setHeaderSafe(event, "X-Permitted-Cross-Domain-Policies", "none");
  setHeaderSafe(event, "Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  setHeaderSafe(event, "Cross-Origin-Resource-Policy", "cross-origin");
  setHeaderSafe(event, "Cross-Origin-Opener-Policy", "same-origin");
  setHeaderSafe(event, "Origin-Agent-Cluster", "?1");

  if (isHttpsRequest(event)) {
    setHeaderSafe(event, "Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

function logError(requestId: string, value: unknown): void {
  if (!value || typeof value !== "object") {
    error(requestId, value);
    return;
  }

  const candidate = value as { code?: string; stack?: string; message?: string };
  if (candidate.code && SILENT_ERRORS.has(candidate.code)) {
    warn(requestId, candidate.code, candidate.message || "");
    return;
  }

  if (candidate.stack) {
    error(requestId, candidate.stack);
    return;
  }

  error(requestId, candidate.message || value);
}

export function respond(event: any, result: ResponseResult): Buffer | string | null | Promise<string> {
  const requestId = String(event.context.requestId || "-");
  const start = Number(event.context.requestStart || Date.now());
  const method = String(event.method || "GET");
  const path = String(event.path || "/");

  let status = result.status;
  if (result.err) {
    logError(requestId, result.err);
    status = -1;
  }

  const body = bodyBuffer(result.body);
  const etag = `"${crc32(body)}"`;

  const responseTime = Math.max(0, Date.now() - start);
  setHeaderSafe(event, "Content-Type", result.type || "text/plain");
  setHeaderSafe(event, "Content-Length", String(body.length));
  setHeaderSafe(event, "Cache-Control", result.cacheControl || `max-age=${config.caching.browserSeconds}`);
  setHeaderSafe(event, "Response-Time", String(responseTime));
  setHeaderSafe(event, "X-Request-ID", requestId);
  setHeaderSafe(event, "X-Content-Type-Options", "nosniff");
  setHeaderSafe(event, "Referrer-Policy", "no-referrer");
  applySecurityHeaders(event);
  applyCorsHeaders(event);

  if (status !== undefined && status !== null) {
    setHeaderSafe(event, "X-Storage-Type", HUMAN_STATUS[String(status)] || "-");
  }

  const incomingEtag = readHeader(event, "if-none-match");
  if (incomingEtag && (incomingEtag === etag || (status === -1 && !config.server.debugEnabled))) {
    setStatusSafe(event, 304);
    log(requestId, method, path, 304, `${responseTime}ms`, `(${HUMAN_STATUS[String(status)] || "-"})`);
    metrics.recordRequest(method, path, 304, responseTime);
    return "";
  }

  if (result.redirect) {
    setStatusSafe(event, 307);
    setHeaderSafe(event, "Location", result.redirect);
    log(requestId, method, path, 307, `${responseTime}ms`, `(${HUMAN_STATUS[String(status)] || "-"})`);
    metrics.recordRequest(method, path, 307, responseTime);
    return "";
  }

  let responseCode = 200;

  if (status === -2) {
    responseCode = result.code || 422;
  } else if (status === -1) {
    setHeaderSafe(event, "Cache-Control", "no-cache, max-age=0");
    if (result.body && result.hash && !result.hash.startsWith("mhf_")) {
      setHeaderSafe(event, "Warning", '110 NitroCraft "Response is Stale"');
      setHeaderSafe(event, "Etag", etag);
      responseCode = result.code || 200;
    } else {
      responseCode = result.code || (config.caching.cloudflare ? 500 : 502);
    }
  } else if (!result.body) {
    responseCode = 404;
  } else {
    if (status === 4) {
      setHeaderSafe(event, "Warning", '111 NitroCraft "Revalidation Failed"');
    }
    setHeaderSafe(event, "Etag", etag);
    responseCode = 200;
  }

  setStatusSafe(event, responseCode);
  log(requestId, method, path, responseCode, `${responseTime}ms`, `(${HUMAN_STATUS[String(status)] || "-"})`);
  metrics.recordRequest(method, path, responseCode, responseTime);
  return result.body ?? null;
}

export function badRequest(body: string, code = 422): ResponseResult {
  return {
    status: -2,
    body,
    code,
    type: "text/plain",
  };
}

export function serverError(err: unknown, body = "Internal Server Error"): ResponseResult {
  return {
    status: -1,
    body,
    err,
    type: "text/plain",
  };
}

export type { ResponseResult };
