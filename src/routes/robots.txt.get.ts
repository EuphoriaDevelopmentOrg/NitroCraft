import { getExternalBaseUrl } from "../utils/request";
import { respond } from "../utils/response";

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export default defineEventHandler((event) => {
  const base = stripTrailingSlash(getExternalBaseUrl(event));
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /metrics",
    "Disallow: /metrics/api-calls",
    "Disallow: /_openapi.json",
    `Sitemap: ${base}/sitemap.xml`,
    "",
  ].join("\n");

  return respond(event, {
    status: 1,
    body,
    type: "text/plain; charset=utf-8",
    cacheControl: "public, max-age=3600",
  });
});
