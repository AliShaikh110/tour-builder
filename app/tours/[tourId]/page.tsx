import type { Metadata } from "next";
import { BrowserOnly } from "@/components/browser-only";
import { TourPlayerPage } from "@/components/viewer/tour-player-page";

export const metadata: Metadata = { title: "Tour" };

export default function TourPage({ params, searchParams }: PageProps<"/tours/[tourId]">) {
  return (
    <BrowserOnly fallback={<div className="h-dvh animate-pulse bg-[#0e0d0c]" aria-busy="true" />}>
      <TourPlayerPage params={params} searchParams={searchParams} mode="page" />
    </BrowserOnly>
  );
}
