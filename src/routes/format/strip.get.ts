import { hasCodes, stripCodes } from "minecraft-toolkit";
import { getQueryParams } from "../../utils/query";
import { jsonBadRequest, jsonResponse, jsonToolkitError } from "../../utils/toolkit";

export default defineEventHandler((event) => {
  const query = getQueryParams(event);
  const text = query.get("text");
  if (!text) {
    return jsonBadRequest(event, "Missing required query: text.");
  }

  try {
    return jsonResponse(event, {
      text: stripCodes(text),
      hadCodes: hasCodes(text),
    });
  } catch (err) {
    return jsonToolkitError(event, err, "Failed to strip formatting codes.");
  }
});
