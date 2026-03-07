import test from "node:test";
import assert from "node:assert/strict";

import { defaultSkinForUuid, normalizeUuid, isValidUuid } from "../../src/utils/player";
import { sanitizeDefaultRedirect } from "../../src/utils/default-redirect";
import { normalizeCorsOrigin, parseCorsOrigins } from "../../src/utils/cors";
import { config } from "../../src/config";
import { getExternalBaseUrl, getRequestUrl } from "../../src/utils/request";
import { validateServerProbeAddress } from "../../src/utils/network-safety";
import { parseBoundedIntegerQuery, parseIntegerQuery } from "../../src/utils/toolkit";

test("normalizeUuid strips dashes", () => {
  assert.equal(normalizeUuid("069a79f4-44e9-4726-a5be-fca90e38aaf5"), "069a79f444e94726a5befca90e38aaf5");
});

test("isValidUuid accepts dashed and undashed", () => {
  assert.equal(isValidUuid("069a79f4-44e9-4726-a5be-fca90e38aaf5"), true);
  assert.equal(isValidUuid("069a79f444e94726a5befca90e38aaf5"), true);
  assert.equal(isValidUuid("not-a-uuid"), false);
});

test("defaultSkinForUuid returns expected default skin", () => {
  assert.equal(defaultSkinForUuid("fffffff0fffffff0fffffff0fffffff1"), "mhf_alex");
  assert.equal(defaultSkinForUuid("fffffff0fffffff0fffffff0fffffff0"), "mhf_steve");
});

test("sanitizeDefaultRedirect requires allowlisted hosts and blocks private IP targets", () => {
  const originalAllowlist = [...config.server.defaultRedirectAllowlist];
  const originalExternal = config.server.externalUrl;
  try {
    (config.server as any).defaultRedirectAllowlist = ["example.com", "*.cdn.example.com", "127.0.0.1"];
    (config.server as any).externalUrl = "";

    assert.equal(sanitizeDefaultRedirect("https://example.com/path"), "https://example.com/path");
    assert.equal(sanitizeDefaultRedirect("https://img.cdn.example.com/a.png"), "https://img.cdn.example.com/a.png");
    assert.equal(sanitizeDefaultRedirect("https://blocked.example.com/path"), null);
    assert.equal(sanitizeDefaultRedirect("http://127.0.0.1/"), null);
    assert.equal(sanitizeDefaultRedirect("javascript:alert(1)"), null);
  } finally {
    (config.server as any).defaultRedirectAllowlist = originalAllowlist;
    (config.server as any).externalUrl = originalExternal;
  }
});

test("parseCorsOrigins allows all for empty or All", () => {
  assert.equal(parseCorsOrigins("").allowAll, true);
  assert.equal(parseCorsOrigins("All").allowAll, true);
});

test("parseCorsOrigins parses comma-separated origins", () => {
  const parsed = parseCorsOrigins("https://app.example.com, https://admin.example.com");
  assert.equal(parsed.allowAll, false);
  assert.deepEqual(parsed.origins, ["https://app.example.com", "https://admin.example.com"]);
});

test("normalizeCorsOrigin handles null and invalid values", () => {
  assert.equal(normalizeCorsOrigin("null"), "null");
  assert.equal(normalizeCorsOrigin("not a url"), null);
});

test("getExternalBaseUrl supports explicit host-only values and normalizes to origin", () => {
  const original = config.server.externalUrl;
  try {
    (config.server as any).externalUrl = "cdn.example.com";
    assert.equal(getExternalBaseUrl({}), "https://cdn.example.com");

    (config.server as any).externalUrl = "https://cdn.example.com/path?q=1";
    assert.equal(getExternalBaseUrl({}), "https://cdn.example.com");
  } finally {
    (config.server as any).externalUrl = original;
  }
});

test("getExternalBaseUrl falls back safely for malformed headers", () => {
  const original = config.server.externalUrl;
  try {
    (config.server as any).externalUrl = "";

    const event = {
      node: {
        req: {
          headers: {
            "x-forwarded-proto": "ftp",
            "x-forwarded-host": "bad host value",
            host: "still bad host value",
          },
        },
      },
    };

    assert.equal(getExternalBaseUrl(event), "http://localhost");
  } finally {
    (config.server as any).externalUrl = original;
  }
});

test("getRequestUrl does not throw on malformed base or request URL", () => {
  const original = config.server.externalUrl;
  try {
    (config.server as any).externalUrl = "://bad";

    const malformedEvent = {
      path: "http://[::1",
      node: {
        req: {
          url: "http://[::1",
          headers: {
            host: "bad host value",
          },
        },
      },
    };

    const parsed = getRequestUrl(malformedEvent);
    assert.equal(parsed.origin, "http://localhost");
    assert.equal(parsed.pathname, "/");
  } finally {
    (config.server as any).externalUrl = original;
  }
});

test("parseIntegerQuery rejects mixed numeric strings", () => {
  const query = new URLSearchParams("port=25565abc&timeoutMs=3000");

  assert.equal(parseIntegerQuery({}, query, "port"), null);
  assert.equal(parseIntegerQuery({}, query, "timeoutMs"), 3000);
});

test("parseBoundedIntegerQuery enforces numeric bounds", () => {
  const query = new URLSearchParams("port=70000&timeoutMs=2500");

  assert.equal(parseBoundedIntegerQuery({}, query, "port", 1, 65_535), null);
  assert.equal(parseBoundedIntegerQuery({}, query, "timeoutMs", 100, 10_000), 2500);
});

test("validateServerProbeAddress blocks local/private targets unless explicitly allowed", async () => {
  assert.equal((await validateServerProbeAddress("localhost:25565", false)).ok, false);
  assert.equal((await validateServerProbeAddress("127.0.0.1", false)).ok, false);
  assert.equal((await validateServerProbeAddress("10.0.0.1", false)).ok, false);

  assert.equal((await validateServerProbeAddress("127.0.0.1", true)).ok, true);
  assert.equal((await validateServerProbeAddress("8.8.8.8", false)).ok, true);
});
