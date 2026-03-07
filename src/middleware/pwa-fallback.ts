export default defineEventHandler((event) => {
  const path = String(event.path || "").split("?")[0];

  if (path === "/sw.js") {
    return new Response(
      "self.addEventListener('install', () => self.skipWaiting());\nself.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));\n",
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
