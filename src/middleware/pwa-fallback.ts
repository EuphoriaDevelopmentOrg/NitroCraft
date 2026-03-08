export default defineEventHandler((event) => {
  const path = String(event.path || "").split("?")[0];

  if (path === "/sw.js") {
    const script = `
const CACHE_NAME = "nitrocraft-shell-v3";
const OFFLINE_FALLBACK = "/offline.html";
const APP_SHELL = [
  "/",
  "/docs",
  "/tools/server-list",
  OFFLINE_FALLBACK,
  "/site.webmanifest",
  "/stylesheets/style.css",
  "/stylesheets/fontawesome-local.css",
  "/javascript/nitrocraft.js",
  "/javascript/server-list-builder.js",
  "/NitroCraft-320.png",
  "/NitroCraft.ico",
  "/NitroCraft.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/vendor/fontawesome/webfonts/fa-solid-900.woff2"
];

function isCacheableStaticAsset(url) {
  if (url.pathname === "/" || url.pathname === "/site.webmanifest" || url.pathname === OFFLINE_FALLBACK) {
    return true;
  }
  return (
    url.pathname.startsWith("/stylesheets/") ||
    url.pathname.startsWith("/javascript/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/vendor/") ||
    url.pathname === "/NitroCraft-320.png" ||
    url.pathname === "/NitroCraft.ico" ||
    url.pathname === "/NitroCraft.png"
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, response.clone());
              if (url.pathname === "/") {
                cache.put("/", response.clone());
              }
            });
          }
          return response;
        })
        .catch(() =>
          caches.match(request)
            .then((cached) => cached || caches.match(url.pathname))
            .then((cached) => cached || caches.match("/"))
            .then((cached) => cached || caches.match(OFFLINE_FALLBACK))
        )
    );
    return;
  }

  if (!isCacheableStaticAsset(url)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      return network || caches.match(OFFLINE_FALLBACK) || Response.error();
    })
  );
});
`.trim();

    return new Response(
      script,
      {
        headers: {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "no-cache, max-age=0",
        },
      },
    );
  }

  if (/^\/workbox-[A-Za-z0-9._-]+\.js$/.test(path)) {
    return new Response("self.workbox = self.workbox || {};\n", {
      headers: {
        "content-type": "application/javascript; charset=utf-8",
        "cache-control": "no-cache, max-age=0",
      },
    });
  }
});
