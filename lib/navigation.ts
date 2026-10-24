import { DEFAULT_ZOOM } from "./constants";
import { carryHeading } from "./geometry";
import type { CameraView, LinkHotspot, Scene } from "./types";

export type ArrivalInput =
  | {
      /** Ribbon, arrows, URL or picking a scene in the editor. */
      via: "direct";
      target: Scene;
    }
  | {
      via: "hotspot";
      hotspot: LinkHotspot;
      source: Scene;
      target: Scene;
      /** Camera in the source scene at the moment the hotspot was clicked. */
      current: CameraView;
      enforceInitialViews: boolean;
    };

const STRAIGHT_AHEAD: CameraView = { yaw: 0, pitch: 0, zoom: DEFAULT_ZOOM };

/**
 * Where the camera faces when a scene opens.
 *
 * Direct arrivals use the scene's initial view (or straight ahead). Hotspot
 * arrivals use, in order: the hotspot's own arrival view ("coming from"), the
 * target's initial view when initial views are enforced, or else the
 * visitor's compass heading carried over (pitch levelled, zoom kept).
 */
export function arrivalView(input: ArrivalInput): CameraView {
  const { target } = input;
  if (input.via === "direct") return target.initialView ?? STRAIGHT_AHEAD;

  if (input.hotspot.arrivalView) return input.hotspot.arrivalView;
  if (input.enforceInitialViews && target.initialView) return target.initialView;
  return {
    yaw: carryHeading(input.current.yaw, input.source.northOffset, target.northOffset),
    pitch: 0,
    zoom: input.current.zoom,
  };
}
