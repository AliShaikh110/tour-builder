"use client";

import { useEffect, useState } from "react";
import { topDownTile } from "@/lib/image";
import { getMedia } from "@/lib/media-db";
import type { DisplayType } from "@/lib/types";

// Tiles are data URLs (nothing to revoke), computed once per image and kept for the session.
const tiles = new Map<string, Promise<string | null>>();

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function tileFor(displayType: DisplayType, mediaKey: string, thumbKey: string): Promise<string | null> {
  // 2D scenes have no floor to project; their thumbnail is shown as is.
  const key = displayType === "360" ? `top:${mediaKey}` : `flat:${thumbKey}`;
  let tile = tiles.get(key);
  if (!tile) {
    tile = (async () => {
      const blob = await getMedia(displayType === "360" ? mediaKey : thumbKey);
      if (!blob) return null;
      return displayType === "360" ? topDownTile(blob) : readAsDataUrl(blob);
    })().catch(() => null);
    tiles.set(key, tile);
  }
  return tile;
}

/** The round, seen-from-above image of a scene for the Connect Scenes map. */
export function useTileImage(displayType: DisplayType, mediaKey: string, thumbKey: string): string | null {
  const key = `${displayType}:${mediaKey}:${thumbKey}`;
  const [entry, setEntry] = useState<{ key: string; url: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void tileFor(displayType, mediaKey, thumbKey).then((url) => {
      if (!cancelled) setEntry({ key: `${displayType}:${mediaKey}:${thumbKey}`, url });
    });
    return () => {
      cancelled = true;
    };
  }, [displayType, mediaKey, thumbKey]);

  return entry?.key === key ? entry.url : null;
}
