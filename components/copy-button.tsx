"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState, type ComponentProps } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Copies text to the clipboard and says "Copied" for a moment. */
export function CopyButton({
  text,
  label,
  compact,
  ...props
}: {
  text: string;
  /** What is copied, e.g. "link"; used for the accessible name. */
  label: string;
  /** Icon only. */
  compact?: boolean;
} & Omit<ComponentProps<typeof Button>, "onClick" | "children">) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      toast.error("Couldn't copy", { description: "Select the text and copy it with Ctrl+C (⌘C on a Mac)." });
    }
  }

  const Icon = copied ? Check : Copy;
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size={compact ? "icon-sm" : "default"}
        onClick={copy}
        aria-label={`Copy ${label}`}
        {...props}
      >
        <Icon aria-hidden="true" />
        {!compact && (copied ? "Copied" : "Copy")}
      </Button>
      <span className="sr-only" aria-live="polite">
        {copied ? `Copied ${label}` : ""}
      </span>
    </>
  );
}
