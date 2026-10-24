"use client";

import { LoaderCircle, Music, Trash2 } from "lucide-react";
import { useId, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TourViewer } from "@/components/viewer/tour-viewer";
import { errorMessage } from "@/lib/api";
import { deleteMedia, mediaUrl, putMedia } from "@/lib/media-db";
import { useTourStore, type SettingsPatch } from "@/lib/store";
import type { AutoRotateSpeed, Tour } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_SOUND_BYTES = 15 * 1024 * 1024;

function SwitchRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
  nested,
  children,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  nested?: boolean;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <div className={cn("py-3", nested ? "ml-4 border-l pl-3" : "border-b last:border-b-0")}>
      <div className="flex items-start justify-between gap-3">
        <Label htmlFor={id} className={cn("flex-col items-start gap-1", disabled && "opacity-50")}>
          <span className="text-sm">{label}</span>
          {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
        </Label>
        <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
      </div>
      {children}
    </div>
  );
}

function AmbientSoundField({ tour, update }: { tour: Tour; update: (patch: SettingsPatch) => string | undefined }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const key = tour.settings.ambientSoundKey;
  const url = mediaUrl(key);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      toast.error("Choose an audio file (MP3, M4A, OGG or WAV).");
      return;
    }
    if (file.size > MAX_SOUND_BYTES) {
      toast.error("That sound is larger than 15 MB. Try a shorter or compressed file.");
      return;
    }
    setBusy(true);
    try {
      const previous = update({ ambientSoundKey: await putMedia(tour.id, file) });
      if (previous) void deleteMedia(tour.id, [previous]).catch(() => undefined);
      toast.success("Ambient sound added", { description: "It loops once visitors first tap or click." });
    } catch (error) {
      toast.error("Couldn't upload that sound", { description: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 border-b py-3">
      <p className="text-sm">Ambient sound</p>
      <p className="text-xs text-muted-foreground">Background audio that loops for the whole tour.</p>
      {url && <audio src={url} controls className="h-9 w-full" aria-label="Ambient sound preview" />}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Music aria-hidden="true" />}
          {key ? "Replace sound" : "Add a sound"}
        </Button>
        {key && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const previous = update({ ambientSoundKey: undefined });
              if (previous) void deleteMedia(tour.id, [previous]).catch(() => undefined);
            }}
          >
            <Trash2 aria-hidden="true" />
            Remove
          </Button>
        )}
      </div>
      <input ref={input} type="file" accept="audio/*" hidden onChange={handleFile} aria-label="Choose an ambient sound" />
    </div>
  );
}

