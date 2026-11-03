/// <reference types="node" />
import fs from "fs";
import path from "path";
import { MAX_PLATES, MIN_PLATES } from "@/capture/slots";
import { ref } from "@/theme/tokens";
import {
  LENS_FOV,
  MAX_SAMPLE_GAP,
  MIN_OVERLAP,
  TARGET_OVERLAP,
  TURN_DEADBAND,
  TURN_REACHED,
  LENS_ASPECT,
  LENS_MM,
  SENSOR_MM,
  angleAtX,
  arcPath,
  dialPoint,
  edgeX,
  ghostStrip,
  dialStops,
  firstLens,
  frameHalfMm,
  integrateTurn,
  isTurnReached,
  quantizeProgress,
  rateAxes,
  rollPlan,
  smoothGravity,
  switchLens,
  targetX,
  turnPlan,
  turnStep,
  turnProgress,
  turnRate,
  viewX,
} from "@/capture/turn";
import { GUIDE } from "@/capture/ui/look";
import { lensFor } from "@/capture/ui/rangefinder/useLenses";

describe("lens default", () => {
  it("starts on 1x, with or without an ultra-wide", () => {
    expect(lensFor("AVCaptureDeviceTypeBuiltInUltraWideCamera", null)).toBe("main");
    expect(lensFor(null, null)).toBe("main");
  });

  it("keeps the player's own choice, but never a lens the phone doesn't have", () => {
    expect(lensFor("ultra", "main")).toBe("main");
    expect(lensFor("ultra", "wide")).toBe("wide");
    expect(lensFor(null, "wide")).toBe("main");
  });
});

describe("turnPlan: photos and turn per lens", () => {
  const view = (half: number, mm: number) => 2 * Math.atan(half / mm) * (180 / Math.PI);

  it("shoots 1x in the sensor's own 3:4 and 0.5x tall, 9:16, as the viewfinder frames them", () => {
    expect(LENS_ASPECT.main).toBe(ref.layout.camera.frameAspect);
    expect(LENS_ASPECT.wide).toBe(ref.layout.camera.frameAspectWide);
    // A 4:3 sensor with the 43.27 mm full-frame diagonal: 34.62 x 25.96.
    expect(SENSOR_MM.long).toBeCloseTo(34.62, 2);
    expect(SENSOR_MM.short).toBeCloseTo(25.96, 2);
    // 1x keeps the short side; 0.5x cuts it to 9/16 of the long side.
    expect(frameHalfMm("main")).toBeCloseTo(12.98, 2);
    expect(frameHalfMm("wide")).toBeCloseTo(9.74, 2);
  });

  it("uses the lenses' views across their frames: 1x 53.1 degrees (26 mm), 0.5x 73.7 (13 mm)", () => {
    expect(LENS_MM).toEqual({ main: 26, wide: 13 });
    expect(LENS_FOV.main).toBeCloseTo(view(frameHalfMm("main"), 26), 12);
    expect(LENS_FOV.main).toBeCloseTo(53.06, 2);
    // A 24 mm main lens (the Camera app's 1x on newer iPhones) sees 56.8: 26 errs toward more overlap.
    expect(LENS_FOV.main).toBeLessThan(view(frameHalfMm("main"), 24));
    expect(LENS_FOV.wide).toBeCloseTo(view(frameHalfMm("wide"), 13), 12);
    expect(LENS_FOV.wide).toBeCloseTo(73.66, 2);
  });

  it("aims for neighbours sharing at least 15 % of the view", () => {
    expect(TARGET_OVERLAP).toBe(0.15);
    expect(MIN_OVERLAP).toBe(0);
  });

  it("takes 8 photos 45 degrees apart on 1x, the default, neighbours sharing 8 degrees (15 %)", () => {
    const plan = turnPlan("main");
    expect(plan.shots).toBe(8);
    expect(plan.step).toBe(45);
    expect(plan.overlap).toBeCloseTo((LENS_FOV.main - 45) / LENS_FOV.main, 12);
    expect(plan.overlap).toBeCloseTo(0.152, 3);
    expect(plan.overlap).toBeGreaterThanOrEqual(TARGET_OVERLAP);
    expect(plan.overlaps).toBe(true);
    // 7 (51.4 apart) would share under 4 %.
    expect((LENS_FOV.main - 360 / 7) / LENS_FOV.main).toBeLessThan(TARGET_OVERLAP);
    // The limit is 1x's full turn.
    expect(MAX_PLATES).toBe(8);
  });

  it("takes 6 photos 60 degrees apart on 0.5x, sharing 13.7 degrees (19 %)", () => {
    const plan = turnPlan("wide");
    expect(plan.shots).toBe(6);
    expect(plan.step).toBe(60);
    expect(plan.overlap).toBeCloseTo((LENS_FOV.wide - 60) / LENS_FOV.wide, 12);
    expect(plan.overlap).toBeCloseTo(0.185, 3);
    expect(plan.overlaps).toBe(true);
  });

  it("held to a lower limit, widens the turn to close the circle, and says the photos only just meet", () => {
    const plan = turnPlan("main", 6);
    expect(plan.shots).toBe(6);
    expect(plan.step).toBe(60);
    expect(plan.overlap).toBeLessThan(0);
    expect(plan.overlaps).toBe(false);
  });

  it("never plans fewer than the minimum or more than the maximum, and always goes all the way round", () => {
    for (const lens of ["wide", "main"] as const) {
      const plan = turnPlan(lens);
      expect(plan.shots).toBeGreaterThanOrEqual(MIN_PLATES);
      expect(plan.shots).toBeLessThanOrEqual(MAX_PLATES);
      expect(plan.shots * plan.step).toBeCloseTo(360, 5);
      expect(plan.overlap).toBeGreaterThanOrEqual(TARGET_OVERLAP);
    }
    expect(turnPlan("wide", 6, 8).shots).toBe(6);
  });
});

