export function normalizeUuid(value: string): string {
  return String(value || "").replace(/-/g, "").toLowerCase();
}

export function isValidUuid(value: string): boolean {
  const normalized = normalizeUuid(value);
  return /^[0-9a-f]{32}$/.test(normalized);
}

export function defaultSkinForUuid(uuid: string): "mhf_alex" | "mhf_steve" {
  const normalized = normalizeUuid(uuid);
  const odd = parseInt(normalized[7], 16)
    ^ parseInt(normalized[15], 16)
    ^ parseInt(normalized[23], 16)
    ^ parseInt(normalized[31], 16);
  return odd ? "mhf_alex" : "mhf_steve";
}
