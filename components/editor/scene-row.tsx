"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Compass,
  Crosshair,
  EllipsisVertical,
  Eye,
  EyeOff,
  GripVertical,
  ImageUp,
  Star,
  Trash2,
} from "lucide-react";
import { MediaImage } from "@/components/media-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Scene } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface SceneRowActions {
  onSelect: () => void;
  onToggleRibbon: () => void;
  onSetCover: () => void;
  /** Undefined when north can't be set (scene not open, or 2D). */
  onSetNorth?: () => void;
  onSwap: () => void;
  onDelete: () => void;
}

function Flag({ icon: Icon, label }: { icon: typeof Star; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex text-muted-foreground" role="img" aria-label={label}>
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function SceneRow({
  scene,
  index,
  current,
  cover,
  actions,
}: {
  scene: Scene;
  index: number;
  current: boolean;
  cover: boolean;
  actions: SceneRowActions;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: scene.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group/row relative flex items-center gap-1 rounded-lg py-1.5 pr-1 pl-0.5 transition-colors",
        current ? "bg-primary/10 ring-1 ring-primary/50" : "hover:bg-accent/60",
        isDragging && "z-10 bg-popover shadow-[0_12px_32px_-8px_oklch(0_0_0/0.7)] ring-1 ring-foreground/15",
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${scene.name}`}
        className="flex h-10 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground/60 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={actions.onSelect}
        aria-current={current ? "true" : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="relative aspect-[2/1] w-24 shrink-0 overflow-hidden rounded-md bg-muted">
          <MediaImage mediaKey={scene.thumbKey} alt="" className="size-full" />
          <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1 text-[10px] leading-4 font-medium tabular-nums backdrop-blur-sm">
            {index + 1}
          </span>
        </span>
        <span className="min-w-0 flex-1 space-y-1">
          <span className="block truncate text-sm font-medium">{scene.name}</span>
          <span className="flex flex-wrap items-center gap-1.5">
            {current && (
              <Badge className="h-4 px-1.5 text-[10px] tracking-wide">EDITING</Badge>
            )}
            {scene.displayType === "2d" && (
              <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                2D
              </Badge>
            )}
            {cover && <Flag icon={Star} label="Cover image" />}
            {scene.hiddenFromRibbon && <Flag icon={EyeOff} label="Hidden from ribbon" />}
            {scene.initialView && <Flag icon={Crosshair} label="Initial view set" />}
            {scene.northOffset !== 0 && <Flag icon={Compass} label="North point set" />}
          </span>
        </span>
      </button>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Options for ${scene.name}`}
            className="shrink-0 text-muted-foreground"
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={actions.onToggleRibbon}>
            {scene.hiddenFromRibbon ? <Eye /> : <EyeOff />}
            {scene.hiddenFromRibbon ? "Show in ribbon" : "Hide from ribbon"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={actions.onSetCover} disabled={cover}>
            <Star />
            {cover ? "Cover image" : "Set as cover"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={actions.onSetNorth} disabled={!actions.onSetNorth}>
            <Compass />
            <span className="flex flex-col">
              Set north here
              {!actions.onSetNorth && (
                <span className="text-xs text-muted-foreground">
                  {scene.displayType === "2d" ? "Only for 360° scenes" : "Open the scene first"}
                </span>
              )}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={actions.onSwap}>
            <ImageUp />
            Swap image
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={actions.onDelete}>
            <Trash2 />
            Delete scene
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
