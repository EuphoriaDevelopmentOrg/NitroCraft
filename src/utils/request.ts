import { config } from "../config";

function firstHeaderValue(value: string | undefined): string {
  return String(value || "").split(",")[0].trim();
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
    return explicit.replace(/\/$/, "");
  }

  const forwardedProto = firstHeaderValue(readHeader(event, "x-forwarded-proto"));
  const protocol = forwardedProto || "http";
  const forwardedHost = firstHeaderValue(readHeader(event, "x-forwarded-host"));
  const host = forwardedHost || readHeader(event, "host") || "localhost";
  return `${protocol}://${host}`;
}

export function getRequestUrl(event: any): URL {
  const base = getExternalBaseUrl(event);
  const rawUrl = event.node?.req?.url || event.path || "/";
  return new URL(rawUrl, base);
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
