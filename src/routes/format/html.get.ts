import { toHTML } from "minecraft-toolkit";
import { getQueryParams } from "../../utils/query";
import { jsonBadRequest, jsonResponse, jsonToolkitError } from "../../utils/toolkit";

function parseMode(value: string | null): "inline" | "class" | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "inline" || normalized === "class") {
    return normalized;
  }
  return undefined;
}

export default defineEventHandler((event) => {
  const query = getQueryParams(event);
  const text = query.get("text");
  if (!text) {
    return jsonBadRequest(event, "Missing required query: text.");
  }

  const mode = parseMode(query.get("mode"));
  if (query.has("mode") && !mode) {
    return jsonBadRequest(event, "Invalid mode. Use inline or class.");
  }

  const classPrefix = query.get("classPrefix") || undefined;

  try {
    const html = toHTML(text, {
      mode,
      classPrefix,
    });
    return jsonResponse(event, {
      html,
    });
  } catch (err) {
    return jsonToolkitError(event, err, "Failed to render Minecraft formatting.");
  }
});
