import { fetchSkinMetadata } from "minecraft-toolkit";
import { getQueryParams } from "../../../utils/query";
import { isValidPlayerInput, parsePlayerInput, resolvePlayerInput } from "../../../utils/player-input";
import {
  jsonBadRequest,
  jsonResponse,
  jsonToolkitError,
  parseIntegerQuery,
} from "../../../utils/toolkit";

function parseBoolean(value: string | null): boolean | undefined {
  if (value === null || value === "") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true") {
    return true;
  }
  if (normalized === "0" || normalized === "false") {
    return false;
  }
  return undefined;
}

export default defineEventHandler(async (event) => {
  const input = parsePlayerInput(String(event.context.params?.id || ""));
  if (!input || !isValidPlayerInput(input)) {
    return jsonBadRequest(event, "Invalid player input. Use UUID or username.");
  }

  const query = getQueryParams(event);
  const dominantColor = parseBoolean(query.get("dominantColor"));

  const x = parseIntegerQuery(event, query, "x");
  const y = parseIntegerQuery(event, query, "y");
  const width = parseIntegerQuery(event, query, "width");
  const height = parseIntegerQuery(event, query, "height");

  if (x === null || y === null || width === null || height === null) {
    return jsonBadRequest(event, "Invalid sample region parameters.");
  }

  if ((width !== undefined && width <= 0) || (height !== undefined && height <= 0)) {
    return jsonBadRequest(event, "Sample width and height must be positive integers.");
  }

  try {
    const identity = await resolvePlayerInput(input);
    const payload = await fetchSkinMetadata(identity.username, {
      dominantColor,
      sampleRegion: x !== undefined || y !== undefined || width !== undefined || height !== undefined
        ? { x, y, width, height }
        : undefined,
    });
    return jsonResponse(event, payload);
  } catch (err) {
    return jsonToolkitError(event, err, "Failed to fetch skin metadata.");
  }
});
