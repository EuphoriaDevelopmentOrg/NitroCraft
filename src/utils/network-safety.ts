import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const DNS_CACHE_MS = 60_000;

type CachedLookup = {
  safe: boolean;
  expiresAt: number;
};

const hostLookupCache = new Map<string, CachedLookup>();

function normalizeHost(host: string): string {
  const trimmed = String(host || "").trim().toLowerCase();
  if (!trimmed) {
    return "";
  }

  const noTrailingDot = trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed;
  const zoneIndex = noTrailingDot.indexOf("%");
  if (zoneIndex > 0) {
    return noTrailingDot.slice(0, zoneIndex);
  }
  return noTrailingDot;
}

function parseIpv4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    return null;
  }

  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const value = Number.parseInt(part, 10);
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      return null;
    }
    octets.push(value);
  }
  return octets;
}

function isPrivateOrReservedIpv4(ip: string): boolean {
  const octets = parseIpv4(ip);
  if (!octets) {
    return true;
  }

  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127) {
    return true;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 192 && b === 0 && c === 2) {
    return true;
  }
  if (a === 198 && b === 18) {
    return true;
  }
  if (a === 198 && b === 19) {
    return true;
  }
  if (a === 198 && b === 51 && c === 100) {
    return true;
  }
  if (a === 203 && b === 0 && c === 113) {
    return true;
  }
  if (a >= 224) {
    return true;
  }
  return false;
}

function isPrivateOrReservedIpv6(ip: string): boolean {
  const value = ip.toLowerCase();
  if (value === "::" || value === "::1") {
    return true;
  }

  if (value.startsWith("::ffff:")) {
    const mapped = value.slice(7);
    if (isIP(mapped) === 4) {
      return isPrivateOrReservedIpv4(mapped);
    }
  }

  if (value.startsWith("fc") || value.startsWith("fd")) {
    return true;
  }
  if (value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb")) {
    return true;
  }
  if (value.startsWith("ff")) {
    return true;
  }
  if (value.startsWith("2001:db8")) {
    return true;
  }
  return false;
}

export function isPublicIpAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    return !isPrivateOrReservedIpv4(ip);
  }
  if (version === 6) {
    return !isPrivateOrReservedIpv6(ip);
  }
  return false;
}

function isLocalHostname(host: string): boolean {
  return host === "localhost"
    || host.endsWith(".localhost")
    || host === "localhost.localdomain"
    || host === "local";
}

export function extractServerAddressHost(address: string): string | null {
  const value = String(address || "").trim();
  if (!value || /[/?#@]/.test(value) || /^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    return null;
  }

  if (value.startsWith("[")) {
    const closing = value.indexOf("]");
    if (closing <= 1) {
      return null;
    }

    const host = normalizeHost(value.slice(1, closing));
    const remainder = value.slice(closing + 1);
    if (remainder && !/^:\d{1,5}$/.test(remainder)) {
      return null;
    }
    return host || null;
  }

  const firstColon = value.indexOf(":");
  const lastColon = value.lastIndexOf(":");
  if (firstColon > -1 && firstColon === lastColon) {
    const maybeHost = normalizeHost(value.slice(0, lastColon));
    const maybePort = value.slice(lastColon + 1);
    if (maybeHost && /^\d{1,5}$/.test(maybePort)) {
      return maybeHost;
    }
  }

  const host = normalizeHost(value);
  return host || null;
}

async function hostnameResolvesPublic(host: string): Promise<boolean> {
  const now = Date.now();
  const cached = hostLookupCache.get(host);
  if (cached && cached.expiresAt > now) {
    return cached.safe;
  }

  let safe = true;
  try {
    const results = await lookup(host, { all: true, verbatim: true });
    if (results.length > 0) {
      safe = results.every((entry) => isPublicIpAddress(entry.address));
    }
  } catch {
    // If DNS fails we let the downstream probe fail naturally.
    safe = true;
  }

  hostLookupCache.set(host, {
    safe,
    expiresAt: now + DNS_CACHE_MS,
  });
  return safe;
}

export async function validateServerProbeAddress(
  address: string,
  allowPrivateTargets: boolean,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const host = extractServerAddressHost(address);
  if (!host) {
    return {
      ok: false,
      reason: "Invalid address/host format.",
    };
  }

  if (allowPrivateTargets) {
    return { ok: true };
  }

  if (isLocalHostname(host)) {
    return {
      ok: false,
      reason: "Private/local targets are not allowed.",
    };
  }

  const version = isIP(host);
  if (version > 0) {
    if (!isPublicIpAddress(host)) {
      return {
        ok: false,
        reason: "Private/local targets are not allowed.",
      };
    }
    return { ok: true };
  }

  const safe = await hostnameResolvesPublic(host);
  if (!safe) {
    return {
      ok: false,
      reason: "Private/local targets are not allowed.",
    };
  }

  return { ok: true };
}
