import { describe, expect, it } from "vitest";
import {
  TWO_PI,
  carryHeading,
  clampPitch,
  degToRad,
  linkbackYaw,
  mapLinkYaw,
  normalizeAngle,
  radToDeg,
} from "@/lib/geometry";

const { PI } = Math;

describe("normalizeAngle", () => {
  it.each([
    [0, 0],
    [PI, PI],
    [TWO_PI, 0],
    [-PI / 2, (3 * PI) / 2],
    [5 * PI, PI],
    [-7 * PI, PI],
  ])("wraps %d into [0, 2π)", (input, expected) => {
    expect(normalizeAngle(input)).toBeCloseTo(expected, 12);
  });

  it("never returns -0 or 2π", () => {
    expect(Object.is(normalizeAngle(-0), 0)).toBe(true);
    const tiny = normalizeAngle(-1e-17);
    expect(tiny).toBeGreaterThanOrEqual(0);
    expect(tiny).toBeLessThan(TWO_PI);
  });
});

describe("unit helpers", () => {
  it("converts degrees and radians both ways", () => {
    expect(degToRad(180)).toBeCloseTo(PI, 12);
    expect(radToDeg(PI / 2)).toBeCloseTo(90, 12);
    expect(radToDeg(degToRad(37.5))).toBeCloseTo(37.5, 12);
  });

  it("clamps pitch to the poles", () => {
    expect(clampPitch(2)).toBe(PI / 2);
    expect(clampPitch(-2)).toBe(-PI / 2);
    expect(clampPitch(0.3)).toBe(0.3);
  });
});

describe("linkbackYaw", () => {
  it("points the opposite way when both scenes share north", () => {
    expect(linkbackYaw(0, 0, 0)).toBeCloseTo(PI, 12);
    expect(linkbackYaw(degToRad(300), 0, 0)).toBeCloseTo(degToRad(120), 12);
  });

  it("applies the north offset difference", () => {
    // 3π/2 + π + (π/2 - 0) = 3π → π
    expect(linkbackYaw((3 * PI) / 2, 0, PI / 2)).toBeCloseTo(PI, 12);
  });

  it("keeps the return bearing exactly opposite the outgoing bearing", () => {
    const hotspotYaw = 1.1;
    const northA = 0.4;
    const northB = 2.3;
    const back = linkbackYaw(hotspotYaw, northA, northB);
    const bearingOut = hotspotYaw - northA;
    const bearingBack = back - northB;
    expect(normalizeAngle(bearingBack - bearingOut)).toBeCloseTo(PI, 12);
  });

  it("stays in [0, 2π)", () => {
    const yaw = linkbackYaw(6, -3, 4);
    expect(yaw).toBeGreaterThanOrEqual(0);
    expect(yaw).toBeLessThan(TWO_PI);
  });
});

describe("carryHeading", () => {
  it("keeps the yaw when scenes share north", () => {
    expect(carryHeading(1.2, 0, 0)).toBeCloseTo(1.2, 12);
  });

  it("keeps facing north across scenes with different north points", () => {
    // Facing north in A (yaw = northA) arrives facing north in B (yaw = northB).
    expect(carryHeading(PI / 4, PI / 4, PI / 2)).toBeCloseTo(PI / 2, 12);
    expect(carryHeading(0.1, 0.5, 6)).toBeCloseTo(normalizeAngle(0.1 - 0.5 + 6), 12);
  });
});

describe("mapLinkYaw", () => {
  it.each([
    ["above", 0, -10, 0],
    ["right", 10, 0, PI / 2],
    ["below", 0, 10, PI],
    ["left", -10, 0, (3 * PI) / 2],
  ])("points at a tile %s an unrotated tile", (_, dx, dy, expected) => {
    expect(mapLinkYaw(dx, dy, 0)).toBeCloseTo(expected, 12);
  });

  it("subtracts the source tile rotation", () => {
    expect(mapLinkYaw(10, 0, PI / 2)).toBeCloseTo(0, 12);
    expect(mapLinkYaw(0, -10, PI / 2)).toBeCloseTo((3 * PI) / 2, 12);
  });
});
