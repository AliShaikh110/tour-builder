"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useCurrentUser } from "@/lib/auth";
import { startAutosave } from "@/lib/autosave";

/**
 * Shows `children` only to a logged-in user; anyone else is sent to the login
 * page (and brought back here afterwards). Use inside <BrowserOnly>.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      startAutosave();
      return;
    }
    const here = window.location.pathname + window.location.search;
    router.replace(here === "/" ? "/login" : `/login?next=${encodeURIComponent(here)}`);
  }, [user, router]);

  return user ? children : null;
}
