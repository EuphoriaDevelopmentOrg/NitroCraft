import { respond } from "../utils/response";

const DOTFILE_PROBE_PATTERNS = [
  /^\/\.env(?:[./].*)?$/i,
  /^\/\.git(?:\/.*)?$/i,
  /^\/\.svn(?:\/.*)?$/i,
  /^\/\.hg(?:\/.*)?$/i,
  /^\/\.htaccess$/i,
  /^\/\.htpasswd$/i,
  /^\/\.ds_store$/i,
];

function safeDecodePath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

export default defineEventHandler((event) => {
  const rawPath = String(event.path || event.node?.req?.url || "/").split("?")[0];
  const decodedPath = safeDecodePath(rawPath);

  // Keep ACME/WebFinger style paths available if you add them later.
  if (/^\/\.well-known(?:\/|$)/i.test(rawPath) || /^\/\.well-known(?:\/|$)/i.test(decodedPath)) {
    return;
  }

  const isProbe = DOTFILE_PROBE_PATTERNS.some((pattern) => pattern.test(rawPath) || pattern.test(decodedPath));
  if (!isProbe) {
    return;
  }

  return respond(event, {
    status: -2,
    code: 404,
    body: "Not Found",
    type: "text/plain; charset=utf-8",
    cacheControl: "no-cache, max-age=0",
  });
});
