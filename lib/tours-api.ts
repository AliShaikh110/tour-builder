import { api, ApiError, errorMessage, type Page } from "./api";
import { markAsServerCopy } from "./autosave";
import { rememberMediaUrls } from "./media-db";
import { useTourStore, type NewTourInput } from "./store";
import type { Tour, TourCategory, TourStatus } from "./types";

/** A tour as the API sends it: dates as text, plus the address of every file it uses. */
type ApiTour = Omit<Tour, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
  media: Record<string, string>;
};

/** One card on the dashboard. */
export interface TourSummary {
  id: string;
  title: string;
  category: TourCategory;
  status: TourStatus;
  createdAt: number;
  updatedAt: number;
  sceneCount: number;
  coverThumbUrl: string | null;
}

type ApiTourSummary = Omit<TourSummary, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };

function fromApi({ media, ...rest }: ApiTour): Tour {
  rememberMediaUrls(media);
  const tour: Tour = { ...rest, createdAt: Date.parse(rest.createdAt), updatedAt: Date.parse(rest.updatedAt) };
  markAsServerCopy(tour);
  return tour;
}

export async function fetchTours(page: number, limit: number): Promise<Page<TourSummary>> {
  const result = await api<Page<ApiTourSummary>>(`/tours?page=${page}&limit=${limit}`);
  return {
    ...result,
    items: result.items.map((t) => ({ ...t, createdAt: Date.parse(t.createdAt), updatedAt: Date.parse(t.updatedAt) })),
  };
}

/** A whole tour, without putting it in the store (e.g. for the .zip export). */
export async function fetchTour(tourId: string): Promise<Tour> {
  return fromApi(await api<ApiTour>(`/tours/${tourId}`));
}

export async function createTourOnServer(input: NewTourInput): Promise<Tour> {
  return fromApi(await api<ApiTour>("/tours", { method: "POST", body: input }));
}

// ---------------------------------------------------------------------------
// Loading tours into the store, once per page visit. The promises are kept so
// components can wait for them with React's use() inside <BrowserOnly>.
// ---------------------------------------------------------------------------

export type TourLoad = { ok: true; canEdit: boolean } | { ok: false; status: number; message: string };

const loads = new Map<string, Promise<TourLoad>>();

function once(key: string, load: () => Promise<TourLoad>): Promise<TourLoad> {
  let promise = loads.get(key);
  if (!promise) {
    promise = load().catch(
      (error): TourLoad => ({ ok: false, status: error instanceof ApiError ? error.status : 0, message: errorMessage(error) }),
    );
    loads.set(key, promise);
  }
  return promise;
}

/** Puts a tour that is already on the server into the store, ready for the editor. */
function keepTour(tour: Tour) {
  useTourStore.getState().insertTour(tour);
  loads.set(`edit:${tour.id}`, Promise.resolve({ ok: true, canEdit: true }));
}

/** One of your tours (any tour, for an admin), for the editor. */
export function loadTour(tourId: string): Promise<TourLoad> {
  return once(`edit:${tourId}`, async () => {
    useTourStore.getState().insertTour(await fetchTour(tourId));
    return { ok: true, canEdit: true };
  });
}

/**
 * For the visitor pages: your own tour when you're logged in and may edit
 * it, otherwise the published version (404 for drafts).
 */
export function loadViewerTour(tourId: string, signedIn: boolean): Promise<TourLoad> {
  return once(`view:${tourId}:${signedIn}`, async () => {
    if (signedIn) {
      const own = await loadTour(tourId);
      if (own.ok || own.status === 0) return own;
    }
    const tour = fromApi(await api<ApiTour>(`/public/tours/${tourId}`, { auth: false }));
    useTourStore.getState().insertTour(tour);
    return { ok: true, canEdit: false };
  });
}

/** Forgets a failed load so the next render tries again. */
export function forgetTourLoad(tourId: string): void {
  for (const key of [...loads.keys()]) if (key.includes(tourId)) loads.delete(key);
}

// ---------------------------------------------------------------------------
// Creating and deleting whole tours
// ---------------------------------------------------------------------------

/** A new, empty tour (the Create wizard), ready for the editor. */
export async function createTour(input: NewTourInput): Promise<Tour> {
  const tour = await createTourOnServer(input);
  keepTour(tour);
  return tour;
}

/**
 * A new tour built in the browser (the demo tour, an imported .zip): creates
 * it on the server, lets `fill` upload its files into it and return its
 * content, then saves that. If anything fails, the half-made tour and the
 * files already uploaded are deleted again.
 */
export async function createFilledTour(info: NewTourInput, fill: (tourId: string) => Promise<Tour>): Promise<Tour> {
  const created = await createTourOnServer(info);
  try {
    const content = await fill(created.id);
    const saved = fromApi(
      await api<ApiTour>(`/tours/${created.id}`, { method: "PUT", body: { ...content, status: "draft" } }),
    );
    keepTour(saved);
    return saved;
  } catch (error) {
    await api(`/tours/${created.id}`, { method: "DELETE" }).catch(() => undefined);
    throw error;
  }
}

/** Deletes the tour, its scenes and all its photos on the server. */
export async function deleteTour(tourId: string): Promise<void> {
  await api(`/tours/${tourId}`, { method: "DELETE" });
  useTourStore.getState().deleteTour(tourId);
  forgetTourLoad(tourId);
}
