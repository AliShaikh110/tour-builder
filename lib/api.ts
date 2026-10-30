// The one place that talks to the backend (photo-sphere-backend).

/** The backend's address, from NEXT_PUBLIC_API_URL in .env.local. */
export const API_URL = (process.env.API_BASE_URL ?? "http://localhost:4000").replace(/\/+$/, "");

const TOKEN_KEY = "photo-sphere:token";

/** The login token, kept in localStorage so a reload stays logged in. */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked (private mode): the login lasts until the tab closes.
  }
}

/** An error answer from the API: { error: { message, details? } }, or status 0 when the server can't be reached. */
export class ApiError extends Error {
  status: number;
  details?: { path: string; message: string }[];

  constructor(status: number, message: string, details?: ApiError["details"]) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** A message for a toast or form, whatever was thrown. */
export function errorMessage(error: unknown, fallback = "Something went wrong. Try again."): string {
  return error instanceof ApiError || error instanceof Error ? error.message || fallback : fallback;
}

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Sent as JSON. */
  body?: unknown;
  /** Sent as multipart/form-data (file uploads). */
  form?: FormData;
  /** false: don't send the login token (public pages, logging in). */
  auth?: boolean;
  /** false: on 401 just forget the token instead of going to the login page. */
  redirectOn401?: boolean;
}

/** Forgets the login and opens the login page, coming back here afterwards. */
export function goToLogin(): void {
  setToken(null);
  const here = window.location.pathname + window.location.search;
  // A full page load, so nothing from the old session stays in memory.
  window.location.assign(here === "/" ? "/login" : `/login?next=${encodeURIComponent(here)}`);
}

/**
 * Calls the API at `/api${path}` and returns the JSON answer. The login token
 * is attached automatically. Throws ApiError for error answers.
 */
export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = options.auth === false ? null : getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, { method: options.method ?? "GET", headers, body });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection, or that the backend is running.");
  }

  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (response.ok) return data as T;

  if (response.status === 401 && token) {
    if (options.redirectOn401 === false) setToken(null);
    else goToLogin();
  }
  throw new ApiError(
    response.status,
    data?.error?.message ?? `The server answered with an error (${response.status}).`,
    data?.error?.details,
  );
}
