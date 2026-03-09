import test from "node:test";
import assert from "node:assert/strict";

import { config } from "../../src/config";
import { withStatusProbeCache } from "../../src/services/status-probe-cache";
import { createSessionRateLimitError, tryConsumeSessionRequest } from "../../src/utils/session-rate-limit";
import { respond } from "../../src/utils/response";

// Nitro normally injects this globally at runtime.
(globalThis as { defineEventHandler?: <T>(handler: T) => T }).defineEventHandler = <T>(handler: T): T => handler;

type MockEventOptions = {
  method?: string;
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
      method: options.method || "GET",
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

test("status route blocks private probe targets by default", async () => {
  const route = (await import("../../src/routes/status/server.get")).default;
  const originalAllowPrivate = config.server.allowPrivateStatusTargets;
  try {
    (config.server as any).allowPrivateStatusTargets = false;

    const { event, res } = createMockEvent({
      url: "/status/server?address=127.0.0.1",
    });

    const body = await route(event);
    assert.equal(res.statusCode, 422);
    assert.match(String(body), /Private\/local targets are not allowed/i);
  } finally {
    (config.server as any).allowPrivateStatusTargets = originalAllowPrivate;
  }
});

test("status browser route validates required targets and maximum batch size", async () => {
  const route = (await import("../../src/routes/status/browser.get")).default;
  const originalMaxAddresses = config.server.statusBrowserMaxAddresses;

  try {
    const missingTargets = createMockEvent({
      url: "/status/browser",
    });
    const missingBody = await route(missingTargets.event);
    assert.equal(missingTargets.res.statusCode, 422);
    assert.match(String(missingBody), /Missing server targets/i);

    (config.server as any).statusBrowserMaxAddresses = 2;
    const tooManyTargets = createMockEvent({
      url: "/status/browser?address=one.example.net&address=two.example.net&address=three.example.net",
    });
    const tooManyBody = await route(tooManyTargets.event);
    assert.equal(tooManyTargets.res.statusCode, 422);
    assert.match(String(tooManyBody), /Too many server targets/i);
  } finally {
    (config.server as any).statusBrowserMaxAddresses = originalMaxAddresses;
  }
});

test("status browser route returns per-target failures for blocked private addresses", async () => {
  const route = (await import("../../src/routes/status/browser.get")).default;
  const originalAllowPrivate = config.server.allowPrivateStatusTargets;

  try {
    (config.server as any).allowPrivateStatusTargets = false;

    const probe = createMockEvent({
      url: "/status/browser?address=127.0.0.1&address=localhost",
    });
    const probeBody = await route(probe.event);
    assert.equal(probe.res.statusCode, 200);
    const payload = JSON.parse(String(probeBody));
    assert.equal(payload.processed, 2);
    assert.equal(payload.succeeded, 0);
    assert.equal(payload.failed, 2);
    assert.equal(Array.isArray(payload.results), true);
    assert.equal(payload.results.length, 2);
    assert.equal(payload.results[0].ok, false);
    assert.match(String(payload.results[0].error), /Private\/local targets are not allowed/i);
  } finally {
    (config.server as any).allowPrivateStatusTargets = originalAllowPrivate;
  }
});

test("status browser route rejects unknown source ids", async () => {
  const route = (await import("../../src/routes/status/browser.get")).default;
  const originalSources = config.server.statusBrowserSources.map((source) => ({ ...source }));

  try {
    (config.server as any).statusBrowserSources = [
      {
        id: "demo-source",
        label: "Demo Source",
        url: "https://example.com/servers.json",
      },
    ];

    const unknownSource = createMockEvent({
      url: "/status/browser?source=does-not-exist",
    });
    const body = await route(unknownSource.event);
    assert.equal(unknownSource.res.statusCode, 422);
    assert.match(String(body), /Unknown source id/i);
  } finally {
    (config.server as any).statusBrowserSources = originalSources;
  }
});

test("status browser route validates dataset pagination inputs", async () => {
  const route = (await import("../../src/routes/status/browser.get")).default;

  const invalidDataset = createMockEvent({
    url: "/status/browser?dataset=invalid",
  });
  const invalidDatasetBody = await route(invalidDataset.event);
  assert.equal(invalidDataset.res.statusCode, 422);
  assert.match(String(invalidDatasetBody), /Invalid dataset\/list/i);

  const invalidPerPage = createMockEvent({
    url: "/status/browser?dataset=java&perPage=101",
  });
  const invalidPerPageBody = await route(invalidPerPage.event);
  assert.equal(invalidPerPage.res.statusCode, 422);
  assert.match(String(invalidPerPageBody), /Invalid numeric query value/i);
});

test("status routes reject out-of-range numeric values", async () => {
  const route = (await import("../../src/routes/status/java.get")).default;
  const originalAllowPrivate = config.server.allowPrivateStatusTargets;
  try {
    (config.server as any).allowPrivateStatusTargets = true;

    const { event, res } = createMockEvent({
      url: "/status/java?address=127.0.0.1&port=70000",
    });

    const body = await route(event);
    assert.equal(res.statusCode, 422);
    assert.match(String(body), /Invalid numeric query value/i);
  } finally {
    (config.server as any).allowPrivateStatusTargets = originalAllowPrivate;
  }
});

test("status icon route rejects out-of-range protocolVersion", async () => {
  const route = (await import("../../src/routes/status/icon.get")).default;
  const originalAllowPrivate = config.server.allowPrivateStatusTargets;
  try {
    (config.server as any).allowPrivateStatusTargets = true;

    const { event, res } = createMockEvent({
      url: "/status/icon?address=127.0.0.1&protocolVersion=1000001",
    });

    const body = await route(event);
    assert.equal(res.statusCode, 422);
    assert.match(String(body), /Invalid numeric query value/i);
  } finally {
    (config.server as any).allowPrivateStatusTargets = originalAllowPrivate;
  }
});

test("format routes handle code stripping and invalid mode", async () => {
  const stripRoute = (await import("../../src/routes/format/strip.get")).default;
  const htmlRoute = (await import("../../src/routes/format/html.get")).default;

  const strip = createMockEvent({
    url: "/format/strip?text=%C2%A7aWelcome%20%C2%A7lHero",
  });
  const strippedBody = await stripRoute(strip.event);
  assert.equal(strip.res.statusCode, 200);
  const strippedPayload = JSON.parse(String(strippedBody));
  assert.equal(strippedPayload.text, "Welcome Hero");
  assert.equal(strippedPayload.hadCodes, true);

  const invalidMode = createMockEvent({
    url: "/format/html?text=%C2%A7aWelcome&mode=broken",
  });
  const invalidBody = await htmlRoute(invalidMode.event);
  assert.equal(invalidMode.res.statusCode, 422);
  assert.match(String(invalidBody), /Invalid mode/i);
});

test("status probe cache deduplicates inflight work and respects ttl", async () => {
  const originalTtl = config.server.statusProbeCacheTtlMs;
  try {
    (config.server as any).statusProbeCacheTtlMs = 80;

    let calls = 0;
    const key = `test-${Date.now()}-${Math.random()}`;
    const loader = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { ok: true, calls };
    };

    const [first, second] = await Promise.all([
      withStatusProbeCache("test", key, loader),
      withStatusProbeCache("test", key, loader),
    ]);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(calls, 1);

    const third = await withStatusProbeCache("test", key, loader);
    assert.equal(third.ok, true);
    assert.equal(calls, 1);

    await new Promise((resolve) => setTimeout(resolve, 110));
    const fourth = await withStatusProbeCache("test", key, loader);
    assert.equal(fourth.ok, true);
    assert.equal(calls, 2);
  } finally {
    (config.server as any).statusProbeCacheTtlMs = originalTtl;
  }
});

