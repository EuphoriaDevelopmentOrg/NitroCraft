export function sanitizeDefaultRedirect(defaultUrl: string | null): string | null {
  if (!defaultUrl || typeof defaultUrl !== "string") {
    return null;
  }

  if (defaultUrl.length > 2048) {
    return null;
  }

  try {
    const parsed = new URL(defaultUrl);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}
