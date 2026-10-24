import { nanoid } from "nanoid";
import type { Infospot, InfospotIcon, InfospotKind, SphericalPosition } from "./types";

export const INFOSPOT_KINDS: { id: InfospotKind; label: string; description: string }[] = [
  { id: "link", label: "Hyperlink", description: "Opens a web page" },
  { id: "short", label: "Short description", description: "A line of text on hover" },
  { id: "image", label: "Image", description: "A photo with a caption" },
  { id: "long", label: "Long description", description: "A title and longer text" },
  { id: "html", label: "HTML pop-up", description: "Your own HTML, e.g. a YouTube video" },
];

export const INFOSPOT_ICONS: { id: InfospotIcon; label: string }[] = [
  { id: "info", label: "Info" },
  { id: "star", label: "Star" },
  { id: "camera", label: "Camera" },
  { id: "bubble", label: "Speech bubble" },
];

export function createInfospotRecord(position: SphericalPosition, overrides: Partial<Infospot> = {}): Infospot {
  return {
    id: nanoid(10),
    position,
    icon: "info",
    scale: 1,
    opacity: 1,
    kind: "short",
    previewText: "",
    ...overrides,
  };
}

/** The fields each kind uses, besides the shared ones. */
const KIND_FIELDS: Record<InfospotKind, (keyof Infospot)[]> = {
  link: ["previewText", "url", "newWindow"],
  short: ["previewText"],
  image: ["previewText", "imageKey", "caption"],
  long: ["title", "description"],
  html: ["previewText", "html"],
};

const SHARED_FIELDS: (keyof Infospot)[] = ["id", "position", "icon", "scale", "opacity", "kind"];

/**
 * Keeps only the fields of the infospot's kind (and trims text, and
 * normalises links), so an infospot switched from Image to Hyperlink
 * doesn't keep a stale image key.
 * `previewText` is always present, as the model requires it.
 */
export function cleanInfospot(spot: Infospot): Infospot {
  const keep = new Set([...SHARED_FIELDS, ...KIND_FIELDS[spot.kind]]);
  const clean: Record<string, unknown> = { previewText: "" };
  for (const [key, value] of Object.entries(spot)) {
    if (!keep.has(key as keyof Infospot) || value === undefined) continue;
    clean[key] = typeof value === "string" && key !== "html" ? value.trim() : value;
  }
  if (spot.kind === "link") {
    clean.newWindow = spot.newWindow ?? true;
    clean.url = safeUrl(spot.url) ?? clean.url;
  }
  return clean as unknown as Infospot;
}

/** Only web, mail and phone links may be opened from a tour. */
export function safeUrl(raw: string | undefined): string | null {
  const text = raw?.trim();
  if (!text) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(candidate);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/** What is still missing before an infospot can be saved, or null. */
export function infospotProblem(spot: Infospot): string | null {
  switch (spot.kind) {
    case "link":
      return safeUrl(spot.url) ? null : "a web address (https://…)";
    case "short":
      return spot.previewText.trim() ? null : "the preview text";
    case "image":
      return spot.imageKey ? null : "an image";
    case "long":
      return spot.title?.trim() ? null : "a title";
    case "html":
      return spot.html?.trim() ? null : "some HTML";
  }
}

/** Text shown on hover. */
export function infospotLabel(spot: Infospot): string {
  const preview = spot.previewText.trim();
  if (preview) return preview;
  if (spot.kind === "long" && spot.title?.trim()) return spot.title.trim();
  if (spot.kind === "link" && spot.url?.trim()) return spot.url.trim();
  return INFOSPOT_KINDS.find((k) => k.id === spot.kind)!.label;
}
