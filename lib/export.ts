import JSZip from "jszip";
import { nanoid } from "nanoid";
import { DEFAULT_SETTINGS } from "./constants";
import { deleteMedia, getMedia, putMedia } from "./media-db";
import { mergeSettings, tourMediaKeys } from "./store";
import type { Scene, Tour } from "./types";

export const EXPORT_FORMAT = "tour-builder";
export const EXPORT_VERSION = 1;

interface MediaEntry {
  path: string;
  type: string;
}

/** The contents of tour.json inside an exported .zip. */
export interface TourExport {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  tour: Tour;
  media: Record<string, MediaEntry>;
}

export class TourFileError extends Error {}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
};

function extensionFor(type: string): string {
  return EXTENSIONS[type] ?? "bin";
}

/** A file name for the export: the title in lowercase words, safe on every system. */
export function exportFileName(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "tour"}.zip`;
}

/**
 * Packs a tour and every image and sound it uses into a .zip:
 * tour.json (the tour plus a media manifest) and media/<key>.<ext>.
 */
export async function exportTour(
  tour: Tour,
  options: {
    readMedia?: (key: string) => Promise<Blob | undefined>;
    onProgress?: (percent: number) => void;
  } = {},
): Promise<Blob> {
  const readMedia = options.readMedia ?? getMedia;
  const zip = new JSZip();
  const media: Record<string, MediaEntry> = {};
  const missing: string[] = [];

  for (const key of new Set(tourMediaKeys(tour))) {
    const blob = await readMedia(key);
    if (!blob) {
      missing.push(key);
      continue;
    }
    const type = blob.type || "application/octet-stream";
    const path = `media/${key}.${extensionFor(type)}`;
    zip.file(path, await blob.arrayBuffer(), { binary: true });
    media[key] = { path, type };
  }
  if (missing.length) {
    throw new TourFileError(`${missing.length} of this tour's files are missing from browser storage, so it can't be exported.`);
  }

  const manifest: TourExport = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    tour,
    media,
  };
  zip.file("tour.json", JSON.stringify(manifest, null, 2));
  // Images are already compressed; storing them avoids burning time for nothing.
  return zip.generateAsync({ type: "blob", compression: "STORE", mimeType: "application/zip" }, (meta) =>
    options.onProgress?.(Math.round(meta.percent)),
  );
}

/**
 * Gives a tour fresh ids everywhere (tour, scenes, hotspots, infospots) and
 * points media at new keys, so an import never collides with what is
 * already in this browser.
 */
export function remapTour(tour: Tour, mediaKeys: Record<string, string>, now = Date.now()): Tour {
  const sceneIds = Object.fromEntries(tour.sceneOrder.map((id) => [id, nanoid(10)]));
  const key = (k: string) => mediaKeys[k] ?? k;

  const scenes: Record<string, Scene> = {};
  for (const oldId of tour.sceneOrder) {
    const scene = tour.scenes[oldId];
    if (!scene) continue;
    scenes[sceneIds[oldId]] = {
      ...scene,
      id: sceneIds[oldId],
      mediaKey: key(scene.mediaKey),
      thumbKey: key(scene.thumbKey),
      hotspots: scene.hotspots
        .filter((h) => sceneIds[h.targetSceneId])
        .map((h) => ({ ...h, id: nanoid(10), targetSceneId: sceneIds[h.targetSceneId] })),
      infospots: scene.infospots.map((i) => ({
        ...i,
        id: nanoid(10),
        ...(i.imageKey ? { imageKey: key(i.imageKey) } : {}),
      })),
    };
  }

  const settings = mergeSettings(DEFAULT_SETTINGS, tour.settings ?? {});
  if (settings.ambientSoundKey) settings.ambientSoundKey = key(settings.ambientSoundKey);

  const next: Tour = {
    ...tour,
    id: nanoid(10),
    status: "draft",
    createdAt: now,
    updatedAt: now,
    sceneOrder: tour.sceneOrder.filter((id) => scenes[sceneIds[id]]).map((id) => sceneIds[id]),
    scenes,
    settings,
  };
  if (tour.coverSceneId && sceneIds[tour.coverSceneId]) next.coverSceneId = sceneIds[tour.coverSceneId];
  else delete next.coverSceneId;
  return next;
}

function parseManifest(text: string): TourExport {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new TourFileError("tour.json in this file isn't valid JSON.");
  }
  const manifest = data as Partial<TourExport>;
  if (manifest?.format !== EXPORT_FORMAT) {
    throw new TourFileError("This isn't a Tour Builder export.");
  }
  if (manifest.version !== EXPORT_VERSION) {
    throw new TourFileError(`This export is version ${manifest.version}; this app reads version ${EXPORT_VERSION}.`);
  }
  const tour = manifest.tour;
  if (!tour || typeof tour.title !== "string" || !Array.isArray(tour.sceneOrder) || typeof tour.scenes !== "object") {
    throw new TourFileError("The tour in this file is incomplete.");
  }
  return manifest as TourExport;
}

/**
 * Reads an exported .zip: checks it, saves its media under new keys and
 * returns the tour with fresh ids, ready to insert.
 */
export async function importTour(
  file: Blob | ArrayBuffer | Uint8Array,
  options: {
    writeMedia?: (blob: Blob) => Promise<string>;
    /** Removes what was already written when the import fails part-way. */
    removeMedia?: (keys: string[]) => Promise<void>;
  } = {},
): Promise<Tour> {
  const writeMedia = options.writeMedia ?? ((blob: Blob) => putMedia(blob));
  const removeMedia = options.removeMedia ?? deleteMedia;
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new TourFileError("This file isn't a valid .zip.");
  }
  const manifestFile = zip.file("tour.json");
  if (!manifestFile) throw new TourFileError("This .zip has no tour.json, so it isn't a Tour Builder export.");
  const manifest = parseManifest(await manifestFile.async("string"));

  const keys = new Set(tourMediaKeys(manifest.tour));
  const entries = [...keys].map((oldKey) => {
    const entry = manifest.media?.[oldKey];
    const stored = entry && zip.file(entry.path);
    if (!stored) throw new TourFileError("Some of the tour's images are missing from this file.");
    return { oldKey, entry, stored };
  });

  const mediaKeys: Record<string, string> = {};
  try {
    for (const { oldKey, entry, stored } of entries) {
      const bytes = await stored.async("uint8array");
      mediaKeys[oldKey] = await writeMedia(new Blob([bytes as BlobPart], { type: entry.type }));
    }
  } catch (error) {
    await removeMedia(Object.values(mediaKeys)).catch(() => undefined);
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      throw new TourFileError("This browser is out of storage space for the tour's photos.");
    }
    throw error;
  }
  return remapTour(manifest.tour, mediaKeys);
}
