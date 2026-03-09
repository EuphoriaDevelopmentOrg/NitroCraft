import { config } from "../../config";
import { getExternalBaseUrl } from "../../utils/request";
import { respond } from "../../utils/response";

const DEFAULT_PAGE_TITLE = "NitroCraft Server Browser";
const DEFAULT_META_DESCRIPTION =
  "Browse Java or Bedrock server lists with paginated Minecraft status probing.";
const DEFAULT_EDITION = "java";
const DEFAULT_TIMEOUT_MS = 2200;
const DEFAULT_PER_PAGE = 10;
const MAX_PER_PAGE = 100;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clampInt(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.floor(value);
  if (rounded < min) {
    return min;
  }
  if (rounded > max) {
    return max;
  }
  return rounded;
}

export default defineEventHandler((event) => {
  const baseUrl = getExternalBaseUrl(event);
  const maxConcurrency = clampInt(config.server.statusBrowserMaxConcurrency, 4, 1, 16);
  const canonicalUrl = `${baseUrl.replace(/\/$/, "")}/tools/server-browser`;
  const safeBaseUrl = escapeHtml(baseUrl);
  const safeCanonicalUrl = escapeHtml(canonicalUrl);

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(DEFAULT_PAGE_TITLE)}</title>
    <meta name="description" content="${escapeHtml(DEFAULT_META_DESCRIPTION)}">
    <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
    <meta name="theme-color" content="#050b16">
    <link rel="canonical" href="${safeCanonicalUrl}">
    <link rel="icon" type="image/x-icon" href="/NitroCraft.ico">
    <link rel="manifest" href="/site.webmanifest">
    <meta property="og:title" content="${escapeHtml(DEFAULT_PAGE_TITLE)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${safeCanonicalUrl}">
    <meta property="og:description" content="${escapeHtml(DEFAULT_META_DESCRIPTION)}">
    <meta property="og:image" content="${safeBaseUrl}/NitroCraft.png">
    <meta property="og:image:alt" content="NitroCraft logo">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(DEFAULT_PAGE_TITLE)}">
    <meta name="twitter:description" content="${escapeHtml(DEFAULT_META_DESCRIPTION)}">
    <meta name="twitter:image" content="${safeBaseUrl}/NitroCraft.png">
    <link rel="stylesheet" href="/stylesheets/style.css">
  </head>
  <body class="docs-page tools-page server-browser-page" lang="en-US">
    <a class="skip-link" href="#content">Skip to content</a>
    <a href="https://github.com/EuphoriaDevelopmentOrg/NitroCraft" target="_blank" rel="noopener noreferrer" class="forkme">View on GitHub</a>

    <main id="content" class="container row docs-row">
      <section class="builder-shell server-browser-shell">
        <header class="builder-header">
          <p class="builder-kicker"><a href="/">NitroCraft Docs</a> / Tooling</p>
          <h1>Server Browser</h1>
          <p>Browse curated Java and Bedrock targets from <code>java.json</code> and <code>bedrock.json</code>, then probe one page at a time.</p>
          <p class="builder-header-links">
            <a href="/tools/server-list">Server List Builder</a>
            <a href="/docs" target="_blank" rel="noopener noreferrer">API Docs</a>
            <a href="/metrics" target="_blank" rel="noopener noreferrer">Metrics</a>
          </p>
        </header>

        <div class="builder-grid">
          <section class="builder-card">
            <h2>Filters</h2>
            <div class="builder-row">
              <div>
                <label for="nsb-edition">Edition</label>
                <select id="nsb-edition">
                  <option value="java" selected>Java</option>
                  <option value="bedrock">Bedrock</option>
                </select>
              </div>
              <div>
                <label for="nsb-per-page">Per Page</label>
                <input id="nsb-per-page" type="number" min="1" max="${MAX_PER_PAGE}" step="1" value="${DEFAULT_PER_PAGE}">
              </div>
            </div>

            <div class="builder-row">
              <div>
                <label for="nsb-page">Page</label>
                <input id="nsb-page" type="number" min="1" step="1" value="1">
              </div>
              <div>
                <label for="nsb-timeout-ms">Timeout (ms)</label>
                <input id="nsb-timeout-ms" type="number" min="100" max="10000" step="50" value="${DEFAULT_TIMEOUT_MS}">
              </div>
            </div>

            <div class="builder-row">
              <div>
                <label for="nsb-concurrency">Concurrency</label>
                <input id="nsb-concurrency" type="number" min="1" max="${maxConcurrency}" step="1" value="${Math.min(3, maxConcurrency)}">
              </div>
              <div>
                <p class="builder-note server-browser-hint">Each page is probed via <code>/status/browser</code> using Minecraft Toolkit.</p>
              </div>
            </div>

            <div class="builder-actions">
              <button id="nsb-probe-btn" type="button">Probe Page</button>
              <button id="nsb-reset-btn" type="button">Reset</button>
            </div>
            <p id="nsb-status" class="builder-note"></p>
          </section>

          <section class="builder-card">
            <h2>Share + Paging</h2>
            <p id="nsb-summary" class="builder-note">Run a probe to view summary stats.</p>

            <label for="nsb-share-url">Share URL</label>
            <input id="nsb-share-url" type="text" readonly>
            <div class="builder-actions">
              <button id="nsb-copy-share" type="button">Copy Share URL</button>
            </div>

            <div class="builder-actions server-browser-pagination">
              <button id="nsb-page-prev" type="button">Previous Page</button>
              <button id="nsb-page-next" type="button">Next Page</button>
            </div>
            <p id="nsb-page-info" class="builder-note">Page 1 of 1</p>
            <p class="builder-note">Per-page limit is capped at <strong>${MAX_PER_PAGE}</strong>.</p>
            <p class="builder-note">Private/local targets follow the global status safety setting.</p>
          </section>
        </div>

        <section class="builder-card builder-preview-card">
          <h2>Results</h2>
          <div class="mc-server-list-preview server-browser-results" id="nsb-results-list" role="list" aria-live="polite">
            <p class="server-browser-empty">Run a probe to see results.</p>
          </div>
        </section>
      </section>
    </main>

    <script>
      window.NITROCRAFT_SERVER_BROWSER_CONFIG = {
        maxConcurrency: ${maxConcurrency},
        maxPerPage: ${MAX_PER_PAGE},
        defaultEdition: ${JSON.stringify(DEFAULT_EDITION)},
        defaultPerPage: ${DEFAULT_PER_PAGE}
      };
    </script>
    <script src="/javascript/server-browser.js"></script>
  </body>
</html>`;

  return respond(event, {
    status: 1,
    body: html,
    type: "text/html; charset=utf-8",
    cacheControl: "no-cache, max-age=0",
  });
});
