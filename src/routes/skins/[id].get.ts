import { getSkin } from "../../services/player";
import { openImage } from "../../services/images";
import { sanitizeDefaultRedirect } from "../../utils/default-redirect";
import { defaultSkinForUuid, isValidUuid, normalizeUuid } from "../../utils/player";
import { defaultSkinPath } from "../../utils/paths";
import { badRequest, respond } from "../../utils/response";
import { getRequestUrl } from "../../utils/request";
import { getQueryParams } from "../../utils/query";

function resolveDefaultName(value: string): "mhf_alex" | "mhf_steve" | null {
  const normalized = value.toLowerCase();
  if (normalized === "alex" || normalized === "mhf_alex") {
    return "mhf_alex";
  }
  if (normalized === "steve" || normalized === "mhf_steve") {
    return "mhf_steve";
  }
  return null;
}

export default defineEventHandler(async (event) => {
  const rawParam = String(event.context.params?.id || "").split(".")[0];
  const userId = normalizeUuid(rawParam);
  if (!isValidUuid(userId)) {
    return respond(event, badRequest("Invalid UUID"));
  }

  const query = getQueryParams(event);
  const providedDefault = query.get("default");

  const image = await getSkin(userId);
  if (image.buffer) {
    return respond(event, {
      status: image.status,
      body: image.buffer,
      type: "image/png",
      hash: image.hash,
      err: image.err,
    });
  }

  const fallback = providedDefault || defaultSkinForUuid(userId);
  const defaultSkin = resolveDefaultName(fallback);

  if (defaultSkin) {
    const body = await openImage(await defaultSkinPath(defaultSkin));
    return respond(event, {
      status: image.status,
      body,
      type: "image/png",
      hash: defaultSkin,
      err: image.err,
    });
  }

  if (isValidUuid(fallback)) {
    const url = getRequestUrl(event);
    url.pathname = `/skins/${normalizeUuid(fallback)}`;
    url.searchParams.delete("default");
    return respond(event, {
      status: image.status,
      redirect: url.toString(),
      err: image.err,
    });
  }

  const safeRedirect = sanitizeDefaultRedirect(fallback);
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