test("metrics and openapi routes return expected payloads", async () => {
  const metricsRoute = (await import("../../src/routes/metrics.get")).default;
  const apiCallsRoute = (await import("../../src/routes/metrics/api-calls.get")).default;
  const openApiRoute = (await import("../../src/routes/openapi.json.get")).default;
  const { metrics } = await import("../../src/services/metrics");

  const metricsEvent = createMockEvent({
    url: "/metrics",
  });
  const metricsBody = await metricsRoute(metricsEvent.event);
  assert.equal(metricsEvent.res.statusCode, 200);
  assert.match(String(metricsBody), /nitrocraft_http_requests_total/i);
  assert.match(String(metricsBody), /nitrocraft_status_probe_cache_hit_ratio/i);

  const apiCallsEvent = createMockEvent({
    url: "/metrics/api-calls",
  });
  const beforeApiCallsTotal = metrics.getApiCallCount();
  const apiCallsBody = await apiCallsRoute(apiCallsEvent.event);
  const afterApiCallsTotal = metrics.getApiCallCount();
  assert.equal(apiCallsEvent.res.statusCode, 200);
  const apiCallsPayload = JSON.parse(String(apiCallsBody));
  assert.equal(typeof apiCallsPayload.apiCalls, "number");
  assert.ok(Number.isFinite(apiCallsPayload.apiCalls));
  assert.equal(afterApiCallsTotal, beforeApiCallsTotal);

  const openApiEvent = createMockEvent({
    url: "/openapi.json",
    headers: {
      host: "nitrocraft.test",
      "x-forwarded-proto": "https",
      "x-forwarded-host": "nitrocraft.test",
    },
  });
  const openApiBody = await openApiRoute(openApiEvent.event);
  assert.equal(openApiEvent.res.statusCode, 200);
  const spec = JSON.parse(String(openApiBody));
  assert.equal(spec.openapi, "3.1.0");
  assert.ok(spec.paths["/openapi.json"]);
  assert.ok(spec.paths["/metrics"]);
  assert.ok(spec.paths["/metrics/api-calls"]);
  assert.ok(spec.paths["/status/browser"]);
  assert.equal(typeof spec.servers[0].url, "string");
  assert.ok(String(spec.servers[0].url).startsWith("http"));
});

