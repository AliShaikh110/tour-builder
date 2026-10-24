"use client";

import { Check } from "lucide-react";
import type { PointerEvent } from "react";
import type { Scene, Tour } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useTileImage } from "./use-tile-image";

function StripItem({
  scene,
  selected,
  onPointerDown,
  onActivate,
}: {
  scene: Scene;
  selected: boolean;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onActivate: () => void;
}) {
  const image = useTileImage(scene.displayType, scene.mediaKey, scene.thumbKey);
  const placed = scene.mapPos !== null;
  return (
    <li className="shrink-0">
      <button
        type="button"
        onPointerDown={onPointerDown}
        onClick={onActivate}
        aria-label={placed ? `${scene.name}, on the plane. Show it.` : `${scene.name}, not placed. Drag onto the plane, or press Enter to drop it in the middle.`}
        className={cn(
          "group/strip flex w-24 flex-col items-center gap-1.5 rounded-lg p-2 text-center outline-none transition-colors",
          "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
          !placed && "cursor-grab active:cursor-grabbing",
          selected && "bg-primary/10",
        )}
      >
        <span
          className={cn(
            "relative block size-14 overflow-hidden rounded-full bg-muted ring-1 ring-foreground/15",
            placed && "opacity-60",
            selected && "ring-2 ring-primary",
          )}
        >
          {image && (
            // eslint-disable-next-line @next/next/no-img-element -- generated data URL
            <img src={image} alt="" draggable={false} className="size-full object-cover" />
          )}
          {placed && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/35">
              <Check className="size-5 text-white" aria-hidden="true" />
            </span>
          )}
        </span>
        <span className="w-full truncate text-xs">{scene.name}</span>
        <span className={cn("text-[10px]", placed ? "text-muted-foreground" : "text-primary")}>
          {placed ? "Placed" : "Drag to place"}
        </span>
      </button>
    </li>
  );
}

/** Every scene, placed or not; unplaced ones are dragged from here onto the plane. */
export function SceneStrip({
  tour,
  unplaced,
  selected,
  onPointerDown,
  onActivate,
}: {
  tour: Tour;
  unplaced: number;
  selected: string | null;
  onPointerDown: (event: PointerEvent<HTMLElement>, sceneId: string) => void;
  onActivate: (sceneId: string) => void;
}) {
  const scenes = tour.sceneOrder.map((id) => tour.scenes[id]).filter(Boolean);
  return (
    <div className="border-t bg-background">
      <p className="px-3 pt-2 text-xs text-muted-foreground tabular-nums">
        {unplaced === 0 ? "Every scene is on the plane" : `${unplaced} of ${scenes.length} scenes unplaced`}
      </p>
      <ul className="flex gap-1 overflow-x-auto px-2 pb-2" aria-label="Scenes">
        {scenes.map((scene) => (
          <StripItem
            key={scene.id}
            scene={scene}
            selected={selected === scene.id}
            onPointerDown={(e) => onPointerDown(e, scene.id)}
            onActivate={() => onActivate(scene.id)}
          />
        ))}
      </ul>
    </div>
  );
}
