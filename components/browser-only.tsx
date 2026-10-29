"use client";

import { Suspense, use, type ReactNode } from "react";
import { browser } from "react-dom";

function BrowserGate({ children }: { children: ReactNode }) {
  use(browser("The login token is kept in this browser's localStorage."));
  return children;
}

/**
 * Renders `children` only in the browser. The login token is in localStorage,
 * so the server prerenders `fallback` instead of mismatching HTML.
 */
export function BrowserOnly({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <BrowserGate>{children}</BrowserGate>
    </Suspense>
  );
}
