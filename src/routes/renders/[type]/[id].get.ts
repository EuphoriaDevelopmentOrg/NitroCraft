import { createRenderHandler } from "../../../utils/render-route";
import { respond } from "../../../utils/response";

const headHandler = createRenderHandler(false);
const bodyHandler = createRenderHandler(true);

export default defineEventHandler((event) => {
  const type = String(event.context.params?.type || "").toLowerCase();
  if (type === "head") {
    return headHandler(event);
  }
  if (type === "body") {
    return bodyHandler(event);
  }

  return respond(event, {
    status: -2,
    body: "Invalid Render Type",
    code: 422,
  });
});
