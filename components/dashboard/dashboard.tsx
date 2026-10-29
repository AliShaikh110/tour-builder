"use client";

import { CloudAlert, FileUp, LoaderCircle, LogOut, Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateTourWizard } from "@/components/wizard/create-tour-wizard";
import { ApiError, errorMessage } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import { flushAllSaves } from "@/lib/autosave";
import { buildDemoTour, DEMO_TOUR_INFO } from "@/lib/demo-tour";
import { importTour, TourFileError } from "@/lib/export";
import { plural } from "@/lib/format";
import { baseName } from "@/lib/image";
import { putMedia } from "@/lib/media-db";
import { createFilledTour, fetchTours, type TourSummary } from "@/lib/tours-api";
import { GlobeArt } from "./globe-art";
import { TourCard } from "./tour-card";

const PAGE_SIZE = 24;

export function DashboardHeader() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        {user && (
          <div className="flex min-w-0 items-center gap-2">
            {user.role === "admin" && <Badge variant="secondary">Admin</Badge>}
            <span className="hidden truncate text-xs text-muted-foreground sm:inline">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut aria-hidden="true" />
              Log out
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}

interface TourList {
  items: TourSummary[];
  total: number;
  page: number;
}

export function Dashboard() {
  const router = useRouter();
  const [list, setList] = useState<TourList | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [demoProgress, setDemoProgress] = useState<{ done: number; total: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);

  // Load the first page each time the dashboard is shown, after any edits
  // still being saved, so the cards are up to date.
  useEffect(() => {
    let cancelled = false;
    flushAllSaves()
      .then(() => fetchTours(1, PAGE_SIZE))
      .then(
        (page) => {
          if (cancelled) return;
          setList({ items: page.items, total: page.total, page: 1 });
          setLoadError(null);
        },
        (error) => {
          if (!cancelled) setLoadError(errorMessage(error));
        },
      );
    return () => {
      cancelled = true;
    };
  }, [reloads]);

  const reload = () => setReloads((n) => n + 1);

  async function loadMore() {
    if (!list || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await fetchTours(list.page + 1, PAGE_SIZE);
      const known = new Set(list.items.map((t) => t.id));
      setList({ items: [...list.items, ...next.items.filter((t) => !known.has(t.id))], total: next.total, page: next.page });
    } catch (error) {
      toast.error("Couldn't load more tours", { description: errorMessage(error) });
    } finally {
      setLoadingMore(false);
    }
  }

  function removeFromList(tourId: string) {
    setList((current) =>
      current && { ...current, items: current.items.filter((t) => t.id !== tourId), total: current.total - 1 },
    );
  }

  async function startDemo() {
    if (demoProgress) return;
    setDemoProgress({ done: 0, total: 3 });
    const toastId = toast.loading("Downloading demo panoramas…");
    try {
      const tour = await createFilledTour(DEMO_TOUR_INFO, (tourId) =>
        buildDemoTour(tourId, (done, total) => {
          setDemoProgress({ done, total });
          toast.loading(`Downloading demo panoramas… ${done}/${total}`, { id: toastId });
        }),
      );
      toast.success("Demo tour ready", { id: toastId, description: tour.title });
      router.push(`/tours/${tour.id}/edit`);
    } catch (error) {
      toast.error("Couldn't create the demo tour", {
        id: toastId,
        description: error instanceof ApiError ? error.message : "Check your internet connection and try again.",
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
      // The tour is created first (named after the file), so its photos can be uploaded into it.
      const tour = await createFilledTour({ title: baseName(file.name), category: "other" }, (tourId) =>
        importTour(file, { writeMedia: (blob) => putMedia(tourId, blob) }),
      );
      toast.success(`Imported “${tour.title}”`, {
        id: toastId,
        description: plural(tour.sceneOrder.length, "scene"),
        action: { label: "Open", onClick: () => router.push(`/tours/${tour.id}/edit`) },
      });
      reload();
    } catch (error) {
      toast.error("Couldn't import that file", {
        id: toastId,
        description: error instanceof TourFileError || error instanceof ApiError ? error.message : "Something went wrong while reading it. Try again.",
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

  let content;
  if (!list && loadError) {
    content = (
      <section className="flex flex-col items-center py-16 text-center" role="alert">
        <CloudAlert className="size-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold">Couldn&apos;t load your tours</h1>
        <p className="mt-2 max-w-sm text-sm text-pretty text-muted-foreground">{loadError}</p>
        <Button className="mt-6" onClick={reload}>
          Try again
        </Button>
      </section>
    );
  } else if (!list) {
    content = (
      <div aria-busy="true">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-16" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-[16/11] rounded-xl" />
          ))}
        </div>
        <span className="sr-only">Loading your tours…</span>
      </div>
    );
  } else if (list.items.length > 0) {
    content = (
      <>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your tours</h1>
            <p className="mt-1 text-sm text-muted-foreground">{plural(list.total, "tour")}</p>
          </div>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Tours">
          {list.items.map((tour) => (
            <TourCard key={tour.id} tour={tour} onDeleted={removeFromList} />
          ))}
        </ul>
        {list.items.length < list.total && (
          <div className="mt-8 flex justify-center">
            <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
              {loadingMore && <LoaderCircle className="animate-spin" aria-hidden="true" />}
              {loadingMore ? "Loading…" : "Load more tours"}
            </Button>
          </div>
        )}
      </>
    );
  } else {
    content = (
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
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <DashboardHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">{content}</main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-6 text-xs text-muted-foreground sm:px-6">
        Tours, photos and settings are saved to your account.
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
