import { describe, expect, it, vi } from "vitest";
import { createInfospotRecord } from "@/lib/infospots";
import { TourSDK, type TourSdkHost } from "@/lib/sdk";
import { addScenesToTour, createHotspotRecord, createSceneRecord, createTourRecord } from "@/lib/store";

function setup() {
  const scenes = ["Gate", "Library", "Garden"].map((name, i) =>
    createSceneRecord({ name, mediaKey: `m${i}`, thumbKey: `t${i}`, width: 2, height: 1, displayType: "360" }),
  );
  const [a, b, c] = scenes;
  a.hotspots.push(createHotspotRecord(b.id, { yaw: 1, pitch: -0.2 }, { title: "Into the library" }));
  b.hotspots.push(createHotspotRecord(a.id, { yaw: 4, pitch: -0.2 }));
  a.infospots.push(createInfospotRecord({ yaw: 0.5, pitch: 0.1 }, { kind: "long", title: "Opening hours" }));
  c.hiddenFromRibbon = true;
  const tour = addScenesToTour(createTourRecord({ title: "Campus", category: "education" }), scenes);

  let current: string | null = a.id;
  const host: TourSdkHost = {
    getTour: () => tour,
    getCurrentSceneId: () => current,
    getCamera: () => ({ yaw: 0, pitch: 0, zoom: 50 }),
    goToScene: vi.fn(async (id: string) => {
      current = id;
      return true;
    }),
    lookAt: vi.fn(async () => undefined),
    setAutoRotate: vi.fn(),
  };
  return { sdk: new TourSDK(host), host, tour, a, b, c };
}

describe("TourSDK", () => {
  it("describes the tour, scenes, hotspots and infospots", () => {
    const { sdk, a, b, c } = setup();
    expect(sdk.version).toBe("1.0");
    expect(sdk.getScenes().map((s) => [s.name, s.index, s.hiddenFromRibbon])).toEqual([
      ["Gate", 0, false],
      ["Library", 1, false],
      ["Garden", 2, true],
    ]);
    expect(sdk.getCurrentScene()?.id).toBe(a.id);
    expect(sdk.getHotspots()).toEqual([
      expect.objectContaining({ targetSceneId: b.id, title: "Into the library", position: { yaw: 1, pitch: -0.2 } }),
    ]);
    expect(sdk.getHotspots(b.id)[0]).toMatchObject({ targetSceneId: a.id, title: "Gate" });
    expect(sdk.getHotspots(c.id)).toEqual([]);
    expect(sdk.getHotspots("nope")).toEqual([]);
    expect(sdk.getInfospots()).toEqual([expect.objectContaining({ kind: "long", label: "Opening hours" })]);
  });

  it("hands out copies, not the live tour", () => {
    const { sdk, tour, a } = setup();
    const copy = sdk.getTour();
    copy.scenes[a.id].name = "Changed";
    expect(tour.scenes[a.id].name).toBe("Gate");
  });

  it("navigates by id and steps through the ribbon order, skipping hidden scenes", async () => {
    const { sdk, host, a, b } = setup();
    expect(await sdk.goToScene("missing")).toBe(false);
    expect(host.goToScene).not.toHaveBeenCalled();

    await sdk.next();
    expect(host.goToScene).toHaveBeenLastCalledWith(b.id);
    await sdk.next(); // wraps past the hidden Garden
    expect(host.goToScene).toHaveBeenLastCalledWith(a.id);
    await sdk.prev();
    expect(host.goToScene).toHaveBeenLastCalledWith(b.id);
  });

  it("normalises lookAt angles and rejects bad input", async () => {
    const { sdk, host } = setup();
    await sdk.lookAt({ yaw: -Math.PI / 2, pitch: 3, zoom: 140 });
    expect(host.lookAt).toHaveBeenCalledWith({ yaw: (3 * Math.PI) / 2, pitch: Math.PI / 2, zoom: 100 }, true);
    await sdk.lookAt({ yaw: 1 }, { animate: false });
    expect(host.lookAt).toHaveBeenLastCalledWith({ yaw: 1, pitch: 0, zoom: undefined }, false);
    await expect(sdk.lookAt({ yaw: Number.NaN })).rejects.toThrow(TypeError);
  });

  it("delivers events until a listener is removed, and survives a failing listener", () => {
    const { sdk } = setup();
    const seen = vi.fn();
    const broken = vi.fn(() => {
      throw new Error("boom");
    });
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    sdk.on("camera:idle", broken);
    const stop = sdk.on("camera:idle", seen);

    sdk.emit("camera:idle", { sceneId: "x", yaw: 1, pitch: 0, zoom: 50 });
    expect(seen).toHaveBeenCalledWith({ sceneId: "x", yaw: 1, pitch: 0, zoom: 50 });
    expect(errors).toHaveBeenCalledOnce();

    stop();
    sdk.emit("camera:idle", { sceneId: "x", yaw: 2, pitch: 0, zoom: 50 });
    expect(seen).toHaveBeenCalledOnce();
    errors.mockRestore();
  });
});
