import { getCape } from "../../services/player";
import { sanitizeDefaultRedirect } from "../../utils/default-redirect";
import { isValidUuid, normalizeUuid } from "../../utils/player";
import { badRequest, respond } from "../../utils/response";
import { getRequestUrl } from "../../utils/request";
import { getQueryParams } from "../../utils/query";

export default defineEventHandler(async (event) => {
  const rawParam = String(event.context.params?.id || "").split(".")[0];
  const userId = normalizeUuid(rawParam);
  if (!isValidUuid(userId)) {
    return respond(event, badRequest("Invalid UUID"));
  }

  const query = getQueryParams(event);
  const providedDefault = query.get("default");

  const image = await getCape(userId);
  if (image.buffer) {
    return respond(event, {
      status: image.status,
      body: image.buffer,
      type: "image/png",
      hash: image.hash,
      err: image.err,
    });
  }

  if (!providedDefault) {
    return respond(event, {
      status: image.status,
      body: null,
      err: image.err,
    });
  }

  if (isValidUuid(providedDefault)) {
    const url = getRequestUrl(event);
    url.pathname = `/capes/${normalizeUuid(providedDefault)}`;
    url.searchParams.delete("default");
    return respond(event, {
      status: image.status,
      redirect: url.toString(),
      err: image.err,
    });
  }

  const safeRedirect = sanitizeDefaultRedirect(providedDefault);
  if (!safeRedirect) {
    return respond(event, {
      status: -2,
      body: "Invalid Default",
      code: 422,
      err: image.err,
    });
  }

  return respond(event, {
    status: image.status,
    redirect: safeRedirect,
    err: image.err,
  });
});
