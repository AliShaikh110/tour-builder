"use client";

import type { Viewer } from "@photo-sphere-viewer/core";
import { MapPinOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useRef, useState, type MouseEvent } from "react";
import { toast } from "sonner";
import { ConnectScenesMap } from "@/components/map/connect-scenes";
import { Button } from "@/components/ui/button";
import type { ViewerPlugins } from "@/components/viewer/panorama-viewer";
import { plural } from "@/lib/format";
import { normalizeAngle, radToDeg } from "@/lib/geometry";
import { arrivalView } from "@/lib/navigation";
import { useTour, useTourStore } from "@/lib/store";
import type { CameraView, LinkHotspot, Scene, Tour } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BottomToolbar } from "./bottom-toolbar";
import { ComingFromDialog } from "./coming-from-dialog";
import { DeveloperPanel } from "./developer-panel";
import { FlatImageDialog } from "./flat-image-dialog";
import { IconRail, type PanelId } from "./icon-rail";
import { PreviewOverlay } from "./preview-overlay";
import { ScenesPanel } from "./scenes-panel";
import { SettingsPanel } from "./settings-panel";
import { SharePanel } from "./share-panel";
import { TopBar, type EditorMode } from "./top-bar";
import { useSceneUpload } from "./use-scene-upload";
import { UNDO_TOAST_MS, useSpotEditor } from "./use-spot-editor";
import { Viewport } from "./viewport";

function TourNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <MapPinOff className="size-8 text-muted-foreground" aria-hidden="true" />
      <h1 className="mt-4 text-xl font-semibold">This tour isn&apos;t in this browser</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Tours are saved in the browser that created them. It may have been deleted, or created
        somewhere else.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Back to your tours</Link>
      </Button>
    </main>
  );
}

export function Editor({ params }: { params: Promise<{ tourId: string }> }) {
  const { tourId } = use(params);
  const tour = useTour(tourId);
  return tour ? <EditorWorkspace tour={tour} /> : <TourNotFound />;
}

const VIEWER_PLUGINS: ViewerPlugins = { markers: { defaultHoverScale: false } };

