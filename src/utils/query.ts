export function getQueryParams(event: any): URLSearchParams {
  const raw = event.node?.req?.url || event.path || "/";
  return new URL(raw, "http://localhost").searchParams;
}
