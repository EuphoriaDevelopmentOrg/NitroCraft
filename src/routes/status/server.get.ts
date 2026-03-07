import { fetchServerStatus } from "minecraft-toolkit";
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

  const edition = parseEdition(query);
  if ((query.has("edition") || query.has("type")) && !edition) {
    return jsonBadRequest(event, "Invalid edition/type. Use java, bedrock, or auto.");
  }

  const port = parseIntegerQuery(event, query, "port");
  const timeoutMs = parseIntegerQuery(event, query, "timeoutMs");
  const protocolVersion = parseIntegerQuery(event, query, "protocolVersion");

  if (port === null || timeoutMs === null || protocolVersion === null) {
    return jsonBadRequest(event, "Invalid numeric query value.");
  }

  try {
    const payload = await fetchServerStatus(address, {
      edition,
      port,
      timeoutMs: timeoutMs ?? config.server.httpTimeout,
      protocolVersion,
    });
    return jsonResponse(event, payload);
  } catch (err) {
    return jsonToolkitError(event, err, "Failed to probe server status.");
  }
});
