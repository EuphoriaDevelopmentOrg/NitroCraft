import { fetchServerStatus } from "minecraft-toolkit";
import { config } from "../../config";
import { statusProbeCacheKey, withStatusProbeCache } from "../../services/status-probe-cache";
import { getQueryParams } from "../../utils/query";
import { validateServerProbeAddress } from "../../utils/network-safety";
import {
  parseBoundedIntegerQuery,
  jsonBadRequest,
  jsonResponse,
  jsonToolkitError,
} from "../../utils/toolkit";

function serverAddress(query: URLSearchParams): string {
  return String(query.get("address") || query.get("host") || "").trim();
}

function parseEdition(query: URLSearchParams): "java" | "bedrock" | "auto" | undefined {
  const raw = String(query.get("edition") || query.get("type") || "").trim().toLowerCase();
  if (!raw) {
    return undefined;
  }
  if (raw === "java" || raw === "bedrock" || raw === "auto") {
    return raw;
  }
  return undefined;
}

export default defineEventHandler(async (event) => {
  const query = getQueryParams(event);
  const address = serverAddress(query);
  if (!address) {
    return jsonBadRequest(event, "Missing required query: address (or host).");
  }
  const targetValidation = await validateServerProbeAddress(address, config.server.allowPrivateStatusTargets);
  if (!targetValidation.ok) {
    return jsonBadRequest(event, targetValidation.reason);
  }

  const edition = parseEdition(query);
  if ((query.has("edition") || query.has("type")) && !edition) {
    return jsonBadRequest(event, "Invalid edition/type. Use java, bedrock, or auto.");
  }

  const port = parseBoundedIntegerQuery(event, query, "port", 1, 65_535);
  const timeoutMs = parseBoundedIntegerQuery(event, query, "timeoutMs", 100, 10_000);
  const protocolVersion = parseBoundedIntegerQuery(event, query, "protocolVersion", 0, 1_000_000);

  if (port === null || timeoutMs === null || protocolVersion === null) {
    return jsonBadRequest(event, "Invalid numeric query value.");
  }

  try {
    const resolvedTimeoutMs = timeoutMs ?? config.server.httpTimeout;
    const payload = await withStatusProbeCache(
      "server",
      statusProbeCacheKey("server", [
        address,
        edition || "auto",
        port,
        resolvedTimeoutMs,
        protocolVersion,
      ]),
      () => fetchServerStatus(address, {
        edition,
        port,
        timeoutMs: resolvedTimeoutMs,
        protocolVersion,
      }),
    );
    return jsonResponse(event, payload);
  } catch (err) {
    return jsonToolkitError(event, err, "Failed to probe server status.");
  }
});
