"use client";

import { Crosshair, EllipsisVertical, Eye, Link2, MapPinPlus, RotateCcw, Route, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SpotType } from "@/components/viewer/spot-markup";

function Hint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function PlaceButton({
  type,
  placing,
  panoramaReady,
  onPlace,
  onCancel,
}: {
  type: SpotType;
  placing: SpotType | null;
  panoramaReady: boolean;
  onPlace: (type: SpotType) => void;
  onCancel: () => void;
}) {
  if (placing === type) {
    return (
      <Button variant="secondary" size="lg" onClick={onCancel} className="ring-1 ring-primary/60">
        <X aria-hidden="true" />
        Cancel
      </Button>
    );
  }
  const label = type === "hotspot" ? "Link Hotspot" : "Add Infospot";
  const Icon = type === "hotspot" ? Link2 : MapPinPlus;
  const hint = !panoramaReady
    ? `${type === "hotspot" ? "Hotspots" : "Infospots"} go on 360° scenes`
    : type === "hotspot"
      ? "Place a hotspot that leads to another scene"
      : "Pin information: a link, text, an image or HTML";
  return (
    <Hint label={hint}>
      <Button
        variant="ghost"
        size="lg"
        onClick={() => onPlace(type)}
        disabled={!panoramaReady || placing !== null}
        aria-label={label}
      >
        <Icon aria-hidden="true" />
        <span className="hidden sm:inline">{label}</span>
      </Button>
    </Hint>
  );
}

/** Floating toolbar along the bottom of the editor viewport. */
export function BottomToolbar({
  panoramaReady,
  placing,
  onPlace,
  onCancelPlacing,
  onSetInitialView,
  onComingFrom,
  onResetInitialViews,
  onPreview,
}: {
  /** A 360° panorama is showing (spots and initial views need one). */
  panoramaReady: boolean;
  placing: SpotType | null;
  onPlace: (type: SpotType) => void;
  onCancelPlacing: () => void;
  onSetInitialView: () => void;
  onComingFrom: () => void;
  onResetInitialViews: () => void;
  onPreview: () => void;
}) {
  const busy = placing !== null;
  return (
    <div
      role="toolbar"
      aria-label="Scene tools"
      className="absolute bottom-4 left-1/2 z-[3] flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-0.5 rounded-xl bg-background/85 p-1 shadow-[0_16px_40px_-12px_oklch(0_0_0/0.75)] ring-1 ring-foreground/10 backdrop-blur-md"
    >
      <PlaceButton type="infospot" placing={placing} panoramaReady={panoramaReady} onPlace={onPlace} onCancel={onCancelPlacing} />
      <PlaceButton type="hotspot" placing={placing} panoramaReady={panoramaReady} onPlace={onPlace} onCancel={onCancelPlacing} />

      <Hint label="Open this scene facing the current view">
        <Button
          variant="ghost"
          size="lg"
          onClick={onSetInitialView}
          disabled={!panoramaReady || busy}
          aria-label="Set Initial View"
        >
          <Crosshair aria-hidden="true" />
          <span className="hidden sm:inline">Set Initial View</span>
        </Button>
      </Hint>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-lg" aria-label="More view options" disabled={busy}>
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="w-64">
          <DropdownMenuItem onSelect={onComingFrom} disabled={!panoramaReady}>
            <Route />
            Set Initial View Coming From…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onResetInitialViews}>
            <RotateCcw />
            Reset All initial views
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Hint label="See the tour as visitors will">
        <Button variant="ghost" size="lg" onClick={onPreview} disabled={busy} aria-label="Preview">
          <Eye aria-hidden="true" />
          <span className="hidden sm:inline">Preview</span>
        </Button>
      </Hint>
    </div>
  );
}
