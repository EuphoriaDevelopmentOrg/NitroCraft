import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

type CanvasModule = typeof import("canvas");

declare global {
  // Process-wide singleton for native canvas module.
  // This avoids duplicate native type registration in hot-reload/dev contexts.
  // eslint-disable-next-line no-var
  var __nitrocraftCanvasModule: CanvasModule | undefined;
}

function getCanvasModule(): CanvasModule {
  if (!globalThis.__nitrocraftCanvasModule) {
    const require = createRequire(import.meta.url);
    globalThis.__nitrocraftCanvasModule = require("canvas") as CanvasModule;
  }
  return globalThis.__nitrocraftCanvasModule;
}

function createCanvas(width: number, height: number): any {
  return getCanvasModule().createCanvas(width, height);
}

async function loadImage(source: Buffer): Promise<any> {
  return getCanvasModule().loadImage(source);
}

function removeTransparency(canvas: any): any {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function hasTransparency(canvas: any): boolean {
  const ctx = canvas.getContext("2d");
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) {
      return true;
    }
  }
  return false;
}

function resize(src: any, scale: number): any {
  const dst = createCanvas(1, 1);
  dst.width = scale * src.width;
  dst.height = scale * src.height;
  const context = dst.getContext("2d");
  context.patternQuality = "fast";
  context.drawImage(src, 0, 0, src.width * scale, src.height * scale);
  return dst;
}

function getPart(src: any, x: number, y: number, width: number, height: number, scale: number): any {
  const dst = createCanvas(1, 1);
  dst.width = scale * width;
  dst.height = scale * height;
  const context = dst.getContext("2d");
  context.patternQuality = "fast";
  context.drawImage(src, x, y, width, height, 0, 0, width * scale, height * scale);
  return dst;
}

function flip(src: any): any {
  const dst = createCanvas(1, 1);
  dst.width = src.width;
  dst.height = src.height;
  const context = dst.getContext("2d");
  context.scale(-1, 1);
  context.drawImage(src, -src.width, 0);
  return dst;
}

const SKEW_A = 26 / 45;
const SKEW_B = SKEW_A * 2;

