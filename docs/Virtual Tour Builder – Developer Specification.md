# Virtual Tour Builder – Developer Specification

Oct 22, 2026 · @OnlyEducation

What to build: a CloudPano-style virtual tour — 360° photos (scenes) linked by clickable hotspots, built in an editor and played in a browser viewer. Based on a hands-on review of CloudPano's editor.

## Feature list (quick view)

| # | Feature | What it lets you do |
| --- | --- | --- |
| 1 | Create-tour wizard | Title → Address → Category → Photos → Audience → Add-ons → Review |
| 2 | Scenes | Upload 360° / 2D / spin photos and videos; rename, reorder, swap, hide, delete |
| 3 | Link hotspots | Clickable arrows that move visitors between scenes; style, size, title, auto return link |
| 4 | Connect Scenes map | Link scenes by placing them on a top-down floor plane |
| 5 | Infospots | Info pins: web link, short text, image, long text, HTML / YouTube |
| 6 | Initial view and navigation | Start angle per scene; visitor keeps facing the same way between scenes (north point) |
| 7 | Viewer | Drag, zoom, arrows, thumbnail ribbon, fullscreen, VR, auto-rotate, compass |
| 8 | Tour settings | Hotspot titles, ribbon options, sounds, tiny planet, privacy, analytics, custom domain |
| 9 | Share and publish | Public link, embed code, social sharing; Street View / Zillow exports (paid in CloudPano) |
| 10 | Developer SDK | Custom HTML / JS / CSS, commands (goToScene, lookAt) and events |

Example: a school builds "Campus Tour" → uploads 6 photos (2) → links Gate → Library → Lab (3) → adds an "Admissions open" pin (5) → sets each start angle (6) → shares the link (9).

## Master prompt for Claude Code

Copy the block below into Claude Code in an empty project folder. It builds the frontend only (Next.js + React Photo Sphere Viewer), saving tours in the browser. Defaults chosen: TypeScript, Tailwind + shadcn/ui, Zustand, IndexedDB — change them in section 1 if you prefer others.