function EditorWorkspace({ tour }: { tour: Tour }) {
  const router = useRouter();
  const updateScene = useTourStore((s) => s.updateScene);
  const resetInitialViews = useTourStore((s) => s.resetInitialViews);
  const restoreViews = useTourStore((s) => s.restoreViews);
  const setArrivalView = useTourStore((s) => s.setArrivalView);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [arrival, setArrival] = useState<{ sceneId: string; view: CameraView } | null>(null);
  const [mode, setMode] = useState<EditorMode>("edit");
  // The side panel starts open on wide screens and closed on phones, where it overlays the view.
  const [panel, setPanel] = useState<PanelId | null>(() =>
    window.matchMedia("(min-width: 768px)").matches ? "scenes" : null,
  );
  const [comingFromOpen, setComingFromOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loadedSceneId, setLoadedSceneId] = useState<string | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [viewerGeneration, setViewerGeneration] = useState(0);

  // Fall back to the first scene when nothing (or a deleted scene) is selected.
  const currentId =
    selectedId && tour.scenes[selectedId] ? selectedId : (tour.sceneOrder[0] ?? null);
  const scene = currentId ? tour.scenes[currentId] : null;
  const panoramaShowing = scene?.displayType === "360" && loadedSceneId === scene.id;
  // Spots are drawn for the panorama on screen, not for one still loading.
  const shownScene = panoramaShowing ? scene : null;
  const editing = mode === "edit";

  const upload = useSceneUpload(tour.id, (ids) => {
    if (!currentId) setSelectedId(ids[0]);
  });

  const handleViewerReady = useCallback((viewer: Viewer) => {
    viewerRef.current = viewer;
    setViewerGeneration((g) => g + 1);
  }, []);
  const handleViewerDestroy = useCallback(() => {
    viewerRef.current = null;
    setLoadedSceneId(null);
  }, []);

  function currentCamera(): CameraView | null {
    const viewer = viewerRef.current;
    if (!viewer || !panoramaShowing) return null;
    const { yaw, pitch } = viewer.getPosition();
    return { yaw: normalizeAngle(yaw), pitch, zoom: Math.round(viewer.getZoomLevel()) };
  }

  /** Opens a scene the direct way (scene list, arrows): at its initial view. */
  function select(sceneId: string) {
    setArrival(null);
    setSelectedId(sceneId);
  }

  /** Follows a hotspot, facing the way the arrival rule says. */
  function travel(hotspot: LinkHotspot) {
    const target = tour.scenes[hotspot.targetSceneId];
    if (!target) return;
    const current = currentCamera();
    const view =
      shownScene && current
        ? arrivalView({
            via: "hotspot",
            hotspot,
            source: shownScene,
            target,
            current,
            enforceInitialViews: tour.settings.enforceInitialViews,
          })
        : null;
    setArrival(view ? { sceneId: target.id, view } : null);
    setSelectedId(target.id);
  }

  const spots = useSpotEditor({
    tour,
    currentId,
    shownScene,
    editing,
    viewerRef,
    viewerGeneration,
    onTravel: travel,
  });
  const { guard } = spots;

  // --- Initial views ----------------------------------------------------------

  function handleSetInitialView() {
    const camera = currentCamera();
    if (!camera || !scene) return;
    updateScene(tour.id, scene.id, { initialView: camera });
    toast.success("Initial view has been set", {
      description: `“${scene.name}” opens facing ${Math.round(radToDeg(camera.yaw))}° at ${camera.zoom}% zoom.`,
    });
  }

  function handleComingFrom(source: Scene, clear: boolean) {
    if (!scene) return;
    const camera = clear ? null : currentCamera();
    if (!clear && !camera) return;
    setArrivalView(tour.id, source.id, scene.id, camera);
    toast.success(
      clear
        ? `Cleared the view for visitors coming from “${source.name}”`
        : `Initial view set for visitors coming from “${source.name}”`,
    );
  }

  function handleResetInitialViews() {
    const snapshot = resetInitialViews(tour.id);
    const count = Object.keys(snapshot.initial).length + snapshot.arrival.length;
    if (count === 0) {
      toast.info("No scene has an initial view yet.");
      return;
    }
    toast.success(`Reset ${plural(count, "initial view")}`, {
      description: "Scenes now open facing straight ahead, or the visitor's heading.",
      duration: UNDO_TOAST_MS,
      action: { label: "Undo", onClick: () => restoreViews(tour.id, snapshot) },
    });
  }

  // --- Layout -----------------------------------------------------------------

  function selectPanel(id: PanelId) {
    const editingSpot = spots.panel !== null;
    guard(() => setPanel((open) => (open === id && !editingSpot ? null : id)));
  }

  function handleHome(event: MouseEvent) {
    if (!spots.dirty) return;
    event.preventDefault();
    guard(() => router.push("/"));
  }

  // Connect Scenes swaps the 360° view for the top-down map, which has its own controls.
  const connecting = editing && panel === "connect" && !spots.panel;

  const sidePanel =
    spots.panel ??
    (panel === "scenes" ? (
      <ScenesPanel
        tour={tour}
        currentId={currentId}
        onSelect={(id) => guard(() => select(id))}
        upload={upload}
        getViewerYaw={() => currentCamera()?.yaw ?? null}
      />
    ) : panel === "settings" ? (
      <SettingsPanel tour={tour} currentId={currentId} />
    ) : panel === "share" ? (
      <SharePanel tour={tour} currentId={currentId} />
    ) : panel === "developer" ? (
      <DeveloperPanel tour={tour} currentId={currentId} />
    ) : null);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar
        tour={tour}
        mode={mode}
        onModeChange={(next) => guard(() => setMode(next))}
        onShare={() =>
          guard(() => {
            setMode("edit");
            setPanel("share");
          })
        }
        onPreview={() => guard(() => setPreviewOpen(true))}
        onHome={handleHome}
      />
      <div className="relative flex min-h-0 flex-1">
        {editing && <IconRail active={spots.panel ? null : panel} onSelect={selectPanel} />}
        {editing && sidePanel && (
          <aside
            id="editor-panel"
            aria-label="Editor panel"
            className={cn(
              "z-10 flex w-80 shrink-0 flex-col border-r bg-sidebar",
              // Phones: overlay the viewport next to the rail.
              "max-md:absolute max-md:inset-y-0 max-md:left-14 max-md:w-[min(20rem,calc(100%-3.5rem))] max-md:shadow-[16px_0_40px_-16px_oklch(0_0_0/0.8)]",
            )}
          >
            {sidePanel}
          </aside>
        )}
        <main className="relative min-w-0 flex-1">
          {connecting ? (
            <ConnectScenesMap tour={tour} />
          ) : (
            <Viewport
              tour={tour}
              scene={scene}
              mode={mode}
              upload={upload}
              viewerRef={viewerRef}
              viewerGeneration={viewerGeneration}
              plugins={VIEWER_PLUGINS}
              onViewerReady={handleViewerReady}
              onViewerDestroy={handleViewerDestroy}
              onSceneLoaded={setLoadedSceneId}
              onSelectScene={(id) => guard(() => select(id))}
              arrival={arrival}
              banner={spots.banner}
            >
              {editing && scene && (
                <BottomToolbar
                  panoramaReady={panoramaShowing}
                  placing={spots.placing}
                  onPlace={spots.startPlacing}
                  onCancelPlacing={spots.cancelPlacing}
                  onSetInitialView={handleSetInitialView}
                  onComingFrom={() => setComingFromOpen(true)}
                  onResetInitialViews={handleResetInitialViews}
                  onPreview={() => guard(() => setPreviewOpen(true))}
                />
              )}
            </Viewport>
          )}
        </main>
      </div>

      {spots.overlays}
      {scene && (
        <ComingFromDialog
          tour={tour}
          scene={scene}
          open={comingFromOpen}
          onOpenChange={setComingFromOpen}
          onSet={handleComingFrom}
        />
      )}
      <FlatImageDialog question={upload.question} />
      <PreviewOverlay tour={tour} startSceneId={currentId} open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </div>
  );
}
