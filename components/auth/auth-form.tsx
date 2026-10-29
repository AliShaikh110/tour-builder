"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState, type FormEvent } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, errorMessage } from "@/lib/api";
import { useAuthStore, useCurrentUser } from "@/lib/auth";

type Mode = "login" | "register";

const COPY: Record<Mode, { title: string; intro: string; submit: string; busy: string }> = {
  login: {
    title: "Log in",
    intro: "Your tours are saved to your account.",
    submit: "Log in",
    busy: "Logging in…",
  },
  register: {
    title: "Create your account",
    intro: "Upload 360° photos, link them with hotspots and share the tour.",
    submit: "Create account",
    busy: "Creating account…",
  },
};

/** Where to go after logging in: the page that asked for it, never another site. */
function safeNext(next: string | string[] | undefined): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function Shell({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Logo />
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-pretty text-muted-foreground">{intro}</p>
        {children}
      </div>
    </main>
  );
}

/** Prerendered while the browser checks whether someone is already logged in. */
export function AuthSkeleton({ mode }: { mode: Mode }) {
  return (
    <Shell title={COPY[mode].title} intro={COPY[mode].intro}>
      <div className="mt-6 space-y-4" aria-busy="true">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-10" />
      </div>
    </Shell>
  );
}

export function AuthForm({
  mode,
  searchParams,
}: {
  mode: Mode;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = use(searchParams);
  const user = useCurrentUser();
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = safeNext(next);
  const copy = COPY[mode];

  // Logged in (just now, or already): carry on to where the visitor was going.
  useEffect(() => {
    if (user) router.replace(target);
  }, [user, router, target]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    setBusy(true);
    setError(null);
    try {
      await (mode === "login" ? login : register)(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? (err.details?.[0]?.message ?? err.message) : errorMessage(err));
      setBusy(false);
    }
  }

  const otherHref = target === "/" ? "" : `?next=${encodeURIComponent(target)}`;

  return (
    <Shell title={copy.title} intro={copy.intro}>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={mode === "register" ? 8 : undefined}
            maxLength={72}
            required
            aria-describedby={mode === "register" ? "password-hint" : undefined}
          />
          {mode === "register" && (
            <p id="password-hint" className="text-xs text-muted-foreground">
              At least 8 characters.
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {busy ? copy.busy : copy.submit}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        {mode === "login" ? "New here? " : "Already have an account? "}
        <Link
          href={`${mode === "login" ? "/register" : "/login"}${otherHref}`}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {mode === "login" ? "Create an account" : "Log in"}
        </Link>
      </p>
    </Shell>
  );
}
