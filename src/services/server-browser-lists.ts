import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type ServerBrowserDataset = "java" | "bedrock";

type ServerListRecord = {
  ipAddress?: unknown;
  address?: unknown;
  host?: unknown;
  hostname?: unknown;
  server?: unknown;
  ip?: unknown;
  port?: unknown;
};

const DATASET_FILENAMES: Record<ServerBrowserDataset, string> = {
  java: "java.json",
  bedrock: "bedrock.json",
};

const datasetCache = new Map<ServerBrowserDataset, Promise<string[]>>();

function normalizeAddressCandidate(value: unknown): string | null {
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

function withPort(address: string, port: unknown): string {
  if (!address || address.includes(":") || address.includes("]")) {
    return address;
  }

  const parsedPort = typeof port === "number"
    ? port
    : (typeof port === "string" ? Number.parseInt(port, 10) : Number.NaN);
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
    return address;
  }

  return `${address}:${parsedPort}`;
}

function pushUniqueAddress(target: string[], seen: Set<string>, value: unknown, port?: unknown): void {
  const normalized = normalizeAddressCandidate(value);
  if (!normalized) {
    return;
  }

  const address = withPort(normalized, port);
  const key = address.toLowerCase();
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  target.push(address);
}

function extractAddresses(payload: unknown): string[] {
  const addresses: string[] = [];
  const seen = new Set<string>();

  if (!Array.isArray(payload)) {
    return addresses;
  }

  for (const entry of payload) {
    if (typeof entry === "string") {
      pushUniqueAddress(addresses, seen, entry);
      continue;
    }

    if (!entry || typeof entry !== "object") {
      continue;
    }

    const record = entry as ServerListRecord;
    const candidate = record.ipAddress ?? record.address ?? record.host ?? record.hostname ?? record.server ?? record.ip;
    pushUniqueAddress(addresses, seen, candidate, record.port);
  }

  return addresses;
}

async function readDatasetFile(dataset: ServerBrowserDataset): Promise<string> {
  const filename = DATASET_FILENAMES[dataset];
  const cwd = process.cwd();
  const knownRuntimeRoots = [
    "/home/container",
    "/home/app/nitrocraft",
  ];
  const knownRuntimeCandidates = knownRuntimeRoots.flatMap((root) => [
    resolve(root, filename),
    resolve(root, ".output", filename),
    resolve(root, ".output", "server", filename),
  ]);
  const candidates = [
    ...knownRuntimeCandidates,
    resolve(cwd, filename),
    resolve(cwd, "..", filename),
    resolve(cwd, "..", "..", filename),
    resolve(cwd, ".output", filename),
    resolve(cwd, ".output", "server", filename),
  ];
  const deduped = Array.from(new Set(candidates));

  for (const path of deduped) {
    try {
      return await readFile(path, "utf8");
    } catch {
      // Keep trying fallback locations.
    }
  }

  throw new Error(`Server-browser dataset not found: ${filename}`);
}

async function loadDataset(dataset: ServerBrowserDataset): Promise<string[]> {
  const raw = await readDatasetFile(dataset);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Server-browser dataset is invalid JSON: ${DATASET_FILENAMES[dataset]}`);
  }

  return extractAddresses(parsed);
}

export async function getServerBrowserDatasetAddresses(dataset: ServerBrowserDataset): Promise<string[]> {
  const cached = datasetCache.get(dataset);
  if (cached) {
    return cached;
  }

  const loader = loadDataset(dataset);
  datasetCache.set(dataset, loader);
  try {
    return await loader;
  } catch (err) {
    datasetCache.delete(dataset);
    throw err;
  }
}
