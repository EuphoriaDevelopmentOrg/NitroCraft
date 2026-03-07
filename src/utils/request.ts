import { config } from "../config";

const DEFAULT_BASE_URL = "http://localhost";

function firstHeaderValue(value: string | undefined): string {
  return String(value || "").split(",")[0].trim();
}

function safeOrigin(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function headerProtocol(value: string | undefined): "http" | "https" {
  return String(value || "").trim().toLowerCase() === "https" ? "https" : "http";
}

function normalizeIp(value: string | undefined): string {
  const ip = String(value || "").trim();
  if (!ip) {
    return "";
  }
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

export function readHeader(event: any, name: string): string | undefined {
  const key = name.toLowerCase();
  const nodeReq = event.node?.req;
  if (nodeReq?.headers) {
    const value = nodeReq.headers[key];
    if (Array.isArray(value)) {
      return value.join(",");
    }
    return value;
  }

  const req = event.req;
  if (req?.headers?.get) {
    return req.headers.get(name) || undefined;
  }

  return undefined;
}

export function getExternalBaseUrl(event: any): string {
  const explicit = config.server.externalUrl.trim();
  if (explicit) {
    const normalized = safeOrigin(explicit);
    if (normalized) {
      return normalized;
    }

    // Accept host-only EXTERNAL_URL values by assuming HTTPS.
    const hostOnly = safeOrigin(`https://${explicit}`);
    if (hostOnly) {
      return hostOnly;
    }
  }

  const protocol = headerProtocol(firstHeaderValue(readHeader(event, "x-forwarded-proto")));
  const forwardedHost = firstHeaderValue(readHeader(event, "x-forwarded-host"));
  const host = firstHeaderValue(forwardedHost || readHeader(event, "host") || "localhost");
  const inferred = safeOrigin(`${protocol}://${host}`);
  return inferred || DEFAULT_BASE_URL;
}

export function getRequestUrl(event: any): URL {
  const base = getExternalBaseUrl(event);
  const rawUrl = String(event.node?.req?.url || event.path || "/").trim() || "/";

  try {
    return new URL(rawUrl, base);
  } catch {
    const fallbackPath = rawUrl.startsWith("/") ? rawUrl : "/";
    try {
      return new URL(fallbackPath, DEFAULT_BASE_URL);
    } catch {
      return new URL("/", DEFAULT_BASE_URL);
    }
  }
}

export function getClientIp(event: any, trustProxy = true): string {
  if (trustProxy) {
    const forwardedFor = firstHeaderValue(readHeader(event, "x-forwarded-for"));
    const forwardedIp = normalizeIp(forwardedFor);
    if (forwardedIp) {
      return forwardedIp;
    }

    const realIp = normalizeIp(readHeader(event, "x-real-ip"));
    if (realIp) {
      return realIp;
    }
  }

  const socketIp = normalizeIp(event.node?.req?.socket?.remoteAddress);
  if (socketIp) {
    return socketIp;
  }

  return "unknown";
}
