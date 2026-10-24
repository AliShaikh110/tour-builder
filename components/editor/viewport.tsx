"use client";

import type { Viewer, events } from "@photo-sphere-viewer/core";
import { ChevronLeft, ChevronRight, ImagePlus, Minus, Plus } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState, type DragEvent, type RefObject } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FlatScene } from "@/components/viewer/flat-scene";
import { LazyPanoramaViewer } from "@/components/viewer/lazy-panorama-viewer";
import type { ViewerPlugins } from "@/components/viewer/panorama-viewer";
import { DEFAULT_ZOOM } from "@/lib/constants";
import { IMAGE_ACCEPT } from "@/lib/image";
import { MediaUrlCache } from "@/lib/media-db";
import { arrivalView } from "@/lib/navigation";
import type { CameraView, Scene, Tour } from "@/lib/types";
import { UploadStatus } from "./scenes-panel";
import type { SceneUpload } from "./use-scene-upload";

const ZOOM_STEP = 10;

function EmptyViewport({ upload }: { upload: SceneUpload }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex size-full items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ImagePlus className="size-7" aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-xl font-semibold tracking-tight">Add your first scene</h2>
        <p className="mt-2 text-sm text-pretty text-muted-foreground">
          Drop 360° photos anywhere here. Each photo becomes a scene visitors can stand inside.
        </p>
        <Button size="lg" className="mt-6" onClick={() => input.current?.click()} disabled={upload.progress !== null}>
          <Plus aria-hidden="true" />
          Add Scenes
        </Button>
        <div className="mt-4 w-64">
          <UploadStatus progress={upload.progress} />
        </div>
        <input
          ref={input}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          hidden
          aria-label="Choose photos to add"
          onChange={(e) => {
            const files = e.target.files ? [...e.target.files] : [];
            e.target.value = "";
            void upload.addFiles(files);
          }}
        />
      </div>
    </div>
  );
}

