import { create } from "zustand";
import { DEFAULT_SETTINGS } from "./constants";
import { LINKBACK_PITCH, linkbackYaw } from "./geometry";
import type {
  CameraView,
  DisplayType,
  HotspotStyle,
  Infospot,
  LinkHotspot,
  Scene,
  SphericalPosition,
  Tour,
  TourAudience,
  TourCategory,
  TourSettings,
} from "./types";
import { newId } from "./utils";

export interface NewTourInput {
  title: string;
  category: TourCategory;
  address?: string;
  audience?: TourAudience;
}

export interface NewSceneInput {
  name: string;
  mediaKey: string;
  thumbKey: string;
  width: number;
  height: number;
  displayType: DisplayType;
}

export type TourPatch = Partial<
  Pick<Tour, "title" | "category" | "address" | "audience" | "status" | "coverSceneId">
>;

export type ScenePatch = Partial<Omit<Scene, "id" | "hotspots" | "infospots">>;

/** A settings change; the nested ribbon and autoRotate groups merge field by field. */
export type SettingsPatch = Partial<Omit<TourSettings, "ribbon" | "autoRotate">> & {
  ribbon?: Partial<TourSettings["ribbon"]>;
  autoRotate?: Partial<TourSettings["autoRotate"]>;
};

export function mergeSettings(settings: TourSettings, patch: SettingsPatch): TourSettings {
  const next: TourSettings = {
    ...settings,
    ...patch,
    ribbon: { ...settings.ribbon, ...patch.ribbon },
    autoRotate: { ...settings.autoRotate, ...patch.autoRotate },
  };
  // An explicit undefined removes the ambient sound.
  if ("ambientSoundKey" in patch && patch.ambientSoundKey === undefined) delete next.ambientSoundKey;
  return next;
}

// ---------------------------------------------------------------------------
// Pure tour operations (unit tested; the store below only wires them up)
// ---------------------------------------------------------------------------

export function createTourRecord(input: NewTourInput, now = Date.now()): Tour {
  const address = input.address?.trim();
  return {
    id: newId(),
    title: input.title.trim() || "Untitled tour",
    category: input.category,
    ...(address ? { address } : {}),
    ...(input.audience ? { audience: input.audience } : {}),
    status: "draft",
    createdAt: now,
    updatedAt: now,
    sceneOrder: [],
    scenes: {},
    settings: structuredClone(DEFAULT_SETTINGS),
  };
}

export function createSceneRecord(input: NewSceneInput): Scene {
  return {
    id: newId(),
    name: input.name.trim() || "Untitled scene",
    mediaKey: input.mediaKey,
    thumbKey: input.thumbKey,
    displayType: input.displayType,
    width: input.width,
    height: input.height,
    hiddenFromRibbon: false,
    initialView: null,
    northOffset: 0,
    mapPos: null,
    hotspots: [],
    infospots: [],
  };
}

export function createHotspotRecord(
  targetSceneId: string,
  position: SphericalPosition,
  overrides: Partial<Omit<LinkHotspot, "id" | "targetSceneId" | "position">> = {},
): LinkHotspot {
  return {
    id: newId(),
    targetSceneId,
    position,
    style: "disc",
    title: null,
    scale: 1,
    opacity: 1,
    rotation: 0,
    source: "manual",
    ...overrides,
  };
}

/** Appends scenes to the end of the tour's scene order. */
export function addScenesToTour(tour: Tour, scenes: Scene[], now = Date.now()): Tour {
  if (scenes.length === 0) return tour;
  return {
    ...tour,
    scenes: { ...tour.scenes, ...Object.fromEntries(scenes.map((s) => [s.id, s])) },
    sceneOrder: [...tour.sceneOrder, ...scenes.map((s) => s.id)],
    updatedAt: now,
  };
}

