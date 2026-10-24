"use client";

import type { Viewer } from "@photo-sphere-viewer/core";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Glasses,
  Hand,
  Images,
  Maximize,
  Minimize,
  Minus,
  Plus,
  Share2,
  Volume2,
  VolumeX,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { mediaUrl } from "@/lib/media-db";
import type { Scene, Tour } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { TourViewerMode } from "./tour-viewer";

const HINT_KEY = "tour-builder:drag-hint-seen";

export function ControlButton({
  icon: Icon,
  label,
  onClick,
  pressed,
  className,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  pressed?: boolean;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-pressed={pressed}
          className={cn(
            "pointer-events-auto flex size-10 items-center justify-center rounded-full bg-black/45 text-white/90 backdrop-blur-md transition-colors outline-none",
            "hover:bg-black/65 hover:text-white focus-visible:ring-2 focus-visible:ring-ring",
            pressed && "bg-primary/90 text-primary-foreground hover:bg-primary",
            className,
          )}
        >
          <Icon className="size-[18px]" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}

/** First-visit hint, until the visitor first drags (remembered per browser). */
function DragHint({ wrapperRef }: { wrapperRef: RefObject<HTMLDivElement | null> }) {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(HINT_KEY) !== "1";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!visible) return;
    const element = wrapperRef.current;
    // Only a real drag counts as "seen"; the timeout just tidies the hint away.
    const learned = () => {
      setVisible(false);
      try {
        localStorage.setItem(HINT_KEY, "1");
      } catch {
        // Storage may be unavailable (private mode); the hint just shows again.
      }
    };
    const timer = window.setTimeout(() => setVisible(false), 7000);
    element?.addEventListener("pointerdown", learned, { once: true });
    return () => {
      window.clearTimeout(timer);
      element?.removeEventListener("pointerdown", learned);
    };
  }, [visible, wrapperRef]);

  if (!visible) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-live="polite">
      <p className="flex animate-in items-center gap-2.5 rounded-full bg-black/55 px-5 py-3 text-sm font-medium text-white backdrop-blur-md duration-500 fade-in zoom-in-95">
        <Hand className="size-5 animate-pulse" aria-hidden="true" />
        Click and drag to explore
      </p>
    </div>
  );
}

function useFullscreen(target: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const update = () => setActive(document.fullscreenElement === target.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, [target]);
  const supported = typeof document !== "undefined" && document.fullscreenEnabled;
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void target.current?.requestFullscreen().catch(() => toast.error("Full screen isn't available here."));
  };
  return { active, supported, toggle };
}

/** Loops the tour's ambient sound after the visitor's first interaction, with a mute switch. */
function useAmbientSound(tour: Tour, enabled: boolean) {
  const url = mediaUrl(enabled ? tour.settings.ambientSoundKey : null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (!url) return;
    const element = new Audio(url);
    element.loop = true;
    element.volume = 0.6;
    audio.current = element;
    const start = () => void element.play().catch(() => undefined);
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("keydown", start, { once: true });
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      element.pause();
      audio.current = null;
    };
  }, [url]);

  useEffect(() => {
    if (audio.current) audio.current.muted = muted;
  }, [muted, url]);

  return url ? { muted, toggle: () => setMuted((m) => !m) } : null;
}

