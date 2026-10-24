import type { MarkerConfig } from "@photo-sphere-viewer/markers-plugin";
import type { HotspotStyle, Infospot, InfospotIcon, LinkHotspot } from "@/lib/types";

/** Link hotspots and infospots are both "spots" drawn as markers on the panorama. */
export type SpotType = "hotspot" | "infospot";

export interface SpotRef {
  type: SpotType;
  id: string;
}

/** Marker ids are prefixed so a hotspot and an infospot can never collide. */
export function spotMarkerId(ref: SpotRef): string {
  return `${ref.type}:${ref.id}`;
}

/** Marker size at scale 1, in CSS pixels. */
export const HOTSPOT_BASE_SIZE = 60;
export const INFOSPOT_BASE_SIZE = 40;

export const HOTSPOT_STYLES: { id: HotspotStyle; label: string }[] = [
  { id: "disc", label: "Floor disc" },
  { id: "arrow-ring", label: "Arrow in ring" },
  { id: "arrow", label: "Arrow" },
  { id: "sphere", label: "Glass sphere" },
];

const STROKE = 'stroke="#fff" stroke-linecap="round" stroke-linejoin="round" fill="none"';

const HOTSPOT_GLYPHS: Record<HotspotStyle, string> = {
  disc: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" fill="rgb(255 255 255 / 0.2)" stroke="#fff" stroke-width="3"/><path d="M22 36 32 25l10 11" ${STROKE} stroke-width="5"/></svg>`,
  "arrow-ring": `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" fill="rgb(14 13 12 / 0.45)" stroke="#fff" stroke-width="3"/><path d="M21 37 32 25l11 12" ${STROKE} stroke-width="5"/></svg>`,
  arrow: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 38 32 17l20 21" ${STROKE} stroke-width="8"/><path d="M19 52 32 38l13 14" ${STROKE} stroke-width="6" stroke-opacity="0.6"/></svg>`,
  sphere: `<span class="hs__orb"></span>`,
};

const ICON_STROKE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const INFOSPOT_GLYPHS: Record<InfospotIcon, string> = {
  info: `<svg viewBox="0 0 24 24" aria-hidden="true" ${ICON_STROKE} stroke-width="2.6"><path d="M12 11v6"/><circle cx="12" cy="7" r="0.6" fill="currentColor"/></svg>`,
  star: `<svg viewBox="0 0 24 24" aria-hidden="true" ${ICON_STROKE}><path d="m12 3.8 2.5 5.1 5.6.8-4 3.9 1 5.6L12 16.6l-5.1 2.6 1-5.6-4-3.9 5.6-.8z"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" aria-hidden="true" ${ICON_STROKE}><path d="M4 9a2 2 0 0 1 2-2h1.5l1.5-2h6l1.5 2H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.2"/></svg>`,
  bubble: `<svg viewBox="0 0 24 24" aria-hidden="true" ${ICON_STROKE}><path d="M6.5 5h11A2.5 2.5 0 0 1 20 7.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5V16A2.5 2.5 0 0 1 4 13.5v-6A2.5 2.5 0 0 1 6.5 5z"/></svg>`,
};

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Inner HTML of a hotspot glyph, also used for the style previews in the editor. */
export function hotspotGlyphHtml(style: HotspotStyle, rotation = 0): string {
  return `<span class="hs__glyph" style="--hs-rot:${rotation}deg">${HOTSPOT_GLYPHS[style]}</span>`;
}

/** Inner HTML of an infospot pin, also used for the icon picker. */
export function infospotGlyphHtml(icon: InfospotIcon): string {
  return `<span class="ip__glyph">${INFOSPOT_GLYPHS[icon]}</span>`;
}

export interface SpotMarkerOptions {
  /** Shown on hover. */
  title: string;
  /** Second, smaller tooltip line (e.g. editing hints). */
  hint?: string;
  /** The spot being edited: highlighted with a pulsing ring. */
  editing?: boolean;
}

function tooltipHtml(options: SpotMarkerOptions): string {
  return `<span class="hs-tip">${escapeHtml(options.title)}${
    options.hint ? `<span class="hs-tip__hint">${escapeHtml(options.hint)}</span>` : ""
  }</span>`;
}

function spotHtml(ref: SpotRef, classes: string, label: string, inner: string): string {
  return `<div class="${classes}" data-spot-id="${escapeHtml(ref.id)}" data-spot-type="${ref.type}" role="button" tabindex="0" aria-label="${escapeHtml(label)}">${inner}</div>`;
}

export function hotspotMarker(hotspot: LinkHotspot, options: SpotMarkerOptions): MarkerConfig {
  const ref: SpotRef = { type: "hotspot", id: hotspot.id };
  const size = Math.round(HOTSPOT_BASE_SIZE * hotspot.scale);
  const classes = ["hs", `hs--${hotspot.style}`, options.editing ? "is-editing" : ""].join(" ").trim();
  return {
    id: spotMarkerId(ref),
    position: hotspot.position,
    html: spotHtml(ref, classes, `Hotspot: ${options.title}`, hotspotGlyphHtml(hotspot.style, hotspot.rotation)),
    size: { width: size, height: size },
    anchor: "center center",
    opacity: hotspot.opacity,
    zIndex: options.editing ? 20 : 10,
    tooltip: { content: tooltipHtml(options), position: "top center", trigger: "hover" },
  };
}

export function infospotMarker(spot: Infospot, options: SpotMarkerOptions): MarkerConfig {
  const ref: SpotRef = { type: "infospot", id: spot.id };
  const size = Math.round(INFOSPOT_BASE_SIZE * spot.scale);
  const classes = ["ip", options.editing ? "is-editing" : ""].join(" ").trim();
  return {
    id: spotMarkerId(ref),
    position: spot.position,
    html: spotHtml(ref, classes, `Information: ${options.title}`, infospotGlyphHtml(spot.icon)),
    size: { width: size, height: size },
    anchor: "center center",
    opacity: spot.opacity,
    zIndex: options.editing ? 21 : 11,
    tooltip: { content: tooltipHtml(options), position: "top center", trigger: "hover" },
  };
}

/**
 * The element the VirtualTour plugin draws for a link (a hotspot in the
 * visitor's viewer). The plugin sets its size and positions it.
 */
export function hotspotLinkElement(hotspot: LinkHotspot, title: string, showTitle: boolean): HTMLElement {
  const element = document.createElement("div");
  element.className = `hs hs--${hotspot.style}`;
  element.dataset.spotId = hotspot.id;
  element.dataset.spotType = "hotspot";
  element.setAttribute("role", "button");
  element.setAttribute("tabindex", "0");
  element.setAttribute("aria-label", `Go to ${title}`);
  element.innerHTML =
    hotspotGlyphHtml(hotspot.style, hotspot.rotation) +
    (showTitle ? `<span class="hs__label">${escapeHtml(title)}</span>` : "");
  return element;
}
