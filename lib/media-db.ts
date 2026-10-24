import { createStore, del, delMany, get, set, type UseStore } from "idb-keyval";
import { nanoid } from "nanoid";
import { useEffect, useState } from "react";

// Image blobs live in IndexedDB; the tour JSON only keeps their keys.
let mediaStore: UseStore | undefined;

function store(): UseStore {
  mediaStore ??= createStore("tour-builder-media", "blobs");
  return mediaStore;
}

export async function putMedia(blob: Blob, key: string = nanoid()): Promise<string> {
  await set(key, blob, store());
  return key;
}

export function getMedia(key: string): Promise<Blob | undefined> {
  return get<Blob>(key, store());
}

export async function deleteMedia(keys: Iterable<string>): Promise<void> {
  const list = [...new Set(keys)];
  if (list.length === 1) return del(list[0], store());
  if (list.length > 1) return delMany(list, store());
}

/**
 * Object URL for a stored blob. The URL is revoked when the key changes or
 * the component unmounts (or is hidden by a navigation Activity).
 */
export function useMediaUrl(key: string | null | undefined): string | null {
  const [entry, setEntry] = useState<{ key: string; url: string } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    let url: string | null = null;
    getMedia(key).then(
      (blob) => {
        if (cancelled || !blob) return;
        url = URL.createObjectURL(blob);
        setEntry({ key, url });
      },
      () => {
        // A missing or unreadable blob just shows the placeholder.
      },
    );
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [key]);

  return entry && entry.key === key ? entry.url : null;
}

/**
 * Object URLs for stored blobs, created on first use and reused, so switching
 * back to a scene is instant. Revoke everything when the owner unmounts.
 */
export class MediaUrlCache {
  private urls = new Map<string, Promise<string | null>>();

  get(key: string): Promise<string | null> {
    let url = this.urls.get(key);
    if (!url) {
      url = getMedia(key).then(
        (blob) => (blob ? URL.createObjectURL(blob) : null),
        () => null,
      );
      this.urls.set(key, url);
    }
    return url;
  }

  revoke(key: string): void {
    const url = this.urls.get(key);
    this.urls.delete(key);
    void url?.then((u) => u && URL.revokeObjectURL(u));
  }

  revokeAll(): void {
    for (const key of [...this.urls.keys()]) this.revoke(key);
  }
}
