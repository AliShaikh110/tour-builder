import { createInfospotRecord } from "@/lib/infospots";
import type { Infospot, SphericalPosition } from "@/lib/types";

/** An infospot being placed or edited in the side panel, not yet saved. */
export interface InfospotDraft {
  sceneId: string;
  /** The saved version, or null for a new infospot. */
  original: Infospot | null;
  /** Working copy; may hold fields of several kinds until it is saved. */
  spot: Infospot;
  /** Images uploaded while editing, so unsaved ones can be deleted on discard. */
  uploads: string[];
}

export function newInfospotDraft(sceneId: string, position: SphericalPosition): InfospotDraft {
  return { sceneId, original: null, spot: createInfospotRecord(position), uploads: [] };
}

export function editInfospotDraft(sceneId: string, spot: Infospot): InfospotDraft {
  return { sceneId, original: spot, spot: { ...spot }, uploads: [] };
}

/** A placed-but-unsaved infospot always counts as a change. */
export function isInfospotDraftDirty(draft: InfospotDraft | null): boolean {
  if (!draft) return false;
  if (!draft.original) return true;
  return JSON.stringify(draft.spot) !== JSON.stringify(draft.original);
}
