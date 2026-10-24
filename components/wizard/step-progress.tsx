"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STEPS, isStepComplete, isStepReachable, type WizardState } from "./wizard-state";

export function StepProgress({
  state,
  onSelect,
  disabled = false,
}: {
  state: WizardState;
  onSelect: (step: number) => void;
  disabled?: boolean;
}) {
  return (
    <nav aria-label="Wizard steps">
      <ol className="grid grid-cols-7 gap-1.5">
        {STEPS.map((step, index) => {
          const current = index === state.step;
          const complete = isStepComplete(index, state);
          const reachable = !disabled && isStepReachable(index, state);
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                disabled={!reachable || current}
                aria-current={current ? "step" : undefined}
                aria-label={`Step ${index + 1}: ${step.label}${complete ? ", completed" : ""}`}
                className={cn(
                  "group/step flex w-full flex-col gap-1.5 rounded-sm pt-2 pb-1 text-left outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                  reachable && !current && "cursor-pointer",
                )}
              >
                <span
                  className={cn(
                    "h-1 rounded-full bg-muted transition-colors duration-300",
                    complete && "bg-primary",
                    current && !complete && "bg-primary/55",
                    current && complete && "bg-primary shadow-[0_0_0_2px_var(--background),0_0_0_3px_var(--primary)]",
                    reachable && !current && "group-hover/step:bg-primary/80",
                  )}
                />
                <span
                  className={cn(
                    "flex h-4 items-center gap-1 text-[11px] leading-none text-muted-foreground",
                    current && "text-foreground",
                  )}
                >
                  {complete && <Check className="size-3 shrink-0 text-primary" strokeWidth={3} aria-hidden="true" />}
                  <span className="hidden truncate sm:inline">{step.label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
