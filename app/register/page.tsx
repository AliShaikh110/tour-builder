import type { Metadata } from "next";
import { AuthForm, AuthSkeleton } from "@/components/auth/auth-form";
import { BrowserOnly } from "@/components/browser-only";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage({ searchParams }: PageProps<"/register">) {
  return (
    <BrowserOnly fallback={<AuthSkeleton mode="register" />}>
      <AuthForm mode="register" searchParams={searchParams} />
    </BrowserOnly>
  );
}
