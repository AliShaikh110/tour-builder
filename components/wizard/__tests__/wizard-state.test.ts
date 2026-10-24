import { describe, expect, it } from "vitest";
import {
  LAST_STEP,
  firstInvalidStep,
  initialWizardState,
  isStepComplete,
  isStepReachable,
  wizardReducer,
  type WizardAction,
  type WizardState,
} from "../wizard-state";

function run(...actions: WizardAction[]): WizardState {
  return actions.reduce(wizardReducer, initialWizardState);
}

describe("wizard navigation", () => {
  it("won't leave the title step without a title", () => {
    const state = run({ type: "next" });
    expect(state.step).toBe(0);
    expect(state.error).toMatch(/title/i);
    expect(run({ type: "next" }, { type: "setTitle", title: "x" }).error).toBeNull();
  });

  it("skips the optional address and requires a category", () => {
    const state = run({ type: "setTitle", title: "Campus" }, { type: "next" }, { type: "next" }, { type: "next" });
    expect(state.step).toBe(2);
    expect(state.error).toMatch(/category/i);
  });

  it("walks to review and ticks completed steps", () => {
    const state = run(
      { type: "setTitle", title: "Campus" },
      { type: "next" },
      { type: "next" },
      { type: "setCategory", category: "education" },
      { type: "next" },
      { type: "next" },
      { type: "setAudience", audience: "client" },
      { type: "next" },
      { type: "next" },
    );
    expect(state.step).toBe(LAST_STEP);
    expect(firstInvalidStep(state)).toBe(-1);
    expect([0, 1, 2, 3, 4, 5].every((i) => isStepComplete(i, state))).toBe(true);
    expect(isStepComplete(LAST_STEP, state)).toBe(false);
  });

  it("only jumps to visited steps whose earlier answers are valid", () => {
    let state = run({ type: "setTitle", title: "Campus" }, { type: "next" }, { type: "next" });
    expect(isStepReachable(1, state)).toBe(true);
    expect(isStepReachable(3, state)).toBe(false);
    expect(wizardReducer(state, { type: "goto", step: 5 }).step).toBe(2);

    state = wizardReducer(state, { type: "goto", step: 0 });
    expect(state).toMatchObject({ step: 0, direction: -1 });
    state = wizardReducer(state, { type: "setTitle", title: "" });
    expect(isStepReachable(2, state)).toBe(false);
  });

  it("resets to the first step", () => {
    const state = run({ type: "setTitle", title: "Campus" }, { type: "next" }, { type: "reset" });
    expect(state).toEqual(initialWizardState);
  });
});
