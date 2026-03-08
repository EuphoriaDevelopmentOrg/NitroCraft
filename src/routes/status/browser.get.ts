import { fetchServerStatus } from "minecraft-toolkit";
import type { ServerEdition, ServerStatus } from "minecraft-toolkit";
import { config } from "../../config";
import { statusProbeCacheKey, withStatusProbeCache } from "../../services/status-probe-cache";
import { validateServerProbeAddress } from "../../utils/network-safety";
import { getQueryParams } from "../../utils/query";
import { jsonBadRequest, jsonResponse, parseBoundedIntegerQuery } from "../../utils/toolkit";

type BrowserProbeResult = {
  address: string;
  ok: boolean;
  status?: ServerStatus;
  error?: string;
  statusCode?: number;
};

type BrowserSourceResult = {
  id: string;
  label: string;
  ok: boolean;
  count: number;
  addresses: string[];
  error?: string;
  statusCode?: number;
};

type ToolkitLikeError = {
  statusCode?: unknown;
  message?: unknown;
};

const MAX_CONCURRENCY_HARD_LIMIT = 16;
const MAX_ADDRESSES_HARD_LIMIT = 100;
const MAX_SOURCE_ADDRESSES_HARD_LIMIT = 5000;
const SOURCE_COLLECTION_KEYS = ["servers", "data", "results", "list", "items"] as const;
const SOURCE_ADDRESS_KEYS = ["address", "host", "hostname", "ip", "domain", "server", "serverAddress", "serverIp"] as const;

type ConfiguredBrowserSource = (typeof config.server.statusBrowserSources)[number];

function clampInt(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.floor(value);
  if (rounded < min) {
    return min;
  }
  if (rounded > max) {
    return max;
  }
  return rounded;
}

function parseEdition(query: URLSearchParams): ServerEdition | undefined {
  const raw = String(query.get("edition") || query.get("type") || "").trim().toLowerCase();
  if (!raw) {
    return undefined;
  }
  if (raw === "auto" || raw === "java" || raw === "bedrock") {
    return raw;
  }
  return undefined;
}

function splitAddressChunk(value: string): string[] {
  return String(value || "")
    .replaceAll("\r", "\n")
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function splitSourceChunk(value: string): string[] {
  return String(value || "")
    .replaceAll("\r", "\n")
    .split(/[\n,\s]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function dedupeAddresses(addresses: string[]): string[] {
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const address of addresses) {
    const key = address.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(address);
  }
  return deduped;
}

function parseDirectAddresses(query: URLSearchParams): string[] {
  const collected: string[] = [];
  const pushChunk = (input: string): void => {
    for (const entry of splitAddressChunk(input)) {
      collected.push(entry);
    }
  };

  for (const value of query.getAll("address")) {
    pushChunk(value);
  }
  for (const value of query.getAll("addresses")) {
    pushChunk(value);
  }

  const host = String(query.get("host") || "").trim();
  if (host) {
    pushChunk(host);
  }

  return dedupeAddresses(collected);
}

function parseSourceIds(query: URLSearchParams): string[] {
  const ids: string[] = [];
  const pushChunk = (input: string): void => {
    for (const entry of splitSourceChunk(input)) {
      ids.push(entry);
    }
  };

  for (const value of query.getAll("source")) {
    pushChunk(value);
  }
  for (const value of query.getAll("sources")) {
    pushChunk(value);
  }

  return Array.from(new Set(ids));
}

function resolveRequestedSources(
  query: URLSearchParams,
  configuredSources: ConfiguredBrowserSource[],
): { selected: ConfiguredBrowserSource[]; requested: string[]; error?: string } {
  const requested = parseSourceIds(query);
  if (!requested.length) {
    return {
      selected: [],
      requested: [],
    };
  }

  if (requested.includes("all")) {
    return {
      selected: [...configuredSources],
      requested,
    };
  }

  const sourceMap = new Map(configuredSources.map((source) => [source.id, source]));
  const selected: ConfiguredBrowserSource[] = [];
  const missing: string[] = [];
  for (const id of requested) {
    const source = sourceMap.get(id);
    if (!source) {
      missing.push(id);
      continue;
    }
    selected.push(source);
  }

  if (missing.length) {
    const available = configuredSources.map((source) => source.id);
    const availableText = available.length
      ? ` Available sources: ${available.join(", ")}.`
      : " No status-browser sources are configured.";
    return {
      selected: [],
      requested,
      error: `Unknown source id(s): ${missing.join(", ")}.${availableText}`,
    };
  }

  return {
    selected,
    requested,
  };
}

function toolkitStatusCode(err: unknown): number | undefined {
  if (!err || typeof err !== "object") {
    return undefined;
  }
  const value = (err as ToolkitLikeError).statusCode;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return undefined;
  }
  if (value < 100 || value > 599) {
    return undefined;
  }
  return value;
}

function toolkitMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") {
    return fallback;
  }
  const value = (err as ToolkitLikeError).message;
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = Array.from({ length: items.length }) as R[];
  let cursor = 0;

  const run = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  };

  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  const workers = Array.from({ length: workerCount }, () => run());
  await Promise.all(workers);
  return results;
}

