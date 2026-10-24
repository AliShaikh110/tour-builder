import { clampPitch, normalizeAngle } from "./geometry";
import { infospotLabel } from "./infospots";
import type { CameraView, DisplayType, HotspotStyle, InfospotKind, Tour } from "./types";
import { hotspotTitle, ribbonScenes } from "./viewer-config";

export const SDK_VERSION = "1.0";

export interface SdkScene {
  id: string;
  name: string;
  /** Position in the tour order, from 0. */
  index: number;
  displayType: DisplayType;
  hiddenFromRibbon: boolean;
  initialView: CameraView | null;
}

export interface SdkHotspot {
  id: string;
  targetSceneId: string;
  /** The hotspot's title, or the destination scene's name. */
  title: string;
  position: { yaw: number; pitch: number };
  style: HotspotStyle;
}

export interface SdkInfospot {
  id: string;
  kind: InfospotKind;
  label: string;
  position: { yaw: number; pitch: number };
}

export interface TourSdkEvents {
  "scene:loaded": { sceneId: string; name: string; via: "hotspot" | "direct" };
  "hotspot:click": { sceneId: string; hotspotId: string; targetSceneId: string; title: string };
  "infospot:open": { sceneId: string; infospotId: string; kind: InfospotKind; label: string };
  "camera:idle": { sceneId: string | null; yaw: number; pitch: number; zoom: number };
}

export type TourSdkEvent = keyof TourSdkEvents;
type Listener<E extends TourSdkEvent> = (data: TourSdkEvents[E]) => void;

/** What the viewer provides so the SDK can read and drive it. */
export interface TourSdkHost {
  getTour(): Tour;
  getCurrentSceneId(): string | null;
  getCamera(): CameraView | null;
  goToScene(sceneId: string): Promise<boolean>;
  lookAt(view: { yaw: number; pitch: number; zoom?: number }, animate: boolean): Promise<void>;
  setAutoRotate(on: boolean): void;
}

/**
 * `window.TourSDK` on viewer pages. Angles are radians (yaw 0 = the photo's
 * centre, increasing to the right; pitch 0 = the horizon, up is positive);
 * zoom is 0–100.
 */
export class TourSDK {
  readonly version = SDK_VERSION;
  private listeners = new Map<TourSdkEvent, Set<Listener<TourSdkEvent>>>();

  constructor(private host: TourSdkHost) {}

  /** A copy of the whole tour (scenes, hotspots, infospots, settings). */
  getTour(): Tour {
    return structuredClone(this.host.getTour());
  }

  getScenes(): SdkScene[] {
    const tour = this.host.getTour();
    return tour.sceneOrder.map((id, index) => {
      const s = tour.scenes[id];
      return {
        id,
        name: s.name,
        index,
        displayType: s.displayType,
        hiddenFromRibbon: s.hiddenFromRibbon,
        initialView: s.initialView ? { ...s.initialView } : null,
      };
    });
  }

  getCurrentScene(): SdkScene | null {
    const id = this.host.getCurrentSceneId();
    return this.getScenes().find((s) => s.id === id) ?? null;
  }

  /** Hotspots of a scene (the current one when no id is given). */
  getHotspots(sceneId?: string): SdkHotspot[] {
    const tour = this.host.getTour();
    const scene = tour.scenes[sceneId ?? this.host.getCurrentSceneId() ?? ""];
    return (scene?.hotspots ?? []).map((h) => ({
      id: h.id,
      targetSceneId: h.targetSceneId,
      title: hotspotTitle(tour, h),
      position: { ...h.position },
      style: h.style,
    }));
  }

  /** Infospots of a scene (the current one when no id is given). */
  getInfospots(sceneId?: string): SdkInfospot[] {
    const scene = this.host.getTour().scenes[sceneId ?? this.host.getCurrentSceneId() ?? ""];
    return (scene?.infospots ?? []).map((i) => ({
      id: i.id,
      kind: i.kind,
      label: infospotLabel(i),
      position: { ...i.position },
    }));
  }

  getCamera(): CameraView | null {
    return this.host.getCamera();
  }

  /** Opens a scene at its initial view. Resolves false for an unknown id. */
  goToScene(sceneId: string): Promise<boolean> {
    if (!this.host.getTour().scenes[sceneId]) return Promise.resolve(false);
    return this.host.goToScene(sceneId);
  }

  /** The next scene in ribbon order (as the › arrow). */
  next(): Promise<boolean> {
    return this.step(1);
  }

