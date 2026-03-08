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
  const lastModified = new Date().toISOString();
  const routes = [
    {
      loc: `${base}/`,
      changefreq: "daily",
      priority: "1.0",
    },
    {
      loc: `${base}/tools/server-list`,
      changefreq: "weekly",
      priority: "0.7",
    },
  ];

  const items = routes.map((route) => `  <url>
    <loc>${escapeXml(route.loc)}</loc>
    <lastmod>${escapeXml(lastModified)}</lastmod>
    <changefreq>${escapeXml(route.changefreq)}</changefreq>
    <priority>${escapeXml(route.priority)}</priority>
  </url>`).join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>
`;

  return respond(event, {
    status: 1,
    body,
    type: "application/xml; charset=utf-8",
    cacheControl: "public, max-age=3600",
  });
});
