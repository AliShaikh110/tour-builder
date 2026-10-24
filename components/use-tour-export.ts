"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { exportFileName, exportTour, TourFileError } from "@/lib/export";
import { formatBytes } from "@/lib/format";
import type { Tour } from "@/lib/types";

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before letting go of the data.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Exports a tour as a .zip download, with progress in a toast. */
export function useTourExport() {
  const [exporting, setExporting] = useState(false);
  const busy = useRef(false);

  async function start(tour: Tour) {
    if (busy.current) return;
    busy.current = true;
    setExporting(true);
    const message = `Exporting “${tour.title}”…`;
    const toastId = toast.loading(message);
    let shown = -1;
    try {
      const blob = await exportTour(tour, {
        onProgress: (percent) => {
          if (percent === shown) return;
          shown = percent;
          toast.loading(`${message} ${percent}%`, { id: toastId });
        },
      });
      const fileName = exportFileName(tour.title);
      downloadBlob(blob, fileName);
      toast.success("Tour exported", {
        id: toastId,
        description: `${fileName} (${formatBytes(blob.size)}). Import it from the dashboard in any browser.`,
      });
    } catch (error) {
      toast.error("Couldn't export the tour", {
        id: toastId,
        description:
          error instanceof TourFileError ? error.message : "Something went wrong while packing the photos. Try again.",
      });
    } finally {
      busy.current = false;
      setExporting(false);
    }
  }

  return { exporting, exportTour: start };
}
