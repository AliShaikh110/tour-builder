import type { Metadata } from "next";
import { BrowserOnly } from "@/components/browser-only";
import { TourPlayerPage } from "@/components/viewer/tour-player-page";

export const metadata: Metadata = { title: "Tour", robots: { index: false } };

/** The viewer without owner buttons, for `<iframe>` embeds. */
export default function EmbedPage({ params, searchParams }: PageProps<"/embed/[tourId]">) {
  return (
    <BrowserOnly fallback={<div className="h-dvh animate-pulse bg-[#0e0d0c]" aria-busy="true" />}>
      <TourPlayerPage params={params} searchParams={searchParams} mode="embed" />
    </BrowserOnly>
  );
}
