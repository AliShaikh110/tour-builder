"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { MediaImage } from "@/components/media-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { plural } from "@/lib/format";
import { useTourStore } from "@/lib/store";
import type { Tour } from "@/lib/types";

function RenameForm({ tour, onDone }: { tour: Tour; onDone: () => void }) {
  const renameScenes = useTourStore((s) => s.renameScenes);
  const scenes = tour.sceneOrder.map((id) => tour.scenes[id]).filter(Boolean);
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(scenes.map((s) => [s.id, s.name])),
  );
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const changed = scenes.filter((s) => {
    const name = names[s.id]?.trim();
    return name && name !== s.name;
  }).length;

  function save() {
    renameScenes(tour.id, names);
    if (changed) toast.success(`Renamed ${plural(changed, "scene")}`);
    onDone();
  }

  // Enter moves down the list; on the last name it saves.
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    const next = inputs.current[index + 1];
    if (next) next.select();
    else save();
  }

  return (
    <>
      <ol className="-mx-1 max-h-[55dvh] space-y-1.5 overflow-y-auto px-1 py-0.5">
        {scenes.map((scene, index) => (
          <li key={scene.id} className="flex items-center gap-3">
            <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
              {index + 1}
            </span>
            <MediaImage mediaKey={scene.thumbKey} alt="" className="aspect-[2/1] w-16 shrink-0 rounded" />
            <Input
              ref={(el) => {
                inputs.current[index] = el;
              }}
              value={names[scene.id] ?? ""}
              onChange={(e) => setNames((n) => ({ ...n, [scene.id]: e.target.value }))}
              onKeyDown={(e) => handleKeyDown(e, index)}
              placeholder={scene.name}
              maxLength={80}
              aria-label={`Name of scene ${index + 1}`}
              autoFocus={index === 0}
            />
          </li>
        ))}
      </ol>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={save}>{changed ? `Save ${plural(changed, "name")}` : "Done"}</Button>
      </DialogFooter>
    </>
  );
}

/** Every scene name in one list, editable in one go. */
export function FastRenameDialog({
  tour,
  open,
  onOpenChange,
}: {
  tour: Tour;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fast rename</DialogTitle>
          <DialogDescription>Press Enter to jump to the next scene. Blank names are kept as they were.</DialogDescription>
        </DialogHeader>
        {open && <RenameForm tour={tour} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