test("docs route points Scalar to custom openapi schema", async () => {
  const route = (await import("../../src/routes/docs.get")).default;
  const originalExternalUrl = config.server.externalUrl;
  try {
    (config.server as any).externalUrl = "";
    const { event, res } = createMockEvent({
      url: "/docs",
      headers: {
        host: "nitrocraft.test",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "nitrocraft.test",
      },
    });

    const body = await route(event);
    assert.equal(res.statusCode, 200);
    assert.match(String(body), /NitroCraft API Docs/i);
    assert.match(String(body), /id="api-reference"/);
    assert.match(String(body), /https:\/\/nitrocraft\.test\/openapi\.json/);
  } finally {
    (config.server as any).externalUrl = originalExternalUrl;
  }
});

test("server list builder page renders expected shell", async () => {
  const route = (await import("../../src/routes/tools/server-list.get")).default;
  const { event, res } = createMockEvent({
    url: "/tools/server-list",
  });

  const body = await route(event);
  assert.equal(res.statusCode, 200);
  assert.match(String(body), /Server List Builder/i);
  assert.match(String(body), /slb-import-btn/);
  assert.match(String(body), /href="\/docs"/);
  assert.match(String(body), /slb-active-target/);
  assert.match(String(body), /slb-animation-ms/);
});

test("server browser page renders expected shell", async () => {
  const route = (await import("../../src/routes/tools/server-browser.get")).default;

  const { event, res } = createMockEvent({
    url: "/tools/server-browser",
  });

  const body = await route(event);
  assert.equal(res.statusCode, 200);
  assert.match(String(body), /Server Browser/i);
  assert.match(String(body), /nsb-probe-btn/);
  assert.match(String(body), /nsb-page-prev/);
  assert.match(String(body), /nsb-page-next/);
  assert.match(String(body), /nsb-per-page/);
  assert.match(String(body), /nsb-results-list/);
  assert.match(String(body), /\/javascript\/server-browser\.js/);
});

