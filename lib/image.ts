import { putMedia } from "./media-db";
import type { DisplayType } from "./types";

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ACCEPTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
/** Value for an `<input type="file" accept>` attribute. */
export const IMAGE_ACCEPT = [...ACCEPTED_IMAGE_EXTENSIONS, ...ACCEPTED_IMAGE_TYPES].join(",");

export const THUMB_WIDTH = 512;

export function isAcceptedImage(file: File): boolean {
  if (ACCEPTED_IMAGE_TYPES.includes(file.type)) return true;
  const name = file.name.toLowerCase();
  return ACCEPTED_IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/** File name without its extension, used as the default scene name. */
export function baseName(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  const name = dot > 0 ? fileName.slice(0, dot) : fileName;
  return name.trim() || "Untitled scene";
}

/** True when the image is (close to) the 2:1 equirectangular ratio. */
export function isEquirectangular(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  return Math.abs(width / height - 2) <= 0.02;
}

export async function readImageSize(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

export async function makeThumbnail(
  blob: Blob,
  size: { width: number; height: number },
  maxWidth = THUMB_WIDTH,
): Promise<Blob> {
  const width = Math.min(maxWidth, size.width);
  const height = Math.max(1, Math.round((size.height * width) / size.width));
  const bitmap = await createImageBitmap(blob, {
    resizeWidth: width,
    resizeHeight: height,
    resizeQuality: "high",
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is not available");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (thumb) => (thumb ? resolve(thumb) : reject(new Error("Could not encode thumbnail"))),
      "image/jpeg",
      0.82,
    );
  });
}

export interface ImportedImage {
  mediaKey: string;
  thumbKey: string;
  width: number;
  height: number;
  displayType: DisplayType;
}

/**
 * Reads the image size (unless already known), makes a thumbnail and stores
 * both blobs in IndexedDB. Images that are not 2:1 default to a 2D scene
 * unless `displayType` is given.
 */
export async function importImage(
  blob: Blob,
  options: { displayType?: DisplayType; size?: { width: number; height: number } } = {},
): Promise<ImportedImage> {
  const { displayType } = options;
  const size = options.size ?? (await readImageSize(blob));
  const thumb = await makeThumbnail(blob, size);
  const [mediaKey, thumbKey] = await Promise.all([putMedia(blob), putMedia(thumb)]);
  return {
    mediaKey,
    thumbKey,
    ...size,
    displayType: displayType ?? (isEquirectangular(size.width, size.height) ? "360" : "2d"),
  };
}

/**
 * Stores a photo for an infospot, downscaled to `maxWidth` when larger so
 * pop-up images don't fill browser storage. Returns the IndexedDB key.
 */
export async function importInfospotImage(file: Blob, maxWidth = 2048): Promise<string> {
  const size = await readImageSize(file);
  const blob = size.width > maxWidth ? await makeThumbnail(file, size, maxWidth) : file;
  return putMedia(blob);
}

/** How far up from straight down a top-down tile reaches: down to 12° below the horizon. */
const TILE_EDGE_PITCH = -Math.PI / 2 + (Math.PI / 2 - (12 * Math.PI) / 180);

/**
 * Renders a 360° image as seen from above: a round tile with the floor at the
 * centre, yaw 0 pointing up and yaw 90° to the right (azimuthal projection).
 * Used for the Connect Scenes map, where floor lines are lined up by eye.
 */
export async function topDownTile(blob: Blob, size = 256, sourceWidth = 1536): Promise<string> {
  // Work from a downscaled copy: the full panorama would be tens of megapixels.
  const bitmap = await createImageBitmap(blob, {
    resizeWidth: sourceWidth,
    resizeHeight: sourceWidth / 2,
    resizeQuality: "medium",
  });
  const source = document.createElement("canvas");
  source.width = bitmap.width;
  source.height = bitmap.height;
  const sourceCtx = source.getContext("2d", { willReadFrequently: true });
  if (!sourceCtx) throw new Error("Canvas 2D context is not available");
  sourceCtx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { width: w, height: h } = source;
  const pixels = sourceCtx.getImageData(0, 0, w, h).data;

  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const outCtx = out.getContext("2d");
  if (!outCtx) throw new Error("Canvas 2D context is not available");
  const image = outCtx.createImageData(size, size);
  const half = size / 2;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const dx = px + 0.5 - half;
      const dy = py + 0.5 - half;
      const r = Math.hypot(dx, dy) / half;
      if (r > 1) continue;
      const yaw = Math.atan2(dx, -dy);
      const pitch = -Math.PI / 2 + r * (TILE_EDGE_PITCH + Math.PI / 2);
      const u = (((yaw / (2 * Math.PI) + 0.5) % 1) + 1) % 1;
      const x = Math.min(w - 1, Math.floor(u * w));
      const y = Math.min(h - 1, Math.floor((0.5 - pitch / Math.PI) * h));
      const from = (y * w + x) * 4;
      const to = (py * size + px) * 4;
      image.data[to] = pixels[from];
      image.data[to + 1] = pixels[from + 1];
      image.data[to + 2] = pixels[from + 2];
      // Soft one-pixel edge.
      image.data[to + 3] = Math.round(255 * Math.min(1, (1 - r) * half));
    }
  }
  outCtx.putImageData(image, 0, 0);
  return out.toDataURL("image/webp", 0.85);
}
