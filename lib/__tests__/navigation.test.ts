import { describe, expect, it } from "vitest";
import { DEFAULT_ZOOM } from "@/lib/constants";
import { carryHeading } from "@/lib/geometry";
import { arrivalView } from "@/lib/navigation";
import { createHotspotRecord, createSceneRecord } from "@/lib/store";
import type { CameraView, Scene } from "@/lib/types";

function scene(name: string, extra: Partial<Scene> = {}): Scene {
  return {
    ...createSceneRecord({ name, mediaKey: "m", thumbKey: "t", width: 2, height: 1, displayType: "360" }),
    ...extra,
  };
}

const initial: CameraView = { yaw: 2, pitch: 0.1, zoom: 30 };
const current: CameraView = { yaw: 1, pitch: -0.4, zoom: 70 };

describe("arrivalView", () => {
  const source = scene("A", { northOffset: 0.5 });
  const target = scene("B", { northOffset: 1.5, initialView: initial });
  const hotspot = createHotspotRecord(target.id, { yaw: 1, pitch: 0 });

  it("opens directly reached scenes at their initial view, or straight ahead", () => {
    expect(arrivalView({ via: "direct", target })).toEqual(initial);
    expect(arrivalView({ via: "direct", target: scene("C") })).toEqual({ yaw: 0, pitch: 0, zoom: DEFAULT_ZOOM });
  });

  it("prefers the hotspot's own arrival view", () => {
    const arrival = { yaw: 3, pitch: 0, zoom: 50 };
    const view = arrivalView({
      via: "hotspot",
      hotspot: { ...hotspot, arrivalView: arrival },
      source,
      target,
      current,
      enforceInitialViews: true,
    });
    expect(view).toEqual(arrival);
  });

  it("uses the target's initial view when initial views are enforced", () => {
    expect(arrivalView({ via: "hotspot", hotspot, source, target, current, enforceInitialViews: true })).toEqual(
      initial,
    );
  });

  it("otherwise keeps the compass heading, levels the pitch and keeps the zoom", () => {
    const view = arrivalView({ via: "hotspot", hotspot, source, target, current, enforceInitialViews: false });
    expect(view.yaw).toBeCloseTo(carryHeading(1, 0.5, 1.5), 12);
    expect(view.yaw).toBeCloseTo(2, 12);
    expect(view).toMatchObject({ pitch: 0, zoom: 70 });
  });

  it("keeps the heading when the target has no initial view, even if enforced", () => {
    const plain = scene("D", { northOffset: 0.5 });
    const view = arrivalView({ via: "hotspot", hotspot, source, target: plain, current, enforceInitialViews: true });
    expect(view.yaw).toBeCloseTo(1, 12);
  });
});
