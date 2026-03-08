import { getExternalBaseUrl } from "../utils/request";
import { respond } from "../utils/response";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttributeJson(value: Record<string, unknown>): string {
  return escapeHtml(JSON.stringify(value));
}

export default defineEventHandler((event) => {
  const baseUrl = getExternalBaseUrl(event);
  const canonicalUrl = `${baseUrl}/docs`;
  const openApiUrl = `${baseUrl}/openapi.json`;
  const scalarConfig = {
    url: openApiUrl,
  };

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>NitroCraft API Docs</title>
    <meta name="description" content="Interactive NitroCraft API reference powered by Scalar.">
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
    <style>
      :root {
        color-scheme: light dark;
      }

      body {
        margin: 0;
        font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
        background: #0b1220;
        color: #e2e8f0;
      }

      .docs-topbar {
        position: sticky;
        top: 0;
        z-index: 5;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        background: rgba(11, 18, 32, 0.92);
        border-bottom: 1px solid rgba(148, 163, 184, 0.25);
        backdrop-filter: blur(8px);
      }

      .docs-topbar a {
        color: #93c5fd;
        text-decoration: none;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <header class="docs-topbar">
      <a href="/">NitroCraft</a>
      <a href="${escapeHtml(openApiUrl)}">OpenAPI JSON</a>
    </header>
    <script id="api-reference" data-configuration="${escapeAttributeJson(scalarConfig)}"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;

  return respond(event, {
    status: 1,
    body: html,
    type: "text/html; charset=utf-8",
    cacheControl: "no-cache, max-age=0",
  });
});
