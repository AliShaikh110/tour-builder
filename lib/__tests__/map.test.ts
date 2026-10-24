import { describe, expect, it } from "vitest";
import { MAP_LINK_PITCH, mapLinkYaw } from "@/lib/geometry";
import {
  TILE_RADIUS,
  capturePlane,
  clearPlane,
  manualConflicts,
  placeOnPlane,
  planeLinks,
  removeFromPlane,
  restorePlane,
  rotateOnPlane,
  tilesTouch,
  unlinkScenes,
} from "@/lib/map";
import { addScenesToTour, createHotspotRecord, createSceneRecord, createTourRecord } from "@/lib/store";
import type { Tour } from "@/lib/types";

function tour3(): { tour: Tour; a: string; b: string; c: string } {
  const scenes = ["A", "B", "C"].map((name) =>
    createSceneRecord({ name, mediaKey: name, thumbKey: name, width: 2, height: 1, displayType: "360" }),
  );
  const tour = addScenesToTour(createTourRecord({ title: "T", category: "other" }), scenes);
  return { tour, a: scenes[0].id, b: scenes[1].id, c: scenes[2].id };
}

const at = (x: number, y: number, rotation = 0) => ({ x, y, rotation });
const touching = TILE_RADIUS * 2;

describe("tilesTouch", () => {
  it("counts touching and overlapping tiles, not distant ones", () => {
    expect(tilesTouch(at(0, 0), at(touching, 0))).toBe(true);
    expect(tilesTouch(at(0, 0), at(10, 10))).toBe(true);
    expect(tilesTouch(at(0, 0), at(touching + 10, 0))).toBe(false);
  });
});

describe("placeOnPlane", () => {
  it("links touching tiles both ways, aimed at each other", () => {
    const { tour: initial, a, b } = tour3();
    let tour = initial;
    tour = placeOnPlane(tour, a, at(0, 0));
    tour = placeOnPlane(tour, b, at(touching, 0));
    const ab = tour.scenes[a].hotspots;
    const ba = tour.scenes[b].hotspots;
    expect(ab).toHaveLength(1);
    expect(ba).toHaveLength(1);
    expect(ab[0]).toMatchObject({ targetSceneId: b, source: "map", title: null });
    // B is to the right of A: yaw 90°.
    expect(ab[0].position.yaw).toBeCloseTo(Math.PI / 2, 12);
    expect(ab[0].position.pitch).toBe(MAP_LINK_PITCH);
    expect(ba[0].position.yaw).toBeCloseTo((3 * Math.PI) / 2, 12);
  });

  it("removes map links when tiles are pulled apart, and re-aims when moved", () => {
    const { tour: initial, a, b } = tour3();
    let tour = initial;
    tour = placeOnPlane(placeOnPlane(tour, a, at(0, 0)), b, at(0, -touching));
    expect(tour.scenes[a].hotspots[0].position.yaw).toBeCloseTo(0, 12);
    tour = placeOnPlane(tour, b, at(touching, 0));
    expect(tour.scenes[a].hotspots).toHaveLength(1);
    expect(tour.scenes[a].hotspots[0].position.yaw).toBeCloseTo(Math.PI / 2, 12);
    tour = placeOnPlane(tour, b, at(500, 500));
    expect(tour.scenes[a].hotspots).toEqual([]);
    expect(tour.scenes[b].hotspots).toEqual([]);
  });

  it("reports and then replaces hand-placed hotspots between newly touching tiles", () => {
    const { tour: initial, a, b, c } = tour3();
    let tour = initial;
    tour = placeOnPlane(placeOnPlane(tour, a, at(0, 0)), b, at(400, 0));
    tour.scenes[a].hotspots.push(createHotspotRecord(b, { yaw: 1, pitch: 0 }));
    tour.scenes[a].hotspots.push(createHotspotRecord(c, { yaw: 2, pitch: 0 }));
    expect(manualConflicts(tour, b, at(touching, 0))).toEqual([a]);
    expect(manualConflicts(tour, b, at(400, 400))).toEqual([]);

    tour = placeOnPlane(tour, b, at(touching, 0));
    const toB = tour.scenes[a].hotspots.filter((h) => h.targetSceneId === b);
    expect(toB.map((h) => h.source)).toEqual(["map"]);
    // The unrelated hand-placed hotspot to C stays.
    expect(tour.scenes[a].hotspots.some((h) => h.targetSceneId === c && h.source === "manual")).toBe(true);
  });
});

