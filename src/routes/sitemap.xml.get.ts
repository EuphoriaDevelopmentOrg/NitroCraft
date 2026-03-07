import { getExternalBaseUrl } from "../utils/request";
import { respond } from "../utils/response";

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export default defineEventHandler((event) => {
  const base = stripTrailingSlash(getExternalBaseUrl(event));
  const canonical = `${base}/`;
  const lastModified = new Date().toISOString();

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${escapeXml(canonical)}</loc>
    <lastmod>${escapeXml(lastModified)}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

  return respond(event, {
    status: 1,
    body,
    type: "application/xml; charset=utf-8",
    cacheControl: "public, max-age=3600",
  });
});