```markdown
# MASTER PROMPT — Virtual Tour Builder (frontend only)

You are a senior frontend engineer. Build a frontend-only virtual tour builder (similar to CloudPano) in this folder. Work phase by phase. At the end of each phase, stop, summarise what changed and tell me exactly what to click to check it.

## 1. Stack (use the latest stable versions; check npm before installing)
- Next.js (App Router, TypeScript), React, Tailwind CSS, shadcn/ui, lucide-react icons, sonner toasts, dnd-kit for drag-and-drop.
- 360 viewer: react-photo-sphere-viewer + @photo-sphere-viewer/core (v5, >= 5.13.1).
- Photo Sphere Viewer plugins (same version as core, import each plugin's index.css): markers-plugin, virtual-tour-plugin, gallery-plugin, autorotate-plugin, compass-plugin, gyroscope-plugin, stereo-plugin, visible-range-plugin.
- State: zustand with persist (tour data in localStorage).
- Media: image Blobs in IndexedDB (idb-keyval); create object URLs at runtime and revoke them on unmount.
- Export/import: jszip. Unit tests: vitest. IDs: nanoid.

## 2. Hard rules
- No backend, no API routes, no database, no login. Everything runs in the browser.
- Photo Sphere Viewer needs window: load every viewer component with next/dynamic and ssr: false inside a "use client" component.
- Keep the viewer instance in a ref (onReady). Never re-create the viewer on each render; memoise the plugins array; switch scenes with setPanorama or the VirtualTour plugin.
- Angles are stored in radians; the UI shows degrees.
- Accessible (keyboard, focus rings, aria labels) and responsive (works at 375 px wide). Dark editor UI.
- After every phase run: npm run lint, npx tsc --noEmit, npm test, npm run build. Fix every error before moving on.

## 3. Routes
- /  Dashboard: tour cards (thumbnail, title, scene count, date, Draft badge), "+ Create", "Start from demo tour", "Import tour".
- /tours/[tourId]/edit  Editor.
- /tours/[tourId]  Full-screen viewer (supports ?scene=<sceneId>).
- /embed/[tourId]  Viewer without owner buttons, for iframes.

## 4. Data model (lib/types.ts)
- Tour: id, title, category, address?, status ('draft' | 'published'), createdAt, updatedAt, coverSceneId?, sceneOrder: string[], scenes: Record<string, Scene>, settings: TourSettings.
- Scene: id, name, mediaKey, thumbKey, displayType ('360' | '2d'), width, height, hiddenFromRibbon, initialView {yaw, pitch, zoom} | null, northOffset, mapPos {x, y, rotation} | null, hotspots: LinkHotspot[], infospots: Infospot[].
- LinkHotspot: id, targetSceneId, position {yaw, pitch}, style ('disc' | 'arrow-ring' | 'arrow' | 'sphere'), title (null = use target scene name), scale (0.5-2), opacity (0-1), rotation (deg), arrivalView? {yaw, pitch, zoom}, source ('manual' | 'map').
- Infospot: id, position {yaw, pitch}, icon ('info' | 'star' | 'camera' | 'bubble'), scale, opacity, kind ('link' | 'short' | 'image' | 'long' | 'html'), previewText, url?, newWindow?, imageKey?, caption?, title?, description?, html?.
- TourSettings: showHotspotTitles, ribbon {enabled, startMinimized, lockOpen}, autoRotate {enabled, speed ('low' | 'med' | 'high'), resumeDelayMs}, showCompass, lockHorizontal, enforceInitialViews, tinyPlanetIntro, disableZoomInEmbed, hotspotClickSound, ambientSoundKey?.

## 5. Phases and features

### Phase 1 - Scaffold, dashboard, create wizard
- Scaffold, layout, zustand store, IndexedDB helpers, types.
- Create wizard modal, one question per screen: Title (required) > Address (optional text, "This tour has no address") > Category (12 tiles: Real Estate, Drone 360, Apartments, Auto & RV, Arts & Museums, Education, Hotels & Resorts, Construction, Dining, Retail, Parks & Rec, Other) > Photos (drag-and-drop or "skip - add media later") > Audience (For me / For a client; clicking a card advances) > Add-ons ("Floor plans - coming soon", "no thanks") > Review (summary table + "Create tour").
- Progress bar of 7 steps, tick on completed steps, completed steps clickable, Enter = next, up/down buttons.
- Create saves a draft and opens the editor.
- Demo tour: 3 panoramas from https://photo-sphere-viewer-data.netlify.app/assets/ saved into IndexedDB, already linked.

### Phase 2 - Editor shell and scenes
- Layout: top bar (logo, Editing/Viewing toggle, inline-editable title, Preview, Share); left icon rail (Scenes, Connect Scenes, Settings, Share, Developer); side panel; centre 360 viewer with zoom +/- and zoom %; bottom toolbar (Add Infospot, Link Hotspot, Set Initial View, more menu with "Set Initial View Coming From..." and "Reset All", Preview).
- Scenes panel: + Add Scenes (jpg, jpeg, png, webp, multiple), Fast Rename (all names in one list), drag to sort, scene card with thumbnail, EDITING badge and menu (Hide from ribbon, Set as cover, Set north here, Swap image, Delete with confirm).
- On upload: read size; if not 2:1, warn and offer "Use as 2D scene"; make a 512 px thumbnail with canvas; save blobs to IndexedDB; show progress.
- Deleting a scene also removes hotspots that point to it.
- 2D scenes show as a centred image over a blurred copy of itself.

### Phase 3 - Link hotspots (connectivity)
- Link Hotspot: banner "Click to set a hotspot", other buttons disabled, Cancel shown. The next click on the panorama (use the viewer click event's yaw/pitch) places a marker and opens the Edit Hotspot panel.
- Panel: 4 style presets, "Apply to all existing hotspots", "Use title of destination scene" + title field, Scale / Opacity / Rotate sliders with number inputs, destination scene grid with search, "Enable automatic linkback", Delete and Save.
- Save shows toast "Hotspot added". Linkback adds the return hotspot in the target scene at yaw = hotspotYaw + PI + (northOffsetB - northOffsetA), pitch = -0.2, normalised to [0, 2*PI).
- Saved hotspot: hover shows its title; click opens a menu (Go to scene, Edit, Delete); drag moves it.
- Unsaved-changes guard on closing a panel: "The changes were not saved. Do you want to continue?"

### Phase 4 - Infospots, initial view, navigation
- Add Infospot: same click-to-place flow, then Edit Infospot panel: icon picker, scale, opacity and an accordion of 5 types: Hyperlink (preview text, URL, open in new window), Short description (preview text), Image (preview text, upload, caption), Long description (title, text), HTML pop-up (preview text, HTML).
- In the viewer: hover shows preview text; click opens a modal for that type. HTML renders only in an iframe with sandbox="allow-scripts allow-popups" and srcdoc (never allow-same-origin); YouTube embeds must work.
- Set Initial View saves the current yaw/pitch/zoom, toast "Initial view has been set". "Coming From..." picks a source scene and saves arrivalView on that scene's hotspot. Reset All clears initial views.
- Arrival rule when travelling by hotspot: use hotspot.arrivalView if set; else if enforceInitialViews and the target has initialView, use it; else keep heading: targetYaw = currentYaw - northOffsetA + northOffsetB. Arriving by ribbon, arrows or URL always uses initialView (or yaw 0).

### Phase 5 - Viewer, preview and settings
- Viewer uses VirtualTourPlugin in client mode (nodes from the store: id, panorama URL, name, thumbnail, showInGallery = !hiddenFromRibbon, links from hotspots with position {yaw, pitch}, infospots as node markers) + GalleryPlugin (ribbon) + AutorotatePlugin + CompassPlugin + GyroscopePlugin + StereoPlugin (VR) + VisibleRangePlugin (lock horizontal).
- Controls: drag and zoom, previous/next arrows, ribbon minimise, fullscreen, VR, hide controls, share, first-visit hint "Click and drag to explore".
- Settings panel (General and Navigation tabs) for every TourSettings field, applied live in a small preview.
- Preview overlay inside the editor with Close.

### Phase 6 - Connect Scenes map (top-down)
- SVG plane: drag scene tiles (round thumbnails) from a bottom strip onto the plane; drag a ring handle to rotate; Pan / Select modes; Fit view; Grid toggle; Clear plane; undo/redo (50 steps).
- Tiles that touch or overlap are linked both ways automatically; draw lines between linked centres (solid = map link, dashed = manual hotspot); clicking a line deletes the link both ways.
- Generated hotspot yaw on A towards B = atan2(dx, -dy) - rotationA, normalised; pitch -0.3; source 'map'. Warn before replacing manual hotspots between the same two scenes.
- Header: "x/y scenes placed - n links".

### Phase 7 - Share, export, developer SDK
- Share panel: copy link (/tours/[id]), copy iframe embed code (/embed/[id]), note "Saved in this browser only - export to move it".
- Export a tour as .zip (tour.json + media); import a .zip on the dashboard with new ids.
- window.TourSDK on viewer pages: getTour, getScenes, getCurrentScene, getHotspots(sceneId), goToScene(id), next(), prev(), lookAt({yaw, pitch}), setAutoRotate(on), on(event, cb) / off; events scene:loaded, hotspot:click, infospot:open, camera:idle. Document it in the README.

## 6. Folder structure
- app/: page.tsx, tours/[tourId]/edit/page.tsx, tours/[tourId]/page.tsx, embed/[tourId]/page.tsx
- components/: dashboard, wizard, editor, viewer, map, ui
- lib/: types.ts, store.ts, media-db.ts, image.ts, geometry.ts, viewer-config.ts, sdk.ts, export.ts, __tests__/

## 7. Tests (vitest)
- geometry: angle normalising, linkback yaw, heading carry-over, map yaw.
- store: create tour, delete scene removes dependent hotspots, linkback, export/import round trip.

## 8. Out of scope for now
Backend, login, payments, client billing, real publishing, analytics, Zillow / Street View / MLS exports, floor-plan drawing, spin scenes, 360 video.

## 9. Definition of done
- Lint, type check, tests and build all pass.
- I can create a tour with the wizard, upload 3 panoramas, link them both ways, add one infospot of each type, set initial views, preview the tour, move between scenes by hotspot, ribbon and arrows, reload the page and still see everything.
- README explains how to run it, the features, the SDK and the limits.

Start with Phase 1. First show me a plan for Phase 1 in under 15 lines, then build it.
```

