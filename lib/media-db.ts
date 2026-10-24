import { api } from "./api";
import { enqueue, flushSaves } from "./autosave";

// Photos, thumbnails and sounds live on the backend. Tours refer to a file by
// its media id (the "key" in mediaKey, thumbKey, imageKey, ambientSoundKey);
// this module remembers each file's address.

const urls = new Map<string, string>();

/** Learns file addresses from the API (the `media` map that comes with every tour). */
export function rememberMediaUrls(media: Record<string, string>): void {
  for (const [key, url] of Object.entries(media)) urls.set(key, url);
}

/** The address of a stored file, or null if it isn't known. */
export function mediaUrl(key: string | null | undefined): string | null {
  return (key && urls.get(key)) || null;
}

/** Uploads a file to the tour and returns its media id. */
export async function putMedia(tourId: string, blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", blob, blob instanceof File ? blob.name : "upload");
  const media = await api<{ id: string; url: string }>(`/tours/${tourId}/media`, { method: "POST", form });
  urls.set(media.id, media.url);
  return media.id;
}

/** Downloads a stored file (for the .zip export and the map tiles). */
export async function getMedia(key: string): Promise<Blob | undefined> {
  const url = mediaUrl(key);
  if (!url) return undefined;
  const response = await fetch(url).catch(() => null);
  return response?.ok ? response.blob() : undefined;
}

/**
 * Deletes files the tour no longer uses (a swapped photo, an unsaved infospot
 * image...). A waiting save goes first, so the server never sees a file
 * deleted while the tour still points at it.
 */
export async function deleteMedia(tourId: string, keys: Iterable<string>): Promise<void> {
  void flushSaves(tourId);
  await Promise.all(
    [...new Set(keys)].map((key) =>
      enqueue(tourId, () => api(`/tours/${tourId}/media/${key}`, { method: "DELETE" })),
    ),
  );
}