/** Removes a scene and every hotspot (in any scene) that points to it. */
export function removeSceneFromTour(tour: Tour, sceneId: string, now = Date.now()): Tour {
  if (!tour.scenes[sceneId]) return tour;
  const scenes: Record<string, Scene> = {};
  for (const [id, scene] of Object.entries(tour.scenes)) {
    if (id === sceneId) continue;
    const hotspots = scene.hotspots.filter((h) => h.targetSceneId !== sceneId);
    scenes[id] = hotspots.length === scene.hotspots.length ? scene : { ...scene, hotspots };
  }
  const next: Tour = {
    ...tour,
    scenes,
    sceneOrder: tour.sceneOrder.filter((id) => id !== sceneId),
    updatedAt: now,
  };
  if (next.coverSceneId === sceneId) delete next.coverSceneId;
  return next;
}

export function updateSceneInTour(
  tour: Tour,
  sceneId: string,
  patch: ScenePatch,
  now = Date.now(),
): Tour {
  const scene = tour.scenes[sceneId];
  if (!scene) return tour;
  return { ...tour, scenes: { ...tour.scenes, [sceneId]: { ...scene, ...patch } }, updatedAt: now };
}

/** Applies a new scene order; ignored unless it is a permutation of the current one. */
export function reorderTourScenes(tour: Tour, order: string[], now = Date.now()): Tour {
  const current = new Set(tour.sceneOrder);
  const valid =
    order.length === tour.sceneOrder.length &&
    new Set(order).size === order.length &&
    order.every((id) => current.has(id));
  if (!valid || order.every((id, i) => id === tour.sceneOrder[i])) return tour;
  return { ...tour, sceneOrder: [...order], updatedAt: now };
}

/** Renames several scenes at once. Blank names keep the old name. */
export function renameTourScenes(
  tour: Tour,
  names: Record<string, string>,
  now = Date.now(),
): Tour {
  let changed = false;
  const scenes = { ...tour.scenes };
  for (const [id, raw] of Object.entries(names)) {
    const name = raw.trim();
    const scene = scenes[id];
    if (!scene || !name || name === scene.name) continue;
    scenes[id] = { ...scene, name };
    changed = true;
  }
  return changed ? { ...tour, scenes, updatedAt: now } : tour;
}

/** Initial views and "coming from" arrival views, captured so a reset can be undone. */
export interface ViewSnapshot {
  initial: Record<string, CameraView>;
  arrival: { sceneId: string; hotspotId: string; view: CameraView }[];
}

export function captureViews(tour: Tour): ViewSnapshot {
  const snapshot: ViewSnapshot = { initial: {}, arrival: [] };
  for (const scene of Object.values(tour.scenes)) {
    if (scene.initialView) snapshot.initial[scene.id] = scene.initialView;
    for (const h of scene.hotspots) {
      if (h.arrivalView) snapshot.arrival.push({ sceneId: scene.id, hotspotId: h.id, view: h.arrivalView });
    }
  }
  return snapshot;
}

/** Clears every initial view and every hotspot arrival view. */
export function resetTourInitialViews(tour: Tour, now = Date.now()): Tour {
  const scenes = Object.fromEntries(
    Object.entries(tour.scenes).map(([id, scene]) => {
      const hasArrival = scene.hotspots.some((h) => h.arrivalView);
      if (!scene.initialView && !hasArrival) return [id, scene];
      const hotspots = hasArrival
        ? scene.hotspots.map((h) => {
            if (!h.arrivalView) return h;
            const copy = { ...h };
            delete copy.arrivalView;
            return copy;
          })
        : scene.hotspots;
      return [id, { ...scene, initialView: null, hotspots }];
    }),
  );
  return { ...tour, scenes, updatedAt: now };
}

export function restoreTourViews(tour: Tour, snapshot: ViewSnapshot, now = Date.now()): Tour {
  const scenes = { ...tour.scenes };
  for (const [sceneId, view] of Object.entries(snapshot.initial)) {
    if (scenes[sceneId]) scenes[sceneId] = { ...scenes[sceneId], initialView: view };
  }
  for (const { sceneId, hotspotId, view } of snapshot.arrival) {
    const scene = scenes[sceneId];
    if (!scene) continue;
    scenes[sceneId] = {
      ...scene,
      hotspots: scene.hotspots.map((h) => (h.id === hotspotId ? { ...h, arrivalView: view } : h)),
    };
  }
  return { ...tour, scenes, updatedAt: now };
}

