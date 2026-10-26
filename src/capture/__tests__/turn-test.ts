import { MAX_PLATES, MIN_PLATES } from "@/capture/slots";
import {
  LENS_FOV,
  MAX_SAMPLE_GAP,
  TURN_DEADBAND,
  TURN_REACHED,
  arcPath,
  dialPoint,
  dialStops,
  integrateTurn,
  isTurnReached,
  quantizeProgress,
  rateAxes,
  smoothGravity,
  turnPlan,
  turnProgress,
  turnRate,
} from "@/capture/turn";
import { lensFor } from "@/capture/ui/rangefinder/useLenses";

describe("lens default", () => {
  it("starts on 0.5x when the phone has an ultra-wide, otherwise 1x", () => {
    expect(lensFor("AVCaptureDeviceTypeBuiltInUltraWideCamera", null)).toBe("wide");
    expect(lensFor(null, null)).toBe("main");
  });

  it("keeps the player's own choice, but never a lens the phone doesn't have", () => {
    expect(lensFor("ultra", "main")).toBe("main");
    expect(lensFor("ultra", "wide")).toBe("wide");
    expect(lensFor(null, "wide")).toBe("main");
  });
});

describe("turnPlan: photos and turn per lens", () => {
  it("takes 6 photos 60 degrees apart on the ultra-wide, neighbours sharing a third", () => {
    expect(LENS_FOV.wide).toBe(90);
    const plan = turnPlan("wide");
    expect(plan.shots).toBe(6);
    expect(plan.step).toBe(60);
    expect(plan.overlap).toBeCloseTo(1 / 3, 5);
  });

  it("holds the main lens to the 6-photo limit: still 60 apart, neighbours just meeting", () => {
    const plan = turnPlan("main");
    expect(plan.shots).toBe(MAX_PLATES);
    expect(plan.step).toBe(60);
    // A sliver of gap at most (55 degree view, 60 degree turn).
    expect(plan.overlap).toBeLessThan(0);
    expect(plan.overlap).toBeGreaterThan(-0.1);
  });

  it("would take more, smaller turns on the main lens if the limit allowed it", () => {
    const plan = turnPlan("main", 12);
    expect(plan.shots).toBe(10);
    expect(plan.step).toBe(36);
    expect(plan.overlap).toBeCloseTo(19 / 55, 5);
  });

  it("never plans fewer than the minimum or more than the maximum, and always goes all the way round", () => {
    for (const lens of ["wide", "main"] as const) {
      const plan = turnPlan(lens);
      expect(plan.shots).toBeGreaterThanOrEqual(MIN_PLATES);
      expect(plan.shots).toBeLessThanOrEqual(MAX_PLATES);
      expect(plan.shots * plan.step).toBeCloseTo(360, 5);
    }
    expect(turnPlan("wide", 6, 8).shots).toBe(6);
  });
});

