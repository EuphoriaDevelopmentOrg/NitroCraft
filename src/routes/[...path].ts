import { respond } from "../utils/response";

export default defineEventHandler((event) => {
  return respond(event, {
    status: -2,
    code: 404,
    body: "Not Found",
    type: "text/plain; charset=utf-8",
    cacheControl: "no-cache, max-age=0",
  });
});
