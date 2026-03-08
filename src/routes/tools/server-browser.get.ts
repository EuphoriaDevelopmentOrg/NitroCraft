import { config } from "../../config";
import { getExternalBaseUrl } from "../../utils/request";
import { respond } from "../../utils/response";

const DEFAULT_PAGE_TITLE = "NitroCraft Server Browser";
const DEFAULT_META_DESCRIPTION =
  "Probe multiple Minecraft Java and Bedrock servers in one view with safe, bounded status checks.";
const DEFAULT_ADDRESSES = "mc.hypixel.net\nplay.cubecraft.net";

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
  const maxAddresses = clampInt(config.server.statusBrowserMaxAddresses, 20, 1, 100);
  const maxConcurrency = clampInt(config.server.statusBrowserMaxConcurrency, 4, 1, 16);
  const sourceOptions = config.server.statusBrowserSources.map((source) => ({
    id: source.id,
    label: source.label,
  }));
  const sourceOptionsHtml = sourceOptions.length
    ? `<div class="server-browser-source-options" id="nsb-source-options">
              ${sourceOptions.map((source) => `
                <label class="server-browser-source-option" for="nsb-source-${escapeHtml(source.id)}">
                  <input id="nsb-source-${escapeHtml(source.id)}" type="checkbox" name="nsb-source" value="${escapeHtml(source.id)}">
                  <span>${escapeHtml(source.label)}</span>
                </label>
              `).join("")}
            </div>
            <p class="builder-note">Optional: pull server addresses from configured public source feeds.</p>`
    : `<p class="builder-note">No external server sources are configured on this deployment.</p>`;
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
          <p>Probe multiple Minecraft servers in one request and compare online status, player counts, and MOTDs.</p>
          <p class="builder-header-links">
            <a href="/tools/server-list">Server List Builder</a>
            <a href="/docs" target="_blank" rel="noopener noreferrer">API Docs</a>
            <a href="/metrics" target="_blank" rel="noopener noreferrer">Metrics</a>
          </p>
        </header>

        <div class="builder-grid">
          <section class="builder-card">
            <h2>Targets</h2>
            <label for="nsb-addresses">Server Addresses</label>
            <textarea id="nsb-addresses" rows="8" maxlength="4000" spellcheck="false">${escapeHtml(DEFAULT_ADDRESSES)}</textarea>
            <p class="builder-note">Use one host per line. <code>host:port</code> is supported.</p>
            ${sourceOptionsHtml}

            <div class="builder-row">
              <div>
                <label for="nsb-edition">Edition</label>
                <select id="nsb-edition">
                  <option value="auto">Auto</option>
                  <option value="java">Java</option>
                  <option value="bedrock">Bedrock</option>
                </select>
              </div>
              <div>
                <label for="nsb-timeout-ms">Timeout (ms)</label>
                <input id="nsb-timeout-ms" type="number" min="100" max="10000" step="50" value="2200">
              </div>
            </div>

            <div class="builder-row">
              <div>
                <label for="nsb-concurrency">Concurrency</label>
                <input id="nsb-concurrency" type="number" min="1" max="${maxConcurrency}" step="1" value="${Math.min(3, maxConcurrency)}">
              </div>
              <div>
                <label for="nsb-limit">Limit</label>
                <input id="nsb-limit" type="number" min="1" max="${maxAddresses}" step="1" value="${Math.min(10, maxAddresses)}">
              </div>
            </div>

            <div class="builder-actions">
              <button id="nsb-probe-btn" type="button">Probe Servers</button>
              <button id="nsb-reset-btn" type="button">Reset</button>
            </div>
            <p id="nsb-status" class="builder-note"></p>
          </section>

          <section class="builder-card">
            <h2>Share + Limits</h2>
            <p id="nsb-summary" class="builder-note">Run a probe to view summary stats.</p>

            <label for="nsb-share-url">Share URL</label>
            <input id="nsb-share-url" type="text" readonly>
            <div class="builder-actions">
              <button id="nsb-copy-share" type="button">Copy Share URL</button>
            </div>

            <p class="builder-note">This browser caps batches at <strong>${maxAddresses}</strong> targets and max concurrency <strong>${maxConcurrency}</strong> for stability.</p>
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
        maxAddresses: ${maxAddresses},
        maxConcurrency: ${maxConcurrency},
        sources: ${JSON.stringify(sourceOptions).replace(/</g, "\\u003c")}
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
