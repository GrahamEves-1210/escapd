/// <reference types="node" />
import fs from "fs";
import path from "path";
import { MAX_PLATES, MIN_PLATES } from "@/capture/slots";
import {
  LENS_FOV,
  MAX_SAMPLE_GAP,
  MIN_OVERLAP,
  TARGET_OVERLAP,
  TURN_DEADBAND,
  TURN_REACHED,
  arcPath,
  dialPoint,
  dialStops,
  firstLens,
  integrateTurn,
  isTurnReached,
  quantizeProgress,
  rateAxes,
  rollPlan,
  smoothGravity,
  switchLens,
  turnPlan,
  turnStep,
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
  it("uses the iPhone lenses' real views in the 3:4 portrait frame: 0.5x about 92 degrees, 1x about 55", () => {
    // Apple's ultra-wide is 120 degrees across the diagonal; the frame's short side is 0.6 of it.
    const ultraWide = 2 * Math.atan(0.6 * Math.tan(Math.PI / 3)) * (180 / Math.PI);
    expect(LENS_FOV.wide).toBeCloseTo(ultraWide, 0);
    expect(LENS_FOV.wide).toBe(92);
    // 24 to 26 mm full-frame equivalent across a 26 mm-equivalent short side.
    const main = (mm: number) => 2 * Math.atan(13 / mm) * (180 / Math.PI);
    expect(LENS_FOV.main).toBeGreaterThanOrEqual(Math.floor(main(26)));
    expect(LENS_FOV.main).toBeLessThanOrEqual(Math.ceil(main(24)));
  });

  it("aims for the fewest photos that still go all the way round, and counts any shared view as overlapping", () => {
    expect(TARGET_OVERLAP).toBe(0);
    expect(MIN_OVERLAP).toBe(0);
  });

  it("takes 4 photos 90 degrees apart on the ultra-wide, neighbours sharing a 2-degree sliver", () => {
    const plan = turnPlan("wide");
    expect(plan.shots).toBe(4);
    expect(plan.step).toBe(90);
    expect(plan.overlap).toBeCloseTo(2 / 92, 5);
    expect(plan.overlaps).toBe(true);
  });

  it("holds the main lens to the 6-photo limit: still 60 apart so the loop closes, neighbours only just meeting", () => {
    const plan = turnPlan("main");
    expect(plan.shots).toBe(MAX_PLATES);
    expect(plan.step).toBe(60);
    // A sliver of gap at most (55 degree view, 60 degree turn): no overlap to keep in view.
    expect(plan.overlap).toBeLessThan(0);
    expect(plan.overlap).toBeGreaterThan(-0.1);
    expect(plan.overlaps).toBe(false);
  });

  it("would take more, smaller turns on the main lens if the limit allowed it", () => {
    // 360 / 55 needs 7 photos, about 51 apart: neighbours would share about 4 degrees.
    const plan = turnPlan("main", 12);
    expect(plan.shots).toBe(7);
    expect(plan.step).toBeCloseTo(360 / 7, 5);
    expect(plan.overlap).toBeCloseTo((55 - 360 / 7) / 55, 5);
    expect(plan.overlaps).toBe(true);
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

describe("rollPlan: the stops, and a lens switch mid-roll", () => {
  it("puts an even circle's stops a turn apart from photo 1 at 0: 4 at 90 on 0.5x, 6 at 60 on 1x", () => {
    expect(rollPlan("wide").stops).toEqual([0, 90, 180, 270]);
    expect(rollPlan("main").stops).toEqual([0, 60, 120, 180, 240, 300]);
    expect(rollPlan("wide")).toMatchObject(turnPlan("wide"));
    expect(rollPlan("main")).toMatchObject(turnPlan("main"));
  });

  it("keeps the stops of photos already placed and shares the rest of the circle evenly", () => {
    // 3 taken on 0.5x, then 1x: 180 degrees left need 4 gaps of at most 55: 3 more, 45 apart, within the 6-photo limit.
    const plan = rollPlan("main", [0, 90, 180]);
    expect(plan.shots).toBe(6);
    expect(plan.stops).toEqual([0, 90, 180, 225, 270, 315]);
    expect(plan.step).toBe(45);
    // 45 on a 55 degree view: neighbours share 10 degrees.
    expect(plan.overlap).toBeCloseTo(10 / 55, 5);
    expect(plan.overlaps).toBe(true);
    // 2 taken: 270 degrees left need 5 gaps, 54 apart: a 1-degree sliver, still overlapping.
    const two = rollPlan("main", [0, 90]);
    expect(two.stops).toEqual([0, 90, 144, 198, 252, 306]);
    expect(two.overlaps).toBe(true);
  });

  it("re-spaces for 0.5x after photos on 1x, at least as many as taken and never more than 6", () => {
    // 3 taken on 1x, then 0.5x: 240 degrees left need 3 gaps of at most 92: 2 more, 80 apart.
    const plan = rollPlan("wide", [0, 60, 120]);
    expect(plan.shots).toBe(5);
    expect(plan.stops).toEqual([0, 60, 120, 200, 280]);
    expect(plan.step).toBe(80);
    expect(plan.overlaps).toBe(true);
    for (let kept = 1; kept <= 6; kept += 1) {
      for (const lens of ["wide", "main"] as const) {
        const stops = dialStops(6).slice(0, kept);
        const p = rollPlan(lens, stops);
        expect(p.shots).toBeGreaterThanOrEqual(Math.max(kept, MIN_PLATES));
        expect(p.shots).toBeLessThanOrEqual(MAX_PLATES);
        expect(p.stops.slice(0, kept)).toEqual(stops);
        expect(p.stops).toHaveLength(p.shots);
      }
    }
  });

  it("switchLens: none taken is the new lens's even circle", () => {
    expect(switchLens(rollPlan("wide"), 0, "main").stops).toEqual(rollPlan("main").stops);
    expect(switchLens(rollPlan("main"), 0, "wide").stops).toEqual(rollPlan("wide").stops);
  });

  it("switchLens: never fewer stops than the slots in use, and back again on the first lens", () => {
    const main = switchLens(rollPlan("wide"), 3, "main");
    expect(main.stops).toEqual([0, 90, 180, 225, 270, 315]);
    expect(switchLens(main, 3, "wide").stops).toEqual([0, 90, 180, 270]);
    // 1 taken on 1x: 0.5x's own 4.
    expect(switchLens(rollPlan("main"), 1, "wide").shots).toBe(4);
    // 5 of 6 taken on 1x, then 0.5x: still 6, the last 60 on.
    expect(switchLens(rollPlan("main"), 5, "wide").stops).toEqual([0, 60, 120, 180, 240, 300]);
  });

  it("switchLens: once every stop is reached the stops stay, and only the overlap follows the lens", () => {
    const wide = rollPlan("wide");
    const after = switchLens(wide, 4, "main");
    expect(after.stops).toBe(wide.stops);
    expect(after.shots).toBe(4);
    expect(after.overlaps).toBe(false);
  });

  it("firstLens: photos in before the lens was known get its even circle when it holds them", () => {
    expect(firstLens(rollPlan("main"), 3, "wide").stops).toEqual([0, 90, 180, 270]);
    expect(firstLens(rollPlan("main"), 4, "wide").stops).toEqual([0, 90, 180, 270]);
    // More than 0.5x's 4: they keep their stops.
    expect(firstLens(rollPlan("main"), 5, "wide").stops).toEqual(rollPlan("main").stops);
    expect(firstLens(rollPlan("main"), 6, "wide").stops).toEqual(rollPlan("main").stops);
  });

  it("turnStep: the turn into a stop from the one before, round past the start for photo 1", () => {
    const stops = [0, 90, 180, 225, 270, 315];
    expect(turnStep(stops, 1)).toBe(90);
    expect(turnStep(stops, 3)).toBe(45);
    expect(turnStep(stops, 0)).toBe(45);
    expect(turnStep([], 0)).toBe(0);
  });
});

describe("DeviceMotion's units (expo-sensors 58, as installed)", () => {
  // The turn maths takes rotationRate in deg/s and timestamps in seconds. A
  // radians-per-second rate would make every turn read 57 times too small and
  // the dial never tick; milliseconds would make it tick at once. These pin
  // what the native modules actually send.
  const read = (file: string) => fs.readFileSync(path.join(__dirname, "../../../node_modules/expo-sensors", file), "utf8");

  it("iOS sends CoreMotion's rotation rate in deg/s as alpha = z, beta = y, gamma = x, stamped in seconds", () => {
    const swift = read("ios/DeviceMotionModule.swift");
    const block = swift.slice(swift.indexOf('"rotationRate": ['), swift.indexOf("]", swift.indexOf('"rotationRate": [')));
    expect(block).toMatch(/"alpha": radiansToDegrees\(rotationRate\.z\)/);
    expect(block).toMatch(/"beta": radiansToDegrees\(rotationRate\.y\)/);
    expect(block).toMatch(/"gamma": radiansToDegrees\(rotationRate\.x\)/);
    // CMLogItem.timestamp: seconds.
    expect(block).toMatch(/"timestamp": data\.timestamp/);
    expect(read("ios/SensorsUtils.swift")).toMatch(/radians \* 180 \/ Double\.pi/);
    expect(rateAxes({ alpha: 1, beta: 2, gamma: 3 }, "ios")).toEqual({ x: 3, y: 2, z: 1 });
  });

  it("Android sends the gyroscope in deg/s as alpha = x, beta = y, gamma = z, stamped in seconds", () => {
    const kotlin = read("android/src/main/java/expo/modules/sensors/modules/DeviceMotionModule.kt");
    const block = kotlin.slice(kotlin.indexOf('"rotationRate"'), kotlin.indexOf('"rotationRate"') + 600);
    expect(block).toMatch(/putDouble\("alpha", Math\.toDegrees\(rotationRate\.values\[0\]/);
    expect(block).toMatch(/putDouble\("beta", Math\.toDegrees\(rotationRate\.values\[1\]/);
    expect(block).toMatch(/putDouble\("gamma", Math\.toDegrees\(rotationRate\.values\[2\]/);
    expect(block).toMatch(/putDouble\("timestamp", rotationRate\.timestamp \/ 1_000_000_000\.0\)/);
    expect(rateAxes({ alpha: 1, beta: 2, gamma: 3 }, "android")).toEqual({ x: 1, y: 2, z: 3 });
  });

  it("reads a real 60-degree turn as one stop: a second at 60 deg/s from iOS samples, 30 a second", () => {
    let gravity = null as ReturnType<typeof smoothGravity> | null;
    let turned = 0;
    let last: number | null = null;
    for (let i = 0; i <= 30; i += 1) {
      // CoreMotion's own clock: seconds since boot.
      const sample = { rotationRate: { alpha: 0, beta: 60, gamma: 0, timestamp: 5000 + i / 30 }, gravity: { x: 0, y: -9.8, z: 0 } };
      gravity = smoothGravity(gravity, sample.gravity);
      const dt = last === null ? 0 : sample.rotationRate.timestamp - last;
      last = sample.rotationRate.timestamp;
      turned = integrateTurn(turned, turnRate(rateAxes(sample.rotationRate, "ios"), gravity), dt);
    }
    expect(Math.abs(turned)).toBeCloseTo(60, 3);
    // One 1x stop (60); on 0.5x (90) not yet far enough.
    expect(isTurnReached(turnProgress(turned, turnPlan("main").step))).toBe(true);
    expect(isTurnReached(turnProgress(turned, turnPlan("wide").step))).toBe(false);
    // The same turn misread as rad/s (1.047) would be under the deadband: no turn at all.
    expect(integrateTurn(0, (60 * Math.PI) / 180, 1 / 30)).toBe(0);
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
    expect(dialStops(4)).toEqual([0, 90, 180, 270]);
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
