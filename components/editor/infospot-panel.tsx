"use client";

import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { MediaImage } from "@/components/media-image";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { infospotGlyphHtml } from "@/components/viewer/spot-markup";
import { errorMessage } from "@/lib/api";
import { IMAGE_ACCEPT, importInfospotImage, isAcceptedImage } from "@/lib/image";
import { INFOSPOT_ICONS, INFOSPOT_KINDS, infospotProblem } from "@/lib/infospots";
import type { Infospot, InfospotKind, Tour } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { InfospotDraft } from "./infospot-draft";
import { PanelHeader, Section, SliderField } from "./panel-fields";

function Field({ id, label, children, hint }: { id: string; label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-normal">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PreviewText({ spot, onChange, hint }: { spot: Infospot; onChange: (text: string) => void; hint?: string }) {
  return (
    <Field id={`ip-preview-${spot.kind}`} label="Preview text" hint={hint ?? "Shown when visitors hover over the pin."}>
      <Input
        id={`ip-preview-${spot.kind}`}
        value={spot.previewText}
        maxLength={120}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

function ImageField({
  tourId,
  spot,
  onUploaded,
}: {
  tourId: string;
  spot: Infospot;
  onUploaded: (key: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!isAcceptedImage(file)) {
      toast.error("Only JPG, PNG and WebP images are supported.");
      return;
    }
    setBusy(true);
    try {
      onUploaded(await importInfospotImage(tourId, file));
    } catch (error) {
      toast.error(`Couldn't upload ${file.name}`, { description: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-normal">Image</Label>
      {spot.imageKey && (
        <MediaImage mediaKey={spot.imageKey} alt="Infospot image" className="aspect-video w-full rounded-lg object-contain bg-black/30" />
      )}
      <Button variant="outline" className="w-full" onClick={() => input.current?.click()} disabled={busy}>
        {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <ImagePlus aria-hidden="true" />}
        {spot.imageKey ? "Replace image" : "Upload custom image"}
      </Button>
      <input ref={input} type="file" accept={IMAGE_ACCEPT} hidden onChange={handleFile} aria-label="Choose an image" />
    </div>
  );
}

export function InfospotPanel({
  tour,
  draft,
  onChange,
  onSave,
  onDelete,
  onClose,
}: {
  tour: Tour;
  draft: InfospotDraft;
  onChange: (draft: InfospotDraft) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { spot } = draft;
  const source = tour.scenes[draft.sceneId];
  const problem = infospotProblem(spot);

  function patch(changes: Partial<Infospot>) {
    onChange({ ...draft, spot: { ...spot, ...changes } });
  }

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title={draft.original ? "Edit infospot" : "New infospot"}
        subtitle={`In “${source?.name}”`}
        onClose={onClose}
        closeLabel="Close infospot panel"
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section title="Icon">
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Infospot icon">
            {INFOSPOT_ICONS.map((icon) => {
              const selected = spot.icon === icon.id;
              return (
                <button
                  key={icon.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={icon.label}
                  title={icon.label}
                  onClick={() => patch({ icon: icon.id })}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-lg bg-[#0e0d0c] ring-1 ring-foreground/10 outline-none transition-shadow",
                    "hover:ring-foreground/30 focus-visible:ring-2 focus-visible:ring-ring",
                    selected && "ring-2 ring-primary hover:ring-primary",
                  )}
                >
                  {/* The .ip pin fills its parent, so the wrapper sets the size. */}
                  <span className="block size-8">
                    <span
                      className="ip"
                      // Static, trusted markup shared with the viewer markers.
                      dangerouslySetInnerHTML={{ __html: infospotGlyphHtml(icon.id) }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Size and look">
          <SliderField label="Scale" value={spot.scale} min={0.5} max={2} step={0.05} onChange={(scale) => patch({ scale })} />
          <SliderField label="Opacity" value={spot.opacity} min={0} max={1} step={0.05} onChange={(opacity) => patch({ opacity })} />
        </Section>

        <Section title="Type">
          <Accordion
            type="single"
            value={spot.kind}
            onValueChange={(kind) => kind && patch({ kind: kind as InfospotKind })}
            className="-mx-1 rounded-lg ring-1 ring-foreground/10"
          >
            {INFOSPOT_KINDS.map((kind) => (
              <AccordionItem key={kind.id} value={kind.id} className="px-3">
                <AccordionTrigger className="py-3 hover:no-underline">
                  <span className="flex flex-col items-start gap-0.5 text-left">
                    <span className={cn("text-sm", spot.kind === kind.id && "text-primary")}>{kind.label}</span>
                    <span className="text-xs font-normal text-muted-foreground">{kind.description}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4">
                  {kind.id === "link" && (
                    <>
                      <PreviewText spot={spot} onChange={(previewText) => patch({ previewText })} />
                      <Field id="ip-url" label="Hyperlink URL">
                        <Input
                          id="ip-url"
                          type="url"
                          inputMode="url"
                          placeholder="https://example.com"
                          value={spot.url ?? ""}
                          onChange={(e) => patch({ url: e.target.value })}
                        />
                      </Field>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="ip-new-window"
                          checked={spot.newWindow ?? true}
                          onCheckedChange={(checked) => patch({ newWindow: checked === true })}
                        />
                        <Label htmlFor="ip-new-window" className="text-sm font-normal">
                          Open link in a new window
                        </Label>
                      </div>
                    </>
                  )}
                  {kind.id === "short" && (
                    <PreviewText
                      spot={spot}
                      onChange={(previewText) => patch({ previewText })}
                      hint="Shown on hover and when the pin is clicked."
                    />
                  )}
                  {kind.id === "image" && (
                    <>
                      <PreviewText spot={spot} onChange={(previewText) => patch({ previewText })} />
                      <ImageField
                        tourId={tour.id}
                        spot={spot}
                        onUploaded={(imageKey) =>
                          onChange({ ...draft, spot: { ...spot, imageKey }, uploads: [...draft.uploads, imageKey] })
                        }
                      />
                      <Field id="ip-caption" label="Caption">
                        <Input
                          id="ip-caption"
                          value={spot.caption ?? ""}
                          maxLength={200}
                          onChange={(e) => patch({ caption: e.target.value })}
                        />
                      </Field>
                    </>
                  )}
                  {kind.id === "long" && (
                    <>
                      <Field id="ip-title" label="Title">
                        <Input
                          id="ip-title"
                          value={spot.title ?? ""}
                          maxLength={120}
                          onChange={(e) => patch({ title: e.target.value })}
                        />
                      </Field>
                      <Field id="ip-description" label="Description">
                        <Textarea
                          id="ip-description"
                          rows={6}
                          value={spot.description ?? ""}
                          onChange={(e) => patch({ description: e.target.value })}
                        />
                      </Field>
                    </>
                  )}
                  {kind.id === "html" && (
                    <>
                      <PreviewText spot={spot} onChange={(previewText) => patch({ previewText })} />
                      <Field
                        id="ip-html"
                        label="HTML"
                        hint="Runs in a locked-down frame. To show a YouTube video, paste its Share › Embed code."
                      >
                        <Textarea
                          id="ip-html"
                          rows={7}
                          spellCheck={false}
                          placeholder={'<iframe src="https://www.youtube.com/embed/…"></iframe>'}
                          value={spot.html ?? ""}
                          onChange={(e) => patch({ html: e.target.value })}
                          className="font-mono text-xs"
                        />
                      </Field>
                    </>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Section>
      </div>

      <footer className="space-y-2 border-t px-4 py-3">
        {problem && <p className="text-xs text-muted-foreground">To save, add {problem}.</p>}
        <div className="flex items-center gap-2">
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 aria-hidden="true" />
            Delete
          </Button>
          <Button className="flex-1" onClick={onSave} disabled={problem !== null}>
            Save Infospot
          </Button>
        </div>
      </footer>
    </div>
  );
}
