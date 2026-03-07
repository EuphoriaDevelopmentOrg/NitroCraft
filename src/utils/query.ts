const QUERY_PARAMS_KEY = "__queryParams";

export function getQueryParams(event: any): URLSearchParams {
  const cached = event.context?.[QUERY_PARAMS_KEY];
  if (cached instanceof URLSearchParams) {
    return cached;
  }

  const raw = event.node?.req?.url || event.path || "/";
  const params = new URL(raw, "http://localhost").searchParams;

  if (event.context && typeof event.context === "object") {
    event.context[QUERY_PARAMS_KEY] = params;
  }

  return params;
}