function normalizeSourceAddressCandidate(value: string): string | null {
  let candidate = String(value || "").trim();
  if (!candidate) {
    return null;
  }

  candidate = candidate.replace(/^["'`]+|["'`]+$/g, "").trim();
  candidate = candidate.replace(/^[-*]+\s*/, "");
  if (!candidate) {
    return null;
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    try {
      candidate = new URL(candidate).host;
    } catch {
      return null;
    }
  }

  const firstToken = candidate.split(/\s+/)[0] || "";
  candidate = firstToken.replace(/[;,]+$/g, "").trim();
  if (!candidate || candidate.length > 255) {
    return null;
  }
  if (candidate.includes("/") || candidate.includes("?") || candidate.includes("#") || candidate.includes("@")) {
    return null;
  }

  return candidate;
}

function pushSourceAddress(
  target: string[],
  seen: Set<string>,
  value: string,
  maxAddresses: number,
  port?: unknown,
): void {
  if (target.length >= maxAddresses) {
    return;
  }

  let candidate = normalizeSourceAddressCandidate(value);
  if (!candidate) {
    return;
  }

  const parsedPort = typeof port === "number"
    ? port
    : (typeof port === "string" ? Number.parseInt(port, 10) : Number.NaN);

  if (
    Number.isInteger(parsedPort)
    && parsedPort >= 1
    && parsedPort <= 65_535
    && !candidate.includes(":")
    && !candidate.includes("]")
  ) {
    candidate = `${candidate}:${parsedPort}`;
  }

  const key = candidate.toLowerCase();
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  target.push(candidate);
}

function extractSourceAddressesFromJson(payload: unknown, maxAddresses: number): string[] {
  const addresses: string[] = [];
  const seen = new Set<string>();

  const visit = (node: unknown, depth: number): void => {
    if (depth > 7 || addresses.length >= maxAddresses || node === null || node === undefined) {
      return;
    }

    if (typeof node === "string") {
      for (const chunk of splitAddressChunk(node)) {
        pushSourceAddress(addresses, seen, chunk, maxAddresses);
      }
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item, depth + 1);
        if (addresses.length >= maxAddresses) {
          break;
        }
      }
      return;
    }

    if (typeof node !== "object") {
      return;
    }

    const record = node as Record<string, unknown>;
    for (const key of SOURCE_ADDRESS_KEYS) {
      const raw = record[key];
      if (typeof raw === "string") {
        pushSourceAddress(addresses, seen, raw, maxAddresses, record.port);
      }
    }

    let visitedCollection = false;
    for (const key of SOURCE_COLLECTION_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) {
        continue;
      }
      visitedCollection = true;
      visit(record[key], depth + 1);
    }

    if (!visitedCollection) {
      for (const value of Object.values(record)) {
        if (Array.isArray(value)) {
          visit(value, depth + 1);
        }
      }
    }
  };

  visit(payload, 0);
  return addresses;
}

