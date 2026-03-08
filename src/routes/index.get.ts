import pkg from "../../package.json";
import { config } from "../config";
import { metrics } from "../services/metrics";
import { getExternalBaseUrl } from "../utils/request";
import { respond } from "../utils/response";

function resolveSiteUpdatedAt(): string {
  const raw = String(process.env.SITE_UPDATED_AT || "").trim();
  if (!raw) {
    return new Date().toISOString();
  }

  try {
    return new Date(raw).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

const SITE_UPDATED_AT = resolveSiteUpdatedAt();

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMinutes(seconds: number): string {
  const minutes = seconds / 60;
  if (Number.isInteger(minutes)) {
    return String(minutes);
  }
  return minutes.toFixed(2).replace(/\.?0+$/, "");
}

function sanitizeHttpUrl(value: string): string | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  try {
    const parsedUrl = new URL(trimmedValue);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return null;
    }
    return parsedUrl.toString();
  } catch {
    return null;
  }
}

function sanitizeSponsorImageUrl(value: string, baseUrl: string): string | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  if (trimmedValue.startsWith("/") && !trimmedValue.startsWith("//")) {
    try {
      return new URL(trimmedValue, baseUrl).toString();
    } catch {
      return null;
    }
  }

  return sanitizeHttpUrl(trimmedValue);
}

