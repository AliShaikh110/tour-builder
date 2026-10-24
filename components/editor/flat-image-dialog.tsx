"use client";

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
import type { FlatImageQuestion } from "./use-scene-upload";

const SHOWN = 4;

/** Warns that images aren't 2:1 and offers to add them as 2D scenes. */
export function FlatImageDialog({ question }: { question: FlatImageQuestion | null }) {
  const files = question?.files ?? [];
  const single = files.length === 1;

  return (
    <AlertDialog open={question !== null} onOpenChange={(open) => !open && question?.answer(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {single
              ? `“${files[0].file.name}” isn't a 360° photo`
              : `${files.length} photos aren't 360° photos`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            A 360° panorama is exactly twice as wide as it is tall (2:1).{" "}
            {single ? "This one can" : "These can"} still be added as flat 2D{" "}
            {single ? "scene" : "scenes"}, shown centred over a blurred background.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="space-y-1 text-sm">
          {files.slice(0, SHOWN).map((f) => (
            <li key={f.file.name + f.file.size} className="flex justify-between gap-3 rounded-md bg-muted/50 px-3 py-1.5">
              <span className="truncate">{f.file.name}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {f.width} × {f.height}
              </span>
            </li>
          ))}
          {files.length > SHOWN && (
            <li className="px-3 text-xs text-muted-foreground">and {files.length - SHOWN} more</li>
          )}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => question?.answer(false)}>
            {question?.mode === "swap" ? "Cancel" : single ? "Skip it" : "Skip them"}
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => question?.answer(true)}>
            {single ? "Use as 2D scene" : "Use as 2D scenes"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
