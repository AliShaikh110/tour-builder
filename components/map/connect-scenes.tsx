"use client";

import {
  Grid3x3,
  Hand,
  Maximize2,
  MousePointer2,
  Redo2,
  RotateCcw,
  RotateCw,
  SquareX,
  Trash2,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { plural } from "@/lib/format";
import { degToRad, normalizeAngle, radToDeg } from "@/lib/geometry";
import {
  TILE_RADIUS,
  capturePlane,
  clearPlane,
  manualConflicts,
  placeOnPlane,
  planeLinks,
  removeFromPlane,
  restorePlane,
  rotateOnPlane,
  unlinkScenes,
  type PlaneSnapshot,
} from "@/lib/map";
import { useTourStore } from "@/lib/store";
import type { MapPosition, Tour } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PlaneTile } from "./plane-tile";
import { SceneStrip } from "./scene-strip";

const HISTORY_LIMIT = 50;
const GRID = 40;
const NOTICE_KEY = "tour-builder:connect-notice-seen";

type View = { x: number; y: number; k: number };
type Drag =
  | { kind: "pan"; startX: number; startY: number; view: View }
  | { kind: "move"; id: string; dx: number; dy: number; pos: MapPosition; moved: boolean }
  | { kind: "rotate"; id: string; pos: MapPosition }
  | { kind: "place"; id: string; screen: { x: number; y: number }; pos: MapPosition | null };

