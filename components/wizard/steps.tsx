"use client";

import {
  BedDouble,
  Briefcase,
  Building2,
  Caravan,
  Drone,
  GraduationCap,
  HardHat,
  House,
  ImageIcon,
  ImagePlus,
  Landmark,
  LoaderCircle,
  MapPinOff,
  Pencil,
  PencilRuler,
  Shapes,
  Store,
  Trees,
  User,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from "lucide-react";
import { nanoid } from "nanoid";
import { useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { AUDIENCE_LABELS, CATEGORIES, CATEGORY_LABELS } from "@/lib/constants";
import { formatBytes, plural } from "@/lib/format";
import { IMAGE_ACCEPT, isAcceptedImage, isEquirectangular, readImageSize } from "@/lib/image";
import type { TourCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RadioTiles, type TileOption } from "./radio-tiles";
import { STEPS, type WizardAction, type WizardPhoto, type WizardState } from "./wizard-state";

type Dispatch = (action: WizardAction) => void;

interface StepProps {
  state: WizardState;
  dispatch: Dispatch;
}

export const ERROR_ID = "create-tour-error";

function StepHeading({ title, hint }: { title: string; hint?: ReactNode }) {
  return (
    <div className="mb-6 space-y-1.5">
      <h2 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">{title}</h2>
      {hint && <p className="text-sm text-pretty text-muted-foreground">{hint}</p>}
    </div>
  );
}

function StepError({ error }: { error: string | null }) {
  return (
    <p id={ERROR_ID} role="alert" className="mt-3 min-h-5 text-sm text-destructive">
      {error}
    </p>
  );
}

// ---------------------------------------------------------------------------

export function TitleStep({ state, dispatch }: StepProps) {
  return (
    <>
      <StepHeading title="What's the name of your tour?" hint="You can rename it any time." />
      <Input
        data-autofocus
        value={state.title}
        onChange={(e) => dispatch({ type: "setTitle", title: e.target.value })}
        maxLength={120}
        placeholder="e.g. Riverside Campus Tour"
        aria-label="Tour title"
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? ERROR_ID : undefined}
        autoComplete="off"
        className="h-12 px-3 text-base sm:text-lg"
      />
      <StepError error={state.error} />
    </>
  );
}

export function AddressStep({ state, dispatch }: StepProps) {
  return (
    <>
      <StepHeading title="Where is it?" hint="Optional. Visitors see the address with the tour." />
      <Input
        data-autofocus
        value={state.address}
        onChange={(e) => dispatch({ type: "setAddress", address: e.target.value })}
        maxLength={200}
        placeholder="Street, city, country"
        aria-label="Tour address"
        autoComplete="street-address"
        className="h-12 px-3 text-base sm:text-lg"
      />
      <Button
        variant="ghost"
        className="mt-4 text-muted-foreground"
        onClick={() => {
          dispatch({ type: "setAddress", address: "" });
          dispatch({ type: "next" });
        }}
      >
        <MapPinOff aria-hidden="true" />
        This tour has no address
      </Button>
    </>
  );
}

const CATEGORY_ICONS: Record<TourCategory, LucideIcon> = {
  "real-estate": House,
  "drone-360": Drone,
  apartments: Building2,
  "auto-rv": Caravan,
  "arts-museums": Landmark,
  education: GraduationCap,
  "hotels-resorts": BedDouble,
  construction: HardHat,
  dining: UtensilsCrossed,
  retail: Store,
  "parks-rec": Trees,
  other: Shapes,
};

const CATEGORY_OPTIONS: TileOption<TourCategory>[] = CATEGORIES.map((c) => ({
  value: c.id,
  label: c.label,
  icon: CATEGORY_ICONS[c.id],
}));

export function CategoryStep({ state, dispatch }: StepProps) {
  return (
    <>
      <StepHeading title="What kind of tour is it?" hint="Pick one. Arrow keys work too." />
      <RadioTiles
        label="Tour category"
        options={CATEGORY_OPTIONS}
        value={state.category}
        onChange={(category) => dispatch({ type: "setCategory", category })}
        className="grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
        tileClassName="min-h-14"
      />
      <StepError error={state.error} />
    </>
  );
}

export function PhotosStep({ state, dispatch }: StepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const accepted: WizardPhoto[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(files)) {
      if (isAcceptedImage(file)) accepted.push({ id: nanoid(8), file, status: "reading" });
      else rejected.push(file.name);
    }
    if (rejected.length) {
      toast.error(`Skipped ${plural(rejected.length, "file")}`, {
        description: `Only JPG, PNG and WebP photos are supported: ${rejected.join(", ")}`,
      });
    }
    dispatch({ type: "addPhotos", photos: accepted });
    for (const photo of accepted) {
      readImageSize(photo.file).then(
        (size) => dispatch({ type: "updatePhoto", id: photo.id, patch: { status: "ready", ...size } }),
        () => dispatch({ type: "updatePhoto", id: photo.id, patch: { status: "error" } }),
      );
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    addFiles(event.target.files);
    event.target.value = "";
  }

  return (
    <>
      <StepHeading
        title="Add your photos"
        hint="360° panoramas (2:1 equirectangular) work best. JPG, PNG or WebP."
      />
      {/* The drop area takes initial focus (not "Browse files") so Enter continues the wizard. */}
      <div
        data-autofocus
        tabIndex={-1}
        aria-label="Photo drop area"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-foreground/20 px-4 py-8 text-center transition-colors duration-150 outline-none",
          dragging && "border-primary bg-primary/10",
        )}
      >
        <ImagePlus
          aria-hidden="true"
          className={cn("size-8 text-muted-foreground transition-colors", dragging && "text-primary")}
        />
        <p className="text-sm text-muted-foreground">
          {dragging ? "Drop to add" : "Drag photos here, or"}
        </p>
        <Button variant="outline" onClick={() => inputRef.current?.click()}>
          Browse files
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          hidden
          onChange={handleInput}
          aria-label="Choose photos"
        />
      </div>
      {state.photos.length > 0 && <PhotoList photos={state.photos} dispatch={dispatch} />}
    </>
  );
}

