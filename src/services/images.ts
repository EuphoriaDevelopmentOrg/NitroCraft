import { readFile, writeFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { debug } from "../utils/logging";

function readPngBuffer(buffer: Buffer): PNG {
  return PNG.sync.read(buffer);
}

function writePngBuffer(image: PNG): Buffer {
  return PNG.sync.write(image, { colorType: 6 });
}

function getIndex(image: PNG, x: number, y: number): number {
  return (image.width * y + x) << 2;
}

function cloneImage(image: PNG): PNG {
  const out = new PNG({ width: image.width, height: image.height });
  Buffer.from(image.data).copy(out.data);
  return out;
}

function createEmpty(width: number, height: number): PNG {
  return new PNG({ width, height });
}

function cropImage(image: PNG, x: number, y: number, width: number, height: number): PNG {
  const out = createEmpty(width, height);

  for (let yy = 0; yy < height; yy += 1) {
    for (let xx = 0; xx < width; xx += 1) {
      const source = getIndex(image, x + xx, y + yy);
      const target = getIndex(out, xx, yy);
      out.data[target] = image.data[source];
      out.data[target + 1] = image.data[source + 1];
      out.data[target + 2] = image.data[source + 2];
      out.data[target + 3] = image.data[source + 3];
    }
  }

  return out;
}

function removeTransparency(image: PNG): PNG {
  for (let i = 3; i < image.data.length; i += 4) {
    image.data[i] = 255;
  }
  return image;
}

function areaHasTransparency(image: PNG, x: number, y: number, width: number, height: number): boolean {
  for (let yy = 0; yy < height; yy += 1) {
    for (let xx = 0; xx < width; xx += 1) {
      const index = getIndex(image, x + xx, y + yy);
      if (image.data[index + 3] < 255) {
        return true;
      }
    }
  }
  return false;
}

function pasteImage(base: PNG, overlay: PNG, offsetX: number, offsetY: number): PNG {
  for (let y = 0; y < overlay.height; y += 1) {
    for (let x = 0; x < overlay.width; x += 1) {
      const destX = offsetX + x;
      const destY = offsetY + y;

      if (destX < 0 || destY < 0 || destX >= base.width || destY >= base.height) {
        continue;
      }

      const source = getIndex(overlay, x, y);
      const target = getIndex(base, destX, destY);

      const sourceAlpha = overlay.data[source + 3] / 255;
      const targetAlpha = base.data[target + 3] / 255;
      const outAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);

      if (outAlpha <= 0) {
        base.data[target] = 0;
        base.data[target + 1] = 0;
        base.data[target + 2] = 0;
        base.data[target + 3] = 0;
        continue;
      }

      base.data[target] = Math.round(
        (overlay.data[source] * sourceAlpha + base.data[target] * targetAlpha * (1 - sourceAlpha)) / outAlpha,
      );
      base.data[target + 1] = Math.round(
        (overlay.data[source + 1] * sourceAlpha + base.data[target + 1] * targetAlpha * (1 - sourceAlpha)) / outAlpha,
      );
      base.data[target + 2] = Math.round(
        (overlay.data[source + 2] * sourceAlpha + base.data[target + 2] * targetAlpha * (1 - sourceAlpha)) / outAlpha,
      );
      base.data[target + 3] = Math.round(outAlpha * 255);
    }
  }

  return base;
}

function resizeNearest(image: PNG, width: number, height: number): PNG {
  const out = createEmpty(width, height);

  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(image.height - 1, Math.floor((y * image.height) / height));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(image.width - 1, Math.floor((x * image.width) / width));
      const source = getIndex(image, sourceX, sourceY);
      const target = getIndex(out, x, y);
      out.data[target] = image.data[source];
      out.data[target + 1] = image.data[source + 1];
      out.data[target + 2] = image.data[source + 2];
      out.data[target + 3] = image.data[source + 3];
    }
  }

  return out;
}

export async function saveImage(buffer: Buffer, outPath: string): Promise<void> {
  const image = readPngBuffer(buffer);
  await writeFile(outPath, writePngBuffer(image));
}

export async function openImage(path: string): Promise<Buffer> {
  return readFile(path);
}

export async function extractFace(buffer: Buffer, outPath: string): Promise<void> {
  const image = readPngBuffer(buffer);
  const face = removeTransparency(cropImage(image, 8, 8, 8, 8));
  await writeFile(outPath, writePngBuffer(face));
}

export async function extractHelm(facePath: string, skinBuffer: Buffer, outPath: string): Promise<void> {
  const skin = readPngBuffer(skinBuffer);
  const faceBuffer = await readFile(facePath);
  const face = readPngBuffer(faceBuffer);

  const isOpaque = !areaHasTransparency(skin, 32, 0, 32, 32);
  if (isOpaque) {
    debug("Skin has no transparent overlay, skipping helm cache.");
    return;
  }

  const helm = cropImage(skin, 8, 8, 8, 8);
  const merged = pasteImage(cloneImage(face), helm, 0, 0);
  const mergedBuffer = writePngBuffer(merged);

  if (mergedBuffer.equals(faceBuffer)) {
    debug("Helm equals base face, skipping helm cache.");
    return;
  }

  await writeFile(outPath, mergedBuffer);
}

export async function resizeImage(path: string, size: number): Promise<Buffer> {
  const image = readPngBuffer(await readFile(path));
  const resized = resizeNearest(image, size, size);
  return writePngBuffer(resized);
}
