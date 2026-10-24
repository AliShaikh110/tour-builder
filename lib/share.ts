import type { Tour } from "./types";

export const EMBED_HEIGHT = 480;

function attribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The visitor page, optionally opening at a scene. */
export function tourLink(origin: string, tourId: string, sceneId?: string | null): string {
  const url = new URL(`/tours/${encodeURIComponent(tourId)}`, origin);
  if (sceneId) url.searchParams.set("scene", sceneId);
  return url.href;
}

export function embedLink(origin: string, tourId: string): string {
  return new URL(`/embed/${encodeURIComponent(tourId)}`, origin).href;
}

/** An <iframe> for another site: full width, fullscreen and VR allowed, loaded when scrolled to. */
export function embedCode(origin: string, tour: Pick<Tour, "id" | "title">, height = EMBED_HEIGHT): string {
  return (
    `<iframe src="${attribute(embedLink(origin, tour.id))}" title="${attribute(tour.title)}" ` +
    `width="100%" height="${height}" style="border:0" ` +
    `allow="fullscreen; gyroscope; accelerometer; xr-spatial-tracking" allowfullscreen loading="lazy"></iframe>`
  );
}
