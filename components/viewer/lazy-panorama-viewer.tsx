"use client";

import dynamic from "next/dynamic";

/** Photo Sphere Viewer needs `window`, so it is only ever loaded in the browser. */
export const LazyPanoramaViewer = dynamic(() => import("./panorama-viewer"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-muted/40" aria-hidden="true" />,
});
