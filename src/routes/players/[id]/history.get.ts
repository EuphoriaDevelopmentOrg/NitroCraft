import { fetchNameHistory } from "minecraft-toolkit";
import { isValidPlayerInput, parsePlayerInput, resolvePlayerInput } from "../../../utils/player-input";
import { jsonBadRequest, jsonResponse, jsonToolkitError } from "../../../utils/toolkit";

export default defineEventHandler(async (event) => {
  const input = parsePlayerInput(String(event.context.params?.id || ""));
  if (!input || !isValidPlayerInput(input)) {
    return jsonBadRequest(event, "Invalid player input. Use UUID or username.");
  }

  try {
    const identity = await resolvePlayerInput(input);
    const history = await fetchNameHistory(identity.uuid);

    return jsonResponse(event, {
      input,
      id: identity.uuid,
      name: identity.username,
      history: history.map((entry) => ({
        name: entry.name,
        changedAt: entry.changedAt ? entry.changedAt.toISOString() : null,
      })),
    });
  } catch (err) {
    return jsonToolkitError(event, err, "Failed to fetch name history.");
  }
});
