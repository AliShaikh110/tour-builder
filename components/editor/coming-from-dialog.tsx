"use client";

import { Crosshair, Route } from "lucide-react";
import { MediaImage } from "@/components/media-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { radToDeg } from "@/lib/geometry";
import type { CameraView, Scene, Tour } from "@/lib/types";

/** Scenes that have at least one hotspot leading to `sceneId`, in tour order. */
export function scenesLinkingTo(tour: Tour, sceneId: string): Scene[] {
  return tour.sceneOrder
    .map((id) => tour.scenes[id])
    .filter((s) => s && s.id !== sceneId && s.hotspots.some((h) => h.targetSceneId === sceneId));
}

function arrivalOf(source: Scene, targetId: string): CameraView | undefined {
  return source.hotspots.find((h) => h.targetSceneId === targetId && h.arrivalView)?.arrivalView;
}

/**
 * "Set Initial View Coming From…": a start view that applies only when the
 * visitor arrives from a particular scene through its hotspot.
 */
export function ComingFromDialog({
  tour,
  scene,
  open,
  onOpenChange,
  onSet,
}: {
  tour: Tour;
  scene: Scene;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Saves the current camera (or clears with `clear`) for arrivals from `fromScene`. */
  onSet: (fromScene: Scene, clear: boolean) => void;
}) {
  const sources = scenesLinkingTo(tour, scene.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set initial view coming from…</DialogTitle>
          <DialogDescription>
            Visitors arriving in “{scene.name}” from the scene you pick will face the way the view faces now.
          </DialogDescription>
        </DialogHeader>
        {sources.length === 0 ? (
          <p className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-3 text-sm text-muted-foreground">
            <Route className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            No scene links here yet. Add a hotspot in another scene that leads to “{scene.name}” first.
          </p>
        ) : (
          <ul className="-mx-1 max-h-[55dvh] space-y-1 overflow-y-auto px-1">
            {sources.map((source) => {
              const arrival = arrivalOf(source, scene.id);
              return (
                <li key={source.id} className="flex items-center gap-3 rounded-lg p-1.5 ring-1 ring-foreground/10">
                  <MediaImage mediaKey={source.thumbKey} alt="" className="aspect-[2/1] w-20 shrink-0 rounded" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">From “{source.name}”</p>
                    {arrival ? (
                      <Badge variant="secondary" className="mt-1 tabular-nums">
                        Faces {Math.round(radToDeg(arrival.yaw))}°
                      </Badge>
                    ) : (
                      <p className="mt-0.5 text-xs text-muted-foreground">Uses the tour&apos;s arrival rule</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                    <Button size="sm" onClick={() => onSet(source, false)}>
                      <Crosshair aria-hidden="true" />
                      Use current view
                    </Button>
                    {arrival && (
                      <Button size="sm" variant="ghost" onClick={() => onSet(source, true)}>
                        Clear
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
