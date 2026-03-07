import { sendRedirect } from "h3";

function stripApiPrefix(pathname: string): string {
  if (pathname === "/api") {
    return "/";
  }
  if (pathname.startsWith("/api/")) {
    return pathname.slice(4);
  }
  return pathname;
}

export default defineEventHandler((event) => {
  const rawPath = String(event.path || "/api");
  const [pathname, query = ""] = rawPath.split("?");
  const targetPath = stripApiPrefix(pathname);
  const location = query ? `${targetPath}?${query}` : targetPath;
  return sendRedirect(event, location, 307);
});