export function Viewport({
  tour,
  scene,
  mode,
  upload,
  viewerRef,
  viewerGeneration,
  plugins,
  onViewerReady,
  onViewerDestroy,
  onSceneLoaded,
  onSelectScene,
  arrival,
  banner,
  children,
}: {
  tour: Tour;
  scene: Scene | null;
  mode: "edit" | "view";
  upload: SceneUpload;
  viewerRef: RefObject<Viewer | null>;
  /** Bumped by the owner each time a new viewer instance is ready. */
  viewerGeneration: number;
  /** Memoised plugin options, read when the viewer is created. */
  plugins?: ViewerPlugins;
  onViewerReady: (viewer: Viewer) => void;
  onViewerDestroy: () => void;
  /** Called once a 360° scene's panorama is showing. */
  onSceneLoaded: (sceneId: string | null) => void;
  onSelectScene: (sceneId: string) => void;
  /** Camera to open `sceneId` with (hotspot travel); other scenes open at their initial view. */
  arrival?: { sceneId: string; view: CameraView } | null;
  /** Shown centred at the top of the view (e.g. "Click to set a hotspot"). */
  banner?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [urls] = useState(() => new MediaUrlCache());
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [dropping, setDropping] = useState(false);
  // What the viewer shows (or is loading). The same image is never requested
  // twice: two in-flight loads of one URL abort each other inside three.js.
  const loaded = useRef<{ viewer: Viewer; sceneId: string; mediaKey: string; done: boolean } | null>(null);

  useEffect(() => () => urls.revokeAll(), [urls]);

  const sceneId = scene?.id ?? null;
  const mediaKey = scene?.mediaKey ?? null;
  const is360 = scene?.displayType === "360";

  // Reads the latest scene data (e.g. initial view) without reloading on every edit.
  const loadPanorama = useEffectEvent(async (viewer: Viewer, id: string, key: string) => {
    const target = tour.scenes[id];
    if (!target) return;
    const view = arrival?.sceneId === id ? arrival.view : arrivalView({ via: "direct", target });
    const position = { yaw: view.yaw, pitch: view.pitch };
    const zoomLevel = view.zoom;
    const current = loaded.current;

    if (current?.viewer === viewer && current.mediaKey === key) {
      // Already showing (e.g. back from a 2D scene): just turn to face the arrival view.
      if (current.done) {
        viewer.rotate(position);
        viewer.zoom(zoomLevel);
        onSceneLoaded(id);
      }
      return;
    }

    const previous = current?.viewer === viewer && current.done ? current : null;
    const entry = { viewer, sceneId: id, mediaKey: key, done: false };
    loaded.current = entry;
    onSceneLoaded(null);

    const url = await urls.get(key);
    if (loaded.current !== entry) return; // a newer scene was requested meanwhile
    if (!url) {
      loaded.current = null;
      toast.error("This scene's photo is missing from browser storage.");
      return;
    }
    try {
      const completed = await viewer.setPanorama(url, {
        position,
        zoom: zoomLevel,
        transition: viewer.state.ready ? { speed: 600, rotation: false, effect: "fade" } : false,
      });
      if (!completed || loaded.current !== entry) return;
      entry.done = true;
      // The same scene with a new key means its image was swapped: free the old URL.
      if (previous && previous.sceneId === id && previous.mediaKey !== key) urls.revoke(previous.mediaKey);
      setZoom(Math.round(viewer.getZoomLevel()));
      onSceneLoaded(id);
    } catch {
      if (loaded.current === entry) loaded.current = null;
      toast.error("This panorama couldn't be displayed.");
    }
  });

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !sceneId || !mediaKey || !is360) return;
    void loadPanorama(viewer, sceneId, mediaKey);
  }, [viewerRef, viewerGeneration, sceneId, mediaKey, is360]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const handleZoom = (e: events.ZoomUpdatedEvent) => setZoom(Math.round(e.zoomLevel));
    viewer.addEventListener("zoom-updated", handleZoom);
    return () => viewer.removeEventListener("zoom-updated", handleZoom);
  }, [viewerRef, viewerGeneration]);

  function zoomBy(delta: number) {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const target = Math.min(100, Math.max(0, viewer.getZoomLevel() + delta));
    void viewer.animate({ zoom: target, speed: 250 });
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDropping(false);
    void upload.addFiles(event.dataTransfer.files);
  }

  const order = tour.sceneOrder;
  const index = sceneId ? order.indexOf(sceneId) : -1;

  return (
    <section
      aria-label={scene ? `${scene.displayType === "360" ? "360° view" : "Image"} of ${scene.name}` : "Viewer"}
      className="relative size-full overflow-hidden bg-[#0e0d0c]"
      onDragOver={(e) => {
        if (mode !== "edit" || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDropping(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false);
      }}
      onDrop={handleDrop}
    >
      {order.length === 0 ? (
        <EmptyViewport upload={upload} />
      ) : (
        <>
          <LazyPanoramaViewer plugins={plugins} onReady={onViewerReady} onDestroy={onViewerDestroy} />
          {scene?.displayType === "2d" && (
            <FlatScene key={scene.mediaKey} mediaKey={scene.mediaKey} alt={scene.name} className="absolute inset-0 z-[1]" />
          )}

          {scene && (
            <div className="pointer-events-none absolute top-3 left-3 z-[2] flex max-w-[60%] items-center gap-2 rounded-lg bg-background/75 px-3 py-1.5 text-sm backdrop-blur-md">
              <span className="truncate font-medium">{scene.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {index + 1}/{order.length}
              </span>
            </div>
          )}

          {is360 && (
            <div className="absolute top-3 right-3 z-[2] flex flex-col items-center overflow-hidden rounded-lg bg-background/75 backdrop-blur-md">
              <Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => zoomBy(ZOOM_STEP)} disabled={zoom >= 100}>
                <Plus />
              </Button>
              <output className="w-full border-y py-1 text-center text-[11px] text-muted-foreground tabular-nums" aria-label="Zoom level">
                {zoom}%
              </output>
              <Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => zoomBy(-ZOOM_STEP)} disabled={zoom <= 0}>
                <Minus />
              </Button>
            </div>
          )}

          {mode === "view" && order.length > 1 && index !== -1 && (
            <>
              <Button
                variant="secondary"
                size="icon-lg"
                aria-label="Previous scene"
                className="absolute top-1/2 left-3 z-[2] -translate-y-1/2 rounded-full bg-background/75 backdrop-blur-md"
                onClick={() => onSelectScene(order[(index - 1 + order.length) % order.length])}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="secondary"
                size="icon-lg"
                aria-label="Next scene"
                className="absolute top-1/2 right-3 z-[2] -translate-y-1/2 rounded-full bg-background/75 backdrop-blur-md"
                onClick={() => onSelectScene(order[(index + 1) % order.length])}
              >
                <ChevronRight />
              </Button>
            </>
          )}

          {mode === "edit" && upload.progress && (
            <div className="absolute top-14 left-1/2 z-[3] w-72 max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-lg bg-background/90 p-1 backdrop-blur-md md:hidden">
              <UploadStatus progress={upload.progress} />
            </div>
          )}
        </>
      )}

      {banner && (
        <div className="absolute top-3 left-1/2 z-[4] max-w-[calc(100%-1.5rem)] -translate-x-1/2" role="status">
          {banner}
        </div>
      )}

      {children}

      {dropping && (
        <div className="pointer-events-none absolute inset-3 z-[5] flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-primary/10 text-base font-medium text-primary backdrop-blur-[2px]">
          Drop photos to add scenes
        </div>
      )}
    </section>
  );
}
