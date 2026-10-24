"use client";

import { Suspense, use, type ReactNode } from "react";
import { browser } from "react-dom";

function BrowserGate({ children }: { children: ReactNode }) {
  use(browser("Tours live in this browser's localStorage and IndexedDB."));
  return children;
}

/**
 * Renders `children` only in the browser. Tour data comes from localStorage,
 * so the server prerenders `fallback` instead of mismatching HTML.
 */
export function BrowserOnly({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <BrowserGate>{children}</BrowserGate>
    </Suspense>
  );
}
