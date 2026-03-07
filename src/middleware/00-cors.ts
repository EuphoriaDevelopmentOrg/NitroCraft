import { config } from "../config";
import { resolveCorsOrigin } from "../utils/cors";
import { readHeader } from "../utils/request";

function setHeader(event: any, name: string, value: string): void {
  if (event.node?.res && typeof event.node.res.setHeader === "function") {
    event.node.res.setHeader(name, value);
    return;
  }

  if (event.res?.headers?.set) {
    event.res.headers.set(name, value);
  }
}

function corsHeaders(event: any): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Origin, Content-Type, Accept, Authorization, If-None-Match",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };

  const origin = resolveCorsOrigin(readHeader(event, "origin"), config.server.corsAllowAll, config.server.corsOrigins);
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    if (origin !== "*") {
      headers.Vary = "Origin";
    }
  }

  return headers;
}

export default defineEventHandler((event) => {
  const headers = corsHeaders(event);
  for (const [name, value] of Object.entries(headers)) {
    setHeader(event, name, value);
  }

  const method = String(event.method || event.node?.req?.method || "GET").toUpperCase();
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...headers,
        "Cache-Control": "no-cache, max-age=0",
      },
    });
  }
});
