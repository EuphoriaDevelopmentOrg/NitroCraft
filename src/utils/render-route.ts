import { config } from "../config";
import { getRender } from "../services/player";
import { drawModel } from "../services/renders";
import { openImage } from "../services/images";
import { defaultSkinPath } from "./paths";
import { sanitizeDefaultRedirect } from "./default-redirect";
import { defaultSkinForUuid, isValidUuid, normalizeUuid } from "./player";
import { badRequest, respond } from "./response";
import { getRequestUrl } from "./request";
import { getQueryParams } from "./query";

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

export function createRenderHandler(body: boolean) {
  return defineEventHandler(async (event) => {
    const rawParam = String(event.context.params?.id || "").split(".")[0];
    const userId = normalizeUuid(rawParam);
    if (!isValidUuid(userId)) {
      return respond(event, badRequest("Invalid UUID"));
    }

    const query = getQueryParams(event);
    const scale = Number.parseInt(query.get("scale") || "", 10) || config.renders.defaultScale;
    const overlay = query.has("overlay") || query.has("helm");
    const providedDefault = query.get("default");

    if (scale < config.renders.minScale || scale > config.renders.maxScale) {
      return respond(event, badRequest("Invalid Scale"));
    }

    const image = await getRender(userId, scale, overlay, body);
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
      const buffer = await openImage(await defaultSkinPath(defaultSkin));
      const rendered = await drawModel(
        buffer,
        scale,
        overlay,
        body,
        defaultSkin === "mhf_alex",
      );
      return respond(event, {
        status: image.status,
        body: rendered,
        type: "image/png",
        hash: defaultSkin,
        err: image.err,
      });
    }

    if (isValidUuid(fallback)) {
      const url = getRequestUrl(event);
      const section = body ? "body" : "head";
      url.pathname = `/renders/${section}/${normalizeUuid(fallback)}`;
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
}
