import { DEFAULT_ZOOM } from "./constants";
import { degToRad } from "./geometry";
import { importImage } from "./image";
import { deleteMedia } from "./media-db";
import {
  addScenesToTour,
  createHotspotRecord,
  createSceneRecord,
  createTourRecord,
} from "./store";
import type { Scene, Tour } from "./types";

const DEMO_BASE_URL = "https://photo-sphere-viewer-data.netlify.app/assets/tour/";

// Cape Florida Light, Key Biscayne (© Pixexid), from the Photo Sphere Viewer
// demo data. Angles were read off the panoramas so the links sit on the paths.
const DEMO_SCENES = [
  { file: "key-biscayne-1.jpg", name: "Palm path", northDeg: 0, startYawDeg: 132 },
  { file: "key-biscayne-2.jpg", name: "Lighthouse garden", northDeg: 14 },
  { file: "key-biscayne-3.jpg", name: "Lighthouse", northDeg: 47 },
];

/** [from scene, to scene, yaw in degrees, pitch in radians] */
const DEMO_LINKS: [number, number, number, number][] = [
  [0, 1, 136, -0.25],
  [1, 0, 330, -0.3],
  [1, 2, 132, -0.4],
  [2, 1, 345, -0.25],
];

/**
 * Downloads the demo panoramas into IndexedDB and returns a linked tour.
 * The caller inserts it into the store.
 */
export async function buildDemoTour(
  onProgress?: (done: number, total: number) => void,
): Promise<Tour> {
  const savedKeys: string[] = [];
  let done = 0;
  // allSettled so no download is still writing blobs when we clean up.
  const results = await Promise.allSettled(
    DEMO_SCENES.map(async (def): Promise<Scene> => {
      const response = await fetch(DEMO_BASE_URL + def.file);
      if (!response.ok) throw new Error(`Download failed (${response.status})`);
      const image = await importImage(await response.blob(), { displayType: "360" });
      savedKeys.push(image.mediaKey, image.thumbKey);
      onProgress?.(++done, DEMO_SCENES.length);
      return {
        ...createSceneRecord({ name: def.name, ...image }),
        northOffset: degToRad(def.northDeg),
        initialView:
          def.startYawDeg === undefined
            ? null
            : { yaw: degToRad(def.startYawDeg), pitch: 0, zoom: DEFAULT_ZOOM },
      };
    }),
  );

  const scenes: Scene[] = [];
  for (const result of results) {
    if (result.status === "rejected") {
      await deleteMedia(savedKeys).catch(() => undefined);
      throw result.reason;
    }
    scenes.push(result.value);
  }

  for (const [from, to, yawDeg, pitch] of DEMO_LINKS) {
    scenes[from].hotspots.push(
      createHotspotRecord(scenes[to].id, { yaw: degToRad(yawDeg), pitch }, { style: "arrow-ring" }),
    );
  }

  const tour = createTourRecord({
    title: "Cape Florida Lighthouse (demo)",
    category: "parks-rec",
    address: "Cape Florida Light, Key Biscayne, FL",
    audience: "me",
  });
  return addScenesToTour(tour, scenes);
}
