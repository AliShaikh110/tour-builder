"use client";

import type { Viewer, events as viewerEvents } from "@photo-sphere-viewer/core";
import type { AutorotatePlugin, events as autorotateEvents } from "@photo-sphere-viewer/autorotate-plugin";
import type { CompassPlugin } from "@photo-sphere-viewer/compass-plugin";
import type { GalleryPlugin } from "@photo-sphere-viewer/gallery-plugin";
import type { GyroscopePlugin } from "@photo-sphere-viewer/gyroscope-plugin";
import type { MarkersPlugin, events as markerEvents } from "@photo-sphere-viewer/markers-plugin";
import type { StereoPlugin } from "@photo-sphere-viewer/stereo-plugin";
import type {
  VirtualTourNode,
  VirtualTourPlugin,
  events as tourEvents,
} from "@photo-sphere-viewer/virtual-tour-plugin";
import type { VisibleRangePlugin } from "@photo-sphere-viewer/visible-range-plugin";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_ZOOM } from "@/lib/constants";
import { infospotLabel } from "@/lib/infospots";
import { MediaUrlCache } from "@/lib/media-db";
import { connectParentBridge, TourSDK } from "@/lib/sdk";
import { playHotspotClick } from "@/lib/sound";
import type { CameraView, Infospot, Tour } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  AUTOROTATE_SPEEDS,
  buildTourNodes,
  hotspotTitle,
  linkTooltip,
  ribbonScenes,
  transitionView,
  type LinkData,
  type TourMediaUrls,
} from "@/lib/viewer-config";
import { FlatScene } from "./flat-scene";
import { InfospotModal } from "./infospot-modal";
import { LazyPanoramaViewer } from "./lazy-panorama-viewer";
import type { PanoramaViewerConfig, ViewerPlugins } from "./panorama-viewer";
import { ViewerControls } from "./viewer-controls";

export type TourViewerMode = "page" | "embed" | "preview" | "compact";

const TRANSITION = { speed: 700, effect: "fade" as const, rotation: false, showLoader: true };
const INTRO_MS = 2600;
/** Quiet time after the last camera move before the SDK's camera:idle fires. */
const CAMERA_IDLE_MS = 300;

async function resolveMedia(cache: MediaUrlCache, tour: Tour): Promise<TourMediaUrls> {
  const scenes = tour.sceneOrder.map((id) => tour.scenes[id]).filter(Boolean);
  const rows = await Promise.all(
    scenes.map(async (s) => [s.id, await cache.get(s.mediaKey), await cache.get(s.thumbKey)] as const),
  );
  const urls: TourMediaUrls = { panorama: {}, thumbnail: {} };
  for (const [id, panorama, thumbnail] of rows) {
    if (panorama) urls.panorama[id] = panorama;
    if (thumbnail) urls.thumbnail[id] = thumbnail;
  }
  return urls;
}

/** What decides the node list, so unrelated edits don't rebuild the tour. */
function nodesSignature(tour: Tour): string {
  return JSON.stringify([
    tour.sceneOrder,
    tour.sceneOrder.map((id) => {
      const s = tour.scenes[id];
      return s && [s.name, s.mediaKey, s.thumbKey, s.displayType, s.hiddenFromRibbon, s.hotspots, s.infospots];
    }),
    tour.settings.showHotspotTitles,
  ]);
}

