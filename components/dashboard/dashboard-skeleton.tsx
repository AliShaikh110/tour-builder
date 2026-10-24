import { Logo } from "@/components/logo";
import { Skeleton } from "@/components/ui/skeleton";

/** Prerendered shell shown until the browser has read the saved tours. */
export function DashboardSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col" aria-busy="true">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center px-4 sm:px-6">
          <Logo />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-16" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-[16/11] rounded-xl" />
          ))}
        </div>
        <span className="sr-only">Loading your tours…</span>
      </main>
    </div>
  );
}
