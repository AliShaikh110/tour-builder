# Tour Builder

A virtual tour builder in the style of CloudPano: 360° photos (scenes) linked by clickable
hotspots, built in an editor and played in a browser viewer. Accounts, tours and photos are
stored by the separate backend in `../photo-sphere-backend` (Express + PostgreSQL); see its
README to set it up.

The full brief is in [`docs/Virtual Tour Builder – Developer Specification.md`](docs/). It is
built phase by phase.

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Scaffold, dashboard, create-tour wizard, demo tour | Done |
| 2 | Editor shell and scenes | Done |
| 3 | Link hotspots | Done |
| 4 | Infospots, initial view, navigation | Done |
| 5 | Viewer, preview, settings | Done |
| 6 | Connect Scenes map | Done |
| 7 | Share, export/import, developer SDK | Done |

## Run it

Requires Node.js 22 or newer, and the backend running (by default on http://localhost:4000).

```bash
npm install
cp .env.example .env.local   # PowerShell: Copy-Item .env.example .env.local
npm run dev                  # http://localhost:3333
```

`.env.local` holds `NEXT_PUBLIC_API_URL`, the backend's address. Restart `npm run dev` after
changing it.

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates Next.js route types, then `tsc --noEmit` |
| `npm test` | Vitest unit tests (geometry, store, navigation, infospots, embeds, viewer config, map, export/import, share links, SDK, wizard) |

## Features

- **Accounts (`/login`, `/register`)**: email and password. The dashboard and the editor need a
  login (you come back to the page you asked for afterwards); the header shows your email and
  **Log out**. If the login expires, the app logs out and opens the login page.
- **Dashboard (`/`)**: your tours (24 at a time, then **Load more tours**), with thumbnail, title,
  scene count, last edit and a Draft badge. Each card's menu: Open editor, Open viewer, Export as
  .zip, Delete (deleting also removes its photos). **Import tour** reads a .zip made by Export
  (see below).
- **Create wizard**: seven steps (Title, Address, Category, Photos, Audience, Add-ons, Review),
  one question per screen. Enter moves forward, ▲/▼ move between steps, and completed steps in
  the progress bar can be revisited. Photos are checked for the 2:1 panorama ratio; other images
  become 2D scenes. **Create tour** saves a draft and opens the editor.
- **Start from demo tour**: downloads three panoramas of Cape Florida Light from the Photo Sphere
  Viewer demo data, uploads them to a new tour and links them both ways.
- **Saving**: every edit shows at once and is saved to the server about a second later (the top
  bar shows Saving… / Saved / Not saved). Closing the tab while a save is waiting asks first.
- **Editor (`/tours/[id]/edit`)**
  - Top bar: logo (back to tours), Editing/Viewing toggle, inline-editable title (Enter saves,
    Escape reverts), Share. In Viewing mode the editing tools hide and ‹ › arrows move between
    scenes.
  - Left rail: Scenes, Connect Scenes, Settings, Share, Developer.
  - Scenes panel: **Add Scenes** (JPG, PNG, WebP, several at once, or drop files on the panel or
    the viewer) with progress, **Fast Rename** (every name in one list, Enter moves down),
    drag-and-drop sorting (also with the keyboard: focus a handle, Space, arrow keys, Space), and
    each card's menu: hide from ribbon, set as cover, set north here, swap image (keeps hotspots),
    delete (with confirmation; hotspots in other scenes that lead to it are removed too).
  - Images that are not 2:1 trigger a warning with **Use as 2D scene**. 2D scenes show centred
    over a blurred copy of themselves.
  - Centre: the 360° viewer with zoom +/– and zoom %. Bottom toolbar: **Add Infospot**,
    **Link Hotspot**, **Set Initial View**, under ⋮ **Set Initial View Coming From…** and **Reset All**,
    and **Preview** (also in the top bar): the tour as visitors see it, full screen, Escape or ✕
    to close.
- **Link hotspots** (360° scenes)
  - **Link Hotspot** shows "Click to set a hotspot" and a Cancel button (Escape also cancels);
    the next click on the panorama places the hotspot and opens the **Edit Hotspot** panel.
  - Panel: destination scene grid (with search when there are more than four other scenes),
    **Enable automatic linkback**, "Use title of destination scene" or a custom title, four
    styles (floor disc, arrow in ring, arrow, glass sphere) with "Apply to all existing
    hotspots", and Scale / Opacity / Rotate sliders with number boxes. Changes preview live.
    **Save Hotspot** shows "Hotspot added"; **Delete** removes it.
  - Linkback puts the return hotspot in the destination at
    `yaw = hotspotYaw + π + (northOffsetB − northOffsetA)`, pitch −0.2, unless the destination
    already links back.
  - Saved hotspots show their title on hover. Click (or focus and press Enter) for **Go to
    scene / Edit hotspot / Delete hotspot** (delete has Undo); drag to move.
  - Closing the panel, switching panels or modes, or leaving the editor with unsaved changes asks
    "The changes were not saved. Do you want to continue?"
  - In Viewing mode, clicking a hotspot travels to its scene.
- **Infospots** (360° scenes)
  - **Add Infospot** works like Link Hotspot ("Click to set an infospot"), then opens **Edit
    Infospot**: icon (info, star, camera, speech bubble), Scale, Opacity, and one of five types:
    Hyperlink (preview text, URL, open in a new window), Short description (preview text), Image
    (preview text, upload, caption), Long description (title, text) and HTML pop-up (preview
    text, HTML). Only the chosen type's fields are saved; Save explains what is missing.
  - Hover shows the preview text. In the editor, click for **Preview / Edit / Delete infospot**
    (delete has Undo) or drag to move; in Viewing mode a click opens the pop-up for its type.
  - HTML pop-ups render in an `<iframe sandbox="allow-scripts allow-popups" srcdoc>`, never
    with `allow-same-origin`, so author HTML can't reach the tour's storage or page. YouTube and
    Vimeo players can't run inside that sandbox (nested frames inherit it, and an opaque origin
    breaks them), so their embed `<iframe>`s are lifted out and shown as their own player frame,
    rebuilt from the validated video id (`lib/embeds.ts`). To embed a video, paste its Share ›
    Embed code.
  - Uploaded images wider than 2048 px are downscaled. Images of unsaved or deleted infospots
    are deleted from the server (after the Undo window for deletes).
