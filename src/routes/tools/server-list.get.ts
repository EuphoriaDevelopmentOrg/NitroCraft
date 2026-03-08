import { getExternalBaseUrl, getRequestUrl } from "../../utils/request";
import { respond } from "../../utils/response";

const DEFAULT_PAGE_TITLE = "NitroCraft Server List Builder";
const DEFAULT_META_DESCRIPTION =
  "Build, preview, and share Minecraft server-list MOTD entries with live formatting and icon simulation.";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stripFormattingCodes(value: string): string {
  return value.replace(/(?:§|&)[0-9A-FK-ORa-fk-or]/g, "");
}

function normalizeOgSnippet(value: string, maxLength: number): string {
  const firstFrame = String(value || "").split("||")[0] || "";
  const cleaned = stripFormattingCodes(firstFrame)
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, maxLength);
}

function parseCount(value: string): number | null {
  const normalized = String(value || "").trim();
  if (!/^\d{1,6}$/.test(normalized)) {
    return null;
  }
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildShareMeta(requestUrl: URL): {
  pageTitle: string;
  title: string;
  description: string;
  shareUrl: string;
} {
  const params = requestUrl.searchParams;
  const serverName = normalizeOgSnippet(params.get("n") || "", 64);
  const motdLine1 = normalizeOgSnippet(params.get("m1") || "", 90);
  const motdLine2 = normalizeOgSnippet(params.get("m2") || "", 90);
  const version = normalizeOgSnippet(params.get("v") || "", 24);
  const online = parseCount(params.get("o") || "");
  const max = parseCount(params.get("x") || "");
  const playerCounts = online !== null && max !== null ? `${online}/${max}` : "";
  const hasShareValues = Boolean(serverName || motdLine1 || motdLine2 || version || playerCounts);

  if (!hasShareValues) {
    return {
      pageTitle: DEFAULT_PAGE_TITLE,
      title: DEFAULT_PAGE_TITLE,
      description: DEFAULT_META_DESCRIPTION,
      shareUrl: requestUrl.toString(),
    };
  }

  const title = serverName ? `${serverName} - NitroCraft Server List Config` : "NitroCraft Server List Config";
  const descriptionParts = [];
  if (motdLine1) {
    descriptionParts.push(motdLine1);
  }
  if (motdLine2) {
    descriptionParts.push(motdLine2);
  }
  if (playerCounts) {
    descriptionParts.push(`Players ${playerCounts}`);
  }
  if (version) {
    descriptionParts.push(`Version ${version}`);
  }
  const description = (descriptionParts.length
    ? `Shared Minecraft server-list setup: ${descriptionParts.join(" | ")}`
    : `Shared Minecraft server-list setup for ${serverName || "NitroCraft"}.`)
    .slice(0, 240);

  return {
    pageTitle: `${title} | NitroCraft`,
    title,
    description,
    shareUrl: requestUrl.toString(),
  };
}

export default defineEventHandler((event) => {
  const baseUrl = getExternalBaseUrl(event);
  const requestUrl = getRequestUrl(event);
  const safeBaseUrl = escapeHtml(baseUrl);
  const canonicalUrl = `${baseUrl.replace(/\/$/, "")}/tools/server-list`;
  const safeCanonicalUrl = escapeHtml(canonicalUrl);
  const shareMeta = buildShareMeta(requestUrl);
  const safeShareTitle = escapeHtml(shareMeta.title);
  const safeShareDescription = escapeHtml(shareMeta.description);
  const safeShareUrl = escapeHtml(shareMeta.shareUrl);
  const schemaJson = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: shareMeta.title,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    url: shareMeta.shareUrl,
    description: shareMeta.description,
    isPartOf: {
      "@type": "WebSite",
      name: "NitroCraft",
      url: baseUrl,
    },
  }).replace(/</g, "\\u003c");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(shareMeta.pageTitle)}</title>
    <meta name="description" content="${safeShareDescription}">
    <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
    <meta name="theme-color" content="#050b16">
    <link rel="canonical" href="${safeCanonicalUrl}">
    <link rel="icon" type="image/x-icon" href="/NitroCraft.ico">
    <link rel="manifest" href="/site.webmanifest">
    <meta property="og:title" content="${safeShareTitle}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${safeShareUrl}">
    <meta property="og:description" content="${safeShareDescription}">
    <meta property="og:image" content="${safeBaseUrl}/NitroCraft.png">
    <meta property="og:image:alt" content="NitroCraft logo">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${safeShareTitle}">
    <meta name="twitter:description" content="${safeShareDescription}">
    <meta name="twitter:image" content="${safeBaseUrl}/NitroCraft.png">
    <meta name="twitter:url" content="${safeShareUrl}">
    <script type="application/ld+json">${schemaJson}</script>
    <link rel="stylesheet" href="/stylesheets/style.css">
  </head>
  <body class="docs-page tools-page" lang="en-US">
    <a class="skip-link" href="#content">Skip to content</a>
    <a href="https://github.com/EuphoriaDevelopmentOrg/NitroCraft" target="_blank" rel="noopener noreferrer" class="forkme">View on GitHub</a>

    <main id="content" class="container row docs-row">
      <section class="builder-shell">
        <header class="builder-header">
          <p class="builder-kicker"><a href="/">NitroCraft Docs</a> / Tooling</p>
          <h1>Server List Builder</h1>
          <p>Design a Minecraft server list entry and preview it live before shipping your MOTD/config.</p>
          <p class="builder-header-links">
            <a href="/docs" target="_blank" rel="noopener noreferrer">API Docs</a>
            <a href="/metrics" target="_blank" rel="noopener noreferrer">Metrics</a>
          </p>
        </header>

        <div class="builder-grid">
          <section class="builder-card">
            <h2>Entry Settings</h2>
            <label for="slb-server-name">Server Name</label>
            <input id="slb-server-name" type="text" maxlength="64" value="NitroCraft Network" autocomplete="off">

            <label for="slb-motd-line1">MOTD Line 1</label>
            <textarea id="slb-motd-line1" rows="2" maxlength="120">&#167;bNitroCraft &#167;7| &#167;aFast API || &#167;3NitroCraft &#167;7| &#167;eFast API || &#167;dNitroCraft &#167;7| &#167;bFast API</textarea>

            <label for="slb-motd-line2">MOTD Line 2</label>
            <textarea id="slb-motd-line2" rows="2" maxlength="120">&#167;7Avatars, skins, renders, status</textarea>

            <div class="builder-format-tools">
              <p id="slb-active-target" class="builder-note builder-active-target">Active input: MOTD Line 1</p>
              <p class="builder-note">Click inside a MOTD line, then use these buttons to insert at your cursor.</p>

              <div class="builder-format-grid builder-format-grid-colors" aria-label="Minecraft color codes">
                <button type="button" class="slb-format-btn slb-format-btn-color" data-slb-insert-code="0" title="Insert &#167;0 (Black)">Black</button>
                <button type="button" class="slb-format-btn slb-format-btn-color" data-slb-insert-code="1" title="Insert &#167;1 (Dark Blue)">Dark Blue</button>
                <button type="button" class="slb-format-btn slb-format-btn-color" data-slb-insert-code="2" title="Insert &#167;2 (Dark Green)">Dark Green</button>
                <button type="button" class="slb-format-btn slb-format-btn-color" data-slb-insert-code="3" title="Insert &#167;3 (Dark Aqua)">Dark Aqua</button>
                <button type="button" class="slb-format-btn slb-format-btn-color" data-slb-insert-code="4" title="Insert &#167;4 (Dark Red)">Dark Red</button>
                <button type="button" class="slb-format-btn slb-format-btn-color" data-slb-insert-code="5" title="Insert &#167;5 (Dark Purple)">Dark Purple</button>
                <button type="button" class="slb-format-btn slb-format-btn-color" data-slb-insert-code="6" title="Insert &#167;6 (Gold)">Gold</button>
                <button type="button" class="slb-format-btn slb-format-btn-color" data-slb-insert-code="7" title="Insert &#167;7 (Gray)">Gray</button>
                <button type="button" class="slb-format-btn slb-format-btn-color" data-slb-insert-code="8" title="Insert &#167;8 (Dark Gray)">Dark Gray</button>
                <button type="button" class="slb-format-btn slb-format-btn-color" data-slb-insert-code="9" title="Insert &#167;9 (Blue)">Blue</button>
                <button type="button" class="slb-format-btn slb-format-btn-color" data-slb-insert-code="a" title="Insert &#167;a (Green)">Green</button>
                <button type="button" class="slb-format-btn slb-format-btn-color" data-slb-insert-code="b" title="Insert &#167;b (Aqua)">Aqua</button>
                <button type="button" class="slb-format-btn slb-format-btn-color" data-slb-insert-code="c" title="Insert &#167;c (Red)">Red</button>
                <button type="button" class="slb-format-btn slb-format-btn-color" data-slb-insert-code="d" title="Insert &#167;d (Light Purple)">Light Purple</button>
                <button type="button" class="slb-format-btn slb-format-btn-color" data-slb-insert-code="e" title="Insert &#167;e (Yellow)">Yellow</button>
                <button type="button" class="slb-format-btn slb-format-btn-color" data-slb-insert-code="f" title="Insert &#167;f (White)">White</button>
              </div>

              <div class="builder-format-grid builder-format-grid-modes" aria-label="Minecraft formatting codes">
                <button type="button" class="slb-format-btn" data-slb-insert-code="l" title="Insert &#167;l">Bold</button>
                <button type="button" class="slb-format-btn" data-slb-insert-code="o" title="Insert &#167;o">Italic</button>
                <button type="button" class="slb-format-btn" data-slb-insert-code="n" title="Insert &#167;n">Underline</button>
                <button type="button" class="slb-format-btn" data-slb-insert-code="m" title="Insert &#167;m">Strikethrough</button>
                <button type="button" class="slb-format-btn" data-slb-insert-code="k" title="Insert &#167;k">Obfuscated</button>
                <button type="button" class="slb-format-btn" data-slb-insert-code="r" title="Insert &#167;r">Reset</button>
                <button type="button" class="slb-format-btn" data-slb-insert-text=" || ">Insert Frame Separator (||)</button>
              </div>

              <div class="builder-format-grid builder-format-grid-templates" aria-label="MOTD animation templates">
                <button type="button" class="slb-format-btn" data-slb-template="rainbow">Template: Rainbow Cycle</button>
                <button type="button" class="slb-format-btn" data-slb-template="pulse">Template: Alert Pulse</button>
                <button type="button" class="slb-format-btn" data-slb-template="status">Template: Status Cycle</button>
              </div>

              <label for="slb-animation-ms">Animation Speed (ms per frame)</label>
              <input id="slb-animation-ms" type="number" min="120" max="5000" step="10" value="700">

              <p class="builder-note">Tip: use <code>||</code> in a MOTD line to create animated frames in the preview.</p>
              <p id="slb-format-status" class="builder-note"></p>
            </div>

            <div class="builder-row">
              <div>
                <label for="slb-online">Online</label>
                <input id="slb-online" type="number" min="0" max="999999" value="24">
              </div>
              <div>
                <label for="slb-max">Max</label>
                <input id="slb-max" type="number" min="1" max="999999" value="250">
              </div>
            </div>

            <div class="builder-row">
              <div>
                <label for="slb-version">Version Label</label>
                <input id="slb-version" type="text" maxlength="32" value="1.21.x">
              </div>
              <div>
                <label for="slb-ping">Ping Bars</label>
                <select id="slb-ping">
                  <option value="5">5 bars</option>
                  <option value="4">4 bars</option>
                  <option value="3">3 bars</option>
                  <option value="2">2 bars</option>
                  <option value="1">1 bar</option>
                  <option value="0">No signal</option>
                </select>
              </div>
            </div>

            <label for="slb-icon-file">Icon File (auto-scaled to 64x64)</label>
            <input id="slb-icon-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif">

            <label for="slb-icon-url">Icon URL or Data URI</label>
            <input id="slb-icon-url" type="text" autocomplete="off" placeholder="https://... or data:image/png;base64,...">

            <p id="slb-icon-status" class="builder-note"></p>
          </section>

          <section class="builder-card">
            <h2>Import + Share</h2>
            <label for="slb-import-address">Import From Server</label>
            <input id="slb-import-address" type="text" autocomplete="off" placeholder="mc.example.net">

            <div class="builder-row">
              <div>
                <label for="slb-import-edition">Edition</label>
                <select id="slb-import-edition">
                  <option value="auto">Auto</option>
                  <option value="java">Java</option>
                  <option value="bedrock">Bedrock</option>
                </select>
              </div>
              <div>
                <label for="slb-import-port">Port (optional)</label>
                <input id="slb-import-port" type="number" min="1" max="65535" placeholder="25565">
              </div>
            </div>

            <button id="slb-import-btn" type="button">Import Status</button>
            <p id="slb-import-status" class="builder-note"></p>

            <label for="slb-share-url">Share URL</label>
            <input id="slb-share-url" type="text" readonly>
            <div class="builder-actions">
              <button id="slb-copy-share" type="button">Copy Share URL</button>
              <button id="slb-reset" type="button">Reset</button>
            </div>

            <p class="builder-note">Share links include your current text settings and icon state.</p>
          </section>
        </div>

        <section class="builder-card builder-preview-card">
          <h2>Live Preview</h2>
          <div class="mc-server-list-preview" role="img" aria-label="Minecraft Java server list row preview">
            <div class="mc-server-entry">
              <img id="slb-preview-java-icon" src="/avatars/069a79f444e94726a5befca90e38aaf5?size=64&overlay" alt="Java server icon" width="64" height="64">
              <div class="mc-server-content">
                <div class="mc-java-line mc-java-line-top">
                  <span id="slb-preview-java-name" class="mc-server-name">NitroCraft Network</span>
                  <span class="mc-java-status">
                    <span id="slb-preview-java-players" class="mc-server-players">24/250</span>
                    <span id="slb-preview-java-ping" class="mc-ping-bars" aria-label="5 ping bars">
                      <span></span><span></span><span></span><span></span><span></span>
                    </span>
                  </span>
                </div>
                <div class="mc-java-line">
                  <span id="slb-preview-java-motd-line1" class="mc-java-motd-line">NitroCraft Fast API</span>
                </div>
                <div class="mc-java-line">
                  <span id="slb-preview-java-motd-line2" class="mc-java-motd-line">Avatars, skins, renders, status</span>
                </div>
                <div class="mc-java-line mc-java-line-version">
                  <span id="slb-preview-java-version" class="mc-server-version">v1.21.x</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>

    <script>
      window.NITROCRAFT_BASE_URL = "${safeBaseUrl}";
    </script>
    <script src="/javascript/server-list-builder.js"></script>
  </body>
</html>`;

  return respond(event, {
    status: 1,
    body: html,
    type: "text/html; charset=utf-8",
    cacheControl: "no-cache, max-age=0",
  });
});
