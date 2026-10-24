"use client";

import { ImageOff } from "lucide-react";
import { useMediaUrl } from "@/lib/media-db";
import { cn } from "@/lib/utils";

/** An image stored in IndexedDB, with a quiet placeholder while it loads. */
export function MediaImage({
  mediaKey,
  alt,
  className,
}: {
  mediaKey: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const url = useMediaUrl(mediaKey);

  if (!mediaKey) {
    return (
      <span className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}>
        <ImageOff className="size-6 opacity-60" aria-hidden="true" />
        <span className="sr-only">{alt}</span>
      </span>
    );
  }

  if (!url) {
    return <span className={cn("block animate-pulse bg-muted", className)} aria-label={alt} role="img" />;
  }

  return (
    // Blob URLs from IndexedDB can't go through next/image optimisation.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} draggable={false} className={cn("object-cover", className)} />
  );
}
