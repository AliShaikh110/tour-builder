"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ImagePlus, LoaderCircle, Plus, TextCursorInput } from "lucide-react";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { plural } from "@/lib/format";
import { radToDeg } from "@/lib/geometry";
import { IMAGE_ACCEPT } from "@/lib/image";
import { useTourStore } from "@/lib/store";
import type { Scene, Tour } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FastRenameDialog } from "./fast-rename-dialog";
import { SceneRow } from "./scene-row";
import type { SceneUpload } from "./use-scene-upload";

function inboundHotspots(tour: Tour, sceneId: string): number {
  return Object.values(tour.scenes).reduce(
    (count, scene) => count + scene.hotspots.filter((h) => h.targetSceneId === sceneId).length,
    0,
  );
}

export function UploadStatus({ progress }: { progress: SceneUpload["progress"] }) {
  if (!progress) return null;
  return (
    <div className="space-y-2 rounded-lg bg-muted/50 px-3 py-2.5" aria-live="polite">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">
          {progress.current
            ? `Adding ${Math.min(progress.done + 1, progress.total)} of ${progress.total}: ${progress.current}`
            : "Reading photos…"}
        </span>
      </p>
      <Progress
        value={progress.current ? (progress.done / progress.total) * 100 : 5}
        aria-label="Upload progress"
      />
    </div>
  );
}

export function ScenesPanel({
  tour,
  currentId,
  onSelect,
  upload,
  getViewerYaw,
}: {
  tour: Tour;
  currentId: string | null;
  onSelect: (sceneId: string) => void;
  upload: SceneUpload;
  /** Current yaw of the open 360° scene, or null when no panorama is showing. */
  getViewerYaw: () => number | null;
}) {
  const reorderScenes = useTourStore((s) => s.reorderScenes);
  const updateScene = useTourStore((s) => s.updateScene);
  const updateTour = useTourStore((s) => s.updateTour);
  const deleteScene = useTourStore((s) => s.deleteScene);

  const addInput = useRef<HTMLInputElement>(null);
  const swapInput = useRef<HTMLInputElement>(null);
  const [swapTarget, setSwapTarget] = useState<Scene | null>(null);
  const [toDelete, setToDelete] = useState<Scene | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [dropping, setDropping] = useState(false);

  const scenes = tour.sceneOrder.map((id) => tour.scenes[id]).filter(Boolean);
  const coverId = tour.coverSceneId ?? tour.sceneOrder[0];
  const busy = upload.progress !== null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = tour.sceneOrder.indexOf(String(active.id));
    const to = tour.sceneOrder.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    reorderScenes(tour.id, arrayMove(tour.sceneOrder, from, to));
  }

  function handleAdd(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? [...event.target.files] : [];
    event.target.value = "";
    void upload.addFiles(files);
  }

  function handleSwap(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file && swapTarget) void upload.swapImage(swapTarget, file);
    setSwapTarget(null);
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDropping(false);
    void upload.addFiles(event.dataTransfer.files);
  }

  function confirmDelete() {
    if (!toDelete) return;
    const index = tour.sceneOrder.indexOf(toDelete.id);
    const neighbour = tour.sceneOrder[index + 1] ?? tour.sceneOrder[index - 1];
    // The server deletes the scene's photos when the tour is next saved.
    const removed = deleteScene(tour.id, toDelete.id);
    if (!removed) return;
    if (removed.id === currentId && neighbour) onSelect(neighbour);
    toast.success(`Deleted “${removed.name}”`);
  }

  const deleteLinks = toDelete ? inboundHotspots(tour, toDelete.id) : 0;

  return (
    <div
      className="flex h-full flex-col"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDropping(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false);
      }}
      onDrop={handleDrop}
    >
      <div className="space-y-3 border-b px-4 pt-4 pb-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold tracking-tight">Scenes</h2>
          <span className="text-xs text-muted-foreground tabular-nums">{plural(scenes.length, "scene")}</span>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => addInput.current?.click()} disabled={busy}>
            <Plus aria-hidden="true" />
            Add Scenes
          </Button>
          <Button
            variant="outline"
            onClick={() => setRenameOpen(true)}
            disabled={scenes.length === 0}
          >
            <TextCursorInput aria-hidden="true" />
            Fast Rename
          </Button>
        </div>
        <UploadStatus progress={upload.progress} />
        <input
          ref={addInput}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          hidden
          onChange={handleAdd}
          aria-label="Choose photos to add"
        />
        <input
          ref={swapInput}
          type="file"
          accept={IMAGE_ACCEPT}
          hidden
          onChange={handleSwap}
          aria-label="Choose a replacement photo"
        />
      </div>

      <div className={cn("relative min-h-0 flex-1 overflow-y-auto p-2", dropping && "bg-primary/5")}>
        {scenes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
            <ImagePlus className="size-6" aria-hidden="true" />
            Drop 360° photos here, or use Add Scenes.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={tour.sceneOrder} strategy={verticalListSortingStrategy}>
              <ol className="space-y-1" aria-label="Scenes, in tour order">
                {scenes.map((scene, index) => {
                  const current = scene.id === currentId;
                  const canSetNorth = current && scene.displayType === "360";
                  return (
                    <SceneRow
                      key={scene.id}
                      scene={scene}
                      index={index}
                      current={current}
                      cover={scene.id === coverId}
                      actions={{
                        onSelect: () => onSelect(scene.id),
                        onToggleRibbon: () =>
                          updateScene(tour.id, scene.id, { hiddenFromRibbon: !scene.hiddenFromRibbon }),
                        onSetCover: () => {
                          updateTour(tour.id, { coverSceneId: scene.id });
                          toast.success(`“${scene.name}” is now the cover image`);
                        },
                        onSetNorth: canSetNorth
                          ? () => {
                              const yaw = getViewerYaw();
                              if (yaw === null) return;
                              updateScene(tour.id, scene.id, { northOffset: yaw });
                              toast.success(`North set for “${scene.name}”`, {
                                description: `North now points to ${Math.round(radToDeg(yaw))}° in this photo.`,
                              });
                            }
                          : undefined,
                        onSwap: () => {
                          setSwapTarget(scene);
                          swapInput.current?.click();
                        },
                        onDelete: () => setToDelete(scene),
                      }}
                    />
                  );
                })}
              </ol>
            </SortableContext>
          </DndContext>
        )}
        {dropping && (
          <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-xl border-2 border-dashed border-primary text-sm font-medium text-primary">
            Drop to add scenes
          </div>
        )}
      </div>

      <FastRenameDialog tour={tour} open={renameOpen} onOpenChange={setRenameOpen} />

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{toDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The photo is deleted from your account.
              {deleteLinks > 0 &&
                ` ${plural(deleteLinks, "hotspot")} in other scenes that ${deleteLinks === 1 ? "leads" : "lead"} here ${deleteLinks === 1 ? "is" : "are"} removed too.`}{" "}
              This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep scene</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete scene
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
