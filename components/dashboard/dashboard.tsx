"use client";

import { FileUp, HardDrive, LoaderCircle, Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { CreateTourWizard } from "@/components/wizard/create-tour-wizard";
import { buildDemoTour } from "@/lib/demo-tour";
import { importTour, TourFileError } from "@/lib/export";
import { plural } from "@/lib/format";
import { useTourStore } from "@/lib/store";
import { GlobeArt } from "./globe-art";
import { TourCard } from "./tour-card";

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <p className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
          <HardDrive className="size-3.5" aria-hidden="true" />
          Saved in this browser only
        </p>
      </div>
    </header>
  );
}

export function Dashboard() {
  const tours = useTourStore((s) => s.tours);
  const insertTour = useTourStore((s) => s.insertTour);
  const router = useRouter();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [demoProgress, setDemoProgress] = useState<{ done: number; total: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);

  const list = useMemo(
    () => Object.values(tours).sort((a, b) => b.updatedAt - a.updatedAt),
    [tours],
  );

  async function startDemo() {
    if (demoProgress) return;
    setDemoProgress({ done: 0, total: 3 });
    const toastId = toast.loading("Downloading demo panoramas…");
    try {
      const tour = await buildDemoTour((done, total) => {
        setDemoProgress({ done, total });
        toast.loading(`Downloading demo panoramas… ${done}/${total}`, { id: toastId });
      });
      insertTour(tour);
      toast.success("Demo tour ready", { id: toastId, description: tour.title });
      router.push(`/tours/${tour.id}/edit`);
    } catch {
      toast.error("Couldn't download the demo panoramas", {
        id: toastId,
        description: "Check your internet connection and try again.",
      });
    } finally {
      setDemoProgress(null);
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || importing) return;
    setImporting(true);
    const toastId = toast.loading(`Importing ${file.name}…`);
    try {
      const tour = await importTour(file);
      insertTour(tour);
      toast.success(`Imported “${tour.title}”`, {
        id: toastId,
        description: plural(tour.sceneOrder.length, "scene"),
        action: { label: "Open", onClick: () => router.push(`/tours/${tour.id}/edit`) },
      });
    } catch (error) {
      toast.error("Couldn't import that file", {
        id: toastId,
        description:
          error instanceof TourFileError ? error.message : "Something went wrong while reading it. Try again.",
      });
    } finally {
      setImporting(false);
    }
  }

  const actions = (
    <>
      <Button variant="ghost" size="lg" onClick={() => importInput.current?.click()} disabled={importing}>
        {importing ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <FileUp aria-hidden="true" />
        )}
        {importing ? "Importing…" : "Import tour"}
      </Button>
      <Button variant="outline" size="lg" onClick={startDemo} disabled={demoProgress !== null}>
        {demoProgress ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles aria-hidden="true" />
        )}
        {demoProgress
          ? `Downloading ${demoProgress.done}/${demoProgress.total}`
          : "Start from demo tour"}
      </Button>
      <Button size="lg" onClick={() => setWizardOpen(true)}>
        <Plus aria-hidden="true" />
        Create
      </Button>
    </>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <DashboardHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {list.length > 0 ? (
          <>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your tours</h1>
                <p className="mt-1 text-sm text-muted-foreground">{plural(list.length, "tour")}</p>
              </div>
              <div className="flex flex-wrap gap-2">{actions}</div>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Tours">
              {list.map((tour) => (
                <TourCard key={tour.id} tour={tour} />
              ))}
            </ul>
          </>
        ) : (
          <section className="flex flex-col items-center py-10 text-center sm:py-16">
            <GlobeArt className="size-36 text-foreground sm:size-44" />
            <h1 className="mt-8 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Build your first virtual tour
            </h1>
            <p className="mt-3 max-w-md text-sm text-pretty text-muted-foreground sm:text-base">
              Upload 360° photos, link them with hotspots, and share a tour visitors can walk
              through. Or open the demo to see one finished.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-2">{actions}</div>
          </section>
        )}
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-6 text-xs text-muted-foreground sm:px-6">
        Tours, photos and settings are stored in this browser. Clearing site data deletes them.
      </footer>
      <CreateTourWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      <input
        ref={importInput}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleImport}
      />
    </div>
  );
}
