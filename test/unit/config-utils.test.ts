import test from "node:test";
import assert from "node:assert/strict";

import { defaultSkinForUuid, normalizeUuid, isValidUuid } from "../../src/utils/player";
import { sanitizeDefaultRedirect } from "../../src/utils/default-redirect";
import { normalizeCorsOrigin, parseCorsOrigins } from "../../src/utils/cors";

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

test("sanitizeDefaultRedirect allows only http/https", () => {
  assert.equal(sanitizeDefaultRedirect("https://example.com/path"), "https://example.com/path");
  assert.equal(sanitizeDefaultRedirect("javascript:alert(1)"), null);
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
