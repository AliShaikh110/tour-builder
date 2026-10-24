"use client";

import type { Viewer, events } from "@photo-sphere-viewer/core";
import type { MarkerConfig, MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import { useEffect, useEffectEvent, useRef, type RefObject } from "react";
import { spotMarkerId, type SpotRef } from "@/components/viewer/spot-markup";
import type { SphericalPosition } from "@/lib/types";

type ViewerRef = RefObject<Viewer | null>;

/**
 * Keeps the markers plugin in step with `markers`, diffing by id so hover
 * state and tooltips survive unrelated re-renders.
 */
export function useMarkerSync(viewerRef: ViewerRef, viewerGeneration: number, markers: MarkerConfig[]) {
  const synced = useRef<{ viewer: Viewer | null; configs: Map<string, string> }>({
    viewer: null,
    configs: new Map(),
  });
  const json = JSON.stringify(markers);

  useEffect(() => {
    const viewer = viewerRef.current;
    const plugin = viewer?.getPlugin<MarkersPlugin>("markers");
    if (!viewer || !plugin) return;
    const state = synced.current;
    if (state.viewer !== viewer) {
      state.viewer = viewer;
      state.configs = new Map();
    }
    const list = JSON.parse(json) as MarkerConfig[];
    const next = new Map(list.map((m) => [m.id, JSON.stringify(m)]));
    const removed = [...state.configs.keys()].filter((id) => !next.has(id));
    if (removed.length) plugin.removeMarkers(removed, false);
    for (const marker of list) {
      const previous = state.configs.get(marker.id);
      if (previous === undefined) plugin.addMarker(marker, false);
      else if (previous !== next.get(marker.id)) plugin.updateMarker(marker, false);
    }
    plugin.renderMarkers();
    state.configs = next;
  }, [viewerRef, viewerGeneration, json]);
}

function spotElement(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>("[data-spot-id]") : null;
}

function spotRef(element: HTMLElement): SpotRef {
  return { type: element.dataset.spotType === "infospot" ? "infospot" : "hotspot", id: element.dataset.spotId! };
}

export interface SpotPointerHandlers {
  /** Click, tap, Enter or Space on a spot. `point` is in client coordinates. */
  onActivate: (spot: SpotRef, point: { x: number; y: number }) => void;
  /** Live position while dragging (only when `draggable`). */
  onDragMove?: (spot: SpotRef, position: SphericalPosition) => void;
  onDragEnd?: (spot: SpotRef, position: SphericalPosition) => void;
}

/**
 * Pointer and keyboard handling for spot markers. Presses on a spot are kept
 * away from Photo Sphere Viewer (so the view doesn't spin), then become a
 * click, or a drag once the pointer moves a few pixels. While dragging, the
 * marker follows the pointer directly through the markers plugin.
 */
export function useSpotPointer(
  viewerRef: ViewerRef,
  viewerGeneration: number,
  draggable: boolean,
  handlers: SpotPointerHandlers,
) {
  const activate = useEffectEvent(handlers.onActivate);
  const dragMove = useEffectEvent((spot: SpotRef, p: SphericalPosition) => {
    viewerRef.current?.getPlugin<MarkersPlugin>("markers")?.updateMarker({ id: spotMarkerId(spot), position: p });
    handlers.onDragMove?.(spot, p);
  });
  const dragEnd = useEffectEvent((spot: SpotRef, p: SphericalPosition) => handlers.onDragEnd?.(spot, p));

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const container = viewer.container;
    let gesture: {
      spot: SpotRef;
      element: HTMLElement;
      pointerId: number;
      x: number;
      y: number;
      dragging: boolean;
      position: SphericalPosition | null;
    } | null = null;

    function toSpherical(event: PointerEvent): SphericalPosition {
      const rect = container.getBoundingClientRect();
      const { yaw, pitch } = viewer!.dataHelper.viewerCoordsToSphericalCoords({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
      return { yaw, pitch };
    }

    function stopGesture() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      gesture?.element.classList.remove("is-dragging");
      gesture = null;
    }

    function onMove(event: PointerEvent) {
      if (!gesture || event.pointerId !== gesture.pointerId || !draggable) return;
      if (!gesture.dragging && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 5) return;
      gesture.dragging = true;
      gesture.element.classList.add("is-dragging");
      gesture.position = toSpherical(event);
      dragMove(gesture.spot, gesture.position);
    }

    function onUp(event: PointerEvent) {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      const { spot, dragging, position } = gesture;
      stopGesture();
      if (dragging && position) dragEnd(spot, position);
      else activate(spot, { x: event.clientX, y: event.clientY });
    }

    function onCancel(event: PointerEvent) {
      if (gesture && event.pointerId === gesture.pointerId) stopGesture();
    }

    function onDown(event: PointerEvent) {
      const element = spotElement(event.target);
      if (!element || event.button !== 0 || gesture) return;
      // Cancelling pointerdown also suppresses the mouse events PSV listens to.
      event.preventDefault();
      event.stopPropagation();
      gesture = {
        spot: spotRef(element),
        element,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        dragging: false,
        position: null,
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    }

    // Touch events are not cancelled by pointerdown; keep them from PSV too.
    function swallow(event: Event) {
      if (spotElement(event.target)) event.stopPropagation();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter" && event.key !== " ") return;
      const element = spotElement(event.target);
      if (!element) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = element.getBoundingClientRect();
      activate(spotRef(element), { x: rect.left + rect.width / 2, y: rect.bottom });
    }

    container.addEventListener("pointerdown", onDown, true);
    container.addEventListener("mousedown", swallow, true);
    container.addEventListener("touchstart", swallow, true);
    container.addEventListener("keydown", onKeyDown, true);
    return () => {
      stopGesture();
      container.removeEventListener("pointerdown", onDown, true);
      container.removeEventListener("mousedown", swallow, true);
      container.removeEventListener("touchstart", swallow, true);
      container.removeEventListener("keydown", onKeyDown, true);
    };
  }, [viewerRef, viewerGeneration, draggable]);
}

/** While `onClick` is set, a click on the panorama reports where it landed. */
export function usePanoramaClick(
  viewerRef: ViewerRef,
  viewerGeneration: number,
  onClick: ((position: SphericalPosition) => void) | null,
) {
  const active = onClick !== null;
  const handle = useEffectEvent((position: SphericalPosition) => onClick?.(position));

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !active) return;
    const listener = (event: events.ClickEvent) => {
      if (event.data.rightclick) return;
      handle({ yaw: event.data.yaw, pitch: event.data.pitch });
    };
    viewer.addEventListener("click", listener);
    viewer.setCursor("crosshair");
    return () => {
      viewer.removeEventListener("click", listener);
      viewer.setCursor(null);
    };
  }, [viewerRef, viewerGeneration, active]);
}
