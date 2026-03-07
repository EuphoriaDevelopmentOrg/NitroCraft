export type ParsedCorsOrigins = {
  allowAll: boolean;
  origins: string[];
  warning: string | null;
};

export function normalizeCorsOrigin(value: string): string | null {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  if (raw.toLowerCase() === "null") {
    return "null";
  }

  try {
    return new URL(raw).origin.toLowerCase();
  } catch {
    return null;
  }
}

export function parseCorsOrigins(value: string | undefined): ParsedCorsOrigins {
  const raw = String(value || "").trim();
  if (!raw || raw.toLowerCase() === "all" || raw === "*") {
    return {
      allowAll: true,
      origins: [],
      warning: null,
    };
  }

  const items = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (items.some((item) => item.toLowerCase() === "all" || item === "*")) {
    return {
      allowAll: true,
      origins: [],
      warning: null,
    };
  }

  const normalized = items
    .map((item) => normalizeCorsOrigin(item))
    .filter((item): item is string => Boolean(item));

  const origins = Array.from(new Set(normalized));
  if (origins.length === 0) {
    return {
      allowAll: true,
      origins: [],
      warning: "CORS_ORIGIN has no valid entries. Falling back to allow-all.",
    };
  }

  return {
    allowAll: false,
    origins,
    warning: null,
  };
}

export function resolveCorsOrigin(
  requestOrigin: string | undefined,
  allowAll: boolean,
  origins: string[],
): string | null {
  if (allowAll) {
    return "*";
  }

  const normalized = normalizeCorsOrigin(requestOrigin || "");
  if (!normalized) {
    return null;
  }

  if (origins.includes(normalized)) {
    return normalized;
  }

  return null;
}
