"use client";

import { Download, ExternalLink, Globe, LoaderCircle } from "lucide-react";
import { useId, useState, type FocusEvent, type ReactNode } from "react";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useTourExport } from "@/components/use-tour-export";
import { embedCode, tourLink } from "@/lib/share";
import { useTourStore } from "@/lib/store";
import type { Tour } from "@/lib/types";

function selectAll(event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  event.currentTarget.select();
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h3 id={id} className="text-sm font-medium">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function SharePanel({ tour, currentId }: { tour: Tour; currentId: string | null }) {
  const [origin] = useState(() => window.location.origin);
  const [atScene, setAtScene] = useState(false);
  const sceneCheckId = useId();
  const publishId = useId();
  const updateTour = useTourStore((s) => s.updateTour);
  const { exporting, exportTour } = useTourExport();
  const published = tour.status === "published";

  const currentScene = currentId ? tour.scenes[currentId] : undefined;
  const link = tourLink(origin, tour.id, atScene ? currentScene?.id : null);
  const code = embedCode(origin, tour);

  return (
    <div className="flex h-full flex-col">
      <header className="px-4 pt-4 pb-3">
        <h2 className="font-semibold tracking-tight">Share</h2>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-4">
        <div className="flex gap-3 rounded-lg bg-primary/8 p-3 ring-1 ring-primary/20">
          <Globe className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1 text-xs">
            <Label htmlFor={publishId} className="text-sm font-medium">
              Published
            </Label>
            <p className="mt-1 text-pretty text-muted-foreground">
              {published
                ? "Anyone with the link or the embed can view this tour."
                : "Draft: only you can open the link. Publish to let visitors see the tour."}
            </p>
          </div>
          <Switch
            id={publishId}
            checked={published}
            onCheckedChange={(checked) => updateTour(tour.id, { status: checked ? "published" : "draft" })}
          />
        </div>

        <Section title="Link">
          <div className="flex gap-2">
            <Input readOnly value={link} onFocus={selectAll} aria-label="Tour link" className="font-mono text-xs md:text-xs" />
            <CopyButton text={link} label="link" />
          </div>
          {currentScene && (
            <div className="flex items-center gap-2">
              <Checkbox id={sceneCheckId} checked={atScene} onCheckedChange={(checked) => setAtScene(checked === true)} />
              <Label htmlFor={sceneCheckId} className="min-w-0 text-xs font-normal text-muted-foreground">
                <span className="truncate">Start at “{currentScene.name}”</span>
              </Label>
            </div>
          )}
          <Button asChild variant="link" size="sm" className="h-auto px-0">
            <a href={link} target="_blank" rel="noopener">
              Open the viewer
              <ExternalLink data-icon="inline-end" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </Button>
        </Section>

        <Section title="Embed on a website">
          <Textarea
            readOnly
            value={code}
            onFocus={selectAll}
            aria-label="Embed code"
            className="resize-none font-mono text-xs break-all md:text-xs"
          />
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-pretty text-muted-foreground">
              {tour.settings.disableZoomInEmbed
                ? "Scroll-wheel zoom is off in the embed, so the page around it keeps scrolling."
                : "Scroll-wheel zoom is on in the embed. Turn it off in Settings if the page needs to scroll past the tour."}
            </p>
            <CopyButton text={code} label="embed code" className="shrink-0" />
          </div>
        </Section>

        <Section title="Export">
          <p className="text-xs text-pretty text-muted-foreground">
            Download the tour with all its photos and sounds as one .zip file. Import it from the dashboard to make
            a copy, in this account or another one.
          </p>
          <Button variant="secondary" onClick={() => void exportTour(tour)} disabled={exporting}>
            {exporting ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Download aria-hidden="true" />
            )}
            {exporting ? "Exporting…" : "Export as .zip"}
          </Button>
        </Section>
      </div>
    </div>
  );
}
