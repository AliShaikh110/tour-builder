// All angles are radians. The UI converts to degrees for display only.

export interface SphericalPosition {
  yaw: number;
  pitch: number;
}

export interface CameraView {
  yaw: number;
  pitch: number;
  /** Photo Sphere Viewer zoom level, 0-100. */
  zoom: number;
}

export type TourStatus = "draft" | "published";

export type TourCategory =
  | "real-estate"
  | "drone-360"
  | "apartments"
  | "auto-rv"
  | "arts-museums"
  | "education"
  | "hotels-resorts"
  | "construction"
  | "dining"
  | "retail"
  | "parks-rec"
  | "other";

export type TourAudience = "me" | "client";

export type DisplayType = "360" | "2d";

export type HotspotStyle = "disc" | "arrow-ring" | "arrow" | "sphere";

export interface LinkHotspot {
  id: string;
  targetSceneId: string;
  position: SphericalPosition;
  style: HotspotStyle;
  /** null = use the target scene's name. */
  title: string | null;
  /** 0.5-2 */
  scale: number;
  /** 0-1 */
  opacity: number;
  /** Degrees. */
  rotation: number;
  /** Overrides the target's initial view when arriving through this hotspot. */
  arrivalView?: CameraView;
  source: "manual" | "map";
}

export type InfospotIcon = "info" | "star" | "camera" | "bubble";

export type InfospotKind = "link" | "short" | "image" | "long" | "html";

export interface Infospot {
  id: string;
  position: SphericalPosition;
  icon: InfospotIcon;
  scale: number;
  opacity: number;
  kind: InfospotKind;
  previewText: string;
  url?: string;
  newWindow?: boolean;
  imageKey?: string;
  caption?: string;
  title?: string;
  description?: string;
  html?: string;
}

export interface MapPosition {
  x: number;
  y: number;
  rotation: number;
}

export interface Scene {
  id: string;
  name: string;
  /** IndexedDB key of the full image. */
  mediaKey: string;
  /** IndexedDB key of the 512 px thumbnail. */
  thumbKey: string;
  displayType: DisplayType;
  width: number;
  height: number;
  hiddenFromRibbon: boolean;
  initialView: CameraView | null;
  /** Yaw (in this scene) that points to the tour's north. */
  northOffset: number;
  mapPos: MapPosition | null;
  hotspots: LinkHotspot[];
  infospots: Infospot[];
}

export type AutoRotateSpeed = "low" | "med" | "high";

export interface TourSettings {
  showHotspotTitles: boolean;
  ribbon: {
    enabled: boolean;
    startMinimized: boolean;
    lockOpen: boolean;
  };
  autoRotate: {
    enabled: boolean;
    speed: AutoRotateSpeed;
    resumeDelayMs: number;
  };
  showCompass: boolean;
  lockHorizontal: boolean;
  enforceInitialViews: boolean;
  tinyPlanetIntro: boolean;
  disableZoomInEmbed: boolean;
  hotspotClickSound: boolean;
  ambientSoundKey?: string;
}

export interface Tour {
  id: string;
  title: string;
  category: TourCategory;
  address?: string;
  audience?: TourAudience;
  status: TourStatus;
  /** Epoch milliseconds. */
  createdAt: number;
  updatedAt: number;
  coverSceneId?: string;
  sceneOrder: string[];
  scenes: Record<string, Scene>;
  settings: TourSettings;
}
