import { fetchBedrockServerStatus } from "minecraft-toolkit";
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

  const port = parseBoundedIntegerQuery(event, query, "port", 1, 65_535);
  const timeoutMs = parseBoundedIntegerQuery(event, query, "timeoutMs", 100, 10_000);

  if (port === null || timeoutMs === null) {
    return jsonBadRequest(event, "Invalid numeric query value.");
  }

  try {
    const resolvedTimeoutMs = timeoutMs ?? config.server.httpTimeout;
    const payload = await withStatusProbeCache(
      "bedrock",
      statusProbeCacheKey("bedrock", [address, port, resolvedTimeoutMs]),
      () => fetchBedrockServerStatus(address, {
        port,
        timeoutMs: resolvedTimeoutMs,
      }),
    );
    return jsonResponse(event, payload);
  } catch (err) {
    return jsonToolkitError(event, err, "Failed to probe Bedrock server status.");
  }
});