function PhotoBadge({ photo }: { photo: WizardPhoto }) {
  if (photo.status === "reading") {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <LoaderCircle className="animate-spin" aria-hidden="true" />
        Reading
      </Badge>
    );
  }
  if (photo.status === "error") return <Badge variant="destructive">Can&apos;t read</Badge>;
  return isEquirectangular(photo.width ?? 0, photo.height ?? 0) ? (
    <Badge className="bg-success/15 text-success">360°</Badge>
  ) : (
    <Badge className="bg-warning/15 text-warning" title="Not 2:1, so it will be added as a flat 2D scene">
      2D · not 2:1
    </Badge>
  );
}

function PhotoList({ photos, dispatch }: { photos: WizardPhoto[]; dispatch: Dispatch }) {
  const flat = photos.filter(
    (p) => p.status === "ready" && !isEquirectangular(p.width ?? 0, p.height ?? 0),
  ).length;
  return (
    <div className="mt-4">
      <ul className="max-h-48 space-y-1 overflow-y-auto pr-1" aria-label="Selected photos">
        {photos.map((photo) => (
          <li key={photo.id} className="flex items-center gap-3 rounded-lg bg-muted/50 py-1.5 pr-1.5 pl-3">
            <ImageIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{photo.file.name}</span>
              <span className="block text-xs text-muted-foreground tabular-nums">
                {photo.width ? `${photo.width} × ${photo.height} · ` : ""}
                {formatBytes(photo.file.size)}
              </span>
            </span>
            <PhotoBadge photo={photo} />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${photo.file.name}`}
              onClick={() => dispatch({ type: "removePhoto", id: photo.id })}
            >
              <X />
            </Button>
          </li>
        ))}
      </ul>
      {flat > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {flat === 1
            ? "1 photo isn't 2:1 and will be added as a flat 2D scene."
            : `${flat} photos aren't 2:1 and will be added as flat 2D scenes.`}
        </p>
      )}
    </div>
  );
}

const AUDIENCE_OPTIONS: TileOption<"me" | "client">[] = [
  { value: "me", label: "For me", description: "My own property, venue or business.", icon: User },
  {
    value: "client",
    label: "For a client",
    description: "I'm building it for someone else.",
    icon: Briefcase,
  },
];

export function AudienceStep({ state, dispatch }: StepProps) {
  return (
    <>
      <StepHeading title="Who is this tour for?" />
      <RadioTiles
        label="Tour audience"
        options={AUDIENCE_OPTIONS}
        value={state.audience}
        onChange={(audience) => dispatch({ type: "setAudience", audience })}
        onPick={(audience) => {
          dispatch({ type: "setAudience", audience });
          dispatch({ type: "next" });
        }}
        className="sm:grid-cols-2"
        tileClassName="items-start px-4 py-5 [&>svg]:mt-0.5"
      />
      <StepError error={state.error} />
    </>
  );
}

export function AddonsStep() {
  return (
    <>
      <StepHeading title="Add floor plans?" hint="Measured floor plans shown next to the tour." />
      <div
        aria-disabled="true"
        className="flex items-start gap-3 rounded-lg px-4 py-5 opacity-70 ring-1 ring-foreground/10"
      >
        <PencilRuler className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Floor plans</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Draw rooms and pin scenes on them. Not available yet.
          </p>
        </div>
        <Badge variant="outline">Coming soon</Badge>
      </div>
    </>
  );
}

export function ReviewStep({
  state,
  dispatch,
  progress,
}: StepProps & { progress: { done: number; total: number } | null }) {
  const ready = state.photos.filter((p) => p.status === "ready");
  const panoramas = ready.filter((p) => isEquirectangular(p.width ?? 0, p.height ?? 0)).length;
  const photosSummary = ready.length
    ? `${plural(ready.length, "photo")}${
        ready.length !== panoramas ? ` (${panoramas} × 360°, ${ready.length - panoramas} × 2D)` : ""
      }`
    : "None yet, add them in the editor";

  const rows: { step: (typeof STEPS)[number]["id"]; label: string; value: string }[] = [
    { step: "title", label: "Title", value: state.title.trim() || "Missing" },
    { step: "address", label: "Address", value: state.address.trim() || "No address" },
    {
      step: "category",
      label: "Category",
      value: state.category ? CATEGORY_LABELS[state.category] : "Missing",
    },
    { step: "photos", label: "Photos", value: photosSummary },
    {
      step: "audience",
      label: "Audience",
      value: state.audience ? AUDIENCE_LABELS[state.audience] : "Missing",
    },
    { step: "addons", label: "Add-ons", value: "None" },
  ];

  return (
    <>
      <StepHeading title="Ready to create your tour?" hint="It is saved as a draft, so everything stays editable." />
      <dl className="divide-y divide-border rounded-lg ring-1 ring-foreground/10">
        {rows.map((row) => (
          <div key={row.step} className="flex items-center gap-3 py-1.5 pr-1.5 pl-4">
            <dt className="w-20 shrink-0 text-xs text-muted-foreground sm:w-24">{row.label}</dt>
            <dd
              className={cn(
                "min-w-0 flex-1 truncate text-sm",
                row.value === "Missing" && "text-destructive",
              )}
            >
              {row.value}
            </dd>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${row.label.toLowerCase()}`}
              disabled={progress !== null}
              onClick={() => dispatch({ type: "goto", step: STEPS.findIndex((s) => s.id === row.step) })}
            >
              <Pencil />
            </Button>
          </div>
        ))}
      </dl>
      {progress && progress.total > 0 && (
        <div className="mt-5 space-y-2" aria-live="polite">
          <p className="text-sm text-muted-foreground tabular-nums">
            Saving photo {Math.min(progress.done + 1, progress.total)} of {progress.total}…
          </p>
          <Progress value={(progress.done / progress.total) * 100} aria-label="Saving photos" />
        </div>
      )}
    </>
  );
}