/** Node ids and images: when these change the tour is reloaded, otherwise updated in place. */
function structureOf(nodes: VirtualTourNode[]): string {
  return nodes.map((n) => `${n.id}=${n.panorama}`).join("|");
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * The visitor's tour player: VirtualTourPlugin (client mode) with the gallery
 * ribbon, autorotate, compass, gyroscope, stereo (VR) and visible-range
 * plugins, plus the tour's own controls. Settings apply live.
 */
export function TourViewer({
  tour,
  startSceneId,
  mode,
  ownerActions,
  onClose,
  onSceneChange,
  className,
}: {
  tour: Tour;
  startSceneId?: string | null;
  mode: TourViewerMode;
  /** Extra buttons for the tour owner (page mode). */
  ownerActions?: ReactNode;
  /** Shows a close button (preview overlay). */
  onClose?: () => void;
  onSceneChange?: (sceneId: string) => void;
  className?: string;
}) {
  const { settings } = tour;
  const viewerRef = useRef<Viewer | null>(null);
  const [viewerGeneration, setViewerGeneration] = useState(0);
  const [cache] = useState(() => new MediaUrlCache());
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [infospot, setInfospot] = useState<Infospot | null>(null);
  const [ribbonOpen, setRibbonOpen] = useState(false);
  const [controlsHidden, setControlsHidden] = useState(false);
  const [vrSupported, setVrSupported] = useState(false);
  const tourRef = useRef(tour);
  const applied = useRef<{ viewer: Viewer | null; structure: string }>({ viewer: null, structure: "" });
  const introPending = useRef(settings.tinyPlanetIntro);
  const wrapper = useRef<HTMLDivElement>(null);
  /** window.TourSDK while this viewer publishes it (page and embed modes). */
  const sdkRef = useRef<TourSDK | null>(null);

  useEffect(() => {
    tourRef.current = tour;
  });
  useEffect(() => () => cache.revokeAll(), [cache]);

  const compact = mode === "compact";
  const currentScene = currentId ? tour.scenes[currentId] : null;
  const flat = currentScene?.displayType === "2d";

  // --- Viewer creation (read once) -------------------------------------------

  const [creation] = useState(() => {
    const config: PanoramaViewerConfig = {
      mousewheel: !(mode === "embed" && settings.disableZoomInEmbed),
      touchmoveTwoFingers: false,
      keyboard: "fullscreen",
      defaultZoomLvl: DEFAULT_ZOOM,
    };
    const plugins: ViewerPlugins = {
      markers: { defaultHoverScale: false },
      gallery: {
        visibleOnLoad: false,
        hideOnClick: false,
        navigationArrows: true,
        thumbnailSize: compact ? { width: 96, height: 54 } : { width: 168, height: 94 },
      },
      autorotate: {
        autostartDelay: settings.autoRotate.enabled ? settings.autoRotate.resumeDelayMs : undefined,
        autostartOnIdle: settings.autoRotate.enabled,
        autorotateSpeed: AUTOROTATE_SPEEDS[settings.autoRotate.speed],
      },
      compass: {
        size: compact ? "64px" : "92px",
        position: compact ? ["top", "right"] : ["top", "center"],
        navigation: false,
        coneColor: "rgba(245, 185, 74, 0.35)",
        hotspotColor: "rgba(255, 255, 255, 0.85)",
      },
      stereo: !compact,
      visibleRange: {},
      virtualTour: {
        dataMode: "client",
        positionMode: "manual",
        renderMode: "2d",
        linksOnCompass: true,
        preload: true,
        showLinkTooltip: true,
        getLinkTooltip: (_content, link) => linkTooltip(tourRef.current, link.data as LinkData | undefined),
        transitionOptions: (toNode, fromNode, fromLink) => {
          const viewer = viewerRef.current;
          const data = fromLink?.data as LinkData | undefined;
          let view: CameraView;
          if (fromNode && data && viewer) {
            const { yaw, pitch } = viewer.getPosition();
            view = transitionView(tourRef.current, toNode.id, {
              sceneId: fromNode.id,
              hotspotId: data.hotspotId,
              camera: { yaw, pitch, zoom: viewer.getZoomLevel() },
            });
          } else {
            view = transitionView(tourRef.current, toNode.id);
          }
          // The tiny planet intro starts looking straight down, zoomed out.
          if (!fromNode && introPending.current) {
            return { ...TRANSITION, effect: "none", rotateTo: { yaw: view.yaw, pitch: -Math.PI / 2 }, zoomTo: 0 };
          }
          return { ...TRANSITION, rotateTo: { yaw: view.yaw, pitch: view.pitch }, zoomTo: view.zoom };
        },
      },
    };
    return { config, plugins };
  });

  const handleReady = useCallback((viewer: Viewer) => {
    viewerRef.current = viewer;
    applied.current = { viewer: null, structure: "" };
    setViewerGeneration((g) => g + 1);
  }, []);
  const handleDestroy = useCallback(() => {
    viewerRef.current = null;
  }, []);

  // --- Nodes -------------------------------------------------------------------

  const signature = useMemo(() => nodesSignature(tour), [tour]);
  const startId = startSceneId && tour.scenes[startSceneId] ? startSceneId : (ribbonScenes(tour)[0] ?? tour.sceneOrder[0]);

  const applyNodes = useEffectEvent((viewer: Viewer, urls: TourMediaUrls) => {
    const plugin = viewer.getPlugin<VirtualTourPlugin>("virtual-tour");
    const nodes = buildTourNodes(tourRef.current, urls);
    if (!plugin || nodes.length === 0) return;
    const structure = structureOf(nodes);
    const current = plugin.getCurrentNode()?.id;
    if (applied.current.viewer !== viewer || applied.current.structure !== structure || !current) {
      if (introPending.current) viewer.setOptions({ fisheye: 2 });
      plugin.setNodes(nodes, current ?? startId);
    } else {
      for (const node of nodes) {
        plugin.updateNode({
          id: node.id,
          name: node.name,
          thumbnail: node.thumbnail,
          showInGallery: node.showInGallery,
          links: node.links,
          markers: node.markers,
          data: node.data,
        });
      }
    }
    applied.current = { viewer, structure };
  });

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    let cancelled = false;
    void resolveMedia(cache, tourRef.current).then((urls) => {
      if (!cancelled && viewerRef.current === viewer) applyNodes(viewer, urls);
    });
    return () => {
      cancelled = true;
    };
  }, [viewerGeneration, signature, cache]);

  // --- Tiny planet intro -------------------------------------------------------

  const playIntro = useEffectEvent((viewer: Viewer, sceneId: string) => {
    const view = transitionView(tourRef.current, sceneId);
    const from = { yaw: viewer.getPosition().yaw, pitch: -Math.PI / 2, zoom: 0, fisheye: 2 };
    viewer.setOptions({ fisheye: 2 });
    viewer.rotate({ yaw: from.yaw, pitch: from.pitch });
    viewer.zoom(from.zoom);
    const started = performance.now() + 500;
    const step = (now: number) => {
      if (viewerRef.current !== viewer) return;
      const t = Math.min(1, Math.max(0, (now - started) / INTRO_MS));
      const k = easeInOut(t);
      viewer.setOptions({ fisheye: from.fisheye * (1 - k) || false });
      viewer.rotate({ yaw: from.yaw + (view.yaw - from.yaw) * k, pitch: from.pitch + (view.pitch - from.pitch) * k });
      viewer.zoom(from.zoom + (view.zoom - from.zoom) * k);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  // --- Events --------------------------------------------------------------------

  const onNodeChanged = useEffectEvent((viewer: Viewer, event: tourEvents.NodeChangedEvent) => {
    const id = event.node.id;
    setCurrentId(id);
    onSceneChange?.(id);
    const scene = tourRef.current.scenes[id];
    sdkRef.current?.emit("scene:loaded", { sceneId: id, name: scene?.name ?? "", via: event.data.fromLink ? "hotspot" : "direct" });
    // Rotate the compass cone by the scene's north so it shows a true heading.
    viewer.container.style.setProperty("--compass-north", `${-(scene?.northOffset ?? 0)}rad`);
    if (introPending.current && !event.data.fromNode) {
      introPending.current = false;
      if (scene?.displayType === "360") playIntro(viewer, id);
      else viewer.setOptions({ fisheye: false });
    }
  });

  const emitHotspotClick = useEffectEvent((hotspotId: string | undefined) => {
    const sdk = sdkRef.current;
    const sceneId = sdk?.getCurrentScene()?.id;
    const hotspot = sceneId ? tourRef.current.scenes[sceneId]?.hotspots.find((h) => h.id === hotspotId) : undefined;
    if (!sdk || !sceneId || !hotspot) return;
    sdk.emit("hotspot:click", {
      sceneId,
      hotspotId: hotspot.id,
      targetSceneId: hotspot.targetSceneId,
      title: hotspotTitle(tourRef.current, hotspot),
    });
  });

  const onViewerClick = useEffectEvent((event: viewerEvents.ClickEvent) => {
    // PSV adds .psv-virtual-tour-link to the element hotspotLinkElement builds, which carries the id.
    const link = (event.data.target as Element | null)?.closest?.<HTMLElement>(".psv-virtual-tour-link");
    if (!link) return;
    if (tourRef.current.settings.hotspotClickSound) playHotspotClick();
    emitHotspotClick(link.dataset.spotId);
  });

  const openInfospot = useEffectEvent((markerId: string) => {
    if (!markerId.startsWith("infospot:")) return;
    const id = markerId.slice("infospot:".length);
    const scene = currentId ? tourRef.current.scenes[currentId] : null;
    const spot = scene?.infospots.find((i) => i.id === id) ?? null;
    setInfospot(spot);
    if (scene && spot) {
      sdkRef.current?.emit("infospot:open", { sceneId: scene.id, infospotId: spot.id, kind: spot.kind, label: infospotLabel(spot) });
    }
  });

  const emitCameraIdle = useEffectEvent((viewer: Viewer) => {
    const sdk = sdkRef.current;
    // Auto-rotation keeps the camera moving; it reports idle once rotation stops.
    if (!sdk || viewer.getPlugin<AutorotatePlugin>("autorotate")?.isEnabled()) return;
    const { yaw, pitch } = viewer.getPosition();
    sdk.emit("camera:idle", { sceneId: sdk.getCurrentScene()?.id ?? null, yaw, pitch, zoom: viewer.getZoomLevel() });
  });

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const tourPlugin = viewer.getPlugin<VirtualTourPlugin>("virtual-tour");
    const markers = viewer.getPlugin<MarkersPlugin>("markers");
    const gallery = viewer.getPlugin<GalleryPlugin>("gallery");
    const gyroscope = viewer.getPlugin<GyroscopePlugin>("gyroscope");
    const autorotate = viewer.getPlugin<AutorotatePlugin>("autorotate");

    const nodeChanged = (e: tourEvents.NodeChangedEvent) => onNodeChanged(viewer, e);
    const markerSelected = (e: markerEvents.SelectMarkerEvent) => openInfospot(e.marker.id);
    const galleryShown = () => setRibbonOpen(true);
    const galleryHidden = () => setRibbonOpen(false);

    tourPlugin?.addEventListener("node-changed", nodeChanged);
    markers?.addEventListener("select-marker", markerSelected);
    gallery?.addEventListener("show-gallery", galleryShown);
    gallery?.addEventListener("hide-gallery", galleryHidden);
    viewer.addEventListener("click", onViewerClick);
    // Desktop browsers report orientation support too; VR only makes sense on phones and tablets.
    const touchDevice = window.matchMedia("(pointer: coarse)").matches;
    if (touchDevice) gyroscope?.isSupported().then(setVrSupported, () => setVrSupported(false));

    // Keyboard: Enter or Space on a focused hotspot or infospot.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const element = (event.target as Element | null)?.closest?.<HTMLElement>("[data-spot-id]");
      if (!element) return;
      event.preventDefault();
      if (element.dataset.spotType === "infospot") {
        openInfospot(`infospot:${element.dataset.spotId}`);
        return;
      }
      const node = tourPlugin?.getCurrentNode();
      const link = node?.links?.find((l) => (l.data as LinkData | undefined)?.hotspotId === element.dataset.spotId);
      if (link && tourPlugin) {
        if (tourRef.current.settings.hotspotClickSound) playHotspotClick();
        emitHotspotClick(element.dataset.spotId);
        void tourPlugin.setCurrentNode(link.nodeId, undefined, link);
      }
    };
    viewer.container.addEventListener("keydown", onKeyDown, true);

    let idleTimer: number | undefined;
    const cameraMoved = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => emitCameraIdle(viewer), CAMERA_IDLE_MS);
    };
    const rotationChanged = (e: autorotateEvents.AutorotateEvent) => {
      if (!e.autorotateEnabled) cameraMoved();
    };
    viewer.addEventListener("position-updated", cameraMoved);
    viewer.addEventListener("zoom-updated", cameraMoved);
    autorotate?.addEventListener("autorotate", rotationChanged);

    return () => {
      tourPlugin?.removeEventListener("node-changed", nodeChanged);
      markers?.removeEventListener("select-marker", markerSelected);
      gallery?.removeEventListener("show-gallery", galleryShown);
      gallery?.removeEventListener("hide-gallery", galleryHidden);
      viewer.removeEventListener("click", onViewerClick);
      viewer.container.removeEventListener("keydown", onKeyDown, true);
      viewer.removeEventListener("position-updated", cameraMoved);
      viewer.removeEventListener("zoom-updated", cameraMoved);
      autorotate?.removeEventListener("autorotate", rotationChanged);
      window.clearTimeout(idleTimer);
    };
  }, [viewerGeneration]);

  // --- Live settings -------------------------------------------------------------

  const { enabled: rotateOn, speed: rotateSpeed, resumeDelayMs } = settings.autoRotate;
  useEffect(() => {
    const autorotate = viewerRef.current?.getPlugin<AutorotatePlugin>("autorotate");
    if (!autorotate) return;
    autorotate.setOptions({
      autostartDelay: rotateOn ? resumeDelayMs : undefined,
      autostartOnIdle: rotateOn,
      autorotateSpeed: AUTOROTATE_SPEEDS[rotateSpeed],
    });
    if (!rotateOn) autorotate.stop();
  }, [viewerGeneration, rotateOn, rotateSpeed, resumeDelayMs]);

  useEffect(() => {
    viewerRef.current?.getPlugin<VisibleRangePlugin>("visible-range")?.setVerticalRange(settings.lockHorizontal ? [0, 0] : null);
  }, [viewerGeneration, settings.lockHorizontal]);

  const { enabled: ribbonOn, startMinimized, lockOpen } = settings.ribbon;
  const ribbonAllowed = ribbonOn && !controlsHidden;
  const loaded = currentId !== null;

  // window.TourSDK, published once the first scene is showing; the editor's previews don't publish it.
  const sdkEnabled = mode === "page" || mode === "embed";
  useEffect(() => {
    if (!sdkEnabled || !loaded) return;
    const tourPlugin = () => viewerRef.current?.getPlugin<VirtualTourPlugin>("virtual-tour");
    const sdk = new TourSDK({
      getTour: () => tourRef.current,
      getCurrentSceneId: () => tourPlugin()?.getCurrentNode()?.id ?? null,
      getCamera: () => {
        const viewer = viewerRef.current;
        if (!viewer) return null;
        const { yaw, pitch } = viewer.getPosition();
        return { yaw, pitch, zoom: viewer.getZoomLevel() };
      },
      goToScene: async (sceneId) => (await tourPlugin()?.setCurrentNode(sceneId)) ?? false,
      lookAt: async (view, animate) => {
        const viewer = viewerRef.current;
        if (!viewer) return;
        if (animate) {
          await viewer.animate({ ...view, speed: "3rpm" });
          return;
        }
        viewer.rotate({ yaw: view.yaw, pitch: view.pitch });
        if (view.zoom !== undefined) viewer.zoom(view.zoom);
      },
      setAutoRotate: (on) => {
        const autorotate = viewerRef.current?.getPlugin<AutorotatePlugin>("autorotate");
        if (on) autorotate?.start();
        else autorotate?.stop();
      },
    });
    sdkRef.current = sdk;
    window.TourSDK = sdk;
    window.dispatchEvent(new CustomEvent("toursdk:ready", { detail: sdk }));
    const disconnect = mode === "embed" ? connectParentBridge(sdk) : undefined;
    return () => {
      disconnect?.();
      sdkRef.current = null;
      if (window.TourSDK === sdk) delete window.TourSDK;
    };
  }, [sdkEnabled, loaded, mode]);

  // Applied once the first scene is in, since the compass shows itself when the viewer becomes ready.
  const showCompass = settings.showCompass && !flat && !controlsHidden;
  useEffect(() => {
    const compass = viewerRef.current?.getPlugin<CompassPlugin>("compass");
    if (!compass || !loaded) return;
    if (showCompass) compass.show();
    else compass.hide();
  }, [viewerGeneration, loaded, showCompass]);
  // On load and when the ribbon settings change (not on every scene change).
  useEffect(() => {
    const gallery = viewerRef.current?.getPlugin<GalleryPlugin>("gallery");
    if (!gallery || !loaded) return;
    // Small screens show the gallery full screen, so they always start closed.
    const roomy = (wrapper.current?.clientWidth ?? 0) >= 500;
    if (!ribbonAllowed) gallery.hide();
    else if (lockOpen || (!startMinimized && roomy)) gallery.show();
    else gallery.hide();
  }, [viewerGeneration, loaded, ribbonAllowed, startMinimized, lockOpen]);

  // Turning the intro on in the settings preview replays it right away.
  const replayIntro = useEffectEvent(() => {
    const viewer = viewerRef.current;
    if (viewer && currentId && !introPending.current && compact) playIntro(viewer, currentId);
  });
  useEffect(() => {
    if (settings.tinyPlanetIntro) replayIntro();
  }, [settings.tinyPlanetIntro]);

  // --- Navigation helpers ----------------------------------------------------------

  function goTo(sceneId: string) {
    void viewerRef.current?.getPlugin<VirtualTourPlugin>("virtual-tour")?.setCurrentNode(sceneId);
  }

  const visible = ribbonScenes(tour);
  const index = currentId ? visible.indexOf(currentId) : -1;
  const neighbours =
    visible.length > 1
      ? {
          prev: visible[(Math.max(index, 0) - 1 + visible.length) % visible.length],
          next: visible[(index + 1) % visible.length],
          position: index === -1 ? "–" : `${index + 1} / ${visible.length}`,
        }
      : null;

  return (
    <div
      ref={wrapper}
      className={cn(
        "tour-viewer relative isolate size-full overflow-hidden bg-[#0e0d0c] select-none",
        flat && "tour-viewer--flat",
        className,
      )}
    >
      {flat && currentScene && (
        <FlatScene key={currentScene.mediaKey} mediaKey={currentScene.mediaKey} alt={currentScene.name} className="absolute inset-0" />
      )}
      <div className="absolute inset-0 z-[1]">
        <LazyPanoramaViewer config={creation.config} plugins={creation.plugins} onReady={handleReady} onDestroy={handleDestroy} />
      </div>

      <ViewerControls
        tour={tour}
        scene={currentScene}
        mode={mode}
        viewerRef={viewerRef}
        wrapperRef={wrapper}
        hidden={controlsHidden}
        onHiddenChange={setControlsHidden}
        neighbours={neighbours}
        onNavigate={goTo}
        ribbon={{
          available: ribbonAllowed && visible.length > 0,
          open: ribbonOpen,
          locked: lockOpen,
          toggle: () => viewerRef.current?.getPlugin<GalleryPlugin>("gallery")?.toggle(),
        }}
        vr={
          vrSupported
            ? {
                toggle: () => void viewerRef.current?.getPlugin<StereoPlugin>("stereo")?.toggle(),
              }
            : null
        }
        ownerActions={ownerActions}
        onClose={onClose}
      />

      <InfospotModal spot={infospot} onClose={() => setInfospot(null)} />
    </div>
  );
}
