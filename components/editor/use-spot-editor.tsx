"use client";

import type { Viewer } from "@photo-sphere-viewer/core";
import { ArrowRightToLine, Eye, MousePointerClick, PencilLine, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode, type RefObject } from "react";
import { toast } from "sonner";
import { InfospotModal } from "@/components/viewer/infospot-modal";
import { hotspotMarker, infospotMarker, type SpotRef, type SpotType } from "@/components/viewer/spot-markup";
import { cleanInfospot, infospotLabel } from "@/lib/infospots";
import { deleteMedia } from "@/lib/media-db";
import { useTourStore } from "@/lib/store";
import type { Infospot, LinkHotspot, Scene, SphericalPosition, Tour } from "@/lib/types";
import { DiscardDialog } from "./discard-dialog";
import { editHotspotDraft, isDraftDirty, newHotspotDraft, type HotspotDraft } from "./hotspot-draft";
import { HotspotPanel } from "./hotspot-panel";
import { editInfospotDraft, isInfospotDraftDirty, newInfospotDraft, type InfospotDraft } from "./infospot-draft";
import { InfospotPanel } from "./infospot-panel";
import { SpotMenu, type SpotMenuState } from "./spot-menu";
import { useMarkerSync, usePanoramaClick, useSpotPointer } from "./use-spot-layer";

/** Toasts with an Undo action stay up long enough to reach the button. */
export const UNDO_TOAST_MS = 8000;

/** What a hotspot is called: its own title, else its destination's name. */
export function hotspotTitle(tour: Tour, hotspot: LinkHotspot): string {
  return hotspot.title?.trim() || tour.scenes[hotspot.targetSceneId]?.name || "Choose a destination";
}

/** Images uploaded while editing that the saved infospot no longer uses. */
function unusedImages(draft: InfospotDraft, kept: string | undefined): string[] {
  return [...draft.uploads, draft.original?.imageKey].filter((k): k is string => !!k && k !== kept);
}

/**
 * Everything about placing, editing, moving and opening hotspots and
 * infospots in the editor. Returns the pieces the editor lays out.
 */
