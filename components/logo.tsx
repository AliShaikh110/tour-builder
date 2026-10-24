import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("size-7 shrink-0", className)}
    >
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
      <ellipse cx="16" cy="16" rx="5.5" ry="13" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
      <path d="M3 16h26" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
      <path
        d="M16 3a13 13 0 0 1 13 13"
        stroke="var(--primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="29" cy="16" r="2.25" fill="var(--primary)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span>{APP_NAME}</span>
    </span>
  );
}