export function ViewerControls({
  tour,
  scene,
  mode,
  viewerRef,
  wrapperRef,
  hidden,
  onHiddenChange,
  neighbours,
  onNavigate,
  ribbon,
  vr,
  ownerActions,
  onClose,
}: {
  tour: Tour;
  scene: Scene | null;
  mode: TourViewerMode;
  viewerRef: RefObject<Viewer | null>;
  wrapperRef: RefObject<HTMLDivElement | null>;
  hidden: boolean;
  onHiddenChange: (hidden: boolean) => void;
  neighbours: { prev: string; next: string; position: string } | null;
  onNavigate: (sceneId: string) => void;
  ribbon: { available: boolean; open: boolean; locked: boolean; toggle: () => void };
  vr: { toggle: () => void } | null;
  ownerActions?: ReactNode;
  onClose?: () => void;
}) {
  const compact = mode === "compact";
  const fullscreen = useFullscreen(wrapperRef);
  const sound = useAmbientSound(tour, !compact);

  function zoomBy(delta: number) {
    const viewer = viewerRef.current;
    if (!viewer) return;
    void viewer.animate({ zoom: Math.min(100, Math.max(0, viewer.getZoomLevel() + delta)), speed: 250 });
  }

  async function share() {
    const url = new URL(`/tours/${tour.id}`, window.location.origin);
    if (scene) url.searchParams.set("scene", scene.id);
    if (navigator.share) {
      try {
        await navigator.share({ title: tour.title, url: url.href });
        return;
      } catch {
        // Cancelled or unavailable: fall back to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url.href);
      toast.success("Link copied", {
        description:
          tour.status === "published" ? undefined : "This tour is a draft: publish it in Share so others can open the link.",
      });
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  if (compact) {
    return ribbon.available && !ribbon.locked ? (
      <div className="pointer-events-none absolute top-2 left-2 z-[2]">
        <ControlButton
          icon={Images}
          label={ribbon.open ? "Hide scenes" : "Show scenes"}
          pressed={ribbon.open}
          onClick={ribbon.toggle}
          className="size-8"
        />
      </div>
    ) : null;
  }

  if (hidden) {
    return (
      <div className="pointer-events-none absolute right-3 bottom-3 z-[2]">
        <ControlButton icon={Eye} label="Show controls" onClick={() => onHiddenChange(false)} />
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[2]">
      <div className="absolute top-3 left-3 max-w-[calc(100%-5rem)] rounded-xl bg-black/45 px-3.5 py-2 text-white backdrop-blur-md">
        <p className="truncate text-xs text-white/70">
          {mode === "preview" ? `Preview · ${tour.title}` : tour.title}
        </p>
        <p className="truncate text-sm font-medium">{scene?.name ?? "Loading…"}</p>
      </div>

      <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
        {onClose && <ControlButton icon={X} label="Close preview" onClick={onClose} className="bg-white/90 text-black hover:bg-white hover:text-black" />}
        {ownerActions}
        {ribbon.available && !ribbon.locked && (
          <ControlButton icon={Images} label={ribbon.open ? "Hide scenes" : "Show scenes"} pressed={ribbon.open} onClick={ribbon.toggle} />
        )}
        <ControlButton icon={Share2} label="Share" onClick={() => void share()} />
        {fullscreen.supported && (
          <ControlButton
            icon={fullscreen.active ? Minimize : Maximize}
            label={fullscreen.active ? "Exit full screen" : "Full screen"}
            onClick={fullscreen.toggle}
          />
        )}
        {vr && <ControlButton icon={Glasses} label="Virtual reality" onClick={vr.toggle} />}
        {sound && (
          <ControlButton
            icon={sound.muted ? VolumeX : Volume2}
            label={sound.muted ? "Unmute sound" : "Mute sound"}
            onClick={sound.toggle}
          />
        )}
        {scene?.displayType === "360" && (
          <>
            <ControlButton icon={Plus} label="Zoom in" onClick={() => zoomBy(10)} className="hidden sm:flex" />
            <ControlButton icon={Minus} label="Zoom out" onClick={() => zoomBy(-10)} className="hidden sm:flex" />
          </>
        )}
        <ControlButton icon={EyeOff} label="Hide controls" onClick={() => onHiddenChange(true)} />
      </div>

      {neighbours && (
        <div
          className={cn(
            "absolute right-3 flex items-center gap-1 rounded-full bg-black/45 p-1 text-white backdrop-blur-md transition-[bottom] duration-300 ease-out",
            // Sits above the ribbon when it is open (thumbnail row ≈ 125 px).
            ribbon.open ? "bottom-[140px]" : "bottom-4",
          )}
        >
          <ControlButton icon={ChevronLeft} label="Previous scene" onClick={() => onNavigate(neighbours.prev)} className="bg-transparent" />
          <span className="min-w-12 px-1 text-center text-xs text-white/80 tabular-nums">
            {neighbours.position}
          </span>
          <ControlButton icon={ChevronRight} label="Next scene" onClick={() => onNavigate(neighbours.next)} className="bg-transparent" />
        </div>
      )}

      <DragHint wrapperRef={wrapperRef} />
    </div>
  );
}
