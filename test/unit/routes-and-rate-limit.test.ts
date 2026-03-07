import test from "node:test";
import assert from "node:assert/strict";

import { config } from "../../src/config";
import { createSessionRateLimitError, tryConsumeSessionRequest } from "../../src/utils/session-rate-limit";
import { respond } from "../../src/utils/response";

// Nitro normally injects this globally at runtime.
(globalThis as { defineEventHandler?: <T>(handler: T) => T }).defineEventHandler = <T>(handler: T): T => handler;

type MockEventOptions = {
  url: string;
  params?: Record<string, string>;
  headers?: Record<string, string>;
};

function createMockEvent(options: MockEventOptions): {
  event: any;
  resHeaders: Record<string, string>;
  res: { statusCode: number };
} {
  const resHeaders: Record<string, string> = {};
  const res = {
    statusCode: 200,
    setHeader(name: string, value: string): void {
      resHeaders[name.toLowerCase()] = String(value);
    },
  };

  return {
    event: {
      method: "GET",
      path: options.url,
      context: {
        params: options.params || {},
        requestId: "test-request",
        requestStart: Date.now(),
      },
      node: {
        req: {
          url: options.url,
          headers: options.headers || {},
          socket: {
            remoteAddress: "127.0.0.1",
          },
        },
        res,
      },
    },
    resHeaders,
    res,
  };
}

test("session limiter allows requests when disabled", () => {
  const original = config.server.sessionsRateLimit;
  (config.server as any).sessionsRateLimit = Number.NaN;

  assert.equal(tryConsumeSessionRequest(1_000), true);
  assert.equal(tryConsumeSessionRequest(1_000), true);
  assert.equal(tryConsumeSessionRequest(1_000), true);

  (config.server as any).sessionsRateLimit = original;
});

test("session limiter blocks requests over the per-second limit", () => {
  const original = config.server.sessionsRateLimit;
  (config.server as any).sessionsRateLimit = 2;

  assert.equal(tryConsumeSessionRequest(10_000), true);
  assert.equal(tryConsumeSessionRequest(10_100), true);
  assert.equal(tryConsumeSessionRequest(10_200), false);
  assert.equal(tryConsumeSessionRequest(11_300), true);

  const err = createSessionRateLimitError();
  assert.equal(err.code, "RATELIMIT");
  assert.equal(err.statusCode, 429);

  (config.server as any).sessionsRateLimit = original;
});

test("avatars route rejects invalid uuid", async () => {
  const route = (await import("../../src/routes/avatars/[id].get")).default;
  const { event, res } = createMockEvent({
    url: "/avatars/not-a-uuid",
    params: { id: "not-a-uuid" },
  });

  const body = await route(event);
  assert.equal(res.statusCode, 422);
  assert.match(String(body), /Invalid UUID/i);
});

test("avatars route rejects out-of-range size", async () => {
  const route = (await import("../../src/routes/avatars/[id].get")).default;
  const validUuid = "069a79f444e94726a5befca90e38aaf5";
  const { event, res } = createMockEvent({
    url: `/avatars/${validUuid}?size=${config.avatars.maxSize + 1}`,
    params: { id: validUuid },
  });

  const body = await route(event);
  assert.equal(res.statusCode, 422);
  assert.match(String(body), /Invalid Size/i);
});

test("render type route rejects unsupported type", async () => {
  const route = (await import("../../src/routes/renders/[type]/[id].get")).default;
  const validUuid = "069a79f444e94726a5befca90e38aaf5";
  const { event, res } = createMockEvent({
    url: `/renders/invalid/${validUuid}`,
    params: { type: "invalid", id: validUuid },
  });

  const body = await route(event);
  assert.equal(res.statusCode, 422);
  assert.match(String(body), /Invalid Render Type/i);
});

test("players route rejects invalid player input", async () => {
  const route = (await import("../../src/routes/players/[id].get")).default;
  const { event, res } = createMockEvent({
    url: "/players/@@@",
    params: { id: "@@@" },
  });

  const body = await route(event);
  assert.equal(res.statusCode, 422);
  assert.match(String(body), /Invalid player input/i);
});

