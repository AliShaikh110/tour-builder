"use client";

import { ArrowRight, Check, ChevronDown, ChevronUp, CornerDownLeft, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api";
import { plural } from "@/lib/format";
import { baseName, importImage } from "@/lib/image";
import { useTourStore } from "@/lib/store";
import { createTour } from "@/lib/tours-api";
import { cn } from "@/lib/utils";
import { StepProgress } from "./step-progress";
import {
  AddonsStep,
  AddressStep,
  AudienceStep,
  CategoryStep,
  PhotosStep,
  ReviewStep,
  TitleStep,
} from "./steps";
import {
  LAST_STEP,
  STEPS,
  firstInvalidStep,
  initialWizardState,
  stepError,
  wizardReducer,
} from "./wizard-state";

/** Mounts with each step: focuses the step's main control and slides in. */
function StepBody({ direction, children }: { direction: 1 | -1; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
  }, []);
  return (
    <div
      ref={ref}
      className={cn(
        "animate-in duration-300 ease-out fade-in motion-reduce:animate-none",
        direction === 1 ? "slide-in-from-bottom-3" : "slide-in-from-top-3",
      )}
    >
      {children}
    </div>
  );
}

export function CreateTourWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const router = useRouter();
  const addScenes = useTourStore((s) => s.addScenes);

  const creating = progress !== null;
  const stepId = STEPS[state.step].id;
  const readingPhotos = state.photos.some((p) => p.status === "reading");

  async function handleCreate() {
    if (creating || readingPhotos) return;
    const invalid = firstInvalidStep(state);
    if (invalid !== -1 || !state.category || !state.audience) {
      dispatch({ type: "goto", step: Math.max(invalid, 0) });
      toast.error(stepError(invalid, state) ?? "Some answers are missing.");
      return;
    }

    const title = state.title.trim();
    const photos = state.photos.filter((p) => p.status === "ready");
    setProgress({ done: 0, total: photos.length });
    let tourId: string;
    try {
      tourId = (
        await createTour({
          title: title || "Untitled tour",
          category: state.category,
          address: state.address.trim() || undefined,
          audience: state.audience,
        })
      ).id;
    } catch (error) {
      setProgress(null);
      toast.error("Couldn't create the tour", { description: errorMessage(error) });
      return;
    }

    let skipped = state.photos.length - photos.length;
    for (const [index, photo] of photos.entries()) {
      try {
        const size =
          photo.width && photo.height ? { width: photo.width, height: photo.height } : undefined;
        const image = await importImage(tourId, photo.file, { size });
        addScenes(tourId, [{ name: baseName(photo.file.name), ...image }]);
      } catch {
        skipped += 1;
      }
      setProgress({ done: index + 1, total: photos.length });
    }

    setProgress(null);
    dispatch({ type: "reset" });
    onOpenChange(false);
    toast.success(`Created “${title}”`, {
      description: skipped
        ? `${plural(skipped, "photo")} couldn't be uploaded and ${skipped === 1 ? "was" : "were"} skipped.`
        : undefined,
    });
    router.push(`/tours/${tourId}/edit`);
  }

  function primaryAction() {
    if (stepId === "review") void handleCreate();
    else dispatch({ type: "next" });
  }

  // Enter moves forward from anywhere except buttons, links and text areas,
  // which keep their native Enter behaviour. Choice tiles opt back in.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || creating) return;
    const target = event.target as HTMLElement;
    if (target instanceof HTMLTextAreaElement) return;
    if (target.closest("button, a, [role='button']") && !target.closest("[data-enter-advances]")) {
      return;
    }
    event.preventDefault();
    primaryAction();
  }

  const primaryLabel: Record<typeof stepId, string> = {
    title: "OK",
    address: "OK",
    category: "OK",
    photos: state.photos.length ? "Continue" : "Skip, add media later",
    audience: "OK",
    addons: "No thanks",
    review: "Create tour",
  };

  let body: ReactNode;
  switch (stepId) {
    case "title":
      body = <TitleStep state={state} dispatch={dispatch} />;
      break;
    case "address":
      body = <AddressStep state={state} dispatch={dispatch} />;
      break;
    case "category":
      body = <CategoryStep state={state} dispatch={dispatch} />;
      break;
    case "photos":
      body = <PhotosStep state={state} dispatch={dispatch} />;
      break;
    case "audience":
      body = <AudienceStep state={state} dispatch={dispatch} />;
      break;
    case "addons":
      body = <AddonsStep />;
      break;
    case "review":
      body = <ReviewStep state={state} dispatch={dispatch} progress={progress} />;
      break;
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !creating && onOpenChange(next)}>
      <DialogContent
        showCloseButton={!creating}
        onKeyDown={handleKeyDown}
        onInteractOutside={(e) => creating && e.preventDefault()}
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <div className="border-b px-5 pt-4 pb-2 sm:px-8">
          <div className="flex items-baseline justify-between gap-3 pr-8">
            <DialogTitle>New virtual tour</DialogTitle>
            <span className="text-xs text-muted-foreground tabular-nums sm:hidden">
              {state.step + 1}/{STEPS.length} · {STEPS[state.step].label}
            </span>
          </div>
          <DialogDescription className="sr-only">
            Answer seven short questions to set up your tour. Press Enter to continue.
          </DialogDescription>
          <StepProgress
            state={state}
            disabled={creating}
            onSelect={(step) => dispatch({ type: "goto", step })}
          />
        </div>

        <div className="min-h-80 flex-1 overflow-y-auto px-5 py-6 sm:min-h-96 sm:px-8 sm:py-8">
          <StepBody key={state.step} direction={state.direction}>
            {body}
          </StepBody>
        </div>

        <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-5 py-3 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              size="lg"
              onClick={primaryAction}
              disabled={creating || (stepId === "review" && readingPhotos)}
              className="px-4"
            >
              {creating ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : stepId === "review" ? null : (
                <Check aria-hidden="true" />
              )}
              {creating ? "Creating…" : stepId === "review" && readingPhotos ? "Reading photos…" : primaryLabel[stepId]}
              {stepId === "review" && !creating && !readingPhotos && <ArrowRight aria-hidden="true" />}
            </Button>
            <span className="hidden items-center gap-1 text-xs text-muted-foreground md:flex">
              press
              <kbd className="inline-flex h-5 items-center gap-1 rounded border border-border bg-background px-1.5 font-sans text-[11px] text-foreground">
                Enter
                <CornerDownLeft className="size-3" aria-hidden="true" />
              </kbd>
            </span>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous step"
              disabled={state.step === 0 || creating}
              onClick={() => dispatch({ type: "prev" })}
            >
              <ChevronUp />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next step"
              disabled={state.step === LAST_STEP || creating}
              onClick={() => dispatch({ type: "next" })}
            >
              <ChevronDown />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