Versions checked 22 Oct 2026: latest Next.js release post is [16.4 (6 Oct 2026)](https://nextjs.org/blog); [react-photo-sphere-viewer](https://github.com/Elius94/react-photo-sphere-viewer) (MIT) needs `@photo-sphere-viewer/core` ≥ 5.13.1 installed separately and supports the Markers and Virtual Tour plugins.

## At a glance

&#91;embedded content: proposed architecture · 2 apps, 1 API, 3 back-end parts\]

Everything the owner builds is saved as one tour record (highlighted); the viewer loads that record plus the images from the CDN. This architecture is a proposal for your build, not CloudPano's internal design.

## Data model

Five records hold everything: **Tour → Scenes → Hotspots / Infospots**, plus **Tour settings**. Fields marked *(observed)* were read from CloudPano's live tour object; the rest are recommended.

| Record | Key fields | Notes |
| --- | --- | --- |
| **Tour** | `id` / `shortId` *(observed, e.g. FRY2xUBXt)*, `title` *(observed)*, `theme` *(observed: classic)*, `status` *(observed: locked)*, `sceneCount` *(observed)*, `category`, `address`, `privacy`, `ownerId`, `createdAt` | `shortId` makes the share URL `/tours/<shortId>` |
| **Scene** | `id`, `name`, `index` (order), `thumbUrl`, `isSpin`, `isVideo` *(all observed)*; `mediaUrl`, `displayType` (360 / 2D), `hiddenFromRibbon`, `initialView {h, v, fov}`, `northOffset`, `floorPlan {x, y, rotation, floorId}`, `depthMapUrl` | `index` drives ribbon and arrow order |
| **Hotspot (link)** | `id`, `type` *(observed: floating)*, `title` *(observed)*, `targetSceneId` *(observed)*, `position {x, y, z}` *(observed, a point on a sphere of radius \~5000)*; `style`, `scale`, `opacity`, `rotation`, `arrivalView` | Belongs to the source scene; one-way |
| **Infospot** | `id`, `position`, `icon`, `scale`, `opacity`, `kind` (hyperlink / short / image / thorough / html), `previewText`, `url`, `newWindow`, `imageUrl`, `caption`, `title`, `description`, `html` | Only the fields of its `kind` are filled |
| **Tour settings** | `showHotspotTitles`, `ribbon {enabled, startMinimized, lockOpen}`, `autoRotate {enabled, speed}`, `tinyPlanet`, `lockHorizontal`, `showCompass`, `enforceInitialViews`, `ambientSoundUrl`, `hotspotClickSound`, `gaId`, `customDomain` | One per tour |

The camera is described by **h** (horizontal angle, 0–360°), **v** (vertical angle) and **fov** (field of view = zoom), e.g. `{h: 145.5, v: 0, fov: 84}` *(observed)*.

```json
{
  "id": "FRY2xUBXt",
  "title": "My Tour Test 01",
  "theme": "classic",
  "scenes": [
    {
      "id": "jr92szQR4",
      "name": "Courtyard",
      "index": 0,
      "displayType": "360",
      "mediaUrl": "https://cdn.example.com/t/FRY2xUBXt/courtyard.jpg",
      "initialView": { "h": 145.5, "v": 0, "fov": 84 },
      "northOffset": 0,
      "hotspots": [
        { "id": "flsqqr4W-", "type": "floating", "targetSceneId": "sKByrKxYK",
          "position": { "x": 73.9, "y": -300.3, "z": -5037.8 }, "scale": 1, "opacity": 1 }
      ],
      "infospots": []
    },
    { "id": "sKByrKxYK", "name": "Riverside", "index": 1, "displayType": "2D", "hotspots": [], "infospots": [] }
  ],
  "settings": { "autoRotate": { "enabled": true, "speed": "med" }, "ribbon": { "enabled": true } }
}
```

In this example the courtyard links to the riverside, but not back — exactly the state of the test tour, since auto-linkback could not be enabled.

## Feature 0 — Create-tour wizard

Entry: **+ Create** → pick **Virtual Tour** → **Build a Virtual Tour** → a 7-step pop-up, one question per screen, with a progress bar, Enter to continue and ▲ / ▼ to move.

| Step | Input | Required |
| --- | --- | --- |
| 1 Title | Text box (rename any time) | Yes |
| 2 Address | Address search + map, or "This tour has no address" | No |
| 3 Category | 12 tiles (Real Estate, Education, Hotels & Resorts, Other…) | Yes |
| 4 Photos | Drag-and-drop 360 / 2D photos and videos, or "skip — add media later" | No |
| 5 Audience | "For me" or "For a client" (client billing) | Yes |
| 6 Add-ons | Paid floor plans, or "no thanks" | No |
| 7 Review | Summary table → **Create tour →** opens the editor (about 4 s) | Yes |

Save the tour as a **draft** on Create; everything stays editable later.

## Feature 1 — Scenes

A tour is an ordered list of scenes; each scene is one image or video the visitor stands inside. Build these functions (all observed in CloudPano's **Edit Scenes** panel):

| Function | What the user does | What the system must do |
| --- | --- | --- |
| Add 360° scene | **+ Add Scenes → Choose 360 Scene** | Accept .jpg, .png, .tiff, .mp4, .mov; video up to 10 min; store, make a thumbnail, add to the end of the list |
| Add 2D scene | "Looking to upload something different than 360?" → **Choose 2D Scene** | Same formats; show as a flat image/video, not a sphere |
| Add spin scene | **Choose Spin Scene** | Accept .mp4, .mov of an object turning; play as a drag-to-rotate spin |
| Select scene | Click a scene card | Load it in the viewer; mark card **EDITING** |
| Fast Rename | **Fast Rename** button | Edit all scene titles in one list (default title = file name) |
| Sort | **Sort Scenes** button, or the ⇅ drag handle on a card | Save the new order; the order drives the visitor's thumbnail strip |
| Hide from Ribbon | Scene card **⋮** menu | Keep the scene in the tour but hide its thumbnail from the visitor's scene strip (reachable only via hotspots) |
| Add Depthmap | Scene card **⋮** menu | Attach a depth image to the scene (purpose not tested; likely for 3D/dollhouse effects) |
| Swap Scene | Scene card **⋮** menu | Replace the image but keep the scene's hotspots and settings |
| Delete Scene | Scene card **⋮** menu (red) | Ask for confirmation; also remove hotspots that point to it |

**Developer notes**

- 360° photos are **equirectangular** images (a flat 2:1 picture that wraps into a sphere). Validate the 2:1 ratio on upload and warn if it is wrong.
- Create several sizes per image (thumbnail, mobile, full) so tours load fast on phones.
- Each scene card also showed a small round **N** badge in CloudPano; it had no tooltip, but Settings → Navigation describes setting a scene's "North Point" by clicking, so it is most likely that (see Feature 4).

## Feature 2 — Connectivity (linking scenes)

Connectivity is what turns separate photos into a walk-through. CloudPano offers two ways to make the same thing — a **link hotspot** (a clickable marker in scene A that moves the visitor to scene B). Both were tested on "My Tour Test 01" (2 scenes).

### Way 1: Link Hotspot (one at a time)

1. Click **Link Hotspot** in the bottom toolbar → a banner says "Click to set a hotspot"; other buttons grey out and **Cancel** appears.
2. Click a spot in the 360° view (e.g. the end of a walkway). A marker appears and the **Edit Hotspot** side panel opens.
3. Set it up in the panel:
   - **Style:** 4 preset icons (floor disc, arrow in ring, plain arrow, glass sphere) or **Custom style → Open Library** (your own uploads, or a Community library of Sounds and Music, Images, Hotspot Icons, Logos, Nadirs).
   - **Apply to all existing hotspots** (copy this style to every hotspot).
   - **Title:** auto-filled from the destination scene when "Use Title of Destination Scene" is ticked; otherwise type one.
   - **Scale**, **Opacity** (0–1) and **Rotate hotspot** (degrees) sliders with number boxes.
   - **Destination:** "Click on any image below to attach this hotspot" — thumbnails of the other scenes, with a search box ("Sort scenes by title").
   - **Enable Automatic Linkback Generation:** also create the return hotspot in scene B. (In testing on the Free plan this box would not switch on.)
4. **Save Hotspot** → toast "Hotspot successfully added." **Delete Hotspot** removes it.
5. Later, hovering the marker shows "Click to Edit or Hold to Drag" with actions **Go to scene**, **Edit Hotspot**, **Delete Hotspot**.

Closing a panel with unsaved changes shows a guard: "The changes were not saved. Do you want to continue?" (No / Yes).

### Way 2: Connect Scenes — top-down map (BETA)

A bird's-eye **floor plane** where each scene is a round tile (the 360° photo seen from above). You connect a tour by **arranging** it instead of placing hotspots one by one. A pop-up warns: "Editing here will modify any scene connections you have already made."

| Element | Behaviour to build |
| --- | --- |
| Header | "Top Down View · 2/2 pano · 0 links" (scenes placed, links made) |
| Toolbar | Undo / Redo, **Pan**, **Select**, **Add floor**, **Remove scene**, **Fit view**, **Grid** toggle, **Clear plane**, **Floor / Floating** mode |
| Scene strip (bottom) | Drag a scene onto the plane; tiles show **Placed** / **In view**; counter "0 of 2 scenes unplaced" |
| Placing | Put each scene where it was taken; drag its ring to rotate until floor lines match neighbours |
| Auto-connect | **Tiles that touch are connected** (both ways). Pull them apart and the link goes |
| Lines | Each line = a way out, arrow at the far end; **solid = walkable**, **grey = not**; **dashed = a hotspot placed by hand** (connecting here replaces it); click a line to delete it both ways |
| Multi-select | Select + drag a box, Shift-click to add; turning a selection keeps the angles inside it |
| Blend slider | 0–100% see-through, only to help judge alignment (default 10%) |
| North needle | Drag "N" to set true north; drives every compass and Google Street View heading; each floor can have its own |
| Live preview | Small 360° view in the corner with full-screen button |

**Developer note:** store links as data on the *source* scene (scene A → B), so one-way links are possible; "linkback" simply creates the B → A record too. Way 2 needs each scene's **position (x, y)**, **rotation** and **floor** saved, and computes links from tile overlap.

## Feature 3 — Infospots

An **infospot** is a pin in a scene that shows information instead of moving the visitor. Flow: **Add Infospot** → click a spot in the view → **Edit Infospot** panel → **Save Infospot**.

| Setting | Options observed |
| --- | --- |
| Icon | \~10 preset icons (stars, "i" circles, speech bubble, camera) or **Custom style → Open Library** |
| Size / look | **Scale** and **Opacity** sliders |
| Type: **Hyperlink** | Preview Text, Hyperlink URL, "Open link in a new window" |
| Type: **Short Description** | Preview Text (shown on hover/tap) |
| Type: **Image** | Preview Text, Upload Custom Image, Caption |
| Type: **Thorough Description** | Title, Description (longer pop-up text) |
| Type: **Pop-up HTML Window** | Preview Text, HTML (help links for writing HTML and embedding YouTube) |
| Actions on a saved pin | **Preview Infospot**, **Edit Infospot**, **Delete Infospot** |

**Developer note:** the Pop-up HTML type runs user-supplied code in your viewer — sanitise it or show it inside a sandboxed iframe (a locked-down mini web page) to block harmful scripts.

## Feature 4 — Initial view and navigation logic

The **initial view** is the direction a scene faces when it opens.

- **Set Initial View** (bottom toolbar): saves the current camera angle as the scene's start view → toast "Initial view has been set".
- **⋮** next to it reveals **Set Initial View Coming From…** (a different start angle depending on which scene the visitor came from) and **Reset All**.
- **Compass rule (Settings → Navigation):** when a visitor leaves a scene facing, say, north-west, they arrive at the next scene also facing north-west, for a natural feeling of walking. This needs each scene's **North Point** calibrated once (the round **N** badge on scene cards appears to be this).
- **Selectively Enforce Initial Views** (checkbox, formerly "Hybrid Mode"): initial views are used only when arriving from a thumbnail or a direct URL, not via hotspots.
- Viewer setting **Lock Horizontal View** stops tilting up and down.

**Developer note:** store per scene `initialView {yaw, pitch, fov}` (yaw = left-right angle, pitch = up-down angle, fov = zoom) plus `northOffset`; store per link an optional `arrivalView`. On hotspot travel compute: arrival yaw = departure compass heading − target northOffset, unless an initial view is enforced.

## Feature 5 — Viewer (what visitors use)

The viewer (also called the player) is the public page that plays the tour. Observed in **Preview** and the embedded preview in Settings.

**Controls on screen**

| Control | Behaviour |
| --- | --- |
| Drag / swipe | Look around; first-time hint "Click and drag mouse to explore" |
| Scroll / pinch, **+ / –** | Zoom in and out |
| Link hotspot | Click → jump to the linked scene |
| Infospot | Hover/tap → preview text; click → full content |
| **‹ ›** arrows | Previous / next scene in list order |
| Thumbnail ribbon | Strip of scenes at the bottom; current one highlighted; **⌄** minimises it |
| Right-side buttons | **Hide controls**, **Edit Tour** (owner only), **Go to Dashboard** (owner only), **Share**, **Fullscreen**, **Virtual Reality** (VR headset / phone cardboard mode) |
| Footer | "Powered by CloudPano" watermark (removed on paid plans) |
| 2D scene | A flat image shown centred over a blurred copy of itself |

**Tour-level viewer settings to support** (Settings → General → Tour Display Settings)

- Always show hotspot titles
- Thumbnails ribbon on/off (off = "No Ribbon" theme), start minimised, prevent minimising
- Play sound when clicking a hotspot; ambient soundscape (background audio)
- Display tour as **Tiny Planet** (a round "little world" view) and start with a tiny-planet zoom-in
- Disable zoom when embedded in another site (so the page can still scroll)
- Lock horizontal view
- **Auto-rotate** each scene until the visitor interacts, resuming after a pause; speed Low / Med / High / Custom; "Nudge toward the mouse pointer"
- Show compass; auto-hide hotspots when the scene is clicked; hide the Share button; show an auto-playback button
- Privacy level (e.g. Public — community and search engines), Google Analytics ID, custom domain

**Per-scene display type:** the 360 icon at the top-right of the editor ("Change Scene Display Type") switches a scene between **2D** and **360** (plus a third option, not identified).

**Developer hooks (CloudPano's own SDK, for reference):** every published tour exposes a global `CloudPano` object (version 1.0) with `getTour`, `getScenes`, `getCurrentScene`, `getHotspots`, `getCamera`, `goToScene`, `nextScene`, `prevScene`, `lookAt({h, v})`, `lookAtSpot`, `clickSpot`, `setAutoRotate`, `on/off` events (`scene:loaded`, `hotspot:click`, `camera:idle`) and `data.set` (values saved across visitors). Owners can add their own `index.html`, `script.js` and `styles.css` that run in the published tour. Copying this idea gives your product an API from day one.

## Recommended tech stack and build plan

Recommendation: build the viewer on **Photo Sphere Viewer v5** (free, MIT licence) — its official plugins already cover most CloudPano viewer features. These are suggestions, not what CloudPano uses (CloudPano's internals are not public).

| Layer | Recommendation | Why |
| --- | --- | --- |
| 360° viewer | [Photo Sphere Viewer v5](https://photo-sphere-viewer.js.org/plugins/) + plugins: Virtual Tour, Markers, Gallery, Autorotate, Compass, Gyroscope, Stereo (VR), Video, Plan | One plugin per CloudPano feature: links, infospots, thumbnail ribbon, auto-rotate, compass, phone tilt, VR, 360 video, floor plan |
| Tour linking | [Virtual Tour plugin](https://photo-sphere-viewer.js.org/plugins/virtual-tour.html) | Nodes (scenes) with `links {nodeId, position {yaw, pitch}}`, fade transitions, preloading, `node-changed` event |
| Large images | Equirectangular **tiles** adapter | Loads a low-res image first, then sharp tiles — fast on phones |
| Alternative viewer | [Pannellum 2.5](https://pannellum.org/documentation/examples/tour) | Simple JSON tours (`scenes`, `hotSpots` with `sceneId`, `targetYaw`); fewer features |
| Avoid for new work | [Marzipano](https://github.com/google/marzipano) | Repository archived (read-only) on 20 Apr 2026 |
| Editor front end | React or Vue single-page app | Panels, drag-and-drop lists, top-down canvas |
| Top-down "Connect Scenes" | 2D canvas library (e.g. Konva or plain SVG) | Drag, rotate and overlap-test round tiles |
| Back end / API | Node.js or Python REST API + PostgreSQL | Stores the data model above (JSON columns suit settings) |
| Media | Object storage (e.g. S3-compatible) + CDN; image worker (e.g. sharp / libvips) | Thumbnails, resized and tiled panoramas |
| Viewer embed | Public page `/tours/<shortId>` + `<iframe>` embed code | Matches CloudPano's share link and embed |

**Build plan (MVP first)**

1. **MVP viewer:** load a tour JSON, show 360° scenes, drag/zoom, thumbnail ribbon, next/previous arrows, fullscreen.
2. **MVP editor:** create tour, upload scenes, rename, reorder, delete, set initial view.
3. **Connectivity:** Link Hotspot placement panel (style, scale, opacity, rotate, title, destination), save/edit/drag/delete, auto-linkback.
4. **Infospots:** the five types, with HTML shown in a sandboxed iframe.
5. **Viewer settings:** auto-rotate, compass + north calibration, heading carry-over, hotspot titles, ribbon options, sound, tiny planet.
6. **Share:** public link, embed code, privacy level, analytics.
7. **Advanced:** top-down Connect Scenes map, 2D and spin scenes, VR, floor plans, SDK (`getScenes`, `goToScene`, events).

## Acceptance checklist

Tick each item when it works on desktop **and** phone.

- [ ] Uploading a 2:1 panorama creates a scene with a thumbnail; a non-2:1 image shows a warning
- [ ] Dragging a scene card changes the order in the editor, the ribbon and the arrows
- [ ] Link Hotspot: click in view → panel opens → choose destination → Save shows "Hotspot successfully added"
- [ ] With auto-linkback on, saving A → B also creates B → A
- [ ] Hotspot can be dragged to a new spot, edited and deleted; deleting a scene removes hotspots pointing to it
- [ ] Each of the 5 infospot types saves and displays correctly; HTML cannot run scripts outside its sandbox
- [ ] Closing a panel with unsaved changes asks "Do you want to continue?"
- [ ] Set Initial View: reopening the scene from a thumbnail faces the saved angle
- [ ] Walking A → B keeps the compass heading (unless initial views are enforced)
- [ ] Viewer: drag, zoom, arrows, ribbon minimise, fullscreen, VR, hide controls all work
- [ ] Auto-rotate stops on touch and resumes after a few seconds
- [ ] Share link `/tours/<id>` and iframe embed both load; embed does not trap page scrolling when that setting is on
- [ ] A 10-scene tour opens its first scene in under 3 seconds on 4G (target to agree with your team)

## Glossary

| Word | Simple meaning |
| --- | --- |
| Scene | One 360° photo or video the visitor stands inside |
| Equirectangular | The flat 2:1 picture format that wraps into a 360° sphere |
| Hotspot / link | A clickable marker that moves the visitor to another scene |
| Linkback | The automatic return link from scene B back to scene A |
| Infospot | A clickable marker that shows text, an image, a link or HTML |
| Initial view | The direction a scene faces when it opens |
| Yaw / h, pitch / v | Left-right angle and up-down angle of the camera |
| FOV (field of view) | How much is visible; smaller = zoomed in |
| North Point / north offset | Which way is real north in a scene, used to keep direction between scenes |
| Tiny Planet | A round "little world" view of a 360° photo |
| Ribbon | The strip of scene thumbnails at the bottom of the viewer |
| SDK / API | Ready-made commands other programs use to control the tour |
| Embed / iframe | Showing the tour inside another website |
| CDN | Servers worldwide that deliver images quickly |
| Sandbox | A locked-down area where untrusted code cannot do harm |
| MVP | Minimum viable product: the smallest version worth releasing |

## Open questions

- **Auto-linkback** would not switch on during testing (Free plan). Unknown whether it is a paid feature or a bug.
- Clicking a hotspot in Preview could not be confirmed because auto-rotate kept moving it; scene switching by arrows and thumbnails was confirmed.
- The third option in "Change Scene Display Type" and the exact purpose of **Add Depthmap** were not identified.
- Viewer performance targets, file-size limits for photos, and which features will be paid in *your* product are decisions for your team.

## Sources

- CloudPano web app, tested hands-on on 22 Oct 2026 (Free plan): tour editor, Edit Hotspot / Edit Infospot panels, Connect Scenes help text, Settings → General and Navigation, Developer panel and live `CloudPano` SDK object (version 1.0) of tour FRY2xUBXt.
- [Photo Sphere Viewer — Virtual Tour plugin](https://photo-sphere-viewer.js.org/plugins/virtual-tour.html) and [plugins list](https://photo-sphere-viewer.js.org/plugins/) (v5 docs, MIT licence), read 22 Oct 2026.
- [Pannellum — tour example](https://pannellum.org/documentation/examples/tour) (v2.5.7 in the example), read 22 Oct 2026.
- [google/marzipano on GitHub](https://github.com/google/marzipano) — archived 20 Apr 2026, read 22 Oct 2026.

Check library versions and licences on these pages before you start building; they change over time.