export function useSpotEditor({
  tour,
  currentId,
  shownScene,
  editing,
  viewerRef,
  viewerGeneration,
  onTravel,
}: {
  tour: Tour;
  currentId: string | null;
  /** The scene whose panorama is on screen (null while loading or for 2D scenes). */
  shownScene: Scene | null;
  editing: boolean;
  viewerRef: RefObject<Viewer | null>;
  viewerGeneration: number;
  /** Follow a hotspot to its scene. */
  onTravel: (hotspot: LinkHotspot) => void;
}) {
  const saveHotspot = useTourStore((s) => s.saveHotspot);
  const deleteHotspot = useTourStore((s) => s.deleteHotspot);
  const saveInfospot = useTourStore((s) => s.saveInfospot);
  const deleteInfospot = useTourStore((s) => s.deleteInfospot);

  const [placing, setPlacing] = useState<SpotType | null>(null);
  const [hotspotDraftState, setHotspotDraft] = useState<HotspotDraft | null>(null);
  const [infospotDraftState, setInfospotDraft] = useState<InfospotDraft | null>(null);
  const [menu, setMenu] = useState<SpotMenuState | null>(null);
  const [preview, setPreview] = useState<Infospot | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Drafts belong to one scene; switching scenes (e.g. after a delete) drops them.
  const hotspotDraft = hotspotDraftState?.sceneId === currentId ? hotspotDraftState : null;
  const infospotDraft = infospotDraftState?.sceneId === currentId ? infospotDraftState : null;
  const placingActive = editing && shownScene ? placing : null;
  const dirty = isDraftDirty(hotspotDraft) || isInfospotDraftDirty(infospotDraft);

  // --- Guard ------------------------------------------------------------------

  function discardDrafts() {
    if (infospotDraftState) {
      const kept = infospotDraftState.original?.imageKey;
      const unsaved = infospotDraftState.uploads.filter((k) => k !== kept);
      if (unsaved.length) void deleteMedia(unsaved).catch(() => undefined);
    }
    setHotspotDraft(null);
    setInfospotDraft(null);
    setPlacing(null);
  }

  /** Runs `action`, first asking to discard an unsaved hotspot or infospot. */
  function guard(action: () => void) {
    const run = () => {
      discardDrafts();
      action();
    };
    if (dirty) setPendingAction(() => run);
    else run();
  }

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!placingActive) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setPlacing(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placingActive]);

  // --- Markers ----------------------------------------------------------------

  const markers = useMemo(() => {
    if (!shownScene) return [];
    const hint = editing ? "Click to edit · drag to move" : undefined;
    const list = [
      ...shownScene.hotspots
        .filter((h) => h.id !== hotspotDraft?.hotspot.id)
        .map((h) => hotspotMarker(h, { title: hotspotTitle(tour, h), hint })),
      ...shownScene.infospots
        .filter((i) => i.id !== infospotDraft?.spot.id)
        .map((i) => infospotMarker(i, { title: infospotLabel(i), hint })),
    ];
    if (hotspotDraft) {
      list.push(
        hotspotMarker(hotspotDraft.hotspot, {
          title: hotspotTitle(tour, hotspotDraft.hotspot),
          hint: "Drag to move",
          editing: true,
        }),
      );
    }
    if (infospotDraft) {
      list.push(
        infospotMarker(infospotDraft.spot, { title: infospotLabel(infospotDraft.spot), hint: "Drag to move", editing: true }),
      );
    }
    return list;
  }, [shownScene, hotspotDraft, infospotDraft, editing, tour]);

  useMarkerSync(viewerRef, viewerGeneration, markers);

  const findHotspot = (id: string) => shownScene?.hotspots.find((h) => h.id === id);
  const findInfospot = (id: string) => shownScene?.infospots.find((i) => i.id === id);
  const isDraft = (ref: SpotRef) =>
    ref.type === "hotspot" ? hotspotDraft?.hotspot.id === ref.id : infospotDraft?.spot.id === ref.id;

  // --- Actions ----------------------------------------------------------------

  function removeHotspot(sceneId: string, hotspotId: string) {
    const removed = deleteHotspot(tour.id, sceneId, hotspotId);
    if (!removed) return;
    toast.success("Hotspot deleted", {
      duration: UNDO_TOAST_MS,
      action: { label: "Undo", onClick: () => saveHotspot(tour.id, sceneId, removed) },
    });
  }

  function removeInfospot(sceneId: string, spotId: string) {
    const removed = deleteInfospot(tour.id, sceneId, spotId);
    if (!removed) return;
    let undone = false;
    // The image is only deleted once the Undo chance has passed.
    const forget = () => {
      if (!undone && removed.imageKey) void deleteMedia([removed.imageKey]).catch(() => undefined);
    };
    toast.success("Infospot deleted", {
      duration: UNDO_TOAST_MS,
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          saveInfospot(tour.id, sceneId, removed);
        },
      },
      onAutoClose: forget,
      onDismiss: forget,
    });
  }

  function openMenu(ref: SpotRef, point: { x: number; y: number }) {
    if (!shownScene) return;
    const sceneId = shownScene.id;
    if (ref.type === "hotspot") {
      const hotspot = findHotspot(ref.id);
      if (!hotspot) return;
      setMenu({
        title: hotspotTitle(tour, hotspot),
        ...point,
        actions: [
          { label: "Go to scene", icon: ArrowRightToLine, onSelect: () => onTravel(hotspot) },
          { label: "Edit hotspot", icon: PencilLine, onSelect: () => setHotspotDraft(editHotspotDraft(sceneId, hotspot)) },
          { label: "Delete hotspot", icon: Trash2, destructive: true, onSelect: () => removeHotspot(sceneId, hotspot.id) },
        ],
      });
    } else {
      const spot = findInfospot(ref.id);
      if (!spot) return;
      setMenu({
        title: infospotLabel(spot),
        ...point,
        actions: [
          { label: "Preview infospot", icon: Eye, onSelect: () => setPreview(spot) },
          { label: "Edit infospot", icon: PencilLine, onSelect: () => setInfospotDraft(editInfospotDraft(sceneId, spot)) },
          { label: "Delete infospot", icon: Trash2, destructive: true, onSelect: () => removeInfospot(sceneId, spot.id) },
        ],
      });
    }
  }

  useSpotPointer(viewerRef, viewerGeneration, editing, {
    onActivate(ref, point) {
      if (placingActive || isDraft(ref)) return;
      if (!editing) {
        // Viewing mode behaves like the visitor's viewer.
        if (ref.type === "hotspot") {
          const hotspot = findHotspot(ref.id);
          if (hotspot) onTravel(hotspot);
        } else {
          setPreview(findInfospot(ref.id) ?? null);
        }
        return;
      }
      guard(() => openMenu(ref, point));
    },
    onDragEnd(ref, position) {
      if (!shownScene) return;
      if (ref.type === "hotspot") {
        if (hotspotDraft?.hotspot.id === ref.id) {
          setHotspotDraft({ ...hotspotDraft, hotspot: { ...hotspotDraft.hotspot, position } });
          return;
        }
        const hotspot = findHotspot(ref.id);
        if (hotspot) saveHotspot(tour.id, shownScene.id, { ...hotspot, position });
      } else {
        if (infospotDraft?.spot.id === ref.id) {
          setInfospotDraft({ ...infospotDraft, spot: { ...infospotDraft.spot, position } });
          return;
        }
        const spot = findInfospot(ref.id);
        if (spot) saveInfospot(tour.id, shownScene.id, { ...spot, position });
      }
    },
  });

  usePanoramaClick(
    viewerRef,
    viewerGeneration,
    placingActive && shownScene
      ? (position: SphericalPosition) => {
          setPlacing(null);
          if (placingActive === "hotspot") setHotspotDraft(newHotspotDraft(tour, shownScene.id, position));
          else setInfospotDraft(newInfospotDraft(shownScene.id, position));
        }
      : null,
  );

  function startPlacing(type: SpotType) {
    guard(() => {
      setMenu(null);
      setPlacing(type);
    });
  }

  function saveHotspotDraft() {
    if (!hotspotDraft) return;
    const target = tour.scenes[hotspotDraft.hotspot.targetSceneId];
    if (!target) return;
    const hotspot = { ...hotspotDraft.hotspot, title: hotspotDraft.hotspot.title?.trim() || null };
    const { linkback } = saveHotspot(tour.id, hotspotDraft.sceneId, hotspot, {
      linkback: hotspotDraft.linkback,
      applyStyleToAll: hotspotDraft.applyStyleToAll,
    });
    toast.success(hotspotDraft.original ? "Hotspot updated" : "Hotspot added", {
      description: linkback ? `A hotspot leading back was added in “${target.name}”.` : undefined,
    });
    setHotspotDraft(null);
  }

  function saveInfospotDraft() {
    if (!infospotDraft) return;
    const spot = cleanInfospot(infospotDraft.spot);
    saveInfospot(tour.id, infospotDraft.sceneId, spot);
    const unused = unusedImages(infospotDraft, spot.imageKey);
    if (unused.length) void deleteMedia(unused).catch(() => undefined);
    toast.success(infospotDraft.original ? "Infospot updated" : "Infospot added");
    setInfospotDraft(null);
  }

  // --- Rendering --------------------------------------------------------------

  let panel: ReactNode = null;
  if (hotspotDraft) {
    panel = (
      <HotspotPanel
        key={hotspotDraft.hotspot.id}
        tour={tour}
        draft={hotspotDraft}
        onChange={setHotspotDraft}
        onSave={saveHotspotDraft}
        onDelete={() => {
          if (hotspotDraft.original) removeHotspot(hotspotDraft.sceneId, hotspotDraft.original.id);
          setHotspotDraft(null);
        }}
        onClose={() => guard(() => undefined)}
      />
    );
  } else if (infospotDraft) {
    panel = (
      <InfospotPanel
        key={infospotDraft.spot.id}
        tour={tour}
        draft={infospotDraft}
        onChange={setInfospotDraft}
        onSave={saveInfospotDraft}
        onDelete={() => {
          const { original, sceneId } = infospotDraft;
          discardDrafts();
          if (original) removeInfospot(sceneId, original.id);
        }}
        onClose={() => guard(() => undefined)}
      />
    );
  }

  const banner = placingActive ? (
    <p className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-[0_12px_32px_-12px_oklch(0_0_0/0.8)]">
      <MousePointerClick className="size-4" aria-hidden="true" />
      {placingActive === "hotspot" ? "Click to set a hotspot" : "Click to set an infospot"}
    </p>
  ) : null;

  const overlays = (
    <>
      <SpotMenu menu={menu} onClose={() => setMenu(null)} />
      <InfospotModal spot={preview} onClose={() => setPreview(null)} />
      <DiscardDialog
        open={pendingAction !== null}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          const action = pendingAction;
          setPendingAction(null);
          action?.();
        }}
      />
    </>
  );

  return {
    dirty,
    guard,
    placing: placingActive,
    startPlacing,
    cancelPlacing: () => setPlacing(null),
    panel,
    banner,
    overlays,
  };
}
