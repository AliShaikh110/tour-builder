import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { LINKBACK_PITCH, linkbackYaw } from "@/lib/geometry";
import { createInfospotRecord } from "@/lib/infospots";
import {
  addScenesToTour,
  applyHotspotStyle,
  coverScene,
  createLinkback,
  createHotspotRecord,
  createSceneRecord,
  createTourRecord,
  removeSceneFromTour,
  renameTourScenes,
  reorderTourScenes,
  resetTourInitialViews,
  setTourArrivalView,
  tourMediaKeys,
  useTourStore,
  type NewSceneInput,
  type NewTourInput,
} from "@/lib/store";

/** Puts a new tour in the store, as the editor has it after loading it from the server. */
function addTour(input: NewTourInput): string {
  const tour = createTourRecord(input);
  useTourStore.getState().insertTour(tour);
  return tour.id;
}

function sceneInput(name: string): NewSceneInput {
  return {
    name,
    mediaKey: `${name}-media`,
    thumbKey: `${name}-thumb`,
    width: 4000,
    height: 2000,
    displayType: "360",
  };
}

beforeEach(() => {
  localStorage.clear();
  useTourStore.setState({ tours: {} });
});

describe("createTourRecord", () => {
  it("creates a draft with defaults", () => {
    const tour = createTourRecord({ title: "  Campus Tour ", category: "education" }, 1000);
    expect(tour).toMatchObject({
      title: "Campus Tour",
      category: "education",
      status: "draft",
      createdAt: 1000,
      updatedAt: 1000,
      sceneOrder: [],
      scenes: {},
    });
    // A UUID, as the backend stores ids.
    expect(tour.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(tour).not.toHaveProperty("address");
    expect(tour.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("copies settings so tours never share them", () => {
    const tour = createTourRecord({ title: "A", category: "other" });
    tour.settings.ribbon.enabled = false;
    expect(DEFAULT_SETTINGS.ribbon.enabled).toBe(true);
  });

  it("keeps a trimmed address and falls back to a title", () => {
    const tour = createTourRecord({ title: " ", category: "retail", address: " 1 Main St " });
    expect(tour.title).toBe("Untitled tour");
    expect(tour.address).toBe("1 Main St");
  });
});

describe("store: tours", () => {
  it("adds a tour to state", () => {
    const id = addTour({ title: "Campus Tour", category: "education", audience: "me" });
    const tour = useTourStore.getState().tours[id];
    expect(tour.title).toBe("Campus Tour");
    expect(tour.audience).toBe("me");
  });

  it("appends scenes in order", () => {
    const store = useTourStore.getState();
    const id = addTour({ title: "T", category: "other" });
    const [gate] = store.addScenes(id, [sceneInput("Gate")]);
    const [library, lab] = store.addScenes(id, [sceneInput("Library"), sceneInput("Lab")]);
    const tour = useTourStore.getState().tours[id];
    expect(tour.sceneOrder).toEqual([gate, library, lab]);
    expect(tour.scenes[lab]).toMatchObject({
      name: "Lab",
      hiddenFromRibbon: false,
      initialView: null,
      hotspots: [],
    });
    expect(coverScene(tour)?.id).toBe(gate);
  });

  it("updates fields and bumps updatedAt", () => {
    const store = useTourStore.getState();
    const id = addTour({ title: "Old", category: "other" });
    useTourStore.setState((s) => ({ tours: { ...s.tours, [id]: { ...s.tours[id], updatedAt: 0 } } }));
    store.updateTour(id, { title: "New" });
    const tour = useTourStore.getState().tours[id];
    expect(tour.title).toBe("New");
    expect(tour.updatedAt).toBeGreaterThan(0);
  });

  it("deletes a tour and returns it for media cleanup", () => {
    const store = useTourStore.getState();
    const id = addTour({ title: "T", category: "other" });
    store.addScenes(id, [sceneInput("A")]);
    const removed = store.deleteTour(id);
    expect(removed?.id).toBe(id);
    expect(useTourStore.getState().tours[id]).toBeUndefined();
    expect(tourMediaKeys(removed!)).toEqual(["A-media", "A-thumb"]);
    expect(store.deleteTour("missing")).toBeUndefined();
  });
});

describe("delete scene", () => {
  function linkedTour() {
    const a = createSceneRecord(sceneInput("A"));
    const b = createSceneRecord(sceneInput("B"));
    const c = createSceneRecord(sceneInput("C"));
    a.hotspots.push(createHotspotRecord(b.id, { yaw: 1, pitch: 0 }));
    a.hotspots.push(createHotspotRecord(c.id, { yaw: 2, pitch: 0 }));
    b.hotspots.push(createHotspotRecord(a.id, { yaw: 3, pitch: 0 }));
    c.hotspots.push(createHotspotRecord(b.id, { yaw: 4, pitch: 0 }));
    const tour = addScenesToTour(createTourRecord({ title: "T", category: "other" }), [a, b, c]);
    return { tour: { ...tour, coverSceneId: b.id }, a, b, c };
  }

  it("removes the scene and every hotspot that points to it", () => {
    const { tour, a, b, c } = linkedTour();
    const next = removeSceneFromTour(tour, b.id);
    expect(next.sceneOrder).toEqual([a.id, c.id]);
    expect(next.scenes[b.id]).toBeUndefined();
    expect(next.scenes[a.id].hotspots.map((h) => h.targetSceneId)).toEqual([c.id]);
    expect(next.scenes[c.id].hotspots).toEqual([]);
    expect(next).not.toHaveProperty("coverSceneId");
  });

  it("only copies scenes whose hotspots changed", () => {
    const { tour, a, b, c } = linkedTour();
    const next = removeSceneFromTour(tour, a.id);
    expect(next.scenes[b.id].hotspots).toEqual([]);
    expect(next.scenes[b.id]).not.toBe(tour.scenes[b.id]);
    expect(next.scenes[c.id]).toBe(tour.scenes[c.id]);
    expect(removeSceneFromTour(next, "missing")).toBe(next);
  });

  it("works through the store and returns the removed scene", () => {
    const { tour, b } = linkedTour();
    const store = useTourStore.getState();
    store.insertTour(tour);
    const removed = store.deleteScene(tour.id, b.id);
    expect(removed?.name).toBe("B");
    const saved = useTourStore.getState().tours[tour.id];
    expect(Object.values(saved.scenes).flatMap((s) => s.hotspots).some((h) => h.targetSceneId === b.id)).toBe(false);
  });
});

describe("scene editing", () => {
  function tourWith(...names: string[]) {
    const scenes = names.map((n) => createSceneRecord(sceneInput(n)));
    return { tour: addScenesToTour(createTourRecord({ title: "T", category: "other" }), scenes), scenes };
  }

  it("reorders only with a permutation of the current scenes", () => {
    const { tour, scenes } = tourWith("A", "B", "C");
    const [a, b, c] = scenes.map((s) => s.id);
    expect(reorderTourScenes(tour, [c, a, b]).sceneOrder).toEqual([c, a, b]);
    expect(reorderTourScenes(tour, [a, b])).toBe(tour);
    expect(reorderTourScenes(tour, [a, a, b])).toBe(tour);
    expect(reorderTourScenes(tour, [a, b, "x"])).toBe(tour);
    expect(reorderTourScenes(tour, [a, b, c])).toBe(tour);
  });

  it("renames several scenes and ignores blank names", () => {
    const { tour, scenes } = tourWith("A", "B");
    const next = renameTourScenes(tour, { [scenes[0].id]: "  Gate ", [scenes[1].id]: "   " });
    expect(next.scenes[scenes[0].id].name).toBe("Gate");
    expect(next.scenes[scenes[1].id].name).toBe("B");
    expect(renameTourScenes(tour, { [scenes[0].id]: "A" })).toBe(tour);
  });

  it("swaps an image but keeps hotspots and returns the old media keys", () => {
    const { tour, scenes } = tourWith("A", "B");
    const [a, b] = scenes;
    a.hotspots.push(createHotspotRecord(b.id, { yaw: 1, pitch: 0 }));
    const store = useTourStore.getState();
    store.insertTour(tour);
    const previous = store.updateScene(tour.id, a.id, {
      mediaKey: "new-media",
      thumbKey: "new-thumb",
      width: 1000,
      height: 800,
      displayType: "2d",
    });
    expect(previous).toMatchObject({ mediaKey: "A-media", thumbKey: "A-thumb" });
    const swapped = useTourStore.getState().tours[tour.id].scenes[a.id];
    expect(swapped).toMatchObject({ name: "A", mediaKey: "new-media", displayType: "2d" });
    expect(swapped.hotspots).toHaveLength(1);
  });

  it("resets initial and arrival views, and restores them", () => {
    const { tour, scenes } = tourWith("A", "B");
    const [a, b] = scenes;
    const view = { yaw: 1, pitch: 0.2, zoom: 40 };
    const arrival = { yaw: 2, pitch: 0, zoom: 60 };
    tour.scenes[a.id].initialView = view;
    tour.scenes[b.id].hotspots.push({ ...createHotspotRecord(a.id, { yaw: 0, pitch: 0 }), arrivalView: arrival });
    const cleared = resetTourInitialViews(tour);
    expect(cleared.scenes[a.id].initialView).toBeNull();
    expect(cleared.scenes[b.id].hotspots[0]).not.toHaveProperty("arrivalView");

    const store = useTourStore.getState();
    store.insertTour(tour);
    const snapshot = store.resetInitialViews(tour.id);
    expect(snapshot.initial).toEqual({ [a.id]: view });
    expect(snapshot.arrival).toEqual([{ sceneId: b.id, hotspotId: tour.scenes[b.id].hotspots[0].id, view: arrival }]);
    expect(store.resetInitialViews(tour.id)).toEqual({ initial: {}, arrival: [] });

    store.restoreViews(tour.id, snapshot);
    const restored = useTourStore.getState().tours[tour.id];
    expect(restored.scenes[a.id].initialView).toEqual(view);
    expect(restored.scenes[b.id].hotspots[0].arrivalView).toEqual(arrival);
  });
});

describe("hotspots and linkback", () => {
  function twoScenes(northA = 0, northB = 0) {
    const a = { ...createSceneRecord(sceneInput("A")), northOffset: northA };
    const b = { ...createSceneRecord(sceneInput("B")), northOffset: northB };
    const tour = addScenesToTour(createTourRecord({ title: "T", category: "other" }), [a, b]);
    useTourStore.getState().insertTour(tour);
    return { tour, a, b };
  }

  it("adds a hotspot, then replaces it when saved again", () => {
    const { tour, a, b } = twoScenes();
    const store = useTourStore.getState();
    const hotspot = createHotspotRecord(b.id, { yaw: 1, pitch: -0.1 });
    store.saveHotspot(tour.id, a.id, hotspot);
    store.saveHotspot(tour.id, a.id, { ...hotspot, title: "Library", scale: 1.5 });
    const saved = useTourStore.getState().tours[tour.id].scenes[a.id].hotspots;
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ title: "Library", scale: 1.5, targetSceneId: b.id });
  });

  it("creates the linkback at the opposite bearing with the linkback pitch", () => {
    const { tour, a, b } = twoScenes(0.3, 1.9);
    const hotspot = createHotspotRecord(b.id, { yaw: 2, pitch: -0.4 }, { style: "sphere", scale: 1.2 });
    const { linkback } = useTourStore.getState().saveHotspot(tour.id, a.id, hotspot, { linkback: true });
    expect(linkback).toMatchObject({ targetSceneId: a.id, style: "sphere", scale: 1.2, title: null });
    expect(linkback!.position.yaw).toBeCloseTo(linkbackYaw(2, 0.3, 1.9), 12);
    expect(linkback!.position.pitch).toBe(LINKBACK_PITCH);
    const back = useTourStore.getState().tours[tour.id].scenes[b.id].hotspots;
    expect(back.map((h) => h.id)).toEqual([linkback!.id]);
  });

  it("does not duplicate an existing return link", () => {
    const { tour, a, b } = twoScenes();
    const store = useTourStore.getState();
    store.saveHotspot(tour.id, b.id, createHotspotRecord(a.id, { yaw: 0, pitch: 0 }));
    const { linkback } = store.saveHotspot(tour.id, a.id, createHotspotRecord(b.id, { yaw: 1, pitch: 0 }), {
      linkback: true,
    });
    expect(linkback).toBeNull();
    expect(useTourStore.getState().tours[tour.id].scenes[b.id].hotspots).toHaveLength(1);
    expect(createLinkback(tour, a.id, createHotspotRecord("missing", { yaw: 0, pitch: 0 }))).toBeNull();
  });

  it("applies one style to every hotspot", () => {
    const { tour, a, b } = twoScenes();
    const store = useTourStore.getState();
    store.saveHotspot(tour.id, b.id, createHotspotRecord(a.id, { yaw: 0, pitch: 0 }, { style: "disc" }));
    store.saveHotspot(tour.id, a.id, createHotspotRecord(b.id, { yaw: 1, pitch: 0 }, { style: "arrow" }), {
      applyStyleToAll: true,
    });
    const styles = Object.values(useTourStore.getState().tours[tour.id].scenes).flatMap((s) =>
      s.hotspots.map((h) => h.style),
    );
    expect(styles).toEqual(["arrow", "arrow"]);
    expect(applyHotspotStyle(tour, "disc").scenes[a.id]).toBe(tour.scenes[a.id]);
  });

  it("deletes a hotspot and returns it for undo", () => {
    const { tour, a, b } = twoScenes();
    const store = useTourStore.getState();
    const hotspot = createHotspotRecord(b.id, { yaw: 1, pitch: 0 });
    store.saveHotspot(tour.id, a.id, hotspot);
    expect(store.deleteHotspot(tour.id, a.id, hotspot.id)).toEqual(hotspot);
    expect(useTourStore.getState().tours[tour.id].scenes[a.id].hotspots).toEqual([]);
    expect(store.deleteHotspot(tour.id, a.id, hotspot.id)).toBeUndefined();
  });
});

describe("arrival views and infospots", () => {
  it("sets and clears the arrival view on every hotspot from one scene to another", () => {
    const a = createSceneRecord(sceneInput("A"));
    const b = createSceneRecord(sceneInput("B"));
    const c = createSceneRecord(sceneInput("C"));
    a.hotspots.push(
      createHotspotRecord(b.id, { yaw: 1, pitch: 0 }),
      createHotspotRecord(b.id, { yaw: 2, pitch: 0 }),
      createHotspotRecord(c.id, { yaw: 3, pitch: 0 }),
    );
    const tour = addScenesToTour(createTourRecord({ title: "T", category: "other" }), [a, b, c]);
    const view = { yaw: 0.5, pitch: -0.1, zoom: 45 };
    const set = setTourArrivalView(tour, a.id, b.id, view);
    expect(set.scenes[a.id].hotspots.map((h) => h.arrivalView ?? null)).toEqual([view, view, null]);
    const cleared = setTourArrivalView(set, a.id, b.id, null);
    expect(cleared.scenes[a.id].hotspots.some((h) => "arrivalView" in h)).toBe(false);
    expect(setTourArrivalView(tour, b.id, a.id, view)).toBe(tour);
  });

  it("saves, replaces and deletes infospots", () => {
    const a = createSceneRecord(sceneInput("A"));
    const tour = addScenesToTour(createTourRecord({ title: "T", category: "other" }), [a]);
    const store = useTourStore.getState();
    store.insertTour(tour);
    const spot = createInfospotRecord({ yaw: 1, pitch: 0 }, { previewText: "Hello" });
    store.saveInfospot(tour.id, a.id, spot);
    store.saveInfospot(tour.id, a.id, { ...spot, previewText: "Hi" });
    expect(useTourStore.getState().tours[tour.id].scenes[a.id].infospots).toEqual([{ ...spot, previewText: "Hi" }]);
    expect(store.deleteInfospot(tour.id, a.id, spot.id)?.previewText).toBe("Hi");
    expect(useTourStore.getState().tours[tour.id].scenes[a.id].infospots).toEqual([]);
  });
});
