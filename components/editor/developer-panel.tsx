"use client";

import { ExternalLink } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { tourLink } from "@/lib/share";
import type { Tour } from "@/lib/types";

function commandsExample(sceneId: string): string {
  return `TourSDK.getScenes();
TourSDK.getCurrentScene();
TourSDK.getHotspots(); // or (sceneId)
TourSDK.goToScene("${sceneId}");
TourSDK.next(); // prev() goes back
TourSDK.lookAt({ yaw: 1.57, pitch: 0 });
TourSDK.getCamera(); // { yaw, pitch, zoom }
TourSDK.setAutoRotate(true);`;
}

const EVENTS_EXAMPLE = `const stop = TourSDK.on("scene:loaded", (e) => {
  console.log(e.name, e.via);
});
TourSDK.on("hotspot:click", (e) => {
  console.log(e.targetSceneId);
});
TourSDK.on("infospot:open", (e) => {
  console.log(e.kind, e.label);
});
TourSDK.on("camera:idle", (e) => {
  console.log(e.yaw, e.pitch, e.zoom);
});

stop(); // or TourSDK.off(event, fn)`;

function embedExample(origin: string, sceneId: string): string {
  return `const frame = document.querySelector("iframe");
let lastId = 0;

function tour(method, ...args) {
  const id = ++lastId;
  return new Promise((resolve, reject) => {
    addEventListener("message", function reply(e) {
      if (e.source !== frame.contentWindow || e.data?.id !== id) return;
      removeEventListener("message", reply);
      e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.result);
    });
    frame.contentWindow.postMessage({ toursdk: 1, id, method, args }, "${origin}");
  });
}

// Events, and "ready" when the tour is up, arrive as { toursdk: 1, event, data }.
addEventListener("message", (e) => {
  if (e.source === frame.contentWindow && e.data?.event) console.log(e.data.event, e.data.data);
});

tour("goToScene", "${sceneId}");`;
}

function Example({ title, hint, code }: { title: string; hint?: ReactNode; code: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 id={id} className="text-sm font-medium">
          {title}
        </h3>
        <CopyButton text={code} label={`${title.toLowerCase()} example`} compact />
      </div>
      {hint && <p className="text-xs text-pretty text-muted-foreground">{hint}</p>}
      <pre className="rounded-lg bg-background/60 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap ring-1 ring-foreground/10 [overflow-wrap:anywhere]">
        <code>{code}</code>
      </pre>
    </section>
  );
}

export function DeveloperPanel({ tour, currentId }: { tour: Tour; currentId: string | null }) {
  const [origin] = useState(() => window.location.origin);
  const exampleScene = (currentId && tour.scenes[currentId] ? currentId : tour.sceneOrder[0]) ?? "SCENE_ID";
  const scenes = tour.sceneOrder.map((id) => tour.scenes[id]).filter(Boolean);
  const scenesId = useId();

  return (
    <div className="flex h-full flex-col">
      <header className="px-4 pt-4 pb-3">
        <h2 className="font-semibold tracking-tight">Developer</h2>
        <p className="mt-1 text-xs text-pretty text-muted-foreground">
          The viewer and the embed expose <code className="font-mono text-foreground">window.TourSDK</code> once the
          first scene shows. Angles are in radians, zoom runs from 0 to 100.
        </p>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-4">
        <div className="space-y-2">
          <p className="text-xs text-pretty text-muted-foreground">
            To try it, open the viewer, open the browser console (F12) and paste an example.
          </p>
          <Button asChild variant="secondary" size="sm">
            <a href={tourLink(origin, tour.id)} target="_blank" rel="noopener">
              <ExternalLink aria-hidden="true" />
              Open the viewer
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </Button>
        </div>

        <Example title="Commands" code={commandsExample(exampleScene)} />
        <Example title="Events" code={EVENTS_EXAMPLE} />
        <Example
          title="From the page around an embed"
          hint={
            <>
              A page on another origin sends the same commands as messages. On this origin,{" "}
              <code className="font-mono text-foreground">frame.contentWindow.TourSDK</code> works directly.
            </>
          }
          code={embedExample(origin, exampleScene)}
        />

        {scenes.length > 0 && (
          <section aria-labelledby={scenesId} className="space-y-2">
            <h3 id={scenesId} className="text-sm font-medium">
              Scene ids
            </h3>
            <ul className="divide-y rounded-lg ring-1 ring-foreground/10">
              {scenes.map((scene) => (
                <li key={scene.id} className="flex items-center gap-2 py-1.5 pr-1.5 pl-3 text-xs">
                  <span className="min-w-0 flex-1 truncate">{scene.name}</span>
                  <code className="font-mono text-muted-foreground">{scene.id}</code>
                  <CopyButton text={scene.id} label={`id of ${scene.name}`} compact variant="ghost" />
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-xs text-pretty text-muted-foreground">
          Custom HTML, CSS and scripts inside the tour aren&apos;t supported. Run your code on your own page and drive
          the tour through the SDK.
        </p>
      </div>
    </div>
  );
}
