import { fetchBedrockServerStatus } from "minecraft-toolkit";
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

  if (port === null || timeoutMs === null) {
    return jsonBadRequest(event, "Invalid numeric query value.");
  }

  try {
    const payload = await fetchBedrockServerStatus(address, {
      port,
      timeoutMs: timeoutMs ?? config.server.httpTimeout,
    });
    return jsonResponse(event, payload);
  } catch (err) {
    return jsonToolkitError(event, err, "Failed to probe Bedrock server status.");
  }
});
