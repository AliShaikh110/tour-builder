"use client";

import { Download, EllipsisVertical, Eye, PencilLine, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { MediaImage } from "@/components/media-image";
import { useTourExport } from "@/components/use-tour-export";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatEditedAt, plural } from "@/lib/format";
import { deleteMedia } from "@/lib/media-db";
import { coverScene, tourMediaKeys, useTourStore } from "@/lib/store";
import type { Tour } from "@/lib/types";

export function TourCard({ tour }: { tour: Tour }) {
  const deleteTour = useTourStore((s) => s.deleteTour);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { exporting, exportTour } = useTourExport();
  const cover = coverScene(tour);
  const sceneCount = tour.sceneOrder.length;
  const editHref = `/tours/${tour.id}/edit`;

  function handleDelete() {
    const removed = deleteTour(tour.id);
    if (!removed) return;
    deleteMedia(tourMediaKeys(removed)).catch(() => undefined);
    toast.success(`Deleted “${removed.title}”`);
  }

  return (
    <li className="group/card relative flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-[box-shadow,transform] duration-200 ease-out focus-within:ring-2 focus-within:ring-ring hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-12px_oklch(0_0_0/0.6)] hover:ring-foreground/20 motion-reduce:hover:translate-y-0">
      <div className="relative aspect-video overflow-hidden bg-muted">
        <MediaImage
          mediaKey={cover?.thumbKey}
          alt=""
          className="size-full transition-transform duration-500 ease-out group-hover/card:scale-[1.03] motion-reduce:group-hover/card:scale-100"
        />
        {tour.status === "draft" && (
          <Badge className="absolute top-3 left-3 bg-background/85 text-foreground backdrop-blur-sm">
            Draft
          </Badge>
        )}
      </div>
      <div className="flex items-start gap-2 py-3 pr-2 pl-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-medium">
            {/* The link's ::after covers the whole card so it is one click target. */}
            <Link href={editHref} className="outline-none after:absolute after:inset-0 after:content-['']">
              {tour.title}
            </Link>
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {sceneCount ? plural(sceneCount, "scene") : "No scenes yet"} ·{" "}
            <time dateTime={new Date(tour.updatedAt).toISOString()}>
              {formatEditedAt(tour.updatedAt)}
            </time>
          </p>
        </div>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="relative z-10" aria-label={`Options for ${tour.title}`}>
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={editHref}>
                <PencilLine />
                Open editor
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild disabled={sceneCount === 0}>
              <Link href={`/tours/${tour.id}`}>
                <Eye />
                Open viewer
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={exporting} onSelect={() => void exportTour(tour)}>
              <Download />
              Export as .zip
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
              <Trash2 />
              Delete tour
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{tour.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The tour and its {plural(sceneCount, "photo")} are removed from this browser. This
              can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep tour</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete tour
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