function extractSourceAddressesFromText(input: string, maxAddresses: number): string[] {
  const addresses: string[] = [];
  const seen = new Set<string>();
  for (const chunk of splitAddressChunk(input)) {
    pushSourceAddress(addresses, seen, chunk, maxAddresses);
    if (addresses.length >= maxAddresses) {
      break;
    }
  }
  return addresses;
}

async function fetchSourceAddresses(
  source: ConfiguredBrowserSource,
  timeoutMs: number,
  maxAddresses: number,
): Promise<BrowserSourceResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
      },
    });

    if (!response.ok) {
      return {
        id: source.id,
        label: source.label,
        ok: false,
        count: 0,
        addresses: [],
        statusCode: response.status,
        error: `Source responded with HTTP ${response.status}.`,
      };
    }

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    let addresses: string[] = [];

    if (contentType.includes("application/json")) {
      const payload = await response.json();
      addresses = extractSourceAddressesFromJson(payload, maxAddresses);
    } else {
      const text = await response.text();
      const trimmed = text.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          addresses = extractSourceAddressesFromJson(JSON.parse(trimmed), maxAddresses);
        } catch {
          addresses = extractSourceAddressesFromText(text, maxAddresses);
        }
      } else {
        addresses = extractSourceAddressesFromText(text, maxAddresses);
      }
    }

    return {
      id: source.id,
      label: source.label,
      ok: true,
      count: addresses.length,
      addresses,
    };
  } catch (err) {
    return {
      id: source.id,
      label: source.label,
      ok: false,
      count: 0,
      addresses: [],
      statusCode: toolkitStatusCode(err) || 502,
      error: toolkitMessage(err, `Failed to fetch source ${source.id}.`),
    };
  } finally {
    clearTimeout(timer);
  }
}

type ProbeOptions = {
  edition: ServerEdition;
  port?: number;
  timeoutMs: number;
  protocolVersion?: number;
  allowPrivateTargets: boolean;
};

async function probeAddress(address: string, options: ProbeOptions): Promise<BrowserProbeResult> {
  const targetValidation = await validateServerProbeAddress(address, options.allowPrivateTargets);
  if (!targetValidation.ok) {
    return {
      address,
      ok: false,
      error: targetValidation.reason,
      statusCode: 422,
    };
  }

  try {
    const status = await withStatusProbeCache(
      "browser",
      statusProbeCacheKey("browser", [
        address,
        options.edition,
        options.port,
        options.timeoutMs,
        options.protocolVersion,
      ]),
      () => fetchServerStatus(address, {
        edition: options.edition,
        port: options.port,
        timeoutMs: options.timeoutMs,
        protocolVersion: options.protocolVersion,
      }),
    );

    return {
      address,
      ok: true,
      status,
    };
  } catch (err) {
    const statusCode = toolkitStatusCode(err) || 502;
    return {
      address,
      ok: false,
      error: toolkitMessage(err, "Failed to probe server status."),
      statusCode,
    };
  }
}

