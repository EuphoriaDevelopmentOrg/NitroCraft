import { resolvePlayer } from "minecraft-toolkit";
import { isValidPlayerInput, parsePlayerInput, resolvePlayerInput } from "../../utils/player-input";
import { jsonBadRequest, jsonResponse, jsonToolkitError } from "../../utils/toolkit";

export default defineEventHandler(async (event) => {
  const input = parsePlayerInput(String(event.context.params?.id || ""));
  if (!input || !isValidPlayerInput(input)) {
    return jsonBadRequest(event, "Invalid player input. Use UUID or username.");
  }

  try {
    const [resolved, identity] = await Promise.all([
      resolvePlayer(input),
      resolvePlayerInput(input),
    ]);

    return jsonResponse(event, {
      input,
      id: identity.uuid,
      name: identity.username,
      skin: resolved.skin,
      cape: resolved.cape,
    });
  } catch (err) {
    return jsonToolkitError(event, err, "Failed to resolve player.");
  }
});