describe("the turn from motion", () => {
  it("maps DeviceMotion's rotation rate to device axes per platform", () => {
    const rate = { alpha: 1, beta: 2, gamma: 3 };
    expect(rateAxes(rate, "ios")).toEqual({ x: 3, y: 2, z: 1 });
    expect(rateAxes(rate, "android")).toEqual({ x: 1, y: 2, z: 3 });
  });

  it("takes the rotation along gravity, so a tilted phone still reads its turn about the vertical", () => {
    // Upright: gravity down the y axis; a turn about y is the whole turn.
    expect(turnRate({ x: 0, y: 30, z: 0 }, { x: 0, y: -9.8, z: 0 })).toBeCloseTo(-30, 5);
    // Tilted back 30 degrees: the same 30 deg/s turn shows on y and z, and still reads 30.
    const tilt = (30 * Math.PI) / 180;
    const g = { x: 0, y: -9.8 * Math.cos(tilt), z: -9.8 * Math.sin(tilt) };
    const rate = { x: 0, y: 30 * Math.cos(tilt), z: 30 * Math.sin(tilt) };
    expect(Math.abs(turnRate(rate, g))).toBeCloseTo(30, 5);
    // Rolling the phone about its own lens axis is not a turn.
    expect(turnRate({ x: 0, y: 0, z: 40 }, { x: 0, y: -9.8, z: 0 })).toBeCloseTo(0, 5);
    // No gravity yet: nothing.
    expect(turnRate({ x: 5, y: 5, z: 5 }, { x: 0, y: 0, z: 0 })).toBe(0);
  });

  it("smooths gravity, starting from the first sample", () => {
    const first = smoothGravity(null, { x: 0, y: -10, z: 0 });
    expect(first).toEqual({ x: 0, y: -10, z: 0 });
    const next = smoothGravity(first, { x: 10, y: -10, z: 0 }, 0.5);
    expect(next).toEqual({ x: 5, y: -10, z: 0 });
  });

  it("integrates the turn, ignoring tremor below the deadband, stalls and bad samples", () => {
    expect(integrateTurn(0, 60, 0.5)).toBe(0); // a gap longer than MAX_SAMPLE_GAP is a stall
    expect(MAX_SAMPLE_GAP).toBeLessThan(0.5);
    expect(integrateTurn(10, 60, 0.1)).toBeCloseTo(16, 5);
    expect(integrateTurn(10, TURN_DEADBAND / 2, 0.1)).toBe(10);
    expect(integrateTurn(10, 60, 0)).toBe(10);
    expect(integrateTurn(10, Number.NaN, 0.1)).toBe(10);
    // Thirty samples a second at 60 deg/s for a second: one turn.
    let turned = 0;
    for (let i = 0; i < 30; i += 1) turned = integrateTurn(turned, 60, 1 / 30);
    expect(turned).toBeCloseTo(60, 5);
  });

  it("measures progress either way round, held to 0..1, and is far enough within 5 %", () => {
    expect(turnProgress(30, 60)).toBe(0.5);
    expect(turnProgress(-30, 60)).toBe(0.5);
    expect(turnProgress(90, 60)).toBe(1);
    expect(turnProgress(10, 0)).toBe(0);
    expect(TURN_REACHED).toBe(0.95);
    expect(isTurnReached(turnProgress(56, 60))).toBe(false);
    expect(isTurnReached(turnProgress(57, 60))).toBe(true);
  });

  it("draws progress in fine steps, or in quarters under Reduce Motion (no sweep)", () => {
    expect(quantizeProgress(0.513, false)).toBe(0.5);
    expect(quantizeProgress(0.527, false)).toBe(0.52);
    expect(quantizeProgress(0.6, true)).toBe(0.5);
    expect(quantizeProgress(0.74, true)).toBe(0.5);
    expect(quantizeProgress(0.75, true)).toBe(0.75);
    expect(quantizeProgress(1.4, true)).toBe(1);
    expect(quantizeProgress(-1, false)).toBe(0);
  });
});

describe("the dial's geometry", () => {
  it("puts photo 1 at the top and the rest clockwise, a turn apart", () => {
    expect(dialStops(6)).toEqual([0, 60, 120, 180, 240, 300]);
    const top = dialPoint(14, 14, 10, 0);
    expect(top.x).toBeCloseTo(14, 5);
    expect(top.y).toBeCloseTo(4, 5);
    const right = dialPoint(14, 14, 10, 90);
    expect(right.x).toBeCloseTo(24, 5);
    expect(right.y).toBeCloseTo(14, 5);
  });

  it("draws the arc clockwise from a stop, and nothing for no turn", () => {
    expect(arcPath(14, 14, 10, 0, 0)).toBe("");
    expect(arcPath(14, 14, 10, 0, 90)).toBe("M14 4A10 10 0 0 1 24 14");
    // Past half way round the large-arc flag is set.
    expect(arcPath(14, 14, 10, 0, 270)).toMatch(/A10 10 0 1 1 /);
  });
});
