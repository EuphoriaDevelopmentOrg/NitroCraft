import { config } from "../config";
import { isPublicIpAddress } from "./network-safety";

function normalizedHost(value: string): string | null {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) {
    return null;
  }

  if (raw.includes("://")) {
    try {
      return new URL(raw).hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  if (/[/?#@]/.test(raw)) {
    return null;
  }

  return raw.endsWith(".") ? raw.slice(0, -1) : raw;
}

function hostMatchesPattern(host: string, pattern: string): boolean {
  if (pattern.startsWith("*.")) {
    const base = pattern.slice(2);
    return host === base || host.endsWith(`.${base}`);
  }
  return host === pattern;
}

function configuredExternalHost(): string | null {
  const explicit = config.server.externalUrl.trim();
  if (!explicit) {
    return null;
  }

  const parsed = normalizedHost(explicit);
  if (parsed) {
    return parsed;
  }

  return normalizedHost(`https://${explicit}`);
}

function allowedHostPatterns(): string[] {
  const normalized = config.server.defaultRedirectAllowlist
    .map((entry) => normalizedHost(entry))
    .filter((entry): entry is string => Boolean(entry));

  if (normalized.length > 0) {
    return Array.from(new Set(normalized));
  }

  const externalHost = configuredExternalHost();
  return externalHost ? [externalHost] : [];
}

export function sanitizeDefaultRedirect(defaultUrl: string | null): string | null {
  if (!defaultUrl || typeof defaultUrl !== "string") {
    return null;
  }

  if (defaultUrl.length > 2048) {
    return null;
  }

  try {
    const parsed = new URL(defaultUrl);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      if (parsed.username || parsed.password) {
        return null;
      }

      const host = parsed.hostname.toLowerCase();
      if (!host) {
        return null;
      }

      const ipVersion = /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(":");
      if (ipVersion && !isPublicIpAddress(host)) {
        return null;
      }

      const patterns = allowedHostPatterns();
      if (!patterns.some((pattern) => hostMatchesPattern(host, pattern))) {
        return null;
      }

      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}
