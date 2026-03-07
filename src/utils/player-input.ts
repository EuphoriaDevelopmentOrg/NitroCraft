import {
  fetchPlayerUUID,
  fetchUsernameByUUID,
  isValidUsername,
} from "minecraft-toolkit";
import { isValidUuid, normalizeUuid } from "./player";

type PlayerInputResolution = {
  input: string;
  uuid: string;
  username: string;
};

function cleanInput(raw: string): string {
  return raw.split(".")[0].trim();
}

export function parsePlayerInput(value: string): string {
  return cleanInput(value);
}

export function isValidPlayerInput(value: string): boolean {
  return isValidUuid(value) || isValidUsername(value);
}

export async function resolvePlayerInput(raw: string): Promise<PlayerInputResolution> {
  const input = cleanInput(raw);

  if (isValidUuid(input)) {
    const normalized = normalizeUuid(input);
    const lookup = await fetchUsernameByUUID(normalized);
    return {
      input,
      uuid: normalized,
      username: lookup.name,
    };
  }

  const lookup = await fetchPlayerUUID(input);
  return {
    input,
    uuid: normalizeUuid(lookup.id),
    username: lookup.name,
  };
}