/**
 * Sets (or clears, with null) the arrival view on every hotspot in `fromSceneId`
 * that leads to `toSceneId`: the "Set Initial View Coming From…" option.
 */
export function setTourArrivalView(
  tour: Tour,
  fromSceneId: string,
  toSceneId: string,
  view: CameraView | null,
  now = Date.now(),
): Tour {
  const scene = tour.scenes[fromSceneId];
  if (!scene?.hotspots.some((h) => h.targetSceneId === toSceneId)) return tour;
  const hotspots = scene.hotspots.map((h) => {
    if (h.targetSceneId !== toSceneId) return h;
    const copy = { ...h };
    if (view) copy.arrivalView = view;
    else delete copy.arrivalView;
    return copy;
  });
  return { ...tour, scenes: { ...tour.scenes, [fromSceneId]: { ...scene, hotspots } }, updatedAt: now };
}

export function upsertInfospot(tour: Tour, sceneId: string, spot: Infospot, now = Date.now()): Tour {
  const scene = tour.scenes[sceneId];
  if (!scene) return tour;
  const exists = scene.infospots.some((i) => i.id === spot.id);
  const infospots = exists
    ? scene.infospots.map((i) => (i.id === spot.id ? spot : i))
    : [...scene.infospots, spot];
  return { ...tour, scenes: { ...tour.scenes, [sceneId]: { ...scene, infospots } }, updatedAt: now };
}

export function removeInfospot(tour: Tour, sceneId: string, spotId: string, now = Date.now()): Tour {
  const scene = tour.scenes[sceneId];
  if (!scene?.infospots.some((i) => i.id === spotId)) return tour;
  const infospots = scene.infospots.filter((i) => i.id !== spotId);
  return { ...tour, scenes: { ...tour.scenes, [sceneId]: { ...scene, infospots } }, updatedAt: now };
}

/** Adds the hotspot to the scene, or replaces the one with the same id. */
export function upsertHotspot(
  tour: Tour,
  sceneId: string,
  hotspot: LinkHotspot,
  now = Date.now(),
): Tour {
  const scene = tour.scenes[sceneId];
  if (!scene) return tour;
  const exists = scene.hotspots.some((h) => h.id === hotspot.id);
  const hotspots = exists
    ? scene.hotspots.map((h) => (h.id === hotspot.id ? hotspot : h))
    : [...scene.hotspots, hotspot];
  return { ...tour, scenes: { ...tour.scenes, [sceneId]: { ...scene, hotspots } }, updatedAt: now };
}

export function removeHotspot(tour: Tour, sceneId: string, hotspotId: string, now = Date.now()): Tour {
  const scene = tour.scenes[sceneId];
  if (!scene?.hotspots.some((h) => h.id === hotspotId)) return tour;
  const hotspots = scene.hotspots.filter((h) => h.id !== hotspotId);
  return { ...tour, scenes: { ...tour.scenes, [sceneId]: { ...scene, hotspots } }, updatedAt: now };
}

/**
 * The return hotspot for `hotspot` (placed in scene `fromSceneId`): in the
 * destination, pointing back, at the opposite compass bearing. Null when the
 * destination is missing or already links back.
 */
export function createLinkback(tour: Tour, fromSceneId: string, hotspot: LinkHotspot): LinkHotspot | null {
  const from = tour.scenes[fromSceneId];
  const to = tour.scenes[hotspot.targetSceneId];
  if (!from || !to || to.id === from.id) return null;
  if (to.hotspots.some((h) => h.targetSceneId === from.id)) return null;
  return createHotspotRecord(
    from.id,
    { yaw: linkbackYaw(hotspot.position.yaw, from.northOffset, to.northOffset), pitch: LINKBACK_PITCH },
    { style: hotspot.style, scale: hotspot.scale, opacity: hotspot.opacity, source: hotspot.source },
  );
}

