import { MAP_LINK_PITCH, mapLinkYaw, normalizeAngle } from "./geometry";
import { createHotspotRecord } from "./store";
import type { HotspotStyle, LinkHotspot, MapPosition, Scene, Tour } from "./types";

/** Radius of a scene tile on the plane, in plane units. */
export const TILE_RADIUS = 56;
/** Tiles closer than this (centre to centre) count as touching. */
export const TOUCH_DISTANCE = TILE_RADIUS * 2 + 2;

export function tilesTouch(a: MapPosition, b: MapPosition): boolean {
  return Math.hypot(b.x - a.x, b.y - a.y) <= TOUCH_DISTANCE;
}

/** The style most hotspots in the tour use, so generated ones match. */
export function prevailingHotspotStyle(tour: Tour): HotspotStyle {
  const counts = new Map<HotspotStyle, number>();
  for (const scene of Object.values(tour.scenes)) {
    for (const h of scene.hotspots) counts.set(h.style, (counts.get(h.style) ?? 0) + 1);
  }
  let best: HotspotStyle = "arrow-ring";
  let max = 0;
  for (const [style, count] of counts) {
    if (count > max) [best, max] = [style, count];
  }
  return best;
}

/** Where a map hotspot in `from` towards `to` sits: their bearing on the plane, in `from`'s frame. */
export function mapHotspotPosition(from: MapPosition, to: MapPosition) {
  return { yaw: mapLinkYaw(to.x - from.x, to.y - from.y, from.rotation), pitch: MAP_LINK_PITCH };
}

const between = (h: LinkHotspot, target: string) => h.targetSceneId === target;

function withScene(tour: Tour, scene: Scene): Tour {
  return { ...tour, scenes: { ...tour.scenes, [scene.id]: scene } };
}

/** Removes every hotspot from `a` to `b` (optionally only one source). */
function dropHotspots(tour: Tour, a: string, b: string, source?: LinkHotspot["source"]): Tour {
  const scene = tour.scenes[a];
  const hotspots = scene.hotspots.filter((h) => !(between(h, b) && (!source || h.source === source)));
  return hotspots.length === scene.hotspots.length ? tour : withScene(tour, { ...scene, hotspots });
}

/** Creates or re-aims the map hotspot from `a` to `b`. */
function ensureMapHotspot(tour: Tour, a: string, b: string, style: HotspotStyle): Tour {
  const from = tour.scenes[a];
  const to = tour.scenes[b];
  if (!from.mapPos || !to.mapPos) return tour;
  const position = mapHotspotPosition(from.mapPos, to.mapPos);
  const existing = from.hotspots.find((h) => between(h, b) && h.source === "map");
  const hotspots = existing
    ? from.hotspots.map((h) => (h === existing ? { ...h, position } : h))
    : [...from.hotspots, createHotspotRecord(b, position, { style, source: "map" })];
  return withScene(tour, { ...from, hotspots });
}

function hasMapLink(tour: Tour, a: string, b: string): boolean {
  return tour.scenes[a].hotspots.some((h) => between(h, b) && h.source === "map");
}

function hasManual(tour: Tour, a: string, b: string): boolean {
  return (
    tour.scenes[a].hotspots.some((h) => between(h, b) && h.source === "manual") ||
    tour.scenes[b].hotspots.some((h) => between(h, a) && h.source === "manual")
  );
}

function placedIds(tour: Tour): string[] {
  return tour.sceneOrder.filter((id) => tour.scenes[id]?.mapPos);
}

/**
 * Scenes whose hand-placed hotspots to or from `sceneId` would be replaced
 * if it were linked at `pos`: they would newly touch and are not map-linked yet.
 */
export function manualConflicts(tour: Tour, sceneId: string, pos: MapPosition): string[] {
  return placedIds(tour).filter((id) => {
    if (id === sceneId) return false;
    const other = tour.scenes[id].mapPos!;
    return tilesTouch(pos, other) && !hasMapLink(tour, sceneId, id) && hasManual(tour, sceneId, id);
  });
}

/**
 * Puts a scene on the plane (or moves it) and re-links it: every placed tile
 * it touches is linked both ways (hand-placed hotspots between them are
 * replaced); map links to tiles it no longer touches are removed.
 */
