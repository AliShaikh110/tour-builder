// @vitest-environment node
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { exportFileName, exportTour, importTour, TourFileError, remapTour } from "@/lib/export";
import { createInfospotRecord } from "@/lib/infospots";
import { addScenesToTour, createHotspotRecord, createSceneRecord, createTourRecord, mergeSettings } from "@/lib/store";
import type { Tour } from "@/lib/types";

function bytes(text: string, type: string): Blob {
  return new Blob([new TextEncoder().encode(text)], { type });
}

function sampleTour(): { tour: Tour; media: Map<string, Blob> } {
  const a = createSceneRecord({ name: "Gate", mediaKey: "m-a", thumbKey: "t-a", width: 2, height: 1, displayType: "360" });
  const b = createSceneRecord({ name: "Library", mediaKey: "m-b", thumbKey: "t-b", width: 2, height: 1, displayType: "360" });
  a.hotspots.push(createHotspotRecord(b.id, { yaw: 1, pitch: -0.2 }, { arrivalView: { yaw: 2, pitch: 0, zoom: 40 } }));
  b.hotspots.push(createHotspotRecord(a.id, { yaw: 4, pitch: -0.2 }));
  a.infospots.push(createInfospotRecord({ yaw: 0.5, pitch: 0 }, { kind: "image", imageKey: "img-1", caption: "Hall" }));
  a.mapPos = { x: 0, y: 0, rotation: 0.5 };
  let tour = addScenesToTour(createTourRecord({ title: "Campus Tour", category: "education" }), [a, b]);
  tour = { ...tour, coverSceneId: b.id, settings: mergeSettings(tour.settings, { ambientSoundKey: "snd", showCompass: true }) };
  const media = new Map<string, Blob>([
    ["m-a", bytes("pano A", "image/jpeg")],
    ["t-a", bytes("thumb A", "image/jpeg")],
    ["m-b", bytes("pano B", "image/webp")],
    ["t-b", bytes("thumb B", "image/jpeg")],
    ["img-1", bytes("photo", "image/png")],
    ["snd", bytes("sound", "audio/mpeg")],
  ]);
  return { tour, media };
}

async function text(blob: Blob | undefined): Promise<string> {
  return new TextDecoder().decode(await blob!.arrayBuffer());
}

describe("export and import", () => {
  it("round-trips a tour with new ids and its media", async () => {
    const { tour, media } = sampleTour();
    const zipBlob = await exportTour(tour, { readMedia: async (k) => media.get(k) });

    const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());
    expect(Object.keys(zip.files).sort()).toEqual(
      ["media/", "media/img-1.png", "media/m-a.jpg", "media/m-b.webp", "media/snd.mp3", "media/t-a.jpg", "media/t-b.jpg", "tour.json"].sort(),
    );

    const stored = new Map<string, Blob>();
    let counter = 0;
    const imported = await importTour(await zipBlob.arrayBuffer(), {
      writeMedia: async (blob) => {
        const key = `new-${++counter}`;
        stored.set(key, blob);
        return key;
      },
    });

    // Fresh ids everywhere, same content.
    expect(imported.id).not.toBe(tour.id);
    expect(imported.title).toBe("Campus Tour");
    expect(imported.status).toBe("draft");
    const [newA, newB] = imported.sceneOrder;
    expect(newA).not.toBe(tour.sceneOrder[0]);
    expect(imported.coverSceneId).toBe(newB);
    const a = imported.scenes[newA];
    const b = imported.scenes[newB];
    expect(a.name).toBe("Gate");
    expect(a.mapPos).toEqual({ x: 0, y: 0, rotation: 0.5 });
    expect(a.hotspots[0]).toMatchObject({ targetSceneId: newB, arrivalView: { yaw: 2, pitch: 0, zoom: 40 } });
    expect(a.hotspots[0].id).not.toBe(tour.scenes[tour.sceneOrder[0]].hotspots[0].id);
    expect(b.hotspots[0].targetSceneId).toBe(newA);
    expect(imported.settings.showCompass).toBe(true);

    // Media came across under new keys, byte for byte, with their types.
    expect(await text(stored.get(a.mediaKey))).toBe("pano A");
    expect(stored.get(b.mediaKey)?.type).toBe("image/webp");
    expect(await text(stored.get(a.infospots[0].imageKey!))).toBe("photo");
    expect(await text(stored.get(imported.settings.ambientSoundKey!))).toBe("sound");
    expect(stored.size).toBe(6);
  });

  it("refuses files that aren't exports", async () => {
    await expect(importTour(new TextEncoder().encode("not a zip"))).rejects.toBeInstanceOf(TourFileError);

    const empty = await new JSZip().generateAsync({ type: "uint8array" });
    await expect(importTour(empty)).rejects.toThrow(/tour\.json/);

    const wrong = new JSZip();
    wrong.file("tour.json", JSON.stringify({ format: "something-else" }));
    await expect(importTour(await wrong.generateAsync({ type: "uint8array" }))).rejects.toThrow(/Tour Builder export/);

    const { tour } = sampleTour();
    const missingMedia = new JSZip();
    missingMedia.file("tour.json", JSON.stringify({ format: "tour-builder", version: 1, tour, media: {} }));
    await expect(importTour(await missingMedia.generateAsync({ type: "uint8array" }))).rejects.toThrow(/missing/);
  });

  it("removes the media it already saved when an import fails part-way", async () => {
    const { tour, media } = sampleTour();
    const zipBlob = await exportTour(tour, { readMedia: async (k) => media.get(k) });
    const written: string[] = [];
    const removed: string[] = [];
    const attempt = importTour(await zipBlob.arrayBuffer(), {
      writeMedia: async () => {
        if (written.length === 3) throw new DOMException("full", "QuotaExceededError");
        written.push(`k${written.length}`);
        return written.at(-1)!;
      },
      removeMedia: async (keys) => {
        removed.push(...keys);
      },
    });
    await expect(attempt).rejects.toThrow(/out of storage/);
    expect(removed.sort()).toEqual(written.sort());
  });

  it("won't export when media is missing", async () => {
    const { tour } = sampleTour();
    await expect(exportTour(tour, { readMedia: async () => undefined })).rejects.toThrow(/missing/);
  });
});

describe("remapTour and exportFileName", () => {
  it("drops hotspots to scenes that aren't in the tour and fills missing settings", () => {
    const { tour } = sampleTour();
    const a = tour.sceneOrder[0];
    tour.scenes[a].hotspots.push(createHotspotRecord("gone", { yaw: 0, pitch: 0 }));
    const partial = { ...tour, settings: { showCompass: true } as Tour["settings"] };
    const remapped = remapTour(partial, {});
    expect(remapped.scenes[remapped.sceneOrder[0]].hotspots).toHaveLength(1);
    expect(remapped.settings.ribbon).toEqual({ enabled: true, startMinimized: false, lockOpen: false });
  });

  it("makes safe file names", () => {
    expect(exportFileName("Café Tour: Floor 2!")).toBe("cafe-tour-floor-2.zip");
    expect(exportFileName("***")).toBe("tour.zip");
  });
});
