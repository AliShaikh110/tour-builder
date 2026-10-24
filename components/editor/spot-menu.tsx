"use client";

import type { LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface SpotMenuAction {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
}

export interface SpotMenuState {
  title: string;
  /** Client coordinates to open the menu at. */
  x: number;
  y: number;
  actions: SpotMenuAction[];
}

/** Actions for a saved hotspot or infospot, opened where it was clicked. */
export function SpotMenu({ menu, onClose }: { menu: SpotMenuState | null; onClose: () => void }) {
  return (
    <DropdownMenu open={menu !== null} onOpenChange={(open) => !open && onClose()} modal={false}>
      <DropdownMenuTrigger asChild>
        {/* Invisible anchor at the click point. */}
        <span
          aria-hidden="true"
          tabIndex={-1}
          className="pointer-events-none fixed size-px"
          style={{ left: menu?.x ?? 0, top: menu?.y ?? 0 }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-52">
        {menu && (
          <>
            <DropdownMenuLabel className="truncate">{menu.title}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {menu.actions.map(({ label, icon: Icon, onSelect, destructive }) => (
              <DropdownMenuItem key={label} variant={destructive ? "destructive" : "default"} onSelect={onSelect}>
                <Icon />
                {label}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
