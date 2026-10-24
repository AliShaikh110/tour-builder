"use client";

import { ImageOff, LayoutGrid, MapPinOff, PencilLine } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/auth";
import { useTour } from "@/lib/store";
import { loadViewerTour } from "@/lib/tours-api";
import { ControlButton } from "./viewer-controls";
import { TourViewer } from "./tour-viewer";

function Message({ icon: Icon, title, body, embed }: { icon: typeof MapPinOff; title: string; body: string; embed: boolean }) {
  return (
    <main className="flex h-dvh flex-col items-center justify-center bg-[#0e0d0c] px-6 text-center text-white">
      <Icon className="size-8 text-white/60" aria-hidden="true" />
      <h1 className="mt-4 text-lg font-semibold">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-white/70">{body}</p>
      {!embed && (
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/">Go to your tours</Link>
        </Button>
      )}
    </main>
  );
}

/** The full-screen visitor page (`/tours/[id]`) and the iframe version (`/embed/[id]`). */
export function TourPlayerPage({
  params,
  searchParams,
  mode,
}: {
  params: Promise<{ tourId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  mode: "page" | "embed";
}) {
  const { tourId } = use(params);
  const { scene } = use(searchParams);
  const router = useRouter();
  const embed = mode === "embed";
  const user = useCurrentUser();
  // Owners (and admins) see their tour on the page, drafts included; everyone else, and every embed, the published one.
  const load = use(loadViewerTour(tourId, !embed && user !== null));
  const tour = useTour(tourId);

  if (!load.ok || !tour) {
    return (
      <Message
        icon={MapPinOff}
        title="This tour isn't available"
        body={
          !load.ok && load.status === 0
            ? load.message
            : "It may not be published yet, or the link may be wrong."
        }
        embed={embed}
      />
    );
  }
  if (tour.sceneOrder.length === 0) {
    return <Message icon={ImageOff} title={tour.title} body="This tour has no scenes yet." embed={embed} />;
  }

  return (
    <main className="h-dvh w-full">
      <h1 className="sr-only">{tour.title}</h1>
      <TourViewer
        tour={tour}
        mode={mode}
        startSceneId={typeof scene === "string" ? scene : null}
        onSceneChange={(id) => {
          // Keep the address shareable without a navigation.
          const url = new URL(window.location.href);
          url.searchParams.set("scene", id);
          window.history.replaceState(window.history.state, "", url);
        }}
        ownerActions={
          embed || !load.canEdit ? null : (
            <>
              <ControlButton icon={PencilLine} label="Edit tour" onClick={() => router.push(`/tours/${tour.id}/edit`)} />
              <ControlButton icon={LayoutGrid} label="Go to dashboard" onClick={() => router.push("/")} />
            </>
          )
        }
      />
    </main>
  );
}
