import { toast } from "sonner";
import { create } from "zustand";
import { api, errorMessage, getToken } from "./api";
import { useTourStore } from "./store";
import type { Tour } from "./types";

// The editor changes tours in the store instantly; this module sends each
// changed tour to the server (PUT /api/tours/:id) shortly afterwards.

const SAVE_DELAY_MS = 800;

/** "saving" from the first unsent change until the server confirms; "error" after a failed save. */
export type SaveStatus = "saving" | "saved" | "error";

export const useSaveStatus = create<Record<string, SaveStatus>>()(() => ({}));

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const queues = new Map<string, Promise<void>>();
/** Tour objects that came from the server, so putting them in the store doesn't save them back. */
const serverCopies = new WeakSet<Tour>();

export function markAsServerCopy(tour: Tour): void {
  serverCopies.add(tour);
}

function setStatus(tourId: string, status: SaveStatus) {
  useSaveStatus.setState({ [tourId]: status });
}

/**
 * Runs `task` after every request already queued for this tour, so the server
 * sees changes in the order they were made (e.g. a save before a file delete).
 */
export function enqueue<T>(tourId: string, task: () => Promise<T>): Promise<T> {
  const run = (queues.get(tourId) ?? Promise.resolve()).then(task);
  queues.set(
    tourId,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

function scheduleSave(tourId: string) {
  clearTimeout(timers.get(tourId));
  timers.set(tourId, setTimeout(() => void saveNow(tourId), SAVE_DELAY_MS));
  setStatus(tourId, "saving");
}

function saveNow(tourId: string): Promise<void> {
  clearTimeout(timers.get(tourId));
  timers.delete(tourId);
  return enqueue(tourId, async () => {
    // The tour as it is when the request leaves, so a burst of edits is one save.
    const tour = useTourStore.getState().tours[tourId];
    if (!tour) return;
    try {
      await api(`/tours/${tourId}`, { method: "PUT", body: tour });
      if (!timers.has(tourId)) setStatus(tourId, "saved");
    } catch (error) {
      setStatus(tourId, "error");
      toast.error("Couldn't save your changes", {
        id: `save-${tourId}`,
        description: errorMessage(error),
        action: { label: "Retry", onClick: () => void saveNow(tourId) },
      });
    }
  });
}

/** Sends a waiting save now; resolves when everything queued for the tour is done. */
export function flushSaves(tourId: string): Promise<void> {
  if (timers.has(tourId)) return saveNow(tourId);
  return queues.get(tourId) ?? Promise.resolve();
}

export function flushAllSaves(): Promise<void> {
  const ids = new Set([...timers.keys(), ...queues.keys()]);
  return Promise.all([...ids].map(flushSaves)).then(() => undefined);
}

export function hasUnsavedChanges(): boolean {
  return Object.values(useSaveStatus.getState()).some((status) => status !== "saved");
}

let started = false;

/** Starts watching the store. Safe to call more than once. */
export function startAutosave(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  useTourStore.subscribe((state, previous) => {
    for (const [id, tour] of Object.entries(state.tours)) {
      if (tour !== previous.tours[id] && !serverCopies.has(tour)) scheduleSave(id);
    }
    for (const id of Object.keys(previous.tours)) {
      if (state.tours[id]) continue;
      // Deleted: nothing left to save.
      clearTimeout(timers.get(id));
      timers.delete(id);
      useSaveStatus.setState({ [id]: "saved" });
    }
  });

  // Closing the tab with a save still waiting asks "Leave site?" first. Not
  // after logging out (or an expired login): those changes can't be saved anyway.
  window.addEventListener("beforeunload", (event) => {
    if (hasUnsavedChanges() && getToken()) event.preventDefault();
  });
}
