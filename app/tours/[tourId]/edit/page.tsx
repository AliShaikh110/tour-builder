import type { Metadata } from "next";
import { RequireAuth } from "@/components/auth/require-auth";
import { BrowserOnly } from "@/components/browser-only";
import { Editor } from "@/components/editor/editor";

export const metadata: Metadata = { title: "Editor" };

function EditorSkeleton() {
  return (
    <div className="flex h-dvh flex-col" aria-busy="true">
      <div className="h-12 shrink-0 border-b" />
      <div className="flex min-h-0 flex-1">
        <div className="w-14 shrink-0 border-r bg-sidebar sm:w-16" />
        <div className="hidden w-80 shrink-0 border-r bg-sidebar md:block" />
        <div className="flex-1 animate-pulse bg-[#0e0d0c]" />
      </div>
      <span className="sr-only">Loading the editor…</span>
    </div>
  );
}

export default function EditTourPage({ params }: PageProps<"/tours/[tourId]/edit">) {
  return (
    <BrowserOnly fallback={<EditorSkeleton />}>
      <RequireAuth>
        <Editor params={params} />
      </RequireAuth>
    </BrowserOnly>
  );
}
