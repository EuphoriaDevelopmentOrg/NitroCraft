import { respond } from "./response";

const JSON_TYPE = "application/json; charset=utf-8";
const NO_CACHE = "no-cache, max-age=0";

type ToolkitLikeError = {
  statusCode?: unknown;
  message?: unknown;
};

function toolkitStatusCode(err: unknown): number | null {
  if (!err || typeof err !== "object") {
    return null;
  }
  const value = (err as ToolkitLikeError).statusCode;
  if (typeof value !== "number") {
    return null;
  }
  if (!Number.isInteger(value) || value < 100 || value > 599) {
    return null;
  }
  return value;
}

function toolkitMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") {
    return fallback;
  }
  const value = (err as ToolkitLikeError).message;
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }
  return value;
}

export function jsonResponse(event: any, payload: unknown): Buffer | string | null | Promise<string> {
  return respond(event, {
    status: 1,
    body: JSON.stringify(payload),
    type: JSON_TYPE,
    cacheControl: NO_CACHE,
  });
}

export function jsonBadRequest(
  event: any,
  message: string,
  code = 422,
): Buffer | string | null | Promise<string> {
  return respond(event, {
    status: -2,
    code,
    body: JSON.stringify({ error: message }),
    type: JSON_TYPE,
    cacheControl: NO_CACHE,
  });
}

export function jsonToolkitError(
  event: any,
  err: unknown,
  fallbackMessage = "Upstream request failed",
): Buffer | string | null | Promise<string> {
  const code = toolkitStatusCode(err) || 502;
  const body = JSON.stringify({
    error: toolkitMessage(err, fallbackMessage),
    statusCode: code,
  });

  if (code >= 500) {
    return respond(event, {
      status: -1,
      code,
      body,
      err,
      type: JSON_TYPE,
      cacheControl: NO_CACHE,
    });
  }

  return respond(event, {
    status: -2,
    code,
    body,
    type: JSON_TYPE,
    cacheControl: NO_CACHE,
  });
}

export function parseIntegerQuery(
  event: any,
  query: URLSearchParams,
  name: string,
): number | null | undefined {
  const raw = query.get(name);
  if (raw === null || raw === "") {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
}
