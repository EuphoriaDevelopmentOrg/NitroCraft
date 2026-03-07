import { fetchServerIcon } from "minecraft-toolkit";
import { config } from "../../config";
import { getQueryParams } from "../../utils/query";
import {
  jsonBadRequest,
  jsonResponse,
  jsonToolkitError,
  parseIntegerQuery,
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

  const port = parseIntegerQuery(event, query, "port");
  const timeoutMs = parseIntegerQuery(event, query, "timeoutMs");
  const protocolVersion = parseIntegerQuery(event, query, "protocolVersion");

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
