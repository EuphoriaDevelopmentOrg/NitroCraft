import { fetchServerIcon } from "minecraft-toolkit";
import { config } from "../../config";
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
  const protocolVersion = parseBoundedIntegerQuery(event, query, "protocolVersion", 0, 1_000_000);

  if (port === null || timeoutMs === null || protocolVersion === null) {
    return jsonBadRequest(event, "Invalid numeric query value.");
  }

  try {
    const payload = await fetchServerIcon(address, {
      port,
      timeoutMs: timeoutMs ?? config.server.httpTimeout,
      protocolVersion,
    });

    return jsonResponse(event, {
      host: payload.host,
      port: payload.port,
      dataUri: payload.dataUri,
      base64: payload.base64,
      byteLength: payload.byteLength,
    });
  } catch (err) {
    return jsonToolkitError(event, err, "Failed to fetch Java server icon.");
  }
});
