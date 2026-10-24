import type { VirtualTourLink, VirtualTourNode } from "@photo-sphere-viewer/virtual-tour-plugin";
import {
  HOTSPOT_BASE_SIZE,
  escapeHtml,
  hotspotLinkElement,
  infospotMarker,
} from "@/components/viewer/spot-markup";
import { infospotLabel } from "./infospots";
import { arrivalView } from "./navigation";
import type { AutoRotateSpeed, CameraView, LinkHotspot, Tour } from "./types";

export const AUTOROTATE_SPEEDS: Record<AutoRotateSpeed, string> = {
  low: "1rpm",
  med: "2rpm",
  high: "4rpm",
};

/** Object URLs of each scene's image and thumbnail, keyed by scene id. */
export interface TourMediaUrls {
  panorama: Record<string, string>;
  thumbnail: Record<string, string>;
}

/** Stored on each VirtualTour link so the viewer can find the hotspot again. */
export interface LinkData {
  hotspotId: string;
  title: string;
}

export function hotspotTitle(tour: Tour, hotspot: LinkHotspot): string {
  return hotspot.title?.trim() || tour.scenes[hotspot.targetSceneId]?.name || "Next scene";
}

/** Scenes a visitor can step through with the arrows and ribbon, in tour order. */
export function ribbonScenes(tour: Tour): string[] {
  return tour.sceneOrder.filter((id) => tour.scenes[id] && !tour.scenes[id].hiddenFromRibbon);
}

/**
 * VirtualTour nodes for every scene whose image is available: hotspots
 * become links (drawn with the same glyphs as the editor), infospots become
 * node markers. 2D scenes get neither; the viewer shows them flat.
 */
export function buildTourNodes(tour: Tour, urls: TourMediaUrls): VirtualTourNode[] {
  const { showHotspotTitles } = tour.settings;
  const available = (id: string) => Boolean(tour.scenes[id] && urls.panorama[id]);

  return tour.sceneOrder.filter(available).map((id) => {
    const scene = tour.scenes[id];
    const is360 = scene.displayType === "360";
    const links: VirtualTourLink[] = is360
      ? scene.hotspots
          .filter((h) => h.targetSceneId !== id && available(h.targetSceneId))
          .map((hotspot) => {
            const title = hotspotTitle(tour, hotspot);
            const size = Math.round(HOTSPOT_BASE_SIZE * hotspot.scale);
            const data: LinkData = { hotspotId: hotspot.id, title };
            return {
              nodeId: hotspot.targetSceneId,
              position: hotspot.position,
              data,
              arrowStyle: {
                element: () => hotspotLinkElement(hotspot, title, showHotspotTitles),
                size: { width: size, height: size },
                style: { opacity: String(hotspot.opacity) },
              },
            };
          })
      : [];
    return {
      id,
      panorama: urls.panorama[id],
      name: scene.name,
      thumbnail: urls.thumbnail[id],
      showInGallery: !scene.hiddenFromRibbon,
      links,
      markers: is360 ? scene.infospots.map((spot) => infospotMarker(spot, { title: infospotLabel(spot) })) : [],
      data: { displayType: scene.displayType },
    };
  });
}

/** Tooltip content for a link, or "" when titles are already always shown. */
export function linkTooltip(tour: Tour, data: LinkData | undefined): string {
  if (!data || tour.settings.showHotspotTitles) return "";
  return `<span class="hs-tip">${escapeHtml(data.title)}</span>`;
}

/**
 * The camera to open `toSceneId` with. `from` is set when the visitor
 * followed a hotspot, carrying the camera at the moment of the click.
 */
export function transitionView(
  tour: Tour,
  toSceneId: string,
  from?: { sceneId: string; hotspotId: string; camera: CameraView },
): CameraView {
  const target = tour.scenes[toSceneId];
  const source = from ? tour.scenes[from.sceneId] : undefined;
  const hotspot = from ? source?.hotspots.find((h) => h.id === from.hotspotId) : undefined;
  if (!target) return { yaw: 0, pitch: 0, zoom: 50 };
  if (!from || !source || !hotspot) return arrivalView({ via: "direct", target });
  return arrivalView({
    via: "hotspot",
    hotspot,
    source,
    target,
    current: from.camera,
    enforceInitialViews: tour.settings.enforceInitialViews,
  });
}