/** Gives every hotspot in the tour the same style. */
export function applyHotspotStyle(tour: Tour, style: HotspotStyle, now = Date.now()): Tour {
  const scenes = Object.fromEntries(
    Object.entries(tour.scenes).map(([id, scene]) => [
      id,
      scene.hotspots.some((h) => h.style !== style)
        ? { ...scene, hotspots: scene.hotspots.map((h) => ({ ...h, style })) }
        : scene,
    ]),
  );
  return { ...tour, scenes, updatedAt: now };
}

/** Every media key (uploaded file) a tour references, e.g. for the .zip export. */
export function tourMediaKeys(tour: Tour): string[] {
  const keys: string[] = [];
  for (const scene of Object.values(tour.scenes)) {
    keys.push(scene.mediaKey, scene.thumbKey);
    for (const spot of scene.infospots) if (spot.imageKey) keys.push(spot.imageKey);
  }
  if (tour.settings.ambientSoundKey) keys.push(tour.settings.ambientSoundKey);
  return keys;
}

/** The scene shown on the dashboard card: the cover, else the first scene. */
export function coverScene(tour: Tour): Scene | undefined {
  const id = tour.coverSceneId ?? tour.sceneOrder[0];
  return id ? tour.scenes[id] : undefined;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * The tours open in this tab. Edits apply here instantly; lib/autosave.ts
 * sends each changed tour to the server shortly afterwards.
 */
interface TourStore {
  tours: Record<string, Tour>;
  /** Adds or replaces a whole tour (loaded from the server, or rebuilt by the map). */
  insertTour: (tour: Tour) => void;
  updateTour: (tourId: string, patch: TourPatch) => void;
  /** Returns the removed tour so the caller can delete its media. */
  deleteTour: (tourId: string) => Tour | undefined;
  addScenes: (tourId: string, inputs: NewSceneInput[]) => string[];
  /** Returns the removed scene so the caller can delete its media. */
  deleteScene: (tourId: string, sceneId: string) => Scene | undefined;
  /** Returns the scene as it was before the patch (e.g. to delete swapped-out media). */
  updateScene: (tourId: string, sceneId: string, patch: ScenePatch) => Scene | undefined;
  reorderScenes: (tourId: string, order: string[]) => void;
  renameScenes: (tourId: string, names: Record<string, string>) => void;
  /** Clears initial and arrival views; returns what was cleared so it can be restored. */
  resetInitialViews: (tourId: string) => ViewSnapshot;
  restoreViews: (tourId: string, snapshot: ViewSnapshot) => void;
  setArrivalView: (tourId: string, fromSceneId: string, toSceneId: string, view: CameraView | null) => void;
  saveInfospot: (tourId: string, sceneId: string, spot: Infospot) => void;
  /** Returns the removed infospot (for undo). */
  deleteInfospot: (tourId: string, sceneId: string, spotId: string) => Infospot | undefined;
  /** Returns the settings as they were before (e.g. to delete a replaced sound). */
  updateSettings: (tourId: string, patch: SettingsPatch) => TourSettings | undefined;
  /**
   * Adds or replaces a hotspot in one write, optionally creating the return
   * hotspot and restyling every hotspot. Returns the linkback, if one was made.
   */
  saveHotspot: (
    tourId: string,
    sceneId: string,
    hotspot: LinkHotspot,
    options?: { linkback?: boolean; applyStyleToAll?: boolean },
  ) => { linkback: LinkHotspot | null };
  /** Returns the removed hotspot (for undo). */
  deleteHotspot: (tourId: string, sceneId: string, hotspotId: string) => LinkHotspot | undefined;
}

export const useTourStore = create<TourStore>()((set, get) => {
  const replaceTour = (tour: Tour) =>
    set((state) => ({ tours: { ...state.tours, [tour.id]: tour } }));

  return {
    tours: {},

    insertTour: replaceTour,

    updateTour: (tourId, patch) => {
      const tour = get().tours[tourId];
      if (!tour) return;
      replaceTour({ ...tour, ...patch, updatedAt: Date.now() });
    },

    deleteTour: (tourId) => {
      const tour = get().tours[tourId];
      if (!tour) return undefined;
      set((state) => {
        const tours = { ...state.tours };
        delete tours[tourId];
        return { tours };
      });
      return tour;
    },

    addScenes: (tourId, inputs) => {
      const tour = get().tours[tourId];
      if (!tour) return [];
      const scenes = inputs.map(createSceneRecord);
      replaceTour(addScenesToTour(tour, scenes));
      return scenes.map((s) => s.id);
    },

    deleteScene: (tourId, sceneId) => {
      const tour = get().tours[tourId];
      const scene = tour?.scenes[sceneId];
      if (!tour || !scene) return undefined;
      replaceTour(removeSceneFromTour(tour, sceneId));
      return scene;
    },

    updateScene: (tourId, sceneId, patch) => {
      const tour = get().tours[tourId];
      const scene = tour?.scenes[sceneId];
      if (!tour || !scene) return undefined;
      replaceTour(updateSceneInTour(tour, sceneId, patch));
      return scene;
    },

    reorderScenes: (tourId, order) => {
      const tour = get().tours[tourId];
      if (!tour) return;
      const next = reorderTourScenes(tour, order);
      if (next !== tour) replaceTour(next);
    },

    renameScenes: (tourId, names) => {
      const tour = get().tours[tourId];
      if (!tour) return;
      const next = renameTourScenes(tour, names);
      if (next !== tour) replaceTour(next);
    },

    resetInitialViews: (tourId) => {
      const tour = get().tours[tourId];
      if (!tour) return { initial: {}, arrival: [] };
      const snapshot = captureViews(tour);
      replaceTour(resetTourInitialViews(tour));
      return snapshot;
    },

    restoreViews: (tourId, snapshot) => {
      const tour = get().tours[tourId];
      if (tour) replaceTour(restoreTourViews(tour, snapshot));
    },

    setArrivalView: (tourId, fromSceneId, toSceneId, view) => {
      const tour = get().tours[tourId];
      if (!tour) return;
      const next = setTourArrivalView(tour, fromSceneId, toSceneId, view);
      if (next !== tour) replaceTour(next);
    },

    saveInfospot: (tourId, sceneId, spot) => {
      const tour = get().tours[tourId];
      if (tour) replaceTour(upsertInfospot(tour, sceneId, spot));
    },

    updateSettings: (tourId, patch) => {
      const tour = get().tours[tourId];
      if (!tour) return undefined;
      replaceTour({ ...tour, settings: mergeSettings(tour.settings, patch), updatedAt: Date.now() });
      return tour.settings;
    },

    deleteInfospot: (tourId, sceneId, spotId) => {
      const tour = get().tours[tourId];
      const spot = tour?.scenes[sceneId]?.infospots.find((i) => i.id === spotId);
      if (!tour || !spot) return undefined;
      replaceTour(removeInfospot(tour, sceneId, spotId));
      return spot;
    },

    saveHotspot: (tourId, sceneId, hotspot, options = {}) => {
      let tour = get().tours[tourId];
      if (!tour?.scenes[sceneId]) return { linkback: null };
      tour = upsertHotspot(tour, sceneId, hotspot);
      const linkback = options.linkback ? createLinkback(tour, sceneId, hotspot) : null;
      if (linkback) tour = upsertHotspot(tour, hotspot.targetSceneId, linkback);
      if (options.applyStyleToAll) tour = applyHotspotStyle(tour, hotspot.style);
      replaceTour(tour);
      return { linkback };
    },

    deleteHotspot: (tourId, sceneId, hotspotId) => {
      const tour = get().tours[tourId];
      const hotspot = tour?.scenes[sceneId]?.hotspots.find((h) => h.id === hotspotId);
      if (!tour || !hotspot) return undefined;
      replaceTour(removeHotspot(tour, sceneId, hotspotId));
      return hotspot;
    },
  };
});

export function useTour(tourId: string): Tour | undefined {
  return useTourStore((state) => state.tours[tourId]);
}