/** Tour display and navigation settings, applied live in the preview above them. */
export function SettingsPanel({ tour, currentId }: { tour: Tour; currentId: string | null }) {
  const updateSettings = useTourStore((s) => s.updateSettings);
  const { settings } = tour;
  const update = (patch: SettingsPatch) => updateSettings(tour.id, patch)?.ambientSoundKey;
  const set = (patch: SettingsPatch) => void updateSettings(tour.id, patch);
  const resumeSeconds = Math.round(settings.autoRotate.resumeDelayMs / 1000);

  return (
    <div className="flex h-full flex-col">
      <header className="px-4 pt-4 pb-3">
        <h2 className="font-semibold tracking-tight">Settings</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Changes apply to the preview and the shared tour.</p>
      </header>

      <div className="mx-4 aspect-[16/10] shrink-0 overflow-hidden rounded-lg ring-1 ring-foreground/10">
        {tour.sceneOrder.length > 0 ? (
          <TourViewer tour={tour} mode="compact" startSceneId={currentId} />
        ) : (
          <div className="flex size-full items-center justify-center bg-muted/40 px-4 text-center text-xs text-muted-foreground">
            Add a scene to preview the settings.
          </div>
        )}
      </div>

      <Tabs defaultValue="general" className="mt-3 min-h-0 flex-1 gap-0">
        <TabsList className="mx-4 grid w-auto grid-cols-2">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="navigation">Navigation</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="min-h-0 overflow-y-auto px-4 pb-4">
          <SwitchRow
            label="Always show hotspot titles"
            hint="Otherwise titles appear on hover."
            checked={settings.showHotspotTitles}
            onChange={(showHotspotTitles) => set({ showHotspotTitles })}
          />
          <SwitchRow
            label="Thumbnail ribbon"
            hint="A strip of scenes along the bottom."
            checked={settings.ribbon.enabled}
            onChange={(enabled) => set({ ribbon: { enabled } })}
          >
            <SwitchRow
              nested
              label="Start minimised"
              checked={settings.ribbon.startMinimized}
              disabled={!settings.ribbon.enabled || settings.ribbon.lockOpen}
              onChange={(startMinimized) => set({ ribbon: { startMinimized } })}
            />
            <SwitchRow
              nested
              label="Prevent minimising"
              hint="Keeps the ribbon open."
              checked={settings.ribbon.lockOpen}
              disabled={!settings.ribbon.enabled}
              onChange={(lockOpen) => set({ ribbon: { lockOpen } })}
            />
          </SwitchRow>
          <SwitchRow
            label="Play a sound when a hotspot is clicked"
            checked={settings.hotspotClickSound}
            onChange={(hotspotClickSound) => set({ hotspotClickSound })}
          />
          <AmbientSoundField tour={tour} update={update} />
          <SwitchRow
            label="Start with a tiny planet"
            hint="The first scene opens as a little world, then flies in."
            checked={settings.tinyPlanetIntro}
            onChange={(tinyPlanetIntro) => set({ tinyPlanetIntro })}
          />
          <SwitchRow
            label="Disable zoom when embedded"
            hint="Lets the page around an embedded tour scroll."
            checked={settings.disableZoomInEmbed}
            onChange={(disableZoomInEmbed) => set({ disableZoomInEmbed })}
          />
        </TabsContent>

        <TabsContent value="navigation" className="min-h-0 overflow-y-auto px-4 pb-4">
          <SwitchRow
            label="Auto-rotate"
            hint="Turns slowly until the visitor interacts."
            checked={settings.autoRotate.enabled}
            onChange={(enabled) => set({ autoRotate: { enabled } })}
          >
            {settings.autoRotate.enabled && (
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Speed</span>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    spacing={0}
                    value={settings.autoRotate.speed}
                    onValueChange={(speed) => speed && set({ autoRotate: { speed: speed as AutoRotateSpeed } })}
                    aria-label="Auto-rotate speed"
                  >
                    <ToggleGroupItem value="low">Low</ToggleGroupItem>
                    <ToggleGroupItem value="med">Med</ToggleGroupItem>
                    <ToggleGroupItem value="high">High</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Resume after</span>
                    <span className="tabular-nums">{resumeSeconds} s</span>
                  </div>
                  <Slider
                    value={[resumeSeconds]}
                    min={1}
                    max={30}
                    step={1}
                    onValueChange={([s]) => set({ autoRotate: { resumeDelayMs: s * 1000 } })}
                    aria-label="Seconds before auto-rotate resumes"
                  />
                </div>
              </div>
            )}
          </SwitchRow>
          <SwitchRow
            label="Show compass"
            hint="Uses each scene's north point (scene menu › Set north here)."
            checked={settings.showCompass}
            onChange={(showCompass) => set({ showCompass })}
          />
          <SwitchRow
            label="Lock horizontal view"
            hint="Visitors can look around but not up or down."
            checked={settings.lockHorizontal}
            onChange={(lockHorizontal) => set({ lockHorizontal })}
          />
          <SwitchRow
            label="Always open scenes at their initial view"
            hint="Hotspots open a scene at its initial view; scenes without one keep the visitor facing the same way. Off: hotspots always keep the visitor's heading. A “coming from” view wins either way."
            checked={settings.enforceInitialViews}
            onChange={(enforceInitialViews) => set({ enforceInitialViews })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
