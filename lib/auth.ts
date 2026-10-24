import { use } from "react";
import { create } from "zustand";
import { api, getToken, setToken } from "./api";

export interface User {
  id: string;
  email: string;
  role: "user" | "admin";
}

interface AuthResponse {
  token: string;
  user: User;
}

interface AuthStore {
  /** null when logged out. */
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()((set) => {
  const signIn = (response: AuthResponse) => {
    setToken(response.token);
    set({ user: response.user });
  };

  return {
    user: null,
    login: async (email, password) =>
      signIn(await api<AuthResponse>("/auth/login", { method: "POST", body: { email, password }, auth: false })),
    register: async (email, password) =>
      signIn(await api<AuthResponse>("/auth/register", { method: "POST", body: { email, password }, auth: false })),
    logout: () => {
      setToken(null);
      // A full page load on purpose, so no tour from this account stays in memory.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    },
  };
});

let session: Promise<void> | null = null;

/** Asks the server who the saved token belongs to, once per page load. */
function checkSession(): Promise<void> {
  session ??= (async () => {
    if (!getToken()) return;
    try {
      const user = await api<User>("/auth/me", { redirectOn401: false });
      useAuthStore.setState({ user });
    } catch {
      // Expired token or server down: carry on logged out.
    }
  })();
  return session;
}

/**
 * The logged-in user, or null. The first call suspends until the saved token
 * has been checked, so use it inside <BrowserOnly> (a Suspense boundary).
 */
export function useCurrentUser(): User | null {
  use(checkSession());
  return useAuthStore((s) => s.user);
}
