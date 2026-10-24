"use client";

import { Check, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { MediaImage } from "@/components/media-image";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { HOTSPOT_STYLES, hotspotGlyphHtml } from "@/components/viewer/spot-markup";
import type { LinkHotspot, Tour } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { HotspotDraft } from "./hotspot-draft";
import { PanelHeader, Section, SliderField } from "./panel-fields";

export function HotspotPanel({
  tour,
  draft,
  onChange,
  onSave,
  onDelete,
  onClose,
}: {
  tour: Tour;
  draft: HotspotDraft;
  onChange: (draft: HotspotDraft) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const { hotspot } = draft;
  const source = tour.scenes[draft.sceneId];
  const destination = hotspot.targetSceneId ? tour.scenes[hotspot.targetSceneId] : undefined;
  const useDestinationTitle = hotspot.title === null;
  const returnExists = destination?.hotspots.some((h) => h.targetSceneId === draft.sceneId) ?? false;

  const candidates = tour.sceneOrder
    .map((id) => tour.scenes[id])
    .filter((s) => s && s.id !== draft.sceneId)
    .filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()));
  const otherScenes = tour.sceneOrder.length - 1;

  function patch(changes: Partial<LinkHotspot>) {
    onChange({ ...draft, hotspot: { ...hotspot, ...changes } });
  }

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title={draft.original ? "Edit hotspot" : "New hotspot"}
        subtitle={`In “${source?.name}”`}
        onClose={onClose}
        closeLabel="Close hotspot panel"
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section
          title="Destination"
          aside={
            !destination && <span className="text-xs text-primary">Choose a scene</span>
          }
        >
          <p className="text-sm text-muted-foreground">Click a scene to attach this hotspot to it.</p>
          {otherScenes > 3 && (
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search scenes by title"
                aria-label="Search scenes by title"
                className="h-8 pl-8 text-sm"
              />
            </div>
          )}
          {otherScenes === 0 ? (
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Add another scene first. A hotspot needs somewhere to go.
            </p>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scene matches “{query}”.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Destination scene">
              {candidates.map((scene) => {
                const selected = scene.id === hotspot.targetSceneId;
                return (
                  <button
                    key={scene.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => patch({ targetSceneId: scene.id })}
                    className={cn(
                      "group/dest relative overflow-hidden rounded-lg text-left ring-1 ring-foreground/10 outline-none transition-shadow",
                      "hover:ring-foreground/30 focus-visible:ring-2 focus-visible:ring-ring",
                      selected && "ring-2 ring-primary hover:ring-primary",
                    )}
                  >
                    <MediaImage mediaKey={scene.thumbKey} alt="" className="aspect-[2/1] w-full" />
                    <span className="block truncate px-2 py-1.5 text-xs font-medium">{scene.name}</span>
                    {selected && (
                      <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-start justify-between gap-3 pt-1">
            <Label htmlFor="hotspot-linkback" className="flex-col items-start gap-1">
              <span className="text-sm">Enable automatic linkback</span>
              <span className="text-xs font-normal text-muted-foreground">
                {returnExists && destination
                  ? `“${destination.name}” already links back here.`
                  : `Also adds a hotspot in ${destination ? `“${destination.name}”` : "the destination"} that leads back here.`}
              </span>
            </Label>
            <Switch
              id="hotspot-linkback"
              checked={draft.linkback && !returnExists}
              disabled={returnExists}
              onCheckedChange={(checked) => onChange({ ...draft, linkback: checked })}
            />
          </div>
        </Section>

        <Section title="Title">
          <div className="flex items-center gap-2">
            <Checkbox
              id="hotspot-use-destination-title"
              checked={useDestinationTitle}
              onCheckedChange={(checked) =>
                patch({ title: checked ? null : (destination?.name ?? "") })
              }
            />
            <Label htmlFor="hotspot-use-destination-title" className="text-sm font-normal">
              Use title of destination scene
            </Label>
          </div>
          <Input
            value={useDestinationTitle ? (destination?.name ?? "") : (hotspot.title ?? "")}
            placeholder={useDestinationTitle ? "Destination scene name" : "Hotspot title"}
            disabled={useDestinationTitle}
            maxLength={80}
            onChange={(e) => patch({ title: e.target.value })}
            aria-label="Hotspot title"
          />
        </Section>

        <Section title="Style">
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Hotspot style">
            {HOTSPOT_STYLES.map((style) => {
              const selected = hotspot.style === style.id;
              return (
                <button
                  key={style.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={style.label}
                  title={style.label}
                  onClick={() => patch({ style: style.id })}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-lg bg-[#0e0d0c] ring-1 ring-foreground/10 outline-none transition-shadow",
                    "hover:ring-foreground/30 focus-visible:ring-2 focus-visible:ring-ring",
                    selected && "ring-2 ring-primary hover:ring-primary",
                  )}
                >
                  <span
                    className={cn("hs-preview block size-9", `hs--${style.id}`)}
                    // Static, trusted markup shared with the viewer markers.
                    dangerouslySetInnerHTML={{ __html: hotspotGlyphHtml(style.id) }}
                  />
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="hotspot-apply-all"
              checked={draft.applyStyleToAll}
              onCheckedChange={(checked) => onChange({ ...draft, applyStyleToAll: checked === true })}
            />
            <Label htmlFor="hotspot-apply-all" className="text-sm font-normal">
              Apply to all existing hotspots
            </Label>
          </div>
        </Section>

        <Section title="Size and look">
          <SliderField label="Scale" value={hotspot.scale} min={0.5} max={2} step={0.05} onChange={(scale) => patch({ scale })} />
          <SliderField label="Opacity" value={hotspot.opacity} min={0} max={1} step={0.05} onChange={(opacity) => patch({ opacity })} />
          <SliderField
            label="Rotate hotspot"
            value={hotspot.rotation}
            min={0}
            max={359}
            step={1}
            suffix="°"
            onChange={(rotation) => patch({ rotation: Math.round(rotation) })}
          />
        </Section>
      </div>

      <footer className="flex items-center gap-2 border-t px-4 py-3">
        <Button variant="destructive" onClick={onDelete}>
          <Trash2 aria-hidden="true" />
          Delete
        </Button>
        <Button className="flex-1" onClick={onSave} disabled={!destination}>
          Save Hotspot
        </Button>
      </footer>
    </div>
  );
}
