"use client";

import type { KeyboardEvent, PointerEvent } from "react";
import { radToDeg } from "@/lib/geometry";
import { TILE_RADIUS } from "@/lib/map";
import type { MapPosition, Scene } from "@/lib/types";
import { useTileImage } from "./use-tile-image";

const HANDLE_DISTANCE = TILE_RADIUS + 22;

/** One scene on the plane: its top-down image, name, and (when selected) the rotate handle. */
export function PlaneTile({
  scene,
  pos,
  selected,
  dimmed,
  onPointerDown,
  onRotatePointerDown,
  onKeyDown,
  onFocus,
}: {
  scene: Scene;
  pos: MapPosition;
  selected: boolean;
  dimmed?: boolean;
  onPointerDown: (event: PointerEvent<SVGGElement>) => void;
  onRotatePointerDown: (event: PointerEvent<SVGGElement>) => void;
  onKeyDown: (event: KeyboardEvent<SVGGElement>) => void;
  onFocus: () => void;
}) {
  const image = useTileImage(scene.displayType, scene.mediaKey, scene.thumbKey);
  const clipId = `tile-clip-${scene.id}`;
  const degrees = radToDeg(pos.rotation);

  return (
    <g
      transform={`translate(${pos.x} ${pos.y})`}
      className="plane-tile outline-none"
      opacity={dimmed ? 0.55 : 1}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${scene.name}. Arrow keys move it, R rotates, Delete takes it off the plane.`}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    >
      <g transform={`rotate(${degrees})`}>
        <clipPath id={clipId}>
          <circle r={TILE_RADIUS} />
        </clipPath>
        <circle r={TILE_RADIUS} fill="#1d1b19" />
        {image && (
          <image
            href={image}
            x={-TILE_RADIUS}
            y={-TILE_RADIUS}
            width={TILE_RADIUS * 2}
            height={TILE_RADIUS * 2}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="xMidYMid slice"
            style={{ pointerEvents: "none" }}
          />
        )}
        {/* Forward (yaw 0) marker on the rim. */}
        <path d={`M -6 ${-TILE_RADIUS + 1} L 0 ${-TILE_RADIUS + 10} L 6 ${-TILE_RADIUS + 1} Z`} fill="var(--primary)" opacity={0.9} />
        <circle
          r={TILE_RADIUS}
          fill="none"
          className="plane-tile__ring"
          stroke={selected ? "var(--primary)" : "rgb(255 255 255 / 0.55)"}
          strokeWidth={selected ? 3 : 1.5}
          vectorEffect="non-scaling-stroke"
        />
        {selected && (
          <g
            className="cursor-grab active:cursor-grabbing"
            onPointerDown={onRotatePointerDown}
            role="presentation"
          >
            <line y1={-TILE_RADIUS} y2={-HANDLE_DISTANCE + 7} stroke="var(--primary)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <circle cy={-HANDLE_DISTANCE} r={9} fill="var(--primary)" stroke="#1a1816" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <circle cy={-HANDLE_DISTANCE} r={16} fill="transparent" />
          </g>
        )}
      </g>
      <text
        y={TILE_RADIUS + 18}
        textAnchor="middle"
        className="fill-white text-[12px] font-medium"
        style={{ paintOrder: "stroke", stroke: "rgb(14 13 12 / 0.85)", strokeWidth: 4, pointerEvents: "none" }}
      >
        {scene.name.length > 22 ? `${scene.name.slice(0, 21)}…` : scene.name}
      </text>
    </g>
  );
}
