"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { TourViewer } from "@/components/viewer/tour-viewer";
import type { Tour } from "@/lib/types";

/** The tour as visitors will see it, full screen over the editor. Escape closes it. */
export function PreviewOverlay({
  tour,
  startSceneId,
  open,
  onClose,
}: {
  tour: Tour;
  startSceneId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        // Focus the overlay itself: the viewer's controls render later and change,
        // and focus left on a replaced element would fall out of the dialog.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
        className="top-0 left-0 z-50 block h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none bg-[#0e0d0c] p-0 ring-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">Preview of {tour.title}</DialogTitle>
        <DialogDescription className="sr-only">The tour as visitors see it. Press Escape to close.</DialogDescription>
        {open && <TourViewer tour={tour} mode="preview" startSceneId={startSceneId} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