export function placeOnPlane(tour: Tour, sceneId: string, pos: MapPosition, now = Date.now()): Tour {
  const scene = tour.scenes[sceneId];
  if (!scene) return tour;
  const style = prevailingHotspotStyle(tour);
  let next = withScene(tour, { ...scene, mapPos: pos });
  for (const id of placedIds(next)) {
    if (id === sceneId) continue;
    if (tilesTouch(pos, next.scenes[id].mapPos!)) {
      next = dropHotspots(next, sceneId, id, "manual");
      next = dropHotspots(next, id, sceneId, "manual");
      next = ensureMapHotspot(next, sceneId, id, style);
      next = ensureMapHotspot(next, id, sceneId, style);
    } else {
      next = dropHotspots(next, sceneId, id, "map");
      next = dropHotspots(next, id, sceneId, "map");
    }
  }
  return { ...next, updatedAt: now };
}

/** Turns a tile; its outgoing map hotspots are re-aimed (links don't change). */
export function rotateOnPlane(tour: Tour, sceneId: string, rotation: number, now = Date.now()): Tour {
  const scene = tour.scenes[sceneId];
  if (!scene?.mapPos) return tour;
  const pos = { ...scene.mapPos, rotation: normalizeAngle(rotation) };
  const hotspots = scene.hotspots.map((h) => {
    const target = tour.scenes[h.targetSceneId]?.mapPos;
    return h.source === "map" && target ? { ...h, position: mapHotspotPosition(pos, target) } : h;
  });
  return { ...withScene(tour, { ...scene, mapPos: pos, hotspots }), updatedAt: now };
}

/** Takes a scene off the plane, with its map links (hand-placed hotspots stay). */
export function removeFromPlane(tour: Tour, sceneId: string, now = Date.now()): Tour {
  const scene = tour.scenes[sceneId];
  if (!scene?.mapPos) return tour;
  let next = withScene(tour, { ...scene, mapPos: null });
  for (const id of next.sceneOrder) {
    if (id === sceneId || !next.scenes[id]) continue;
    next = dropHotspots(next, sceneId, id, "map");
    next = dropHotspots(next, id, sceneId, "map");
  }
  return { ...next, updatedAt: now };
}

/** Empties the plane and removes every map link. */
export function clearPlane(tour: Tour, now = Date.now()): Tour {
  const scenes = Object.fromEntries(
    Object.entries(tour.scenes).map(([id, s]) => [
      id,
      { ...s, mapPos: null, hotspots: s.hotspots.filter((h) => h.source !== "map") },
    ]),
  );
  return { ...tour, scenes, updatedAt: now };
}

/** Deletes every hotspot between two scenes, both ways. */
export function unlinkScenes(tour: Tour, a: string, b: string, now = Date.now()): Tour {
  if (!tour.scenes[a] || !tour.scenes[b]) return tour;
  return { ...dropHotspots(dropHotspots(tour, a, b), b, a), updatedAt: now };
}

export interface PlaneLink {
  a: string;
  b: string;
  /** Solid when any hotspot between them came from the map, dashed when all are hand-placed. */
  kind: "map" | "manual";
  aToB: boolean;
  bToA: boolean;
}

/** One line per linked pair of placed scenes. */
export function planeLinks(tour: Tour): PlaneLink[] {
  const placed = placedIds(tour);
  const links: PlaneLink[] = [];
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i];
      const b = placed[j];
      const ab = tour.scenes[a].hotspots.filter((h) => between(h, b));
      const ba = tour.scenes[b].hotspots.filter((h) => between(h, a));
      if (!ab.length && !ba.length) continue;
      const kind = [...ab, ...ba].some((h) => h.source === "map") ? "map" : "manual";
      links.push({ a, b, kind, aToB: ab.length > 0, bToA: ba.length > 0 });
    }
  }
  return links;
}

/** The parts of a tour the map edits, captured for undo and redo. */
export type PlaneSnapshot = Record<string, Pick<Scene, "mapPos" | "hotspots">>;

export function capturePlane(tour: Tour): PlaneSnapshot {
  return Object.fromEntries(
    Object.values(tour.scenes).map((s) => [s.id, { mapPos: s.mapPos, hotspots: s.hotspots }]),
  );
}

export function restorePlane(tour: Tour, snapshot: PlaneSnapshot, now = Date.now()): Tour {
  const scenes = { ...tour.scenes };
  for (const [id, saved] of Object.entries(snapshot)) {
    if (!scenes[id]) continue;
    // Hotspots to scenes deleted since the snapshot are left out.
    const hotspots = saved.hotspots.filter((h) => tour.scenes[h.targetSceneId]);
    scenes[id] = { ...scenes[id], mapPos: saved.mapPos, hotspots };
  }
  return { ...tour, scenes, updatedAt: now };
}
