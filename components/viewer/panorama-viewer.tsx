"use client";

import { Viewer, type ViewerConfig } from "@photo-sphere-viewer/core";
import "@photo-sphere-viewer/core/index.css";
import { AutorotatePlugin, type AutorotatePluginConfig } from "@photo-sphere-viewer/autorotate-plugin";
import { CompassPlugin, type CompassPluginConfig } from "@photo-sphere-viewer/compass-plugin";
import "@photo-sphere-viewer/compass-plugin/index.css";
import { GalleryPlugin, type GalleryPluginConfig } from "@photo-sphere-viewer/gallery-plugin";
import "@photo-sphere-viewer/gallery-plugin/index.css";
import { GyroscopePlugin, type GyroscopePluginConfig } from "@photo-sphere-viewer/gyroscope-plugin";
import { MarkersPlugin, type MarkersPluginConfig } from "@photo-sphere-viewer/markers-plugin";
import "@photo-sphere-viewer/markers-plugin/index.css";
import { StereoPlugin } from "@photo-sphere-viewer/stereo-plugin";
import { VirtualTourPlugin, type VirtualTourPluginConfig } from "@photo-sphere-viewer/virtual-tour-plugin";
import "@photo-sphere-viewer/virtual-tour-plugin/index.css";
import { VisibleRangePlugin, type VisibleRangePluginConfig } from "@photo-sphere-viewer/visible-range-plugin";
import { useEffect, useEffectEvent, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Plugins to enable, with their options. Plugin classes are imported here,
 * inside the browser-only module, so callers only need type imports.
 */
export interface ViewerPlugins {
  markers?: MarkersPluginConfig;
  gallery?: GalleryPluginConfig;
  autorotate?: AutorotatePluginConfig;
  compass?: CompassPluginConfig;
  /** Stereo (VR) needs the gyroscope plugin, so enabling it adds both. */
  gyroscope?: GyroscopePluginConfig;
  stereo?: boolean;
  visibleRange?: VisibleRangePluginConfig;
  virtualTour?: VirtualTourPluginConfig;
}

export type PanoramaViewerConfig = Omit<ViewerConfig, "container" | "panorama" | "plugins">;

export interface PanoramaViewerProps {
  /** Read once, when the viewer is created. */
  config?: PanoramaViewerConfig;
  /** Read once, when the viewer is created. Pass a memoised object. */
  plugins?: ViewerPlugins;
  /** Receives the instance right after it is created (before any panorama). */
  onReady: (viewer: Viewer) => void;
  /** Called just before the instance is destroyed. */
  onDestroy?: () => void;
  className?: string;
}

function pluginList(plugins: ViewerPlugins = {}): ViewerConfig["plugins"] {
  const list: NonNullable<ViewerConfig["plugins"]> = [];
  if (plugins.markers) list.push([MarkersPlugin, plugins.markers]);
  if (plugins.gallery) list.push([GalleryPlugin, plugins.gallery]);
  if (plugins.autorotate) list.push([AutorotatePlugin, plugins.autorotate]);
  if (plugins.compass) list.push([CompassPlugin, plugins.compass]);
  if (plugins.gyroscope || plugins.stereo) list.push([GyroscopePlugin, plugins.gyroscope ?? {}]);
  if (plugins.stereo) list.push(StereoPlugin);
  if (plugins.visibleRange) list.push([VisibleRangePlugin, plugins.visibleRange]);
  // Last, so it can find the markers, gallery and compass plugins it drives.
  if (plugins.virtualTour) list.push([VirtualTourPlugin, plugins.virtualTour]);
  return list;
}

/**
 * Photo Sphere Viewer mounted directly: one instance per mount, destroyed on
 * unmount (including when Next.js hides the route with Activity) so WebGL
 * contexts never leak. Load panoramas through the instance (`setPanorama`);
 * this component never re-creates the viewer on re-render.
 */
export default function PanoramaViewer({
  config,
  plugins,
  onReady,
  onDestroy,
  className,
}: PanoramaViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const readOptions = useEffectEvent(() => ({ config, plugins }));
  const handleReady = useEffectEvent((viewer: Viewer) => onReady(viewer));
  const handleDestroy = useEffectEvent(() => onDestroy?.());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const options = readOptions();
    const viewer = new Viewer({
      navbar: false,
      canvasBackground: "#0e0d0c",
      lang: { loading: "Loading…" },
      ...options.config,
      plugins: pluginList(options.plugins),
      container,
    });
    handleReady(viewer);
    return () => {
      handleDestroy();
      viewer.destroy();
    };
  }, []);

  return <div ref={containerRef} className={cn("size-full", className)} />;
}