test("server list builder shared URL updates OG metadata", async () => {
  const route = (await import("../../src/routes/tools/server-list.get")).default;
  const originalExternalUrl = config.server.externalUrl;

  try {
    (config.server as any).externalUrl = "";
    const { event, res } = createMockEvent({
      url: "/tools/server-list?n=My%20Server&m1=%C2%A7aWelcome%20to%20My%20Server%20%7C%7C%20Alt&m2=Join%20now&o=12&x=99&v=1.21.4",
      headers: {
        host: "nitrocraft.test",
        "x-forwarded-proto": "https",
      },
    });

    const body = await route(event);
    assert.equal(res.statusCode, 200);
    assert.match(String(body), /<title>My Server - NitroCraft Server List Config \| NitroCraft<\/title>/);
    assert.match(String(body), /property="og:title" content="My Server - NitroCraft Server List Config"/);
    assert.match(String(body), /property="og:url" content="https:\/\/nitrocraft\.test\/tools\/server-list\?n=My%20Server/);
    assert.match(String(body), /Shared Minecraft server-list setup:/);
    assert.match(String(body), /Welcome to My Server/);
    assert.match(String(body), /Players 12\/99/);
  } finally {
    (config.server as any).externalUrl = originalExternalUrl;
  }
});

test("index route renders multiple sponsor cards and falls back to legacy sponsor fields", async () => {
  const route = (await import("../../src/routes/index.get")).default;
  const originalCards = config.sponsors.cards.map((card) => ({ ...card }));
  const originalUrl = config.sponsors.cardUrl;
  const originalImage = config.sponsors.cardImage;
  const originalAlt = config.sponsors.cardAlt;

  try {
    (config.sponsors as any).cards = [
      {
        url: "https://sponsor-a.example.com/click",
        image: "/images/sponsor-a.png",
        alt: "Sponsor A",
      },
      {
        url: "https://sponsor-b.example.com/click",
        image: "https://cdn.example.com/sponsor-b.png",
        alt: "Sponsor B",
      },
    ];
    (config.sponsors as any).cardUrl = "";
    (config.sponsors as any).cardImage = "";

    const configured = createMockEvent({
      url: "/",
      headers: {
        host: "nitrocraft.test",
        "x-forwarded-proto": "https",
      },
    });
    const configuredBody = await route(configured.event);
    assert.equal(configured.res.statusCode, 200);
    assert.match(String(configuredBody), /class="sponsor-strip"/);
    assert.match(String(configuredBody), /data-pinned="true" data-uuid="d634462bd663401d9788a8596307bc4d"/);
    assert.match(String(configuredBody), /data-pinned="true" data-uuid="15851079f1d24d418207ce9f914e966d"/);
    assert.match(String(configuredBody), /href="https:\/\/[^"]+\/docs"/);
    assert.match(String(configuredBody), /Support tiers:/);
    assert.match(String(configuredBody), /<strong>\$20<\/strong>\s*Sponsor Spotlight/);
    assert.match(String(configuredBody), /href="https:\/\/sponsor-a\.example\.com\/click"/);
    assert.match(String(configuredBody), /href="https:\/\/sponsor-b\.example\.com\/click"/);
    assert.match(String(configuredBody), /src="https:\/\/[^"]+\/images\/sponsor-a\.png"/);
    assert.match(String(configuredBody), /src="https:\/\/cdn\.example\.com\/sponsor-b\.png"/);
    assert.match(String(configuredBody), /alt="Sponsor A"/);
    assert.match(String(configuredBody), /alt="Sponsor B"/);
    assert.equal((String(configuredBody).match(/class="sponsor-card"/g) || []).length, 2);

    (config.sponsors as any).cards = [];
    (config.sponsors as any).cardUrl = "https://single.example.com/click";
    (config.sponsors as any).cardImage = "/images/sponsor-single.png";
    (config.sponsors as any).cardAlt = "Single Sponsor";

    const single = createMockEvent({
      url: "/",
      headers: {
        host: "nitrocraft.test",
        "x-forwarded-proto": "https",
      },
    });
    const singleBody = await route(single.event);
    assert.equal(single.res.statusCode, 200);
    assert.match(String(singleBody), /href="https:\/\/single\.example\.com\/click"/);
    assert.match(String(singleBody), /src="https:\/\/[^"]+\/images\/sponsor-single\.png"/);
    assert.match(String(singleBody), /alt="Single Sponsor"/);
    assert.equal((String(singleBody).match(/class="sponsor-card"/g) || []).length, 1);

    (config.sponsors as any).cards = [];
    (config.sponsors as any).cardUrl = "";
    (config.sponsors as any).cardImage = "";

    const unconfigured = createMockEvent({
      url: "/",
      headers: {
        host: "nitrocraft.test",
        "x-forwarded-proto": "https",
      },
    });
    const unconfiguredBody = await route(unconfigured.event);
    assert.equal(unconfigured.res.statusCode, 200);
    assert.doesNotMatch(String(unconfiguredBody), /class="sponsor-strip"/);
  } finally {
    (config.sponsors as any).cards = originalCards;
    (config.sponsors as any).cardUrl = originalUrl;
    (config.sponsors as any).cardImage = originalImage;
    (config.sponsors as any).cardAlt = originalAlt;
  }
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

test("probe filter middleware turns common dotfile scans into clean 404 responses", async () => {
  const middleware = (await import("../../src/middleware/00-probe-filter")).default;

  const blocked = createMockEvent({
    url: "/.env",
  });
  const blockedBody = await middleware(blocked.event);
  assert.equal(blocked.res.statusCode, 404);
  assert.equal(String(blockedBody), "Not Found");

  const blockedEncoded = createMockEvent({
    url: "/%2eenv.local",
  });
  const blockedEncodedBody = await middleware(blockedEncoded.event);
  assert.equal(blockedEncoded.res.statusCode, 404);
  assert.equal(String(blockedEncodedBody), "Not Found");

  const allowedWellKnown = createMockEvent({
    url: "/.well-known/security.txt",
  });
  const allowedResult = await middleware(allowedWellKnown.event);
  assert.equal(allowedResult, undefined);
});

test("catch-all route returns clean 404 for unknown paths", async () => {
  const route = (await import("../../src/routes/[...path]")).default;
  const { event, res } = createMockEvent({
    url: "/this-route-does-not-exist",
  });

  const body = await route(event);
  assert.equal(res.statusCode, 404);
  assert.equal(String(body), "Not Found");
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
