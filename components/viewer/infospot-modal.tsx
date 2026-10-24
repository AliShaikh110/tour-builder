"use client";

import { ExternalLink, Link2Off } from "lucide-react";
import { MediaImage } from "@/components/media-image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { INFOSPOT_KINDS, infospotLabel, safeUrl } from "@/lib/infospots";
import type { Infospot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { splitVideoEmbeds } from "@/lib/embeds";
import { SandboxedHtml, VideoEmbed } from "./sandboxed-html";

function LinkBody({ spot }: { spot: Infospot }) {
  const href = safeUrl(spot.url);
  if (!href) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link2Off className="size-4" aria-hidden="true" />
        This link isn&apos;t a valid web address.
      </p>
    );
  }
  const newWindow = spot.newWindow ?? true;
  return (
    <div className="space-y-4">
      <p className="truncate text-sm text-muted-foreground" title={href}>
        {href}
      </p>
      <Button asChild className="w-full sm:w-auto">
        <a href={href} target={newWindow ? "_blank" : "_top"} rel="noopener noreferrer">
          Open link
          <ExternalLink aria-hidden="true" />
        </a>
      </Button>
    </div>
  );
}

/** The pop-up a visitor sees after clicking an infospot, laid out for its kind. */
export function InfospotModal({ spot, onClose }: { spot: Infospot | null; onClose: () => void }) {
  const kind = spot ? INFOSPOT_KINDS.find((k) => k.id === spot.kind)! : null;
  const title = spot ? (spot.kind === "long" ? spot.title?.trim() || "Details" : infospotLabel(spot)) : "";
  const wide = spot?.kind === "image" || spot?.kind === "html";

  return (
    <Dialog open={spot !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn("max-h-[calc(100dvh-2rem)] overflow-y-auto", wide ? "sm:max-w-2xl" : "sm:max-w-md")}>
        {spot && kind && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6 text-lg leading-snug">{title}</DialogTitle>
              <DialogDescription className="sr-only">{kind.label}</DialogDescription>
            </DialogHeader>
            {spot.kind === "link" && <LinkBody spot={spot} />}
            {spot.kind === "image" && (
              <figure className="space-y-2">
                <MediaImage
                  mediaKey={spot.imageKey}
                  alt={spot.caption || spot.previewText || "Infospot image"}
                  className="max-h-[65dvh] w-full rounded-lg object-contain"
                />
                {spot.caption && <figcaption className="text-sm text-muted-foreground">{spot.caption}</figcaption>}
              </figure>
            )}
            {spot.kind === "long" && spot.description && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-pretty">{spot.description}</p>
            )}
            {spot.kind === "html" && spot.html && (
              <div className="space-y-3">
                {splitVideoEmbeds(spot.html).map((part, index) =>
                  part.type === "video" ? (
                    <VideoEmbed key={index} src={part.src} title={part.title} />
                  ) : (
                    <SandboxedHtml key={index} html={part.html} title={title} />
                  ),
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
