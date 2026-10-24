"use client";

import { mediaUrl } from "@/lib/media-db";
import { cn } from "@/lib/utils";

/** A 2D scene: the image centred over a blurred, enlarged copy of itself. */
export function FlatScene({
  mediaKey,
  alt,
  className,
}: {
  mediaKey: string;
  alt: string;
  className?: string;
}) {
  const url = mediaUrl(mediaKey);

  return (
    <div className={cn("relative size-full overflow-hidden bg-[#0e0d0c]", className)}>
      {url && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- uploaded photo on the backend */}
          <img
            src={url}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-2xl"
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- uploaded photo on the backend */}
          <img
            src={url}
            alt={alt}
            className="absolute inset-0 m-auto max-h-full max-w-full object-contain shadow-[0_24px_64px_-16px_oklch(0_0_0/0.7)]"
          />
        </>
      )}
    </div>
  );
}