describe("rotate, remove and clear", () => {
  it("re-aims only the rotated tile's outgoing map hotspots", () => {
    const { tour: initial, a, b } = tour3();
    let tour = initial;
    tour = placeOnPlane(placeOnPlane(tour, a, at(0, 0)), b, at(touching, 0));
    const before = tour.scenes[b].hotspots[0].position.yaw;
    tour = rotateOnPlane(tour, a, Math.PI / 2);
    expect(tour.scenes[a].hotspots[0].position.yaw).toBeCloseTo(mapLinkYaw(touching, 0, Math.PI / 2), 12);
    expect(tour.scenes[a].hotspots[0].position.yaw).toBeCloseTo(0, 12);
    expect(tour.scenes[b].hotspots[0].position.yaw).toBe(before);
  });

  it("takes a scene off the plane with its map links only", () => {
    const { tour: initial, a, b, c } = tour3();
    let tour = initial;
    tour = placeOnPlane(placeOnPlane(tour, a, at(0, 0)), b, at(touching, 0));
    tour.scenes[b].hotspots.push(createHotspotRecord(a, { yaw: 1, pitch: 0 }));
    tour.scenes[b].hotspots.push(createHotspotRecord(c, { yaw: 1, pitch: 0 }));
    tour = removeFromPlane(tour, a);
    expect(tour.scenes[a].mapPos).toBeNull();
    expect(tour.scenes[a].hotspots).toEqual([]);
    expect(tour.scenes[b].hotspots.map((h) => h.source)).toEqual(["manual", "manual"]);

    tour = clearPlane(placeOnPlane(tour, a, at(0, 0)));
    expect(Object.values(tour.scenes).every((s) => s.mapPos === null)).toBe(true);
    expect(Object.values(tour.scenes).flatMap((s) => s.hotspots).every((h) => h.source === "manual")).toBe(true);
  });
});

describe("planeLinks and unlinkScenes", () => {
  it("draws map links solid and hand-placed ones dashed, with their directions", () => {
    const { tour: initial, a, b, c } = tour3();
    let tour = initial;
    tour = placeOnPlane(placeOnPlane(tour, a, at(0, 0)), b, at(touching, 0));
    tour = placeOnPlane(tour, c, at(600, 0));
    tour.scenes[c].hotspots.push(createHotspotRecord(a, { yaw: 1, pitch: 0 }));
    expect(planeLinks(tour)).toEqual([
      { a, b, kind: "map", aToB: true, bToA: true },
      { a, b: c, kind: "manual", aToB: false, bToA: true },
    ]);
    tour = unlinkScenes(tour, a, b);
    expect(planeLinks(tour).map((l) => l.b)).toEqual([c]);
  });
});

describe("plane snapshots", () => {
  it("restores positions and hotspots for undo", () => {
    const { tour: initial, a, b } = tour3();
    let tour = initial;
    tour = placeOnPlane(tour, a, at(0, 0));
    const snapshot = capturePlane(tour);
    tour = placeOnPlane(tour, b, at(touching, 0));
    const restored = restorePlane(tour, snapshot);
    expect(restored.scenes[b].mapPos).toBeNull();
    expect(restored.scenes[a].hotspots).toEqual([]);
    expect(restored.scenes[a].mapPos).toEqual(at(0, 0));
  });
});
