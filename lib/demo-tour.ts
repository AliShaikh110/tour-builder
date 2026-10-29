import { DEFAULT_ZOOM } from "./constants";
import { degToRad } from "./geometry";
import { importImage } from "./image";
import {
  addScenesToTour,
  createHotspotRecord,
  createSceneRecord,
  createTourRecord,
  type NewTourInput,
} from "./store";
import type { Scene, Tour } from "./types";

export const DEMO_TOUR_INFO: NewTourInput = {
  title: "Cape Florida Lighthouse (demo)",
  category: "parks-rec",
  address: "Cape Florida Light, Key Biscayne, FL",
  audience: "me",
};

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
 * Downloads the demo panoramas, uploads them to the tour `tourId` and returns
 * its linked content. The caller saves it (or deletes the tour on failure).
 */
export async function buildDemoTour(
  tourId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<Tour> {
  let done = 0;
  // allSettled so no upload is still running when the caller cleans up.
  const results = await Promise.allSettled(
    DEMO_SCENES.map(async (def): Promise<Scene> => {
      const response = await fetch(DEMO_BASE_URL + def.file);
      if (!response.ok) throw new Error(`Download failed (${response.status})`);
      const image = await importImage(tourId, await response.blob(), { displayType: "360" });
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
    if (result.status === "rejected") throw result.reason;
    scenes.push(result.value);
  }

  for (const [from, to, yawDeg, pitch] of DEMO_LINKS) {
    scenes[from].hotspots.push(
      createHotspotRecord(scenes[to].id, { yaw: degToRad(yawDeg), pitch }, { style: "arrow-ring" }),
    );
  }

  return addScenesToTour(createTourRecord(DEMO_TOUR_INFO), scenes);
}