export default defineEventHandler(async (event) => {
  const query = getQueryParams(event);
  const edition = parseEdition(query);
  if ((query.has("edition") || query.has("type")) && !edition) {
    return jsonBadRequest(event, "Invalid edition/type. Use java, bedrock, or auto.");
  }

  const maxAddresses = clampInt(
    config.server.statusBrowserMaxAddresses,
    20,
    1,
    MAX_ADDRESSES_HARD_LIMIT,
  );
  const maxConcurrency = clampInt(
    config.server.statusBrowserMaxConcurrency,
    4,
    1,
    MAX_CONCURRENCY_HARD_LIMIT,
  );

  const limit = parseBoundedIntegerQuery(event, query, "limit", 1, maxAddresses);
  const timeoutMs = parseBoundedIntegerQuery(event, query, "timeoutMs", 100, 10_000);
  const port = parseBoundedIntegerQuery(event, query, "port", 1, 65_535);
  const protocolVersion = parseBoundedIntegerQuery(event, query, "protocolVersion", 0, 1_000_000);
  const concurrency = parseBoundedIntegerQuery(event, query, "concurrency", 1, maxConcurrency);

  if (limit === null || timeoutMs === null || port === null || protocolVersion === null || concurrency === null) {
    return jsonBadRequest(event, "Invalid numeric query value.");
  }

  const directAddresses = parseDirectAddresses(query);
  if (directAddresses.length > maxAddresses) {
    return jsonBadRequest(event, `Too many server targets. Maximum is ${maxAddresses}.`);
  }

  const sourceSelection = resolveRequestedSources(query, config.server.statusBrowserSources);
  if (sourceSelection.error) {
    return jsonBadRequest(event, sourceSelection.error);
  }

  const resolvedTimeoutMs = timeoutMs ?? config.server.httpTimeout;
  const sourceTimeoutMs = clampInt(
    config.server.statusBrowserSourceTimeoutMs,
    resolvedTimeoutMs,
    200,
    20_000,
  );
  const maxSourceAddresses = clampInt(
    config.server.statusBrowserMaxSourceAddresses,
    maxAddresses,
    1,
    MAX_SOURCE_ADDRESSES_HARD_LIMIT,
  );

  const selectedSources = sourceSelection.selected;
  const sourceResults = selectedSources.length
    ? await mapWithConcurrency(
      selectedSources,
      Math.min(selectedSources.length, maxConcurrency),
      (source) => fetchSourceAddresses(source, sourceTimeoutMs, maxSourceAddresses),
    )
    : [];

  const sourceAddresses = sourceResults
    .filter((entry) => entry.ok)
    .flatMap((entry) => entry.addresses);

  const mergedCandidates = dedupeAddresses([...directAddresses, ...sourceAddresses]);
  if (!mergedCandidates.length) {
    return jsonBadRequest(
      event,
      "Missing server targets. Provide address=host (repeatable), addresses=host1,host2, or source=provider-id.",
    );
  }

  const truncatedCandidates = Math.max(0, mergedCandidates.length - maxAddresses);
  const boundedCandidates = mergedCandidates.slice(0, maxAddresses);

  const resolvedLimit = limit ?? boundedCandidates.length;
  const targets = boundedCandidates.slice(0, resolvedLimit);
  const resolvedConcurrency = concurrency ?? maxConcurrency;
  const resolvedEdition = edition || "auto";

  const results = await mapWithConcurrency(targets, resolvedConcurrency, (address) => probeAddress(address, {
    edition: resolvedEdition,
    port: port === undefined ? undefined : port,
    timeoutMs: resolvedTimeoutMs,
    protocolVersion: protocolVersion === undefined ? undefined : protocolVersion,
    allowPrivateTargets: config.server.allowPrivateStatusTargets,
  }));

  const succeeded = results.filter((entry) => entry.ok).length;
  const failed = results.length - succeeded;

  return jsonResponse(event, {
    directCandidates: directAddresses.length,
    sourceCandidates: sourceAddresses.length,
    totalCandidates: mergedCandidates.length,
    truncatedCandidates,
    processed: results.length,
    succeeded,
    failed,
    edition: resolvedEdition,
    timeoutMs: resolvedTimeoutMs,
    concurrency: resolvedConcurrency,
    limit: resolvedLimit,
    maxAddresses,
    maxConcurrency,
    sources: {
      requested: sourceSelection.requested,
      selected: selectedSources.map((source) => source.id),
      total: sourceResults.length,
      succeeded: sourceResults.filter((entry) => entry.ok).length,
      failed: sourceResults.filter((entry) => !entry.ok).length,
      details: sourceResults.map((entry) => ({
        id: entry.id,
        label: entry.label,
        ok: entry.ok,
        count: entry.count,
        error: entry.error,
        statusCode: entry.statusCode,
      })),
    },
    generatedAt: new Date().toISOString(),
    results,
  });
});
