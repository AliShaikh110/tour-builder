"use client";

import { Check, type LucideIcon } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export interface TileOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon: LucideIcon;
}

/**
 * A radio group drawn as tiles (WAI-ARIA radio pattern: arrows move and
 * select, Space or a click selects). Enter is left to the wizard, which
 * advances only once something is selected (`data-enter-advances`).
 * `onPick` replaces `onChange` for clicks and Space, e.g. to select and advance.
 */
export function RadioTiles<T extends string>({
  label,
  options,
  value,
  onChange,
  onPick,
  className,
  tileClassName,
}: {
  label: string;
  options: TileOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  onPick?: (value: T) => void;
  className?: string;
  tileClassName?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const tabStop = selectedIndex === -1 ? 0 : selectedIndex;

  function activate(index: number) {
    (onPick ?? onChange)(options[index].value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = options.length;
    let next = -1;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (index + 1) % count;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (index - 1 + count) % count;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = count - 1;
        break;
      case " ":
        event.preventDefault();
        activate(index);
        return;
      default:
        return;
    }
    event.preventDefault();
    refs.current[next]?.focus();
    onChange(options[next].value);
  }

  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-2", className)}>
      {options.map((option, index) => {
        const checked = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={index === tabStop ? 0 : -1}
            data-autofocus={index === tabStop ? "" : undefined}
            data-enter-advances=""
            onClick={() => activate(index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "group/tile relative flex items-center gap-3 rounded-lg bg-card px-3 py-3 text-left ring-1 ring-foreground/10 transition-[background-color,box-shadow,color] duration-150 outline-none",
              "hover:bg-accent hover:ring-foreground/20 focus-visible:ring-2 focus-visible:ring-ring",
              checked && "bg-primary/10 ring-2 ring-primary hover:bg-primary/15 hover:ring-primary",
              tileClassName,
            )}
          >
            <Icon
              aria-hidden="true"
              className={cn(
                "size-5 shrink-0 text-muted-foreground transition-colors group-hover/tile:text-foreground",
                checked && "text-primary group-hover/tile:text-primary",
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium leading-tight">{option.label}</span>
              {option.description && (
                <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                  {option.description}
                </span>
              )}
            </span>
            {checked && (
              <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3" strokeWidth={3} aria-hidden="true" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
