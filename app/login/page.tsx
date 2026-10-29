import type { Metadata } from "next";
import { AuthForm, AuthSkeleton } from "@/components/auth/auth-form";
import { BrowserOnly } from "@/components/browser-only";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <BrowserOnly fallback={<AuthSkeleton mode="login" />}>
      <AuthForm mode="login" searchParams={searchParams} />
    </BrowserOnly>
  );
}
