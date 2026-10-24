import type { TourAudience, TourCategory, TourSettings } from "./types";

export const APP_NAME = "Tour Builder";

export const CATEGORIES: { id: TourCategory; label: string }[] = [
  { id: "real-estate", label: "Real Estate" },
  { id: "drone-360", label: "Drone 360" },
  { id: "apartments", label: "Apartments" },
  { id: "auto-rv", label: "Auto & RV" },
  { id: "arts-museums", label: "Arts & Museums" },
  { id: "education", label: "Education" },
  { id: "hotels-resorts", label: "Hotels & Resorts" },
  { id: "construction", label: "Construction" },
  { id: "dining", label: "Dining" },
  { id: "retail", label: "Retail" },
  { id: "parks-rec", label: "Parks & Rec" },
  { id: "other", label: "Other" },
];

export const CATEGORY_LABELS = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label]),
) as Record<TourCategory, string>;

export const AUDIENCE_LABELS: Record<TourAudience, string> = {
  me: "For me",
  client: "For a client",
};

export const DEFAULT_SETTINGS: TourSettings = {
  showHotspotTitles: false,
  ribbon: { enabled: true, startMinimized: false, lockOpen: false },
  autoRotate: { enabled: true, speed: "med", resumeDelayMs: 4000 },
  showCompass: false,
  lockHorizontal: false,
  enforceInitialViews: true,
  tinyPlanetIntro: false,
  disableZoomInEmbed: false,
  hotspotClickSound: false,
};

export const DEFAULT_ZOOM = 50;
