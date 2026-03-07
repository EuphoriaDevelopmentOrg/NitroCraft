import { sendRedirect } from "h3";

export default defineEventHandler((event) => {
  const rawPath = String(event.path || "/api");
  const queryIndex = rawPath.indexOf("?");
  const query = queryIndex >= 0 ? rawPath.slice(queryIndex + 1) : "";
  const location = query ? `/?${query}` : "/";
  return sendRedirect(event, location, 307);
});
