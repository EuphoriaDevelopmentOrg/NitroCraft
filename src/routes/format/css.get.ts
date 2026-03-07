import { generateCSS } from "minecraft-toolkit";
import { respond } from "../../utils/response";

export default defineEventHandler((event) => {
  const css = generateCSS();
  return respond(event, {
    status: 1,
    body: css,
    type: "text/css; charset=utf-8",
    cacheControl: "no-cache, max-age=0",
  });
});
