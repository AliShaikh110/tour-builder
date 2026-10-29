import { RequireAuth } from "@/components/auth/require-auth";
import { BrowserOnly } from "@/components/browser-only";
import { Dashboard } from "@/components/dashboard/dashboard";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";

export default function HomePage() {
  return (
    <BrowserOnly fallback={<DashboardSkeleton />}>
      <RequireAuth>
        <Dashboard />
      </RequireAuth>
    </BrowserOnly>
  );
}