describe("rollPlan: the stops, and a lens switch mid-roll", () => {
  it("puts an even circle's stops a turn apart from photo 1 at 0: 8 at 45 on 1x, 6 at 60 on 0.5x", () => {
    expect(rollPlan("main").stops).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
    expect(rollPlan("wide").stops).toEqual([0, 60, 120, 180, 240, 300]);
    expect(rollPlan("wide")).toMatchObject(turnPlan("wide"));
    expect(rollPlan("main")).toMatchObject(turnPlan("main"));
  });

  it("keeps the stops of photos already placed and shares the rest of the circle evenly", () => {
    // 3 taken on 0.5x, then 1x: 240 degrees left need 6 gaps of at most 45.1: 5 more, 40 apart.
    const plan = rollPlan("main", [0, 60, 120]);
    expect(plan.shots).toBe(8);
    expect(plan.stops).toEqual([0, 60, 120, 160, 200, 240, 280, 320]);
    expect(plan.step).toBe(40);
    expect(plan.overlaps).toBe(true);
  });

  it("re-spaces for 0.5x after photos on 1x, at least as many as taken and never more than the limit", () => {
    // 3 taken on 1x, then 0.5x: 270 degrees left need 5 gaps of at most 62.6: 4 more, 54 apart.
    const plan = rollPlan("wide", [0, 45, 90]);
    expect(plan.shots).toBe(7);
    expect(plan.stops).toEqual([0, 45, 90, 144, 198, 252, 306]);
    expect(plan.overlaps).toBe(true);
    for (let n = 1; n <= MAX_PLATES; n += 1) {
      for (const lens of ["wide", "main"] as const) {
        const stops = dialStops(MAX_PLATES).slice(0, n);
        const p = rollPlan(lens, stops);
        expect(p.shots).toBeGreaterThanOrEqual(Math.max(n, MIN_PLATES));
        expect(p.shots).toBeLessThanOrEqual(MAX_PLATES);
        expect(p.stops.slice(0, n)).toEqual(stops);
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
    expect(main.shots).toBe(8);
    expect(switchLens(main, 3, "wide").stops).toEqual([0, 60, 120, 180, 240, 300]);
    // 1 taken on 1x: 0.5x's own 6.
    expect(switchLens(rollPlan("main"), 1, "wide").shots).toBe(6);
    // 5 of 8 taken on 1x, then 0.5x: the last 180 degrees in 3 turns of 60, so 7 in all.
    const late = switchLens(rollPlan("main"), 5, "wide");
    expect(late.stops).toEqual([0, 45, 90, 135, 180, 240, 300]);
  });

  it("switchLens: once every stop is reached the stops stay, and only the overlap follows the lens", () => {
    const wide = rollPlan("wide");
    const after = switchLens(wide, 6, "main");
    expect(after.stops).toBe(wide.stops);
    expect(after.shots).toBe(6);
    expect(after.overlaps).toBe(false);
  });

  it("firstLens: photos in before the lens was known get its even circle when it holds them", () => {
    expect(firstLens(rollPlan("main"), 3, "wide").stops).toEqual([0, 60, 120, 180, 240, 300]);
    expect(firstLens(rollPlan("main"), 6, "wide").stops).toEqual([0, 60, 120, 180, 240, 300]);
    // More than 0.5x's 6: they keep their stops.
    expect(firstLens(rollPlan("main"), 7, "wide").stops.slice(0, 7)).toEqual(rollPlan("main").stops.slice(0, 7));
    expect(firstLens(rollPlan("wide"), 3, "main").stops).toEqual(rollPlan("main").stops);
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

  it("reads a real turn to the right from iOS samples, 30 a second, as positive degrees", () => {
    let gravity = null as ReturnType<typeof smoothGravity> | null;
    let turned = 0;
    let last: number | null = null;
    // Upright, turning right (clockwise seen from above) at 60 deg/s: CoreMotion's
    // rotation about the device's y axis (up) is negative, gravity is down -y.
    for (let i = 0; i <= 15; i += 1) {
      const sample = { rotationRate: { alpha: 0, beta: -60, gamma: 0, timestamp: 5000 + i / 30 }, gravity: { x: 0, y: -9.8, z: 0 } };
      gravity = smoothGravity(gravity, sample.gravity);
      const dt = last === null ? 0 : sample.rotationRate.timestamp - last;
      last = sample.rotationRate.timestamp;
      turned = integrateTurn(turned, turnRate(rateAxes(sample.rotationRate, "ios"), gravity), dt);
    }
    // Half a second: 30 degrees, to the right.
    expect(turned).toBeCloseTo(30, 3);
    // Not yet 1x's 45 turn; 13 more degrees is (within 5 %: 42.75).
    expect(isTurnReached(turnProgress(turned, turnPlan("main").step))).toBe(false);
    expect(isTurnReached(turnProgress(turned + 12, turnPlan("main").step))).toBe(false);
    expect(isTurnReached(turnProgress(turned + 13, turnPlan("main").step))).toBe(true);
    // The same turn misread as rad/s (1.047) would be under the deadband: no turn at all.
    expect(integrateTurn(0, (60 * Math.PI) / 180, 1 / 30)).toBe(0);
  });

  it("reads a turn to the right as positive on Android too (gravity reported down, the gyroscope right-handed)", () => {
    // expo-sensors' Android accelerationIncludingGravity is accelerometer - 2 x gravity: pointing down, as on iOS.
    const kotlin = read("android/src/main/java/expo/modules/sensors/modules/DeviceMotionModule.kt");
    expect(kotlin).toMatch(/accelerationIncludingGravity\.values\[1\] - 2 \* gravity\.values\[1\]/);
    expect(turnRate(rateAxes({ alpha: 0, beta: -60, gamma: 0 }, "android"), { x: 0, y: -9.8, z: 0 })).toBeCloseTo(60, 9);
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

  it("measures progress turning right only, held to 0..1, and is far enough within 5 %", () => {
    expect(turnProgress(30, 60)).toBe(0.5);
    // A turn to the left goes away from the next stop.
    expect(turnProgress(-30, 60)).toBe(0);
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

describe("the turn guide's geometry: the last photo's edge on the feed", () => {
  const DEG = Math.PI / 180;
  /** The direction (degrees right of the feed's middle) a point at share `x` of the width shows. */
  const angleAt = (x: number, fov: number) => Math.atan((x - 0.5) * 2 * Math.tan((fov / 2) * DEG)) / DEG;

  it("projects directions through the lens as a pinhole: the middle at 0.5, the frame's sides at fov / 2", () => {
    for (const fov of [LENS_FOV.main, LENS_FOV.wide]) {
      expect(viewX(0, fov)).toBeCloseTo(0.5, 12);
      expect(viewX(fov / 2, fov)).toBeCloseTo(1, 12);
      expect(viewX(-fov / 2, fov)).toBeCloseTo(0, 12);
      expect(viewX(90, fov)).toBe(Infinity);
      expect(viewX(-95, fov)).toBe(-Infinity);
    }
  });

  it("puts the last photo's edge on the frame's right edge before any turn, and slides it left turning right", () => {
    const fov = LENS_FOV.main;
    expect(edgeX(0, fov)).toBeCloseTo(1, 12);
    // Half the view turned: the edge in the middle; the whole view: on the left edge.
    expect(edgeX(fov / 2, fov)).toBeCloseTo(0.5, 12);
    expect(edgeX(fov, fov)).toBeCloseTo(0, 12);
    // Heading deltas to screen shares, 1x (53.06 degrees across): 10 degrees right is 0.797 across, 20 is 0.615.
    const h = fov / 2;
    expect(edgeX(10, fov)).toBeCloseTo(0.5 + (0.5 * Math.tan((h - 10) * DEG)) / Math.tan(h * DEG), 12);
    expect(edgeX(10, fov)).toBeCloseTo(0.7973, 3);
    expect(edgeX(20, fov)).toBeCloseTo(0.6147, 3);
    // Monotonic: further right, further left on the feed; turning left takes it off the right side.
    for (let t = 0; t < 60; t += 1) expect(edgeX(t + 1, fov)).toBeLessThan(edgeX(t, fov));
    expect(edgeX(-5, fov)).toBeGreaterThan(1);
  });

  it("marks where the edge has to be for the plan's turn: 1x's 45 at 0.165 across, 0.5x's 60 at 0.214", () => {
    const main = turnPlan("main");
    const wide = turnPlan("wide");
    expect(targetX(main.step, LENS_FOV.main)).toBeCloseTo(0.5 - (0.5 * Math.tan((45 - LENS_FOV.main / 2) * DEG)) / Math.tan((LENS_FOV.main / 2) * DEG), 12);
    expect(targetX(main.step, LENS_FOV.main)).toBeCloseTo(0.1655, 3);
    expect(targetX(wide.step, LENS_FOV.wide)).toBeCloseTo(0.2142, 3);
    // On 393 x 852: 1x's 365-pt-wide 3:4 feed has the mark 60 pt in; 0.5x's 273.8-pt 9:16 one, 58.7.
    expect(targetX(main.step, LENS_FOV.main) * 365).toBeCloseTo(60.4, 0);
    expect(targetX(wide.step, LENS_FOV.wide) * 273.8).toBeCloseTo(58.7, 0);
  });

  it("leaves exactly the plan's overlap left of the mark: the angle from the frame's left edge to it is fov - step", () => {
    for (const lens of ["main", "wide"] as const) {
      const { step } = turnPlan(lens);
      const fov = LENS_FOV[lens];
      expect(angleAt(targetX(step, fov), fov) + fov / 2).toBeCloseTo(fov - step, 9);
    }
  });

  it("slides the last photo by the edge's travel, so it lines up with the room across the whole overlap", () => {
    for (const lens of ["main", "wide"] as const) {
      const { step } = turnPlan(lens);
      const fov = LENS_FOV[lens];
      const shift = edgeX(step, fov) - 1;
      // Every direction the two photos share: where it was in the last photo, shifted, against where it is now.
      for (let a = fov / 2 - (fov - step); a <= fov / 2; a += 0.5) {
        const was = viewX(a, fov);
        const now = viewX(a - step, fov);
        // Exact at both ends of the strip; between them within 0.5 % of the width on 1x, 1.6 % on 0.5x (4 pt of 274), where the view is widest.
        expect(Math.abs(was + shift - now)).toBeLessThan(lens === "main" ? 0.005 : 0.016);
      }
      expect(viewX(fov / 2 - (fov - step), fov) + shift).toBeCloseTo(0, 9);
      expect(viewX(fov / 2, fov) + shift).toBeCloseTo(edgeX(step, fov), 12);
    }
  });
});

describe("the turn guide's ghost: the last photo in strips, each on its part of the room", () => {
  it("maps a share of the feed back to its direction (viewX's inverse)", () => {
    for (const fov of [LENS_FOV.main, LENS_FOV.wide]) {
      for (const a of [-30, -10, 0, 7.5, 20]) expect(angleAtX(viewX(a, fov), fov)).toBeCloseTo(a, 9);
    }
  });

  it("puts each strip's sides where their directions now are, so 10 strips (the guide's) lie on the room within 0.4 % of the width (about 1 pt)", () => {
    for (const lens of ["main", "wide"] as const) {
      const fov = LENS_FOV[lens];
      for (const turned of [0, 10, turnPlan(lens).step]) {
        const n = GUIDE.ghostStrips;
        for (let i = 0; i < n; i += 1) {
          const { left, right } = ghostStrip(i / n, (i + 1) / n, turned, fov);
          const exact = viewX(angleAtX(i / n, fov) - turned, fov);
          if (exact >= -1) expect(left).toBeCloseTo(exact, 12);
          // Inside the strip, stretched evenly: against the true place of each direction still on the feed.
          for (let k = 0; k <= 10; k += 1) {
            const x = (i + k / 10) / n;
            const drawn = left + (right - left) * (k / 10);
            const truth = viewX(angleAtX(x, fov) - turned, fov);
            if (truth >= 0 && truth <= 1) expect(Math.abs(drawn - truth)).toBeLessThan(0.004);
          }
        }
        // The last strip ends on the edge line.
        expect(ghostStrip((n - 1) / n, 1, turned, fov).right).toBeCloseTo(edgeX(turned, fov), 12);
      }
    }
  });

  it("holds directions behind the phone just short of it, far off the feed, never at infinity", () => {
    const { left, right } = ghostStrip(0, 0.125, 120, LENS_FOV.main);
    expect(Number.isFinite(left)).toBe(true);
    expect(right).toBeLessThan(-10);
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