export default defineEventHandler((event) => {
  const domain = getExternalBaseUrl(event);
  const safeDomain = escapeHtml(domain);
  const featuredUuid = "ae795aa86327408e92ab25c8a59f3ba1";
  const slugline = "Minecraft avatars, skins, and renders at Nitro speed.";
  const metaDescription =
    "Minecraft avatars, skins, capes, and renders at Nitro speed with UUID lookups and caching.";
  const canonicalUrl = domain.endsWith("/") ? domain : `${domain}/`;
  const safeCanonicalUrl = escapeHtml(canonicalUrl);
  const openApiUrl = `${domain}/openapi.json`;
  const docsUrl = `${domain}/docs`;
  const sitemapUrl = `${domain}/sitemap.xml`;
  const safeOpenApiUrl = escapeHtml(openApiUrl);
  const safeDocsUrl = escapeHtml(docsUrl);
  const safeSitemapUrl = escapeHtml(sitemapUrl);
  const safeSoftwareVersion = escapeHtml(String((pkg as { version?: string }).version || "1.1.6"));
  const safeUpdatedAt = escapeHtml(SITE_UPDATED_AT);
  const sponsorCandidates = config.sponsors.cards.length
    ? config.sponsors.cards
    : [{
      url: config.sponsors.cardUrl,
      image: config.sponsors.cardImage,
      alt: config.sponsors.cardAlt,
    }];
  const sponsorCardsHtml = sponsorCandidates
    .map((card) => {
      const sponsorCardUrl = sanitizeHttpUrl(card.url);
      const sponsorCardImage = sanitizeSponsorImageUrl(card.image, canonicalUrl);
      const sponsorCardAlt = escapeHtml(String(card.alt || "Sponsor").trim() || "Sponsor");
      if (!sponsorCardUrl || !sponsorCardImage) {
        return "";
      }

      return `<a class="sponsor-card" href="${escapeHtml(sponsorCardUrl)}" target="_blank" rel="noopener noreferrer sponsored">
        <img src="${escapeHtml(sponsorCardImage)}" alt="${sponsorCardAlt}" loading="lazy" decoding="async">
      </a>`;
    })
    .filter(Boolean)
    .join("");
  const sponsorSectionHtml = sponsorCardsHtml
    ? `
    <section class="sponsor-strip" aria-label="Sponsors">
      <div class="sponsor-card-list">
        ${sponsorCardsHtml}
      </div>
    </section>`
    : "";
  const schemaJson = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "NitroCraft",
        url: canonicalUrl,
        description: metaDescription,
        potentialAction: {
          "@type": "SearchAction",
          target: `${canonicalUrl}docs`,
          "query-input": "required name=endpoint",
        },
      },
      {
        "@type": "Organization",
        name: "Euphoria Development",
        url: canonicalUrl,
      },
      {
        "@type": "WebAPI",
        name: "NitroCraft API",
        url: canonicalUrl,
        documentation: canonicalUrl,
        serviceType: "Minecraft avatar and render API",
        provider: {
          "@type": "Organization",
          name: "Euphoria Development",
          url: canonicalUrl,
        },
      },
      {
        "@type": "SoftwareApplication",
        name: "NitroCraft",
        operatingSystem: "Any",
        applicationCategory: "DeveloperApplication",
        softwareVersion: String((pkg as { version?: string }).version || "1.1.6"),
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        url: canonicalUrl,
      },
    ],
  }).replace(/</g, "\\u003c");
  const localMinutes = formatMinutes(config.caching.localSeconds);
  const browserMinutes = formatMinutes(config.caching.browserSeconds);
  const apiCallCount = metrics.getApiCallCount();
  const formattedApiCallCount = new Intl.NumberFormat("en-US").format(apiCallCount);
  const year = new Date().getFullYear();
  const cloudflareCachingNote = config.caching.cloudflare
    ? '<br>In addition, <span title="A CDN and caching proxy">Cloudflare</span> may cache images as long as your browser would.'
    : "";
  const cloudflareHeaderNote = config.caching.cloudflare
    ? '<br>Please note that these headers may be cached by <span title="A CDN and caching proxy">Cloudflare</span>.'
    : "";
  const noImageStatusCodes = config.caching.cloudflare
    ? "<code>500 Server Error</code> is used when no skin/cape was found because of Mojang or NitroCraft server issues."
    : "<code>502 Bad Gateway</code> and <code>500 Server Error</code> are used when no skin/cape was found because of Mojang or NitroCraft server issues.";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <title>NitroCraft - ${slugline}</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="canonical" href="${safeCanonicalUrl}">
    <link rel="alternate" type="application/json" title="NitroCraft OpenAPI" href="${safeOpenApiUrl}">
    <link rel="sitemap" type="application/xml" href="${safeSitemapUrl}">
    <link rel="preload" as="image" href="/NitroCraft-320.png">
    <link rel="icon" type="image/x-icon" href="/NitroCraft.ico">
    <link rel="apple-touch-icon" href="/NitroCraft.png">
    <link rel="manifest" href="/site.webmanifest">
    <link rel="stylesheet" href="/stylesheets/fontawesome-local.css">
    <link rel="stylesheet" href="/stylesheets/style.css">
    <meta name="description" content="${metaDescription}">
    <meta name="keywords" content="minecraft, avatar, renders, skins, uuid, nitrocraft">
    <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
    <meta name="author" content="Euphoria Development">
    <meta name="format-detection" content="telephone=no">
    <meta name="application-name" content="NitroCraft">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="NitroCraft">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="theme-color" content="#050b16">
    <meta name="version" content="${safeSoftwareVersion}">
    <meta property="og:updated_time" content="${safeUpdatedAt}">
    <meta property="og:title" content="NitroCraft">
    <meta property="og:site_name" content="NitroCraft">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${safeCanonicalUrl}">
    <meta property="og:image" content="${safeDomain}/NitroCraft.png">
    <meta property="og:image:type" content="image/png">
    <meta property="og:image:alt" content="NitroCraft logo">
    <meta property="og:description" content="${metaDescription}">
    <meta property="og:locale" content="en_US">
    <meta property="og:see_also" content="${safeDocsUrl}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="NitroCraft">
    <meta name="twitter:description" content="${metaDescription}">
    <meta name="twitter:image" content="${safeDomain}/NitroCraft.png">
    <meta name="twitter:image:alt" content="NitroCraft logo">
    <meta name="twitter:url" content="${safeCanonicalUrl}">
    <script type="application/ld+json">${schemaJson}</script>
  </head>
  <body class="docs-page" lang="en-US">
    <a class="skip-link" href="#content">Skip to content</a>
    <a href="https://github.com/EuphoriaDevelopmentOrg/NitroCraft" target="_blank" rel="noopener noreferrer" class="forkme">View on GitHub</a>

    <div class="jumbotron">
      <div class="container">
        <div class="brand-header">
          <div class="brand-lockup">
            <img class="brand-logo" src="/NitroCraft-320.png" alt="NitroCraft Logo" width="320" height="320" loading="eager" fetchpriority="high">
            <div class="brand-copy">
              <h1>NitroCraft</h1>
              <h2>${slugline}</h2>
            </div>
          </div>

          <div class="site-stats" aria-label="NitroCraft usage statistics">
            <div class="site-stat">
              <span class="site-stat-label">API calls served</span>
              <strong id="api-call-count-value" class="site-stat-value">${formattedApiCallCount}</strong>
              <span class="site-stat-meta"></span>
            </div>
          </div>
        </div>

        <div id="avatar-wrapper" role="toolbar" aria-label="Choose a sample UUID">
          <button type="button" class="avatar-picker is-active" data-uuid="ae795aa86327408e92ab25c8a59f3ba1" title="jomo" aria-label="Use jomo UUID"><span class="avatar jomo"></span></button>
          <button type="button" class="avatar-picker" data-pinned="true" data-uuid="d634462bd663401d9788a8596307bc4d" title="RepGraphics" aria-label="Use RepGraphics UUID"><span class="avatar repgraphics"></span></button>
          <button type="button" class="avatar-picker" data-pinned="true" data-uuid="15851079f1d24d418207ce9f914e966d" title="26bz" aria-label="Use 26bz UUID"><span class="avatar u26bz"></span></button>
          <button type="button" class="avatar-picker" data-pinned="true" data-uuid="5e23737cc1994b7ab18512ca6bd7da94" title="Connols" aria-label="Use Connols UUID"><span class="avatar connols"></span></button>
          <button type="button" class="avatar-picker" data-uuid="2d5aa9cdaeb049189930461fc9b91cc5" title="jake_0" aria-label="Use jake_0 UUID"><span class="avatar jake_0"></span></button>
          <button type="button" class="avatar-picker" data-uuid="0ea8eca3dbf647cc9d1ac64551ca975c" title="sk89q" aria-label="Use sk89q UUID"><span class="avatar sk89q"></span></button>
          <button type="button" class="avatar-picker" data-uuid="af74a02d19cb445bb07f6866a861f783" title="md_5" aria-label="Use md_5 UUID"><span class="avatar md_5"></span></button>
          <button type="button" class="avatar-picker" data-uuid="069a79f444e94726a5befca90e38aaf5" title="notch" aria-label="Use notch UUID"><span class="avatar notch"></span></button>
          <button type="button" class="avatar-picker" data-uuid="853c80ef3c3749fdaa49938b674adae6" title="jeb_" aria-label="Use jeb_ UUID"><span class="avatar jeb"></span></button>
          <button type="button" class="avatar-picker" data-uuid="61699b2ed3274a019f1e0ea8c3f06bc6" title="dinnerbone" aria-label="Use dinnerbone UUID"><span class="avatar dinnerbone flipped"></span></button>
          <button type="button" class="avatar-picker" data-uuid="7d043c7389524696bfba571c05b6aec0" title="ez" aria-label="Use ez UUID"><span class="avatar ez"></span></button>
          <button type="button" class="avatar-picker" data-uuid="e6b5c088068044df9e1b9bf11792291b" title="grumm" aria-label="Use grumm UUID"><span class="avatar grumm flipped"></span></button>
          <button type="button" class="avatar-picker" data-uuid="1c1bd09a6a0f4928a7914102a35d2670" title="themogmimer" aria-label="Use themogmimer UUID"><span class="avatar themogmimer"></span></button>
          <button type="button" class="avatar-picker" data-uuid="696a82ce41f44b51aa31b8709b8686f0" title="searge" aria-label="Use searge UUID"><span class="avatar searge"></span></button>
          <button type="button" class="avatar-picker" data-uuid="b9583ca43e64488a9c8c4ab27e482255" title="xlson" aria-label="Use xlson UUID"><span class="avatar xlson"></span></button>
          <button type="button" class="avatar-picker" data-uuid="7125ba8b1c864508b92bb5c042ccfe2b" title="krisjelbring" aria-label="Use krisjelbring UUID"><span class="avatar krisjelbring"></span></button>
          <button type="button" class="avatar-picker" data-uuid="23c0b72e6a3f4390897f9ec328eef972" title="aikar" aria-label="Use aikar UUID"><span class="avatar aikar"></span></button>
          <button type="button" class="avatar-picker" data-uuid="98bde7ac1cdc4027a8e94b3ed31558c1" title="ammar2" aria-label="Use ammar2 UUID"><span class="avatar ammar2"></span></button>
          <button type="button" class="avatar-picker" data-uuid="b05881186e75410db2db4d3066b223f7" title="marc" aria-label="Use marc UUID"><span class="avatar marc"></span></button>
          <button type="button" class="avatar-picker" data-uuid="9769ecf6331448f3ace67ae06cec64a3" title="mollstam" aria-label="Use mollstam UUID"><span class="avatar mollstam"></span></button>
          <button type="button" class="avatar-picker" data-uuid="020242a17b9441799eff511eea1221da" title="evilseph" aria-label="Use evilseph UUID"><span class="avatar evilseph"></span></button>
          <button type="button" class="avatar-picker" data-uuid="4566e69fc90748ee8d71d7ba5aa00d20" title="thinkofdeath" aria-label="Use thinkofdeath UUID"><span class="avatar thinkofdeath"></span></button>
        </div>

        <nav class="head-nav" aria-label="Documentation sections">
          <a href="#try">Try it</a>
          <a href="#avatars">Avatars</a>
          <a href="#head-renders">Head</a>
          <a href="#body-renders">Body</a>
          <a href="#skins">Skins</a>
          <a href="#capes">Capes</a>
          <a href="#toolkit">Toolkit</a>
          <a href="#sdk-snippet">SDK</a>
          <a href="#meta">Meta</a>
        </nav>

        <div class="quick-links" aria-label="Quick links">
          <a class="quick-link" href="${safeDomain}/tools/server-list">Server List Builder</a>
          <a class="quick-link" href="${safeDomain}/docs">API Docs</a>
        </div>

        <div id="support" class="support-strip" aria-label="Support NitroCraft">
          <span class="support-strip-label">Support NitroCraft:</span>
          <a href="https://github.com/sponsors/EuphoriaDevelopmentOrg" target="_blank" rel="noopener noreferrer">
            <img src="https://img.shields.io/badge/GitHub%20Sponsors-Support-181717?logo=githubsponsors&logoColor=white" alt="Support via GitHub Sponsors" width="173" height="20" loading="lazy" decoding="async">
          </a>
        </div>
        <p class="support-tier-note">Support tiers: <strong>$5</strong> Supporter, <strong>$10</strong> Builder, and <strong>$20</strong> Sponsor Spotlight (includes homepage + <a href="https://github.com/EuphoriaDevelopmentOrg/NitroCraft#donations" target="_blank" rel="noopener noreferrer">README sponsor placement</a>).</p>
      </div>
    </div>

    ${sponsorSectionHtml}

    <main id="content" class="container row docs-row">
      <div class="docs-main">
        <section id="documentation">
          <div id="alerts" aria-live="polite"></div>

          <section id="try">
            <h2><a href="#try">Try it</a></h2>
            <form id="tryit" action="#">
              <label class="visually-hidden" for="tryname">UUID or username</label>
              <div class="row">
                <div class="col-md-11">
                  <input id="tryname" name="player" type="text" placeholder="Enter UUID or username" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="try-help">
                </div>
                <div class="col-md-1">
                  <input type="submit" value="Go!">
                </div>
              </div>
            </form>
            <p id="try-help" class="try-help">Enter a Mojang UUID or username, then press Enter to update all previews.</p>
          </section>

          <section id="avatars">
            <h2><a href="#avatars">Avatars</a></h2>
            <div class="row">
              <div class="col-md-2">
                <img class="tryit" data-src="/avatars/$?size=100" src="/images/mhf_steve.png" alt="avatar" width="100" height="100" loading="lazy" decoding="async">
              </div>
              <div class="col-md-10">
                <div class="code">${safeDomain}/avatars/<mark class="green">uuid</mark></div>
                <p>Accepted <a href="#meta-parameters">modifiers</a>: <i><b>size</b>, <b>overlay</b>, <b>default</b></i>.</p>
              </div>
            </div>
          </section>

          <section id="head-renders">
            <h2><a href="#head-renders">Head Renders</a></h2>
            <div class="row">
              <div class="col-md-2">
                <img class="tryit" data-src="/renders/head/$" src="/images/mhf_steve.png" alt="head" width="120" height="111" loading="lazy" decoding="async">
              </div>
              <div class="col-md-10">
                <div class="code">${safeDomain}/renders/head/<mark class="green">uuid</mark></div>
                <p>Accepted <a href="#meta-parameters">modifiers</a>: <i><b>scale</b>, <b>overlay</b>, <b>default</b></i>.</p>
              </div>
            </div>
          </section>

          <section id="body-renders">
            <h2><a href="#body-renders">Body Renders</a></h2>
            <div class="row">
              <div class="col-md-2">
                <img class="tryit" data-src="/renders/body/$" src="/images/mhf_steve.png" alt="body" width="120" height="270" loading="lazy" decoding="async">
              </div>
              <div class="col-md-10">
                <div class="code">${safeDomain}/renders/body/<mark class="green">uuid</mark></div>
                <p>Accepted <a href="#meta-parameters">modifiers</a>: <i><b>scale</b>, <b>overlay</b>, <b>default</b></i>.</p>
              </div>
            </div>
          </section>

          <section id="skins">
            <h2><a href="#skins">Skins</a></h2>
            <div class="row">
              <div class="col-md-2">
                <img class="tryit" data-src="/skins/$" src="/images/mhf_steve_skin.png" alt="skin" width="64" height="64" loading="lazy" decoding="async">
              </div>
              <div class="col-md-10">
                <div class="code">${safeDomain}/skins/<mark class="green">uuid</mark></div>
                <p>Accepted <a href="#meta-parameters">modifiers</a>: <i><b>default</b></i>.</p>
              </div>
            </div>
          </section>

          <section id="capes">
            <h2><a href="#capes">Capes</a></h2>
            <div class="row">
              <div class="col-md-2">
                <img class="tryit" data-src="/capes/$?default=853c80ef3c3749fdaa49938b674adae6" src="/images/mhf_alex_skin.png" alt="cape" width="64" height="64" loading="lazy" decoding="async">
              </div>
              <div class="col-md-10">
                <div class="code">${safeDomain}/capes/<mark class="green">uuid</mark></div>
                <p>Accepted <a href="#meta-parameters">modifiers</a>: <i><b>default</b></i>.</p>
              </div>
            </div>
          </section>

          <section id="toolkit">
            <h2><a href="#toolkit">Toolkit Extras</a></h2>
            <p>Additional endpoints powered by <code>minecraft-toolkit</code>:</p>
            <p>Credit to <a href="https://github.com/26bz" target="_blank" rel="noopener noreferrer">26bz</a> for creating <a href="https://github.com/26bz/minecraft-toolkit" target="_blank" rel="noopener noreferrer"><code>minecraft-toolkit</code></a>.</p>
            <ul>
              <li><code>${safeDomain}/players/{uuid-or-username}</code> - resolved player identity + textures</li>
              <li><code>${safeDomain}/players/{uuid-or-username}/profile</code> - Mojang profile payload</li>
              <li><code>${safeDomain}/players/{uuid-or-username}/history</code> - name history</li>
              <li><code>${safeDomain}/players/{uuid-or-username}/skin-metadata?dominantColor=true&x=8&y=8&width=8&height=8</code></li>
              <li><code>${safeDomain}/status/java?address=mc.hypixel.net</code> - Java status ping</li>
              <li><code>${safeDomain}/status/bedrock?address=play.example.net&port=19132</code> - Bedrock status ping</li>
              <li><code>${safeDomain}/status/server?address=mc.hypixel.net&edition=auto</code> - auto status probe</li>
              <li><code>${safeDomain}/status/icon?address=mc.hypixel.net</code> - Java server icon</li>
              <li><code>${safeDomain}/format/html?text=%C2%A7aWelcome%20%C2%A7lHero</code> - formatting to HTML</li>
              <li><code>${safeDomain}/format/strip?text=%C2%A7aWelcome%20%C2%A7lHero</code> - strip formatting codes</li>
              <li><code>${safeDomain}/format/css</code> - CSS classes for formatting mode</li>
              <li><code>${safeDomain}/tools/server-list</code> - live Minecraft server-list entry simulator</li>
              <li><code>${safeDomain}/docs</code> - interactive API reference (Scalar)</li>
              <li><code>${safeDomain}/metrics</code> - Prometheus metrics endpoint</li>
            </ul>
          </section>

          <section id="sdk-snippet">
            <h2><a href="#sdk-snippet">SDK Snippet Generator</a></h2>
            <p>Pick an endpoint and language to generate a starter request snippet. Interactive docs are available at <code>${safeDomain}/docs</code>.</p>
            <div class="sdk-controls">
              <div>
                <label for="sdk-endpoint">Endpoint</label>
                <select id="sdk-endpoint">
                  <option value="/avatars/{uuid}?size=160&overlay">Avatar</option>
                  <option value="/renders/head/{uuid}?scale=6&overlay">Head render</option>
                  <option value="/players/{uuid-or-username}">Player resolve</option>
                  <option value="/status/server?address=mc.hypixel.net&edition=auto">Status probe</option>
                  <option value="/format/html?text=%C2%A7aWelcome%20%C2%A7lHero">Formatting HTML</option>
                </select>
              </div>
              <div>
                <label for="sdk-language">Language</label>
                <select id="sdk-language">
                  <option value="curl">cURL</option>
                  <option value="javascript">JavaScript (fetch)</option>
                  <option value="python">Python (requests)</option>
                </select>
              </div>
            </div>
            <div id="sdk-snippet-code" class="code">${safeDomain}/avatars/${featuredUuid}?size=160&amp;overlay</div>
          </section>

          <hr>

          <section id="meta">
            <h2><a href="#meta">Meta</a></h2>
            <p>You can append <code>.png</code> or any other extension to the URL path if you like, but all image responses are PNG.</p>

            <section id="meta-attribution">
              <h3><a href="#meta-attribution">Attribution</a></h3>
              <p>
                Attribution is not required, but it is <strong>encouraged</strong>.<br>
                If you want to show support for this service, place a notice like:
                <span class="code">Thank you to &lt;a href="${safeDomain}"&gt;NitroCraft&lt;/a&gt; for providing avatars.</span>
              </p>
            </section>

            <section id="meta-parameters">
              <h3><a href="#meta-parameters">URL Parameters</a></h3>
              <p>
                You can tweak images using <a href="https://en.wikipedia.org/wiki/Query_string" target="_blank" rel="noopener noreferrer">query string parameters</a>.<br>
                Example: <code>${safeDomain}/avatars/853c80ef3c3749fdaa49938b674adae6<mark class="blue">?</mark><mark class="green">size=4</mark><mark class="blue">&</mark><mark class="green">default=MHF_Steve</mark><mark class="blue">&</mark><mark class="green">overlay</mark></code>
              </p>
              <ul>
                <li><b>size</b>: Avatar size in pixels. <code>${config.avatars.minSize} - ${config.avatars.maxSize}</code></li>
                <li><b>scale</b>: Render scale factor. <code>${config.renders.minScale} - ${config.renders.maxScale}</code></li>
                <li><b>overlay</b>: Applies the avatar/render overlay. Presence implies <code>true</code>. This option was previously known as <code>helm</code>.</li>
                <li><b>default</b>: Fallback when the requested image cannot be served. Accepts a custom URL, any UUID, or <code>MHF_Steve</code>/<code>MHF_Alex</code>. Default is selected from Minecraft's default skin for the requested UUID.</li>
              </ul>
            </section>

            <section id="meta-uuids">
              <h3><a href="#meta-uuids">About UUIDs</a></h3>
              <p>UUIDs may be any valid Mojang UUID in dashed or undashed format.</p>
              <p>Malformed UUIDs are rejected.</p>
            </section>

            <section id="meta-usernames">
              <h3><a href="#meta-usernames">About Usernames</a></h3>
              <p>Core image endpoints (<code>/avatars</code>, <code>/skins</code>, <code>/capes</code>, <code>/renders</code>) require UUIDs.</p>
              <p>The Try It box and <code>/players/{uuid-or-username}</code> can resolve usernames to UUID first.</p>
            </section>

            <section id="meta-caching">
              <h3><a href="#meta-caching">About Caching</a></h3>
              <p>
                NitroCraft checks for skin updates every ${localMinutes} minutes.<br>
                Images are also cached in your browser for ${browserMinutes} minutes unless you clear your browser cache.${cloudflareCachingNote}
              </p>
              <p>After changing your Minecraft skin, you can try clearing your browser cache to see the change faster.</p>
            </section>

            <section id="meta-cors">
              <h3><a href="#meta-cors">CORS</a></h3>
              <p>NitroCraft supports Cross-Origin Resource Sharing, so you can make AJAX requests from other sites.</p>
            </section>

            <section id="meta-http-headers">
              <h3><a href="#meta-http-headers">HTTP Headers</a></h3>
              <p>
                NitroCraft replies with <code>200 OK</code> when the requested user's skin/cape is found. This is also used in some rare cases when Mojang has issues and NitroCraft serves a stale cached image.
                ${noImageStatusCodes}
              </p>
              <p>Responses include useful debugging headers.${cloudflareHeaderNote}</p>
              <ul>
                <li>
                  <b>Warning</b>: Set when cached content is used after an error.
                  <ul>
                    <li><code>110 NitroCraft "Response is Stale"</code></li>
                    <li><code>111 NitroCraft "Revalidation Failed"</code></li>
                  </ul>
                </li>
                <li>
                  <b>X-Storage-Type</b>: Details about cache/storage behavior.
                  <ul>
                    <li><b>none</b>: No external requests; player has no skin (cached)</li>
                    <li><b>cached</b>: No external requests; skin cached</li>
                    <li><b>checked</b>: Requested skin details and kept cached skin</li>
                    <li><b>downloaded</b>: Requested skin details and downloaded fresh skin</li>
                    <li><b>server error</b>: Mojang or NitroCraft server issue</li>
                    <li><b>server error;cached</b>: Server issue but cached skin was available</li>
                    <li><b>user error</b>: Invalid request data (for example malformed UUID)</li>
                  </ul>
                </li>
                <li><b>X-Request-ID</b>: Internal ID for your request.</li>
                <li><b>Response-Time</b>: Request processing time in milliseconds.</li>
              </ul>
            </section>
          </section>
        </section>
      </div>
    </main>

    <footer id="footer">
      <div class="container row">
        <p class="footer-meta">
          Copyright &copy; ${year} <a href="https://euphoriadevelopment.uk" target="_blank" rel="noopener noreferrer">Euphoria Development</a>. NitroCraft is open source and available under MIT.
        </p>
        <p class="footer-links">
          <span class="footer-link-list">
            <a href="https://github.com/EuphoriaDevelopmentOrg/NitroCraft" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="${safeDomain}/status/mc">Service Status</a>
            <a href="${safeDomain}/renders/head/853c80ef3c3749fdaa49938b674adae6?scale=6&amp;overlay">Live Example</a>
            <a href="${safeDomain}/tools/server-list">Server List Builder</a>
            <a href="${safeDomain}/docs">API Docs</a>
          </span>
        </p>
      </div>
    </footer>

    <button id="back-to-top" type="button" aria-label="Go to top">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6 14l6-6 6 6"></path>
      </svg>
    </button>

    <script src="/javascript/nitrocraft.js"></script>
  </body>
</html>`;

  return respond(event, {
    status: 1,
    body: html,
    type: "text/html; charset=utf-8",
    cacheControl: "no-cache, max-age=0",
  });
});