- **Initial views and navigation**
  - **Set Initial View** saves the current direction and zoom ("Initial view has been set").
  - **Set Initial View Coming From…** lists the scenes that link here; "Use current view" saves
    the view as the `arrivalView` of that scene's hotspot(s) to here. "Clear" removes it.
  - **Reset All** clears initial views and coming-from views, with Undo.
  - Travelling by hotspot faces: the hotspot's arrival view if set; else the target's initial
    view when "Always open scenes at their initial view" is on (Settings › Navigation, on by
    default); else the same compass
    heading (`targetYaw = currentYaw − northOffsetA + northOffsetB`, level pitch, same zoom).
    Opening a scene from the list, arrows or a URL uses its initial view (or yaw 0).

- **Connect Scenes** (editor rail): a top-down floor plane in place of the 360° view.
  - Drag scenes from the strip at the bottom onto the plane (or focus one and press Enter to drop
    it in the middle). Each tile is the panorama seen from above (floor in the centre, the
    scene's forward direction marked at the top of the rim), so floor lines can be lined up.
  - Select and drag to move; drag the handle above a selected tile to rotate (Shift snaps to
    15°). Keyboard: arrows move (Shift for bigger steps), R / Shift+R rotate, Delete takes a tile
    off the plane.
  - Tiles that touch or overlap are linked both ways automatically, as hotspots marked
    `source: 'map'` at `yaw = atan2(dx, −dy) − rotationA` and pitch −0.3; pulling tiles apart
    removes those links, and rotating re-aims them. Linking over hand-placed hotspots between the
    same two scenes asks first ("Replace hand-placed hotspots?").
  - Lines run centre to centre: solid for map links, dashed for hand-placed hotspots, with an
    arrow for each direction. The dot in the middle of a line removes that link both ways. A
    removed link between touching tiles stays removed until one of them is moved again.
  - Pan / Select modes, wheel or +/− zoom, Fit view, Grid toggle, Remove from plane, Clear plane,
    and undo/redo (50 steps, Ctrl+Z / Ctrl+Shift+Z). The header shows "x/y scenes placed · n
    links".
- **Viewer (`/tours/[id]`, `?scene=<sceneId>`) and embed (`/embed/[id]`)**
  - Photo Sphere Viewer's VirtualTourPlugin in client mode: one node per scene (image,
    name, thumbnail, `showInGallery = !hiddenFromRibbon`), hotspots as links drawn with the
    editor's glyphs, infospots as node markers. Plus GalleryPlugin (the thumbnail ribbon),
    AutorotatePlugin, CompassPlugin, GyroscopePlugin + StereoPlugin (VR) and VisibleRangePlugin
    (lock horizontal).
  - Controls: drag and zoom, ‹ › to the previous/next scene in the ribbon, show/hide the ribbon,
    share (system share sheet or copy link), full screen, VR (phones and tablets that support
    it), ambient sound mute, zoom +/–, hide controls, and a first-visit "Click and drag to
    explore" hint. For the tour's owner (or an admin) the page adds **Edit tour** and **Go to
    dashboard**; visitors and the embed get neither.
  - Visitors (and every embed) see only published tours; the owner can also open a draft.
  - The address keeps `?scene=` in step, so a copied link opens the same scene.
  - Hotspot travel uses the Phase 4 arrival rule; ribbon, arrows and links open scenes at
    their initial view. 2D scenes show flat over a blurred copy, with the ribbon still usable.
  - The compass reads true headings: its cone is turned by each scene's north point.
