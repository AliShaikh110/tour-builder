"use client";

import { Eye, PencilLine, Share2 } from "lucide-react";
import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSaveStatus } from "@/lib/autosave";
import { useTourStore } from "@/lib/store";
import type { Tour } from "@/lib/types";
import { cn } from "@/lib/utils";

export type EditorMode = "edit" | "view";

/** Whether the latest changes have reached the server. */
function SaveStatus({ tourId }: { tourId: string }) {
  const status = useSaveStatus((s) => s[tourId]);
  if (!status) return null;
  return (
    <span
      role="status"
      className={cn("hidden px-2 text-xs md:inline", status === "error" ? "text-destructive" : "text-muted-foreground")}
    >
      {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Not saved"}
    </span>
  );
}

/** The tour title as text that turns into an input on focus. Enter saves, Escape reverts. */
function InlineTitle({ tour }: { tour: Tour }) {
  const updateTour = useTourStore((s) => s.updateTour);
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    const title = draft?.trim();
    if (title && title !== tour.title) updateTour(tour.id, { title });
    setDraft(null);
  }

  return (
    <input
      value={draft ?? tour.title}
      onFocus={() => setDraft(tour.title)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(null);
          // Blur after the reset so commit() sees no draft.
          requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
        }
      }}
      maxLength={120}
      aria-label="Tour title"
      spellCheck={false}
      className="h-8 w-full min-w-0 truncate rounded-md bg-transparent px-2 text-center text-sm font-medium outline-none hover:bg-accent/60 focus:bg-input/30 focus:text-left focus:ring-2 focus:ring-ring sm:text-base"
    />
  );
}

export function TopBar({
  tour,
  mode,
  onModeChange,
  onShare,
  onPreview,
  onHome,
}: {
  tour: Tour;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  onShare: () => void;
  onPreview: () => void;
  /** Lets the editor stop the navigation (e.g. to ask about unsaved changes). */
  onHome?: (event: MouseEvent) => void;
}) {
  return (
    <header className="grid h-12 shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2 border-b bg-background px-2 sm:gap-4">
      <div className="flex items-center gap-1 sm:gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/" aria-label="Back to your tours" onClick={onHome}>
            <LogoMark className="size-6" />
          </Link>
        </Button>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          value={mode}
          onValueChange={(value) => value && onModeChange(value as EditorMode)}
          aria-label="Editor mode"
        >
          <ToggleGroupItem value="edit" aria-label="Editing" className="data-[state=on]:bg-primary/15 data-[state=on]:text-primary">
            <PencilLine aria-hidden="true" />
            <span className="hidden sm:inline">Editing</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="view" aria-label="Viewing" className="data-[state=on]:bg-primary/15 data-[state=on]:text-primary">
            <Eye aria-hidden="true" />
            <span className="hidden sm:inline">Viewing</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="mx-auto w-full max-w-md min-w-0">
        <InlineTitle tour={tour} />
      </div>

      <div className="flex items-center gap-1">
        <SaveStatus tourId={tour.id} />
        <Button variant="ghost" onClick={onPreview} className="hidden sm:inline-flex">
          <Eye aria-hidden="true" />
          Preview
        </Button>
        <Button variant="outline" onClick={onShare} aria-label="Share">
          <Share2 aria-hidden="true" />
          <span className="hidden sm:inline">Share</span>
        </Button>
      </div>
    </header>
  );
}
