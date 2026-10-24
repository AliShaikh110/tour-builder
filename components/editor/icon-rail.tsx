"use client";

import { Code, Images, Settings2, Share2, Waypoints, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type PanelId = "scenes" | "connect" | "settings" | "share" | "developer";

export const PANELS: { id: PanelId; label: string; icon: LucideIcon }[] = [
  { id: "scenes", label: "Scenes", icon: Images },
  { id: "connect", label: "Connect Scenes", icon: Waypoints },
  { id: "settings", label: "Settings", icon: Settings2 },
  { id: "share", label: "Share", icon: Share2 },
  { id: "developer", label: "Developer", icon: Code },
];

/** Left rail of panel switches. Choosing the open panel again closes it. */
export function IconRail({
  active,
  onSelect,
}: {
  active: PanelId | null;
  onSelect: (panel: PanelId) => void;
}) {
  return (
    <nav aria-label="Editor panels" className="flex w-14 shrink-0 flex-col items-center gap-1 border-r bg-sidebar py-2 sm:w-16">
      {PANELS.map(({ id, label, icon: Icon }) => {
        const selected = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-pressed={selected}
            aria-controls="editor-panel"
            className={cn(
              "flex w-12 flex-col items-center gap-1 rounded-lg px-1 py-2 text-muted-foreground outline-none transition-colors sm:w-14",
              "hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              selected && "bg-primary/12 text-primary hover:bg-primary/15 hover:text-primary",
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
            <span className="text-center text-[10px] leading-tight">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