- **Settings** (editor rail): every tour setting on two tabs, with a small live preview.
  General: always show hotspot titles; thumbnail ribbon (start minimised, prevent minimising);
  hotspot click sound (synthesised, no file); ambient sound (upload, loops after the first tap);
  tiny planet intro; disable zoom when embedded. Navigation: auto-rotate (Low/Med/High, resume
  delay), compass, lock horizontal view, always open scenes at their initial view.

- **Share** (editor rail, or Share in the top bar)
  - **Published** switch: a draft's link only opens for you; a published tour opens for anyone
    with the link or the embed.
  - Link to `/tours/[id]` with Copy, an optional "Start at <current scene>" (`?scene=`), and Open
    the viewer.
  - `<iframe>` embed code for `/embed/[id]` (full width, 480 px high, fullscreen and VR allowed,
    lazy-loaded) with Copy, and a reminder of the "disable zoom when embedded" setting.
  - **Export as .zip**.
- **Developer** (editor rail): copyable SDK examples filled in with this tour's scene ids, the
  postMessage version for a page around an embed, and a list of scene ids.

## Export and import

**Export as .zip** (Share panel or a dashboard card) downloads `<tour-title>.zip`:

```text
tour.json          { format: "tour-builder", version: 1, exportedAt, tour, media }
media/<key>.<ext>  every panorama, thumbnail, infospot image and the ambient sound
```

`media` maps each media key the tour uses to `{ path, type }`. Files are stored uncompressed
(photos are already compressed). Export stops with a message if any file is missing on the server.

**Import tour** (dashboard) checks that the file is a version-1 Tour Builder export and that every
file the tour refers to is inside, creates a new tour, uploads the media into it, gives the
scenes, hotspots and infospots new ids (hotspot targets and the cover follow), fills in any
settings the file lacks with defaults, and saves it as a draft. Importing the same file twice
gives two independent tours. If the import fails part-way, the half-made tour and the files
already uploaded are deleted again.

## Developer SDK

`window.TourSDK` exists on the viewer (`/tours/[id]`) and the embed (`/embed/[id]`) once the first
scene is showing. It is not published in the editor or its previews. When it appears, `window`
gets a `toursdk:ready` event whose `detail` is the SDK.

```js
function onTourReady(run) {
  if (window.TourSDK) run(window.TourSDK);
  else window.addEventListener("toursdk:ready", (e) => run(e.detail), { once: true });
}

onTourReady((tour) => {
  tour.on("scene:loaded", (e) => console.log("Now in", e.name));
  tour.goToScene(tour.getScenes()[1].id);
});
```

Angles are radians: yaw 0 is the middle of the photo and grows to the right; pitch 0 is the
horizon, up is positive (±π/2 at most). Zoom runs from 0 (widest) to 100.

| Member | Returns | Notes |
| --- | --- | --- |
| `version` | `"1.0"` | |
| `getTour()` | `Tour` | A copy: scenes, hotspots, infospots, settings |
| `getScenes()` | `{ id, name, index, displayType, hiddenFromRibbon, initialView }[]` | Tour order |
| `getCurrentScene()` | scene or `null` | |
| `getHotspots(sceneId?)` | `{ id, targetSceneId, title, position, style }[]` | Current scene when no id |
| `getInfospots(sceneId?)` | `{ id, kind, label, position }[]` | Current scene when no id |
| `getCamera()` | `{ yaw, pitch, zoom }` or `null` | |
| `goToScene(id)` | `Promise<boolean>` | Opens at the scene's initial view. `false` for an unknown id, or if another navigation interrupts it |
| `next()`, `prev()` | `Promise<boolean>` | Ribbon order (hidden scenes skipped), wrapping around, like the ‹ › arrows |
| `lookAt({ yaw, pitch?, zoom? }, { animate? })` | `Promise<void>` | Animated unless `animate: false`. Yaw is normalised, pitch clamped, zoom clamped to 0–100. Rejects non-numbers |
| `setAutoRotate(on)` | | Starts or stops rotating. With the tour's auto-rotate setting on, rotation still resumes after the idle delay |
| `on(event, listener)` | `() => void` | Call the returned function to stop listening |
| `off(event, listener)` | | |

