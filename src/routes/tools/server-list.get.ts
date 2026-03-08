import { getExternalBaseUrl } from "../../utils/request";
import { respond } from "../../utils/response";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export default defineEventHandler((event) => {
  const baseUrl = getExternalBaseUrl(event);
  const safeBaseUrl = escapeHtml(baseUrl);

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>NitroCraft Server List Builder</title>
    <meta name="description" content="Build and preview a live Minecraft server list entry with icon, MOTD, and metadata.">
    <link rel="icon" type="image/x-icon" href="/NitroCraft.ico">
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
            <a href="/openapi.json" target="_blank" rel="noopener noreferrer">OpenAPI</a>
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
            <textarea id="slb-motd-line1" rows="2" maxlength="120">§bNitroCraft §7| §aFast API</textarea>

            <label for="slb-motd-line2">MOTD Line 2</label>
            <textarea id="slb-motd-line2" rows="2" maxlength="120">§7Avatars, skins, renders, status</textarea>

            <div class="builder-format-tools">
              <label for="slb-format-target">Formatting Target</label>
              <select id="slb-format-target">
                <option value="motdLine1">MOTD Line 1</option>
                <option value="motdLine2">MOTD Line 2</option>
              </select>

              <div class="builder-format-grid builder-format-grid-colors" aria-label="Minecraft color codes">
                <button type="button" class="slb-format-btn" data-slb-insert-code="0">§0 Black</button>
                <button type="button" class="slb-format-btn" data-slb-insert-code="1">§1 Dark Blue</button>
                <button type="button" class="slb-format-btn" data-slb-insert-code="2">§2 Dark Green</button>
                <button type="button" class="slb-format-btn" data-slb-insert-code="3">§3 Dark Aqua</button>
                <button type="button" class="slb-format-btn" data-slb-insert-code="4">§4 Dark Red</button>
                <button type="button" class="slb-format-btn" data-slb-insert-code="5">§5 Dark Purple</button>
                <button type="button" class="slb-format-btn" data-slb-insert-code="6">§6 Gold</button>
                <button type="button" class="slb-format-btn" data-slb-insert-code="7">§7 Gray</button>
                <button type="button" class="slb-format-btn" data-slb-insert-code="8">§8 Dark Gray</button>
                <button type="button" class="slb-format-btn" data-slb-insert-code="9">§9 Blue</button>
                <button type="button" class="slb-format-btn" data-slb-insert-code="a">§a Green</button>
                <button type="button" class="slb-format-btn" data-slb-insert-code="b">§b Aqua</button>
                <button type="button" class="slb-format-btn" data-slb-insert-code="c">§c Red</button>
                <button type="button" class="slb-format-btn" data-slb-insert-code="d">§d Light Purple</button>
                <button type="button" class="slb-format-btn" data-slb-insert-code="e">§e Yellow</button>
                <button type="button" class="slb-format-btn" data-slb-insert-code="f">§f White</button>
              </div>

              <div class="builder-format-grid builder-format-grid-modes" aria-label="Minecraft formatting codes">
                <button type="button" class="slb-format-btn" data-slb-insert-code="l">§l Bold</button>
                <button type="button" class="slb-format-btn" data-slb-insert-code="o">§o Italic</button>
                <button type="button" class="slb-format-btn" data-slb-insert-code="n">§n Underline</button>
                <button type="button" class="slb-format-btn" data-slb-insert-code="m">§m Strikethrough</button>
                <button type="button" class="slb-format-btn" data-slb-insert-code="k">§k Obfuscated</button>
                <button type="button" class="slb-format-btn" data-slb-insert-code="r">§r Reset</button>
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