export async function drawModel(
  img: Buffer,
  scale: number,
  overlay: boolean,
  isBody: boolean,
  slim: boolean,
): Promise<Buffer> {
  const canvas = createCanvas(1, 1);
  canvas.width = scale * 20;
  canvas.height = scale * (isBody ? 45.1 : 18.5);

  const ctx = canvas.getContext("2d");
  const skin = await loadImage(img);
  const oldSkin = skin.height === 32;
  const armWidth = slim ? 3 : 4;

  const headTop = resize(removeTransparency(getPart(skin, 8, 0, 8, 8, 1)), scale);
  const headFront = resize(removeTransparency(getPart(skin, 8, 8, 8, 8, 1)), scale);
  const headRight = resize(removeTransparency(getPart(skin, 0, 8, 8, 8, 1)), scale);

  const armRightTop = resize(removeTransparency(getPart(skin, 44, 16, armWidth, 4, 1)), scale);
  const armRightFront = resize(removeTransparency(getPart(skin, 44, 20, armWidth, 12, 1)), scale);
  const armRightSide = resize(removeTransparency(getPart(skin, 40, 20, 4, 12, 1)), scale);

  const armLeftTop = oldSkin
    ? flip(armRightTop)
    : resize(removeTransparency(getPart(skin, 36, 48, armWidth, 4, 1)), scale);
  const armLeftFront = oldSkin
    ? flip(armRightFront)
    : resize(removeTransparency(getPart(skin, 36, 52, armWidth, 12, 1)), scale);

  const legRightFront = resize(removeTransparency(getPart(skin, 4, 20, 4, 12, 1)), scale);
  const legRightSide = resize(removeTransparency(getPart(skin, 0, 20, 4, 12, 1)), scale);

  const legLeftFront = oldSkin
    ? flip(legRightFront)
    : resize(removeTransparency(getPart(skin, 20, 52, 4, 12, 1)), scale);

  const bodyFront = resize(removeTransparency(getPart(skin, 20, 20, 8, 12, 1)), scale);

  if (overlay) {
    if (hasTransparency(getPart(skin, 32, 0, 32, 32, 1))) {
      headTop.getContext("2d").drawImage(getPart(skin, 40, 0, 8, 8, scale), 0, 0);
      headFront.getContext("2d").drawImage(getPart(skin, 40, 8, 8, 8, scale), 0, 0);
      headRight.getContext("2d").drawImage(getPart(skin, 32, 8, 8, 8, scale), 0, 0);
    }

    if (!oldSkin) {
      const bodyRegion = getPart(skin, 16, 32, 32, 16, 1);
      const rightArmRegion = getPart(skin, 48, 48, 16, 16, 1);
      const leftArmRegion = getPart(skin, 40, 32, 16, 16, 1);
      const rightLegRegion = getPart(skin, 0, 32, 16, 16, 1);
      const leftLegRegion = getPart(skin, 0, 48, 16, 16, 1);

      if (hasTransparency(bodyRegion)) {
        bodyFront.getContext("2d").drawImage(getPart(skin, 20, 36, 8, 12, scale), 0, 0);
      }

      if (hasTransparency(rightArmRegion)) {
        armRightTop.getContext("2d").drawImage(getPart(skin, 44, 32, armWidth, 4, scale), 0, 0);
        armRightFront.getContext("2d").drawImage(getPart(skin, 44, 36, armWidth, 12, scale), 0, 0);
        armRightSide.getContext("2d").drawImage(getPart(skin, 40, 36, 4, 12, scale), 0, 0);
      }

      if (hasTransparency(leftArmRegion)) {
        armLeftTop.getContext("2d").drawImage(getPart(skin, 52, 48, armWidth, 4, scale), 0, 0);
        armLeftFront.getContext("2d").drawImage(getPart(skin, 52, 52, armWidth, 12, scale), 0, 0);
      }

      if (hasTransparency(rightLegRegion)) {
        legRightFront.getContext("2d").drawImage(getPart(skin, 4, 36, 4, 12, scale), 0, 0);
        legRightSide.getContext("2d").drawImage(getPart(skin, 0, 36, 4, 12, scale), 0, 0);
      }

      if (hasTransparency(leftLegRegion)) {
        legLeftFront.getContext("2d").drawImage(getPart(skin, 4, 52, 4, 12, scale), 0, 0);
      }
    }
  }

  let x = 0;
  let y = 0;
  let z = 0;
  const zOffset = scale * 3;
  const xOffset = scale * 2;

  if (isBody) {
    const front = createCanvas(1, 1);
    front.width = scale * 16;
    front.height = scale * 24;
    const frontc = front.getContext("2d");
    frontc.patternQuality = "fast";

    frontc.drawImage(armRightFront, (4 - armWidth) * scale, 0, armWidth * scale, 12 * scale);
    frontc.drawImage(armLeftFront, 12 * scale, 0, armWidth * scale, 12 * scale);
    frontc.drawImage(bodyFront, 4 * scale, 0, 8 * scale, 12 * scale);
    frontc.drawImage(legRightFront, 4 * scale, 12 * scale, 4 * scale, 12 * scale);
    frontc.drawImage(legLeftFront, 8 * scale, 12 * scale, 4 * scale, 12 * scale);

    x = xOffset + scale * 2;
    y = scale * -armWidth;
    z = zOffset + scale * 8;
    ctx.setTransform(1, -SKEW_A, 1, SKEW_A, 0, 0);
    ctx.drawImage(armRightTop, y - z - 0.5, x + z, armRightTop.width + 1, armRightTop.height + 1);

    y = scale * 8;
    ctx.drawImage(armLeftTop, y - z, x + z, armLeftTop.width, armLeftTop.height + 1);

    ctx.setTransform(1, SKEW_A, 0, SKEW_B, 0, 0);
    x = xOffset + scale * 2;
    y = 0;
    z = zOffset + scale * 20;
    ctx.drawImage(legRightSide, x + y, z - y, legRightSide.width, legRightSide.height);

    x = xOffset + scale * 2;
    y = scale * -armWidth;
    z = zOffset + scale * 8;
    ctx.drawImage(armRightSide, x + y, z - y - 0.5, armRightSide.width, armRightSide.height + 1);

    z = zOffset + scale * 12;
    y = 0;
    ctx.setTransform(1, -SKEW_A, 0, SKEW_B, 0, SKEW_A);
    ctx.drawImage(front, y + x, x + z - 0.5, front.width, front.height);
  }

  x = xOffset;
  y = -0.5;
  z = zOffset;
  ctx.setTransform(1, -SKEW_A, 1, SKEW_A, 0, 0);
  ctx.drawImage(headTop, y - z, x + z, headTop.width, headTop.height + 1);

  x = xOffset + 8 * scale;
  y = 0;
  z = zOffset - 0.5;
  ctx.setTransform(1, -SKEW_A, 0, SKEW_B, 0, SKEW_A);
  ctx.drawImage(headFront, y + x, x + z, headFront.width, headFront.height);

  x = xOffset;
  y = 0;
  z = zOffset;
  ctx.setTransform(1, SKEW_A, 0, SKEW_B, 0, 0);
  ctx.drawImage(headRight, x + y, z - y - 0.5, headRight.width + 0.5, headRight.height + 1);

  return canvas.toBuffer("image/png");
}

export async function openRender(path: string): Promise<Buffer> {
  return readFile(path);
}