| Event | Data | Fires |
| --- | --- | --- |
| `scene:loaded` | `{ sceneId, name, via }` (`via` is `"hotspot"` or `"direct"`) | After a scene has loaded. The first scene loads before the SDK is published; read it with `getCurrentScene()` |
| `hotspot:click` | `{ sceneId, hotspotId, targetSceneId, title }` | A hotspot is clicked, or activated with Enter/Space, before the move |
| `infospot:open` | `{ sceneId, infospotId, kind, label }` | An infospot's pop-up opens |
| `camera:idle` | `{ sceneId, yaw, pitch, zoom }` | The camera has been still for 300 ms after moving. Not while auto-rotating; once when it stops |

A listener that throws is logged and doesn't stop the others.

### From the page around an embed

A page on another origin can't touch `iframe.contentWindow.TourSDK`, so the embed also answers
`postMessage` (a page on the same origin can use `contentWindow.TourSDK` directly):

```js
const frame = document.querySelector("iframe");
let lastId = 0;

function tour(method, ...args) {
  const id = ++lastId;
  return new Promise((resolve, reject) => {
    addEventListener("message", function reply(e) {
      if (e.source !== frame.contentWindow || e.data?.id !== id) return;
      removeEventListener("message", reply);
      e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.result);
    });
    frame.contentWindow.postMessage({ toursdk: 1, id, method, args }, "https://your-tour-host");
  });
}

addEventListener("message", (e) => {
  if (e.source === frame.contentWindow && e.data?.event) console.log(e.data.event, e.data.data);
});

await tour("goToScene", "<sceneId>");
```

- Request `{ toursdk: 1, id, method, args }`, reply `{ toursdk: 1, id, result }` or
  `{ toursdk: 1, id, error }`. Every method in the table except `on`/`off` can be called.
- Events arrive as `{ toursdk: 1, event, data }`, starting with `ready` (`{ version }`).

## How data is stored

- Everything lives on the backend (PostgreSQL tables `users`, `tours`, `media`, `scenes`,
  `hotspots`, `infospots`, and the uploaded files). `lib/api.ts` is the only code that calls it.
- The login token is kept in `localStorage` (`photo-sphere:token`); `lib/auth.ts` holds the
  logged-in user.
- An open tour lives in the Zustand store (`lib/store.ts`), so edits apply instantly.
  `lib/autosave.ts` watches the store and sends a changed tour to `PUT /api/tours/:id` 800 ms
  after the last change, one request at a time per tour.
- Files are uploaded with `POST /api/tours/:id/media`. A tour refers to a file by its media id
  (`mediaKey`, `thumbKey`, `imageKey`, `ambientSoundKey`); `lib/media-db.ts` knows each file's
  address. Ids of new scenes, hotspots and infospots are UUIDs made in the browser.
- Angles are stored in radians. The UI shows degrees.

## Stack

Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS 4, shadcn/ui
(Radix), lucide-react, sonner, Zustand, nanoid, dnd-kit, Photo Sphere Viewer 5 with
the markers, virtual-tour, gallery, autorotate, compass, gyroscope, stereo and visible-range
plugins, JSZip (export/import), Vitest. `three` is pinned to
the version `@photo-sphere-viewer/core` depends on, so only one copy is bundled.

The viewer is mounted directly from `@photo-sphere-viewer/core`
(`components/viewer/panorama-viewer.tsx`, loaded with `next/dynamic` and `ssr: false`) instead of
through react-photo-sphere-viewer. That wrapper never destroys its viewer on unmount (leaking a
WebGL context per visit), destroys it when a hidden route is shown again (Next.js keeps visited
routes alive with React Activity), and shares one global event emitter between instances. The
component here creates one viewer per mount, keeps it in a ref, destroys it on cleanup, and loads
scenes with `setPanorama`.

## Limits

- Uploads are limited by the backend's `MAX_UPLOAD_MB` (25 MB by default) per file.
- Two tabs editing the same tour at once: the last save wins.
- There is no admin page in the app. Admins use the API (`/api/admin/...`, see the backend
  README) and can open any tour by its link.
- Custom HTML, CSS and scripts that run inside a published tour (CloudPano's Developer feature)
  aren't included. The only author code is the HTML infospot, which stays in its sandbox. Use
  the SDK from your own page instead.
- On small screens the ribbon opens as Photo Sphere Viewer's full-screen scene picker, so it
  starts closed there.
