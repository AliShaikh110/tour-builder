"use client";

import { useEffect, useRef, useState } from "react";

const FRAME_STYLE = `
html { color-scheme: dark; }
body { display: flow-root; margin: 0; padding: 16px; font: 15px/1.55 system-ui, sans-serif; color: #eeeae6; background: transparent; overflow-wrap: anywhere; }
img, video { max-width: 100%; height: auto; }
iframe { max-width: 100%; border: 0; }
a { color: #f5b94a; }
`;

// Runs inside the sandbox and reports the content height to the parent, so
// the frame can size itself. It measures <body>, not <html>, whose height
// follows the frame and would feed back. The parent only trusts this frame.
const HEIGHT_REPORTER = `(() => {
  const post = () => parent.postMessage({ infospotHeight: Math.ceil(document.body.getBoundingClientRect().height) }, "*");
  new ResizeObserver(post).observe(document.body);
  addEventListener("load", post);
  post();
})();`;

export function buildSrcDoc(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base target="_blank"><style>${FRAME_STYLE}</style></head><body>${html}<script>${HEIGHT_REPORTER}</script></body></html>`;
}

/**
 * Author-supplied HTML, isolated in a sandboxed iframe. `allow-scripts` lets
 * the author's scripts run; there is deliberately no `allow-same-origin`, so
 * the content gets an opaque origin and can't reach the tour's storage,
 * cookies or the page around it. (Video players can't work under an opaque
 * origin, so lib/embeds lifts them out into `VideoEmbed` frames.)
 */
export function SandboxedHtml({ html, title }: { html: string; title: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(120);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow) return;
      const reported = (event.data as { infospotHeight?: unknown } | null)?.infospotHeight;
      if (typeof reported !== "number" || !Number.isFinite(reported)) return;
      setHeight(Math.min(Math.max(reported, 48), Math.round(window.innerHeight * 0.7)));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      ref={frame}
      title={title}
      srcDoc={buildSrcDoc(html)}
      sandbox="allow-scripts allow-popups"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      referrerPolicy="strict-origin-when-cross-origin"
      className="block w-full rounded-lg bg-black/20"
      style={{ height }}
    />
  );
}

/**
 * A YouTube or Vimeo player lifted out of author HTML (see lib/embeds). Its
 * src is rebuilt from a validated id, and it is cross-origin, so
 * allow-same-origin here only lets the player keep its own origin.
 */
export function VideoEmbed({ src, title }: { src: string; title: string }) {
  return (
    <iframe
      src={src}
      title={title}
      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      className="block aspect-video w-full rounded-lg bg-black"
    />
  );
}
