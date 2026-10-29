"use client";

import { ImageOff } from "lucide-react";
import { useState } from "react";
import { mediaUrl } from "@/lib/media-db";
import { cn } from "@/lib/utils";

/**
 * An uploaded photo, given by its media key or its address (`src`), with a
 * quiet placeholder while it loads.
 */
export function MediaImage({
  mediaKey,
  src,
  alt,
  className,
}: {
  mediaKey?: string | null;
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const url = src ?? mediaUrl(mediaKey);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);

  if (!url) {
    return (
      <span className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}>
        <ImageOff className="size-6 opacity-60" aria-hidden="true" />
        <span className="sr-only">{alt}</span>
      </span>
    );
  }

  return (
    // Photos come from the backend's storage, not through next/image optimisation.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      draggable={false}
      onLoad={() => setLoadedUrl(url)}
      className={cn("object-cover", loadedUrl !== url && "animate-pulse bg-muted", className)}
    />
  );
}
