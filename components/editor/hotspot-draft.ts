import { createHotspotRecord } from "@/lib/store";
import type { HotspotStyle, LinkHotspot, SphericalPosition, Tour } from "@/lib/types";

/** A hotspot being placed or edited in the side panel, not yet saved. */
export interface HotspotDraft {
  /** Scene the hotspot sits in. */
  sceneId: string;
  /** The saved version, or null for a new hotspot. */
  original: LinkHotspot | null;
  /** Working copy. `targetSceneId` is "" until a destination is chosen. */
  hotspot: LinkHotspot;
  linkback: boolean;
  applyStyleToAll: boolean;
}

/** New hotspots reuse the style already used in the tour, so a tour stays consistent. */
function preferredStyle(tour: Tour, sceneId: string): HotspotStyle {
  const local = tour.scenes[sceneId]?.hotspots.at(-1);
  if (local) return local.style;
  for (const scene of Object.values(tour.scenes)) {
    const any = scene.hotspots.at(-1);
    if (any) return any.style;
  }
  return "arrow-ring";
}

export function newHotspotDraft(tour: Tour, sceneId: string, position: SphericalPosition): HotspotDraft {
  return {
    sceneId,
    original: null,
    hotspot: createHotspotRecord("", position, { style: preferredStyle(tour, sceneId) }),
    linkback: true,
    applyStyleToAll: false,
  };
}

export function editHotspotDraft(sceneId: string, hotspot: LinkHotspot): HotspotDraft {
  return { sceneId, original: hotspot, hotspot: { ...hotspot }, linkback: false, applyStyleToAll: false };
}

/** A placed-but-unsaved hotspot always counts as a change. */
export function isDraftDirty(draft: HotspotDraft | null): boolean {
  if (!draft) return false;
  if (!draft.original) return true;
  return draft.applyStyleToAll || draft.linkback || JSON.stringify(draft.hotspot) !== JSON.stringify(draft.original);
}