function ToolButton({
  icon: Icon,
  label,
  onClick,
  pressed,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          aria-pressed={pressed}
          className={cn(pressed && "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary")}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

/** A small arrowhead at `t` (0–1) along a→b, pointing towards b, in plane units. */
function arrowAt(a: MapPosition, b: MapPosition, t: number, size: number): string {
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const x = a.x + (b.x - a.x) * t;
  const y = a.y + (b.y - a.y) * t;
  const point = (dx: number, dy: number) =>
    `${x + dx * Math.cos(angle) - dy * Math.sin(angle)},${y + dx * Math.sin(angle) + dy * Math.cos(angle)}`;
  return `${point(size, 0)} ${point(-size * 0.6, size * 0.7)} ${point(-size * 0.6, -size * 0.7)}`;
}

/**
 * Connect Scenes: a top-down floor plane. Tiles that touch are linked both
 * ways; clicking a line removes that link. Everything here is undoable.
 */
export function ConnectScenesMap({ tour }: { tour: Tour }) {
  const insertTour = useTourStore((s) => s.insertTour);
  const container = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [mode, setMode] = useState<"select" | "pan">("select");
  const [grid, setGrid] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<{ past: PlaneSnapshot[]; future: PlaneSnapshot[] }>({ past: [], future: [] });
  const [drag, setDragState] = useState<Drag | null>(null);
  // The live drag, readable synchronously: pointer events can arrive faster than renders.
  const dragRef = useRef<Drag | null>(null);
  const setDrag = (next: Drag | null) => {
    dragRef.current = next;
    setDragState(next);
  };
  const [hoverLink, setHoverLink] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ id: string; pos: MapPosition; names: string[] } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notice, setNotice] = useState(() => {
    try {
      return localStorage.getItem(NOTICE_KEY) !== "1";
    } catch {
      return true;
    }
  });
  const fitted = useRef(false);

  const scenes = tour.sceneOrder.map((id) => tour.scenes[id]).filter(Boolean);
  const placed = scenes.filter((s) => s.mapPos);
  const selectedScene = selected ? tour.scenes[selected] : null;

  // --- Sizing and view ---------------------------------------------------------

  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function fitView(target: Tour = tour) {
    const tiles = Object.values(target.scenes).filter((s) => s.mapPos);
    if (!size.width || !size.height) return;
    if (tiles.length === 0) {
      setView({ x: size.width / 2, y: size.height / 2, k: 1 });
      return;
    }
    const pad = TILE_RADIUS + 40;
    const xs = tiles.map((s) => s.mapPos!.x);
    const ys = tiles.map((s) => s.mapPos!.y);
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    const k = Math.min(size.width / (maxX - minX), size.height / (maxY - minY), 1.6);
    setView({ k, x: size.width / 2 - ((minX + maxX) / 2) * k, y: size.height / 2 - ((minY + maxY) / 2) * k });
  }

  // Fit once, when the plane first has a size.
  useEffect(() => {
    if (fitted.current || !size.width) return;
    fitted.current = true;
    fitView();
  });

  function toPlane(clientX: number, clientY: number): { x: number; y: number } {
    const rect = svg.current!.getBoundingClientRect();
    return { x: (clientX - rect.left - view.x) / view.k, y: (clientY - rect.top - view.y) / view.k };
  }

  function insidePlane(clientX: number, clientY: number): boolean {
    const rect = svg.current?.getBoundingClientRect();
    return !!rect && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }

  // --- History -------------------------------------------------------------------

  function commit(next: Tour) {
    if (next === tour) return;
    setHistory((h) => ({ past: [...h.past, capturePlane(tour)].slice(-HISTORY_LIMIT), future: [] }));
    insertTour(next);
  }

  function undo() {
    const previous = history.past.at(-1);
    if (!previous) return;
    setHistory({ past: history.past.slice(0, -1), future: [capturePlane(tour), ...history.future] });
    insertTour(restorePlane(tour, previous));
  }

  function redo() {
    const next = history.future[0];
    if (!next) return;
    setHistory({ past: [...history.past, capturePlane(tour)].slice(-HISTORY_LIMIT), future: history.future.slice(1) });
    insertTour(restorePlane(tour, next));
  }

  /** Places or moves a tile, asking first if hand-placed hotspots would be replaced. */
  function place(id: string, pos: MapPosition) {
    const clashes = manualConflicts(tour, id, pos);
    if (clashes.length) {
      setConflict({ id, pos, names: clashes.map((c) => tour.scenes[c].name) });
      return;
    }
    commit(placeOnPlane(tour, id, pos));
  }

  // --- Pointer interaction ----------------------------------------------------

  function startPan(event: PointerEvent) {
    setDrag({ kind: "pan", startX: event.clientX, startY: event.clientY, view });
  }

  function onBackgroundPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.target !== event.currentTarget && !(event.target as Element).classList.contains("plane-bg")) return;
    svg.current?.setPointerCapture(event.pointerId);
    if (mode === "pan" || event.button === 1) startPan(event);
    else setSelected(null);
  }

  function onTilePointerDown(event: PointerEvent<SVGGElement>, id: string) {
    event.stopPropagation();
    svg.current?.setPointerCapture(event.pointerId);
    if (mode === "pan") {
      startPan(event);
      return;
    }
    const pos = tour.scenes[id].mapPos!;
    const point = toPlane(event.clientX, event.clientY);
    setSelected(id);
    setDrag({ kind: "move", id, dx: point.x - pos.x, dy: point.y - pos.y, pos, moved: false });
  }

  function onRotatePointerDown(event: PointerEvent<SVGGElement>, id: string) {
    event.stopPropagation();
    svg.current?.setPointerCapture(event.pointerId);
    setDrag({ kind: "rotate", id, pos: tour.scenes[id].mapPos! });
  }

  function onStripPointerDown(event: PointerEvent<HTMLElement>, id: string) {
    if (tour.scenes[id].mapPos || event.button !== 0) return;
    event.preventDefault();
    container.current?.setPointerCapture(event.pointerId);
    setDrag({ kind: "place", id, screen: { x: event.clientX, y: event.clientY }, pos: null });
  }

  /** The drag after the pointer moves to (clientX, clientY). */
  function draggedTo(current: Drag, clientX: number, clientY: number, snap: boolean): Drag {
    if (current.kind === "pan") {
      return current;
    }
    const point = toPlane(clientX, clientY);
    if (current.kind === "move") {
      const pos = { ...current.pos, x: point.x - current.dx, y: point.y - current.dy };
      const moved = current.moved || Math.hypot(pos.x - current.pos.x, pos.y - current.pos.y) * view.k > 3;
      return { ...current, pos: moved ? pos : current.pos, moved };
    }
    if (current.kind === "rotate") {
      let rotation = Math.atan2(point.x - current.pos.x, -(point.y - current.pos.y));
      // Shift snaps to 15° steps.
      if (snap) rotation = degToRad(Math.round(radToDeg(rotation) / 15) * 15);
      return { ...current, pos: { ...current.pos, rotation: normalizeAngle(rotation) } };
    }
    const over = insidePlane(clientX, clientY);
    return { ...current, screen: { x: clientX, y: clientY }, pos: over ? { x: point.x, y: point.y, rotation: 0 } : null };
  }

  function onPointerMove(event: PointerEvent) {
    const current = dragRef.current;
    if (!current) return;
    if (current.kind === "pan") {
      setView({
        ...current.view,
        x: current.view.x + event.clientX - current.startX,
        y: current.view.y + event.clientY - current.startY,
      });
      return;
    }
    setDrag(draggedTo(current, event.clientX, event.clientY, event.shiftKey));
  }

  function onPointerUp(event: PointerEvent) {
    const started = dragRef.current;
    setDrag(null);
    if (!started) return;
    // Finish from the release point itself, in case the last move hasn't rendered yet.
    const current = draggedTo(started, event.clientX, event.clientY, event.shiftKey);
    if (current.kind === "move" && current.moved) place(current.id, current.pos);
    if (current.kind === "rotate") commit(rotateOnPlane(tour, current.id, current.pos.rotation));
    if (current.kind === "place" && current.pos) {
      setSelected(current.id);
      place(current.id, current.pos);
    }
  }

  function onWheel(event: React.WheelEvent<SVGSVGElement>) {
    const rect = svg.current!.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    const k = Math.min(4, Math.max(0.2, view.k * Math.exp(-event.deltaY * 0.0015)));
    setView({ k, x: sx - (sx - view.x) * (k / view.k), y: sy - (sy - view.y) * (k / view.k) });
  }

  function zoomBy(factor: number) {
    const k = Math.min(4, Math.max(0.2, view.k * factor));
    const cx = size.width / 2;
    const cy = size.height / 2;
    setView({ k, x: cx - (cx - view.x) * (k / view.k), y: cy - (cy - view.y) * (k / view.k) });
  }

  // --- Keyboard -------------------------------------------------------------------

  function onTileKeyDown(event: KeyboardEvent<SVGGElement>, id: string) {
    const pos = tour.scenes[id].mapPos;
    if (!pos) return;
    const step = event.shiftKey ? 32 : 8;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[event.key]) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      place(id, { ...pos, x: pos.x + dx, y: pos.y + dy });
    } else if (event.key === "r" || event.key === "R") {
      event.preventDefault();
      commit(rotateOnPlane(tour, id, pos.rotation + degToRad(event.shiftKey ? -15 : 15)));
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      commit(removeFromPlane(tour, id));
      setSelected(null);
    }
  }

  const undoRef = useRef({ undo, redo });
  useEffect(() => {
    undoRef.current = { undo, redo };
  });
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable]")) return;
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z" && event.key.toLowerCase() !== "y") return;
      event.preventDefault();
      if (event.key.toLowerCase() === "y" || event.shiftKey) undoRef.current.redo();
      else undoRef.current.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // --- What to draw (live during drags) ----------------------------------------

  const shown = useMemo(() => {
    if (drag?.kind === "move" && drag.moved) return placeOnPlane(tour, drag.id, drag.pos);
    if (drag?.kind === "rotate") return rotateOnPlane(tour, drag.id, drag.pos.rotation);
    if (drag?.kind === "place" && drag.pos) return placeOnPlane(tour, drag.id, drag.pos);
    return tour;
  }, [tour, drag]);
  const links = useMemo(() => planeLinks(shown), [shown]);
  const shownPlaced = shown.sceneOrder.map((id) => shown.scenes[id]).filter((s) => s?.mapPos);

  const unplaced = scenes.length - placed.length;
  const dragging = drag?.kind === "move" || drag?.kind === "rotate" ? drag.id : null;
  const placingScene = drag?.kind === "place" ? tour.scenes[drag.id] : null;

  // Visible plane area, for the grid.
  const visible = {
    x: -view.x / view.k,
    y: -view.y / view.k,
    width: size.width / view.k,
    height: size.height / view.k,
  };

  return (
    <div className="flex size-full flex-col bg-[#121110]">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Connect Scenes · top-down view</h2>
          <p className="text-xs text-muted-foreground tabular-nums">
            {placed.length}/{scenes.length} scenes placed · {plural(planeLinks(tour).length, "link")}
          </p>
        </div>
        <div role="toolbar" aria-label="Map tools" className="ml-auto flex flex-wrap items-center gap-0.5">
          <ToolButton icon={Undo2} label="Undo (Ctrl+Z)" onClick={undo} disabled={!history.past.length} />
          <ToolButton icon={Redo2} label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!history.future.length} />
          <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
          <ToolButton icon={MousePointer2} label="Select and move" pressed={mode === "select"} onClick={() => setMode("select")} />
          <ToolButton icon={Hand} label="Pan" pressed={mode === "pan"} onClick={() => setMode("pan")} />
          <ToolButton icon={Maximize2} label="Fit view" onClick={() => fitView()} />
          <ToolButton icon={Grid3x3} label="Grid" pressed={grid} onClick={() => setGrid((g) => !g)} />
          <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
          <ToolButton
            icon={RotateCcw}
            label="Rotate left 15° (Shift+R)"
            disabled={!selectedScene?.mapPos}
            onClick={() => selected && commit(rotateOnPlane(tour, selected, tour.scenes[selected].mapPos!.rotation - degToRad(15)))}
          />
          <ToolButton
            icon={RotateCw}
            label="Rotate right 15° (R)"
            disabled={!selectedScene?.mapPos}
            onClick={() => selected && commit(rotateOnPlane(tour, selected, tour.scenes[selected].mapPos!.rotation + degToRad(15)))}
          />
          <ToolButton
            icon={SquareX}
            label="Remove from plane (Delete)"
            disabled={!selectedScene?.mapPos}
            onClick={() => {
              if (!selected) return;
              commit(removeFromPlane(tour, selected));
              setSelected(null);
            }}
          />
          <ToolButton icon={Trash2} label="Clear plane" disabled={!placed.length} onClick={() => setConfirmClear(true)} />
        </div>
      </header>

      {notice && (
        <div className="flex items-start gap-3 border-b bg-primary/10 px-3 py-2 text-sm">
          <p className="flex-1 text-pretty">
            Editing here changes scene connections: tiles that touch are linked both ways, and pulling them apart removes
            the link. Hand-placed hotspots are only replaced after you confirm.
          </p>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss"
            onClick={() => {
              setNotice(false);
              try {
                localStorage.setItem(NOTICE_KEY, "1");
              } catch {
                // Not remembered without storage; it just shows again.
              }
            }}
          >
            <X />
          </Button>
        </div>
      )}

      <div
        ref={container}
        className="relative min-h-0 flex-1 touch-none overflow-hidden"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
      >
        <svg
          ref={svg}
          width={size.width}
          height={size.height}
          className={cn("absolute inset-0 select-none", mode === "pan" ? "cursor-grab" : "cursor-default", drag?.kind === "pan" && "cursor-grabbing")}
          onPointerDown={onBackgroundPointerDown}
          onWheel={onWheel}
          role="application"
          aria-label="Top-down floor plane"
        >
          <defs>
            <pattern id="plane-grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
              <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="rgb(255 255 255 / 0.06)" strokeWidth={1} />
            </pattern>
          </defs>
          <rect className="plane-bg" width="100%" height="100%" fill="transparent" />

          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {grid && <rect className="plane-bg" {...visible} fill="url(#plane-grid)" />}

            {shownPlaced.map((scene) => (
              <PlaneTile
                key={scene.id}
                scene={scene}
                pos={scene.mapPos!}
                selected={selected === scene.id}
                dimmed={dragging !== null && dragging !== scene.id}
                onPointerDown={(e) => onTilePointerDown(e, scene.id)}
                onRotatePointerDown={(e) => onRotatePointerDown(e, scene.id)}
                onKeyDown={(e) => onTileKeyDown(e, scene.id)}
                onFocus={() => setSelected(scene.id)}
              />
            ))}

            {/* Links: centre to centre over the tiles (touching tiles leave no gap between rims),
                arrows show each direction, and the dot in the middle removes the link. */}
            {links.map((link) => {
              const a = shown.scenes[link.a].mapPos!;
              const b = shown.scenes[link.b].mapPos!;
              const key = `${link.a}-${link.b}`;
              const hovered = hoverLink === key;
              const colour = link.kind === "map" ? "var(--primary)" : "rgb(255 255 255 / 0.85)";
              const unit = 1 / view.k;
              const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
              const label = `${link.kind === "map" ? "Map link" : "Hand-placed hotspot"} between ${shown.scenes[link.a].name} and ${shown.scenes[link.b].name}. Press to remove it both ways.`;
              const remove = () => {
                commit(unlinkScenes(tour, link.a, link.b));
                setHoverLink(null);
                toast.success("Link removed both ways", { description: "Undo with Ctrl+Z." });
              };
              return (
                <g key={key}>
                  <g pointerEvents="none" opacity={hovered ? 1 : 0.9}>
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="rgb(14 13 12 / 0.55)"
                      strokeWidth={hovered ? 7 : 5.5}
                      vectorEffect="non-scaling-stroke"
                    />
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={colour}
                      strokeWidth={hovered ? 3.5 : 2.5}
                      strokeDasharray={link.kind === "manual" ? "7 6" : undefined}
                      vectorEffect="non-scaling-stroke"
                    />
                    {link.aToB && <polygon points={arrowAt(a, b, 0.78, 8 * unit)} fill={colour} />}
                    {link.bToA && <polygon points={arrowAt(b, a, 0.78, 8 * unit)} fill={colour} />}
                  </g>
                  {!drag && (
                    <g
                      transform={`translate(${mid.x} ${mid.y}) scale(${unit})`}
                      className="cursor-pointer outline-none"
                      role="button"
                      tabIndex={0}
                      aria-label={label}
                      onPointerEnter={() => setHoverLink(key)}
                      onPointerLeave={() => setHoverLink(null)}
                      onFocus={() => setHoverLink(key)}
                      onBlur={() => setHoverLink(null)}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={remove}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " " || e.key === "Delete") {
                          e.preventDefault();
                          remove();
                        }
                      }}
                    >
                      <title>Remove this link both ways</title>
                      <circle r={hovered ? 11 : 8} fill="#1a1816" stroke={colour} strokeWidth={2} />
                      {hovered ? (
                        <path d="M-4 -4 L4 4 M4 -4 L-4 4" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
                      ) : (
                        <circle r={2.5} fill={colour} />
                      )}
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {placed.length === 0 && !placingScene && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center text-sm text-muted-foreground">
            Drag scenes from the strip below onto the plane, where each photo was taken.
          </p>
        )}

        <div className="pointer-events-none absolute right-3 bottom-3 flex flex-col items-end gap-2">
          <div className="pointer-events-auto flex overflow-hidden rounded-lg bg-background/80 ring-1 ring-foreground/10 backdrop-blur">
            <Button variant="ghost" size="icon-sm" aria-label="Zoom in" onClick={() => zoomBy(1.25)}>
              <span aria-hidden="true" className="text-base leading-none">+</span>
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Zoom out" onClick={() => zoomBy(0.8)}>
              <span aria-hidden="true" className="text-base leading-none">−</span>
            </Button>
          </div>
          <ul className="rounded-lg bg-background/80 px-3 py-2 text-xs text-muted-foreground ring-1 ring-foreground/10 backdrop-blur max-sm:hidden">
            <li className="flex items-center gap-2">
              <svg width="26" height="6" aria-hidden="true">
                <line x1="0" y1="3" x2="26" y2="3" stroke="var(--primary)" strokeWidth="2.5" />
              </svg>
              Linked on the map
            </li>
            <li className="mt-1 flex items-center gap-2">
              <svg width="26" height="6" aria-hidden="true">
                <line x1="0" y1="3" x2="26" y2="3" stroke="rgb(255 255 255 / 0.7)" strokeWidth="2.5" strokeDasharray="7 6" />
              </svg>
              Hand-placed hotspot
            </li>
            <li className="mt-1">Click a link&apos;s middle dot to remove it · Shift snaps rotation</li>
          </ul>
        </div>

        {placingScene && drag?.kind === "place" && (
          <div
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-primary"
            style={{ left: drag.screen.x, top: drag.screen.y, width: TILE_RADIUS * view.k * 2, height: TILE_RADIUS * view.k * 2, opacity: drag.pos ? 0 : 0.85 }}
          >
            <span className="flex size-full items-center justify-center rounded-full bg-background/80 px-2 text-center text-[11px]">
              {placingScene.name}
            </span>
          </div>
        )}
      </div>

      <SceneStrip
        tour={tour}
        unplaced={unplaced}
        selected={selected}
        onPointerDown={onStripPointerDown}
        onActivate={(id) => {
          const pos = tour.scenes[id].mapPos;
          if (pos) {
            setSelected(id);
            setView({ ...view, x: size.width / 2 - pos.x * view.k, y: size.height / 2 - pos.y * view.k });
          } else {
            // Keyboard and tap: drop it in the middle of the visible plane.
            const centre = { x: (size.width / 2 - view.x) / view.k, y: (size.height / 2 - view.y) / view.k, rotation: 0 };
            setSelected(id);
            place(id, centre);
          }
        }}
      />

      <AlertDialog open={conflict !== null} onOpenChange={(open) => !open && setConflict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace hand-placed hotspots?</AlertDialogTitle>
            <AlertDialogDescription>
              “{conflict ? tour.scenes[conflict.id]?.name : ""}” already has hotspots you placed by hand to or from{" "}
              {conflict?.names.map((n) => `“${n}”`).join(", ")}. Linking the tiles replaces them with map links.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (conflict) commit(placeOnPlane(tour, conflict.id, conflict.pos));
                setConflict(null);
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear the plane?</AlertDialogTitle>
            <AlertDialogDescription>
              Every tile comes off and its map links are removed. Hand-placed hotspots stay. You can undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                commit(clearPlane(tour));
                setSelected(null);
              }}
            >
              Clear plane
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