  /** The previous scene in ribbon order (as the ‹ arrow). */
  prev(): Promise<boolean> {
    return this.step(-1);
  }

  /** Turns the camera; animated unless `{ animate: false }`. */
  lookAt(view: { yaw: number; pitch?: number; zoom?: number }, options: { animate?: boolean } = {}): Promise<void> {
    if (!Number.isFinite(view.yaw) || (view.pitch !== undefined && !Number.isFinite(view.pitch))) {
      return Promise.reject(new TypeError("lookAt needs numeric yaw and pitch, in radians"));
    }
    const zoom = view.zoom === undefined ? undefined : Math.min(100, Math.max(0, view.zoom));
    return this.host.lookAt(
      { yaw: normalizeAngle(view.yaw), pitch: clampPitch(view.pitch ?? 0), zoom },
      options.animate ?? true,
    );
  }

  setAutoRotate(on: boolean): void {
    this.host.setAutoRotate(on);
  }

  /** Listens for an event; returns a function that stops listening. */
  on<E extends TourSdkEvent>(event: E, listener: Listener<E>): () => void {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(listener as Listener<TourSdkEvent>);
    return () => this.off(event, listener);
  }

  off<E extends TourSdkEvent>(event: E, listener: Listener<E>): void {
    this.listeners.get(event)?.delete(listener as Listener<TourSdkEvent>);
  }

  /** @internal Called by the viewer. */
  emit<E extends TourSdkEvent>(event: E, data: TourSdkEvents[E]): void {
    for (const listener of this.listeners.get(event) ?? []) {
      try {
        listener(data);
      } catch (error) {
        console.error(`TourSDK "${event}" listener failed`, error);
      }
    }
  }

  private step(direction: 1 | -1): Promise<boolean> {
    const tour = this.host.getTour();
    const order = ribbonScenes(tour);
    if (order.length === 0) return Promise.resolve(false);
    const index = order.indexOf(this.host.getCurrentSceneId() ?? "");
    const target = order[(Math.max(index, direction === 1 ? -1 : 0) + direction + order.length) % order.length];
    return this.host.goToScene(target);
  }
}

const BRIDGE_METHODS = [
  "getTour",
  "getScenes",
  "getCurrentScene",
  "getHotspots",
  "getInfospots",
  "getCamera",
  "goToScene",
  "next",
  "prev",
  "lookAt",
  "setAutoRotate",
] as const;

const BRIDGE_EVENTS: TourSdkEvent[] = ["scene:loaded", "hotspot:click", "infospot:open", "camera:idle"];

/**
 * Lets the page embedding `/embed/[id]` use the SDK across origins:
 * it posts `{ toursdk: 1, id, method, args }` and gets `{ toursdk: 1, id,
 * result }` or `{ …, error }` back; events arrive as `{ toursdk: 1, event, data }`.
 */
export function connectParentBridge(sdk: TourSDK): () => void {
  if (window.parent === window) return () => undefined;

  const onMessage = async (event: MessageEvent) => {
    if (event.source !== window.parent) return;
    const request = event.data as { toursdk?: number; id?: unknown; method?: string; args?: unknown[] } | null;
    if (request?.toursdk !== 1 || typeof request.method !== "string") return;
    // Pages opened from disk report the origin "null", which postMessage can't target.
    const origin = event.origin && event.origin !== "null" ? event.origin : "*";
    const reply = (body: Record<string, unknown>) =>
      window.parent.postMessage({ toursdk: 1, id: request.id, ...body }, origin);
    if (!(BRIDGE_METHODS as readonly string[]).includes(request.method)) {
      reply({ error: `Unknown method "${request.method}"` });
      return;
    }
    try {
      const method = sdk[request.method as (typeof BRIDGE_METHODS)[number]] as (...args: unknown[]) => unknown;
      reply({ result: await method.apply(sdk, Array.isArray(request.args) ? request.args : []) });
    } catch (error) {
      reply({ error: error instanceof Error ? error.message : String(error) });
    }
  };
  window.addEventListener("message", onMessage);

  const stops = BRIDGE_EVENTS.map((name) =>
    sdk.on(name, (data) => window.parent.postMessage({ toursdk: 1, event: name, data }, "*")),
  );
  window.parent.postMessage({ toursdk: 1, event: "ready", data: { version: SDK_VERSION } }, "*");

  return () => {
    window.removeEventListener("message", onMessage);
    for (const stop of stops) stop();
  };
}

declare global {
  interface Window {
    TourSDK?: TourSDK;
  }
}
