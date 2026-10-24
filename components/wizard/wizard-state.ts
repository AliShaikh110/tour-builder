import type { TourAudience, TourCategory } from "@/lib/types";

export const STEPS = [
  { id: "title", label: "Title" },
  { id: "address", label: "Address" },
  { id: "category", label: "Category" },
  { id: "photos", label: "Photos" },
  { id: "audience", label: "Audience" },
  { id: "addons", label: "Add-ons" },
  { id: "review", label: "Review" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

export const LAST_STEP = STEPS.length - 1;

export interface WizardPhoto {
  id: string;
  file: File;
  status: "reading" | "ready" | "error";
  width?: number;
  height?: number;
}

export interface WizardState {
  step: number;
  /** Highest step reached so far; steps up to it are reachable from the progress bar. */
  furthest: number;
  /** Direction of the last move, for the slide animation. */
  direction: 1 | -1;
  error: string | null;
  title: string;
  address: string;
  category: TourCategory | null;
  photos: WizardPhoto[];
  audience: TourAudience | null;
}

export const initialWizardState: WizardState = {
  step: 0,
  furthest: 0,
  direction: 1,
  error: null,
  title: "",
  address: "",
  category: null,
  photos: [],
  audience: null,
};

export type WizardAction =
  | { type: "next" }
  | { type: "prev" }
  | { type: "goto"; step: number }
  | { type: "setTitle"; title: string }
  | { type: "setAddress"; address: string }
  | { type: "setCategory"; category: TourCategory }
  | { type: "setAudience"; audience: TourAudience }
  | { type: "addPhotos"; photos: WizardPhoto[] }
  | { type: "updatePhoto"; id: string; patch: Partial<WizardPhoto> }
  | { type: "removePhoto"; id: string }
  | { type: "reset" };

/** Why the user can't leave `step` yet, or null when it's fine. */
export function stepError(step: number, state: WizardState): string | null {
  switch (STEPS[step]?.id) {
    case "title":
      return state.title.trim() ? null : "Give your tour a title to continue.";
    case "category":
      return state.category ? null : "Pick the category that fits best.";
    case "audience":
      return state.audience ? null : "Choose who the tour is for.";
    default:
      return null;
  }
}

export function isStepComplete(step: number, state: WizardState): boolean {
  return step < state.furthest && stepError(step, state) === null;
}

/** A step is reachable when it was visited and every step before it is valid. */
export function isStepReachable(step: number, state: WizardState): boolean {
  if (step > state.furthest) return false;
  for (let i = 0; i < step; i++) if (stepError(i, state)) return false;
  return true;
}

/** First step whose answer is still missing, or -1. */
export function firstInvalidStep(state: WizardState): number {
  return STEPS.findIndex((_, i) => stepError(i, state) !== null);
}

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "next": {
      const error = stepError(state.step, state);
      if (error) return { ...state, error };
      if (state.step >= LAST_STEP) return state;
      const step = state.step + 1;
      return { ...state, step, furthest: Math.max(state.furthest, step), direction: 1, error: null };
    }
    case "prev":
      if (state.step === 0) return state;
      return { ...state, step: state.step - 1, direction: -1, error: null };
    case "goto":
      if (action.step === state.step || !isStepReachable(action.step, state)) return state;
      return {
        ...state,
        step: action.step,
        direction: action.step > state.step ? 1 : -1,
        error: null,
      };
    case "setTitle":
      return { ...state, title: action.title, error: null };
    case "setAddress":
      return { ...state, address: action.address };
    case "setCategory":
      return { ...state, category: action.category, error: null };
    case "setAudience":
      return { ...state, audience: action.audience, error: null };
    case "addPhotos":
      return { ...state, photos: [...state.photos, ...action.photos] };
    case "updatePhoto":
      return {
        ...state,
        photos: state.photos.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
      };
    case "removePhoto":
      return { ...state, photos: state.photos.filter((p) => p.id !== action.id) };
    case "reset":
      return initialWizardState;
  }
}
