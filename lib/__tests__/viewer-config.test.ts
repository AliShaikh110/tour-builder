import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { createInfospotRecord } from "@/lib/infospots";
import {
  addScenesToTour,
  createHotspotRecord,
  createSceneRecord,
  createTourRecord,
  mergeSettings,
} from "@/lib/store";
import type { Tour } from "@/lib/types";
import { buildTourNodes, linkTooltip, ribbonScenes, transitionView, type LinkData } from "@/lib/viewer-config";

function demoTour(): Tour {
  const a = createSceneRecord({ name: "Gate", mediaKey: "a", thumbKey: "at", width: 2, height: 1, displayType: "360" });
  const b = createSceneRecord({ name: "Library", mediaKey: "b", thumbKey: "bt", width: 2, height: 1, displayType: "360" });
  const c = createSceneRecord({ name: "Poster", mediaKey: "c", thumbKey: "ct", width: 4, height: 3, displayType: "2d" });
  a.hotspots.push(createHotspotRecord(b.id, { yaw: 1, pitch: -0.2 }, { scale: 1.5, opacity: 0.8 }));
  b.hotspots.push(createHotspotRecord(a.id, { yaw: 4, pitch: -0.2 }, { title: "Back <out>" }));
  b.hiddenFromRibbon = true;
  b.northOffset = 1;
  b.initialView = { yaw: 2, pitch: 0, zoom: 40 };
  a.infospots.push(createInfospotRecord({ yaw: 0.5, pitch: 0 }, { previewText: "Admissions open" }));
  c.hotspots.push(createHotspotRecord(a.id, { yaw: 0, pitch: 0 }));
  return addScenesToTour(createTourRecord({ title: "Campus", category: "education" }), [a, b, c]);
}

const urlsFor = (tour: Tour) => ({
  panorama: Object.fromEntries(tour.sceneOrder.map((id) => [id, `blob:${id}`])),
  thumbnail: Object.fromEntries(tour.sceneOrder.map((id) => [id, `blob:thumb-${id}`])),
});

describe("buildTourNodes", () => {
  it("maps scenes, hotspots and infospots onto VirtualTour nodes", () => {
    const tour = demoTour();
    const [a, b, c] = tour.sceneOrder;
    const nodes = buildTourNodes(tour, urlsFor(tour));
    expect(nodes.map((n) => n.id)).toEqual([a, b, c]);
    expect(nodes[0]).toMatchObject({ name: "Gate", panorama: `blob:${a}`, thumbnail: `blob:thumb-${a}`, showInGallery: true });
    expect(nodes[1].showInGallery).toBe(false);

    const link = nodes[0].links![0];
    expect(link).toMatchObject({ nodeId: b, position: { yaw: 1, pitch: -0.2 } });
    expect((link.data as LinkData).title).toBe("Library");
    expect(link.arrowStyle?.size).toEqual({ width: 90, height: 90 });
    expect(link.arrowStyle?.style).toEqual({ opacity: "0.8" });
    const element = (link.arrowStyle!.element as () => HTMLElement)();
    expect(element.dataset).toMatchObject({ spotType: "hotspot" });
    expect(element.querySelector(".hs__label")).toBeNull();

    expect(nodes[0].markers).toHaveLength(1);
    expect(nodes[0].markers![0].id).toMatch(/^infospot:/);
  });

  it("gives 2D scenes no links or markers and skips scenes without an image", () => {
    const tour = demoTour();
    const [a, , c] = tour.sceneOrder;
    const nodes = buildTourNodes(tour, urlsFor(tour));
    expect(nodes[2]).toMatchObject({ id: c, links: [], markers: [] });

    const urls = urlsFor(tour);
    delete urls.panorama[c];
    expect(buildTourNodes(tour, urls).map((n) => n.id)).not.toContain(c);
    expect(buildTourNodes(tour, urls)[0].id).toBe(a);
  });

  it("puts escaped titles on the hotspots when titles are always shown", () => {
    const tour = demoTour();
    tour.settings = mergeSettings(tour.settings, { showHotspotTitles: true });
    const back = buildTourNodes(tour, urlsFor(tour))[1].links![0];
    const element = (back.arrowStyle!.element as () => HTMLElement)();
    expect(element.querySelector(".hs__label")?.innerHTML).toBe("Back &lt;out&gt;");
    expect(linkTooltip(tour, back.data as LinkData)).toBe("");
  });
});

describe("linkTooltip and ribbonScenes", () => {
  it("escapes tooltip titles and lists visible scenes", () => {
    const tour = demoTour();
    expect(linkTooltip(tour, { hotspotId: "x", title: "<b>Hi</b>" })).toBe('<span class="hs-tip">&lt;b&gt;Hi&lt;/b&gt;</span>');
    const [a, , c] = tour.sceneOrder;
    expect(ribbonScenes(tour)).toEqual([a, c]);
  });
});

describe("transitionView", () => {
  it("opens directly reached scenes at their initial view", () => {
    const tour = demoTour();
    const b = tour.sceneOrder[1];
    expect(transitionView(tour, b)).toEqual({ yaw: 2, pitch: 0, zoom: 40 });
  });

  it("opens a scene reached through a hotspot at its initial view by default", () => {
    const tour = demoTour();
    const [a, b] = tour.sceneOrder;
    const hotspotId = tour.scenes[a].hotspots[0].id;
    const view = transitionView(tour, b, { sceneId: a, hotspotId, camera: { yaw: 0.5, pitch: 0.3, zoom: 60 } });
    expect(view).toEqual({ yaw: 2, pitch: 0, zoom: 40 });
  });

  it("carries the heading through a hotspot when initial views aren't enforced", () => {
    const demo = demoTour();
    const tour = { ...demo, settings: mergeSettings(demo.settings, { enforceInitialViews: false }) };
    const [a, b] = tour.sceneOrder;
    const hotspotId = tour.scenes[a].hotspots[0].id;
    const view = transitionView(tour, b, { sceneId: a, hotspotId, camera: { yaw: 0.5, pitch: 0.3, zoom: 60 } });
    expect(view.yaw).toBeCloseTo(1.5, 12);
    expect(view).toMatchObject({ pitch: 0, zoom: 60 });
  });
});

describe("mergeSettings", () => {
  it("merges nested groups field by field and can remove the ambient sound", () => {
    const merged = mergeSettings(
      { ...DEFAULT_SETTINGS, ambientSoundKey: "sound" },
      { ribbon: { startMinimized: true }, autoRotate: { speed: "high" }, ambientSoundKey: undefined },
    );
    expect(merged.ribbon).toEqual({ ...DEFAULT_SETTINGS.ribbon, startMinimized: true });
    expect(merged.autoRotate).toEqual({ ...DEFAULT_SETTINGS.autoRotate, speed: "high" });
    expect(merged).not.toHaveProperty("ambientSoundKey");
  });
});
