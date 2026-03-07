import { access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";
import { config } from "../config";

const IMAGE_ROOTS = [
  resolve(process.cwd(), "public", "images"),
  resolve(process.cwd(), ".output", "public", "images"),
];

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function ensureImageDirectories(): Promise<void> {
  await Promise.all([
    mkdir(config.directories.faces, { recursive: true }),
    mkdir(config.directories.helms, { recursive: true }),
    mkdir(config.directories.skins, { recursive: true }),
    mkdir(config.directories.renders, { recursive: true }),
    mkdir(config.directories.capes, { recursive: true }),
  ]);
}

async function resolveImageAsset(filename: string): Promise<string> {
  for (const root of IMAGE_ROOTS) {
    const candidate = join(root, filename);
    if (await exists(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Default image asset not found: ${filename}`);
}

export async function defaultAvatarPath(name: "mhf_alex" | "mhf_steve"): Promise<string> {
  return resolveImageAsset(`${name}.png`);
}

export async function defaultSkinPath(name: "mhf_alex" | "mhf_steve"): Promise<string> {
  return resolveImageAsset(`${name}_skin.png`);
}

export function facePath(hash: string): string {
  return join(config.directories.faces, `${hash}.png`);
}

export function helmPath(hash: string): string {
  return join(config.directories.helms, `${hash}.png`);
}

export function skinPath(hash: string): string {
  return join(config.directories.skins, `${hash}.png`);
}

export function capePath(hash: string): string {
  return join(config.directories.capes, `${hash}.png`);
}

export function renderPath(hash: string, scale: number, overlay: boolean, body: boolean, slim: boolean): string {
  const type = overlay ? (body ? "bodyhelm" : "headhelm") : (body ? "body" : "head");
  return join(config.directories.renders, `${hash}-${scale}-${type}-${slim ? "s" : "t"}.png`);
}
