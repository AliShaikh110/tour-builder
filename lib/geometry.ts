export const TWO_PI = Math.PI * 2;

/** Pitch given to an automatically created linkback hotspot. */
export const LINKBACK_PITCH = -0.2;

/** Pitch given to hotspots generated from the Connect Scenes map. */
export const MAP_LINK_PITCH = -0.3;

/** Wraps any angle into [0, 2π). */
export function normalizeAngle(angle: number): number {
  const wrapped = angle % TWO_PI;
  const positive = wrapped < 0 ? wrapped + TWO_PI : wrapped;
  // `+ 0` turns -0 into 0; float rounding can land exactly on 2π.
  return positive >= TWO_PI ? 0 : positive + 0;
}

export function clampPitch(pitch: number): number {
  return Math.min(Math.PI / 2, Math.max(-Math.PI / 2, pitch));
}

export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Yaw of the return hotspot placed in scene B for a hotspot at `hotspotYaw`
 * in scene A: the opposite compass bearing, expressed in B's frame.
 */
export function linkbackYaw(
  hotspotYaw: number,
  northOffsetA: number,
  northOffsetB: number,
): number {
  return normalizeAngle(hotspotYaw + Math.PI + (northOffsetB - northOffsetA));
}

/** Keeps the visitor's compass heading when moving from scene A to scene B. */
export function carryHeading(
  currentYaw: number,
  northOffsetA: number,
  northOffsetB: number,
): number {
  return normalizeAngle(currentYaw - northOffsetA + northOffsetB);
}

/**
 * Yaw in scene A pointing at scene B on the top-down map (SVG coordinates,
 * y grows downwards, so "up" on the plane is yaw 0 before rotation).
 */
export function mapLinkYaw(dx: number, dy: number, rotationA: number): number {
  return normalizeAngle(Math.atan2(dx, -dy) - rotationA);
}