test("request limiter middleware returns 429 when limit is exceeded", async () => {
  const original = {
    max: config.server.requestsRateLimit.max,
    windowMs: config.server.requestsRateLimit.windowMs,
    trustProxy: config.server.requestsRateLimit.trustProxy,
    excludePaths: [...config.server.requestsRateLimit.excludePaths],
  };

  (config.server.requestsRateLimit as any).max = 2;
  (config.server.requestsRateLimit as any).windowMs = 1000;
  (config.server.requestsRateLimit as any).trustProxy = true;
  (config.server.requestsRateLimit as any).excludePaths = [];

  const middleware = (await import("../../src/middleware/00-rate-limit")).default;
  const ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;

  const first = createMockEvent({
    url: "/avatars/069a79f444e94726a5befca90e38aaf5",
    headers: { "x-forwarded-for": ip },
  });
  const second = createMockEvent({
    url: "/avatars/069a79f444e94726a5befca90e38aaf5",
    headers: { "x-forwarded-for": ip },
  });
  const third = createMockEvent({
    url: "/avatars/069a79f444e94726a5befca90e38aaf5",
    headers: { "x-forwarded-for": ip },
  });

  assert.equal(await middleware(first.event), undefined);
  assert.equal(await middleware(second.event), undefined);

  const blocked = await middleware(third.event);
  assert.equal(third.res.statusCode, 429);
  assert.equal(String(blocked), "Too Many Requests");
  assert.equal(third.resHeaders["x-ratelimit-limit"], "2");
  assert.equal(third.resHeaders["x-ratelimit-remaining"], "0");
  assert.ok(third.resHeaders["retry-after"]);

  (config.server.requestsRateLimit as any).max = original.max;
  (config.server.requestsRateLimit as any).windowMs = original.windowMs;
  (config.server.requestsRateLimit as any).trustProxy = original.trustProxy;
  (config.server.requestsRateLimit as any).excludePaths = original.excludePaths;
});

test("cors defaults to allow-all and can be restricted by allowlist", () => {
  const originalAllowAll = config.server.corsAllowAll;
  const originalOrigins = [...config.server.corsOrigins];

  (config.server as any).corsAllowAll = true;
  (config.server as any).corsOrigins = [];

  const all = createMockEvent({
    url: "/status/mc",
    headers: { origin: "https://app.example.com" },
  });
  respond(all.event, {
    status: 1,
    body: "ok",
    type: "text/plain; charset=utf-8",
  });
  assert.equal(all.resHeaders["access-control-allow-origin"], "*");
  assert.equal(all.resHeaders["x-frame-options"], "DENY");
  assert.ok(all.resHeaders["permissions-policy"]);
  assert.equal(all.resHeaders["cross-origin-opener-policy"], "same-origin");
  assert.equal(all.resHeaders["origin-agent-cluster"], "?1");

  (config.server as any).corsAllowAll = false;
  (config.server as any).corsOrigins = ["https://app.example.com"];

  const allowed = createMockEvent({
    url: "/status/mc",
    headers: { origin: "https://app.example.com" },
  });
  respond(allowed.event, {
    status: 1,
    body: "ok",
    type: "text/plain; charset=utf-8",
  });
  assert.equal(allowed.resHeaders["access-control-allow-origin"], "https://app.example.com");
  assert.equal(allowed.resHeaders.vary, "Origin");

  const denied = createMockEvent({
    url: "/status/mc",
    headers: { origin: "https://blocked.example.com" },
  });
  respond(denied.event, {
    status: 1,
    body: "ok",
    type: "text/plain; charset=utf-8",
  });
  assert.equal(denied.resHeaders["access-control-allow-origin"], undefined);

  (config.server as any).corsAllowAll = originalAllowAll;
  (config.server as any).corsOrigins = originalOrigins;
});
