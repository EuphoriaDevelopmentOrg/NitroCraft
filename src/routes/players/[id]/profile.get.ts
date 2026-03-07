import { fetchPlayerProfile } from "minecraft-toolkit";
import { isValidPlayerInput, parsePlayerInput, resolvePlayerInput } from "../../../utils/player-input";
import { jsonBadRequest, jsonResponse, jsonToolkitError } from "../../../utils/toolkit";

export default defineEventHandler(async (event) => {
  const input = parsePlayerInput(String(event.context.params?.id || ""));
  if (!input || !isValidPlayerInput(input)) {
    return jsonBadRequest(event, "Invalid player input. Use UUID or username.");
  }

  try {
    const identity = await resolvePlayerInput(input);
    const profile = await fetchPlayerProfile(identity.username);
    return jsonResponse(event, profile);
  } catch (err) {
    return jsonToolkitError(event, err, "Failed to fetch player profile.");
  }
});
