// Home's motion parallax: the maths (tilt.ts). The phone's lean from gravity, the rest pose that follows
// however it is held, the dead band, each layer's slide, the web's pointer and the pinned tilt.
import { PARALLAX } from "../../art/nook";
import { NO_REST, NO_TILT, aimTilt, layerShift, movesTilt, parseTilt, pointerTilt, tiltAngles } from "../tilt";

const G = 9.81;
const deg = (d: number) => (d * Math.PI) / 180;
/** Gravity in the phone's axes for a phone pitched back `pitch` from upright and rolled `roll` to the right. */
const gravity = (pitch: number, roll: number) => ({
  x: G * Math.sin(deg(roll)),
  y: -G * Math.cos(deg(roll)) * Math.cos(deg(pitch)),
  z: -G * Math.cos(deg(roll)) * Math.sin(deg(pitch)),
});

describe("the phone's lean", () => {
  it("reads roll and pitch from gravity: upright is level, flat on its back a quarter turn, the right edge dipping is +roll", () => {
    expect(tiltAngles(gravity(0, 0))).toEqual({ roll: 0, pitch: expect.closeTo(0, 6) });
    expect(tiltAngles(gravity(90, 0))?.pitch).toBeCloseTo(Math.PI / 2, 6);
    expect(tiltAngles(gravity(45, 0))?.pitch).toBeCloseTo(deg(45), 6);
    expect(tiltAngles(gravity(45, 10))?.roll).toBeCloseTo(deg(10), 6);
    expect(tiltAngles(gravity(45, -10))?.roll).toBeCloseTo(deg(-10), 6);
    // The size of gravity doesn't matter (a hand's push adds to it), only its direction.
    const g = gravity(30, 5);
    expect(tiltAngles({ x: g.x * 1.3, y: g.y * 1.3, z: g.z * 1.3 })).toEqual({ roll: expect.closeTo(deg(5), 6), pitch: expect.closeTo(deg(30), 6) });
  });

  it("reads nothing in free fall or from a broken sample", () => {
    expect(tiltAngles({ x: 0, y: 0, z: 0 })).toBeNull();
    expect(tiltAngles({ x: Number.NaN, y: 1, z: 1 })).toBeNull();
  });
});

describe("the tilt the layers head for", () => {
  it("takes however the phone is held as rest, then measures from it: right edge down shows the scene from the left, top away from below", () => {
    const first = aimTilt(NO_REST, deg(3), deg(50), 0);
    expect(first.aim).toEqual(NO_TILT);
    expect(first.rest).toEqual({ roll: deg(3), pitch: deg(50), primed: true });
    const dt = PARALLAX.interval / 1000;
    const right = aimTilt(first.rest, deg(3) + PARALLAX.range / 2, deg(50), dt);
    expect(right.aim.x).toBeLessThan(-0.45);
    expect(right.aim.x).toBeGreaterThan(-0.5);
    expect(right.aim.y).toBeCloseTo(0, 6);
    const away = aimTilt(first.rest, deg(3), deg(50) + PARALLAX.range / 2, dt);
    expect(away.aim.y).toBeGreaterThan(0.45);
    expect(away.aim.x).toBeCloseTo(0, 6);
  });

  it("never passes full tilt, however far the phone turns", () => {
    const rest = { roll: 0, pitch: 1, primed: true };
    const far = aimTilt(rest, -2, 3, 0.03);
    expect(far.aim).toEqual({ x: 1, y: 1 });
  });

  it("re-centres slowly: a new way of holding the phone becomes neutral within a few seconds, and not at once", () => {
    let rest = aimTilt(NO_REST, 0, deg(40), 0).rest;
    const dt = PARALLAX.interval / 1000;
    const held = { roll: PARALLAX.range * 0.8, pitch: deg(40) };
    let aim = NO_TILT;
    const run = (seconds: number) => {
      for (let t = 0; t < seconds; t += dt) ({ rest, aim } = aimTilt(rest, held.roll, held.pitch, dt));
    };
    run(0.3);
    expect(Math.abs(aim.x)).toBeGreaterThan(0.7);
    run(PARALLAX.recentre * 4);
    expect(Math.abs(aim.x)).toBeLessThan(0.02);
  });

  it("holds still for a still hand: sensor noise inside the dead band moves nothing, a real move does, and it always comes exactly to rest", () => {
    const at = { x: 0.3, y: -0.2 };
    expect(movesTilt(at, { x: 0.3 + PARALLAX.dead * 0.6, y: -0.2 - PARALLAX.dead * 0.6 })).toBe(false);
    expect(movesTilt(at, { x: 0.3 + PARALLAX.dead * 1.5, y: -0.2 })).toBe(true);
    expect(movesTilt({ x: PARALLAX.dead / 2, y: 0 }, NO_TILT)).toBe(true);
    expect(movesTilt(NO_TILT, NO_TILT)).toBe(false);
  });
});

describe("a layer's slide", () => {
  it("is its depth at full tilt across, less up and down; nothing at rest; nothing at the sill's depth", () => {
    expect(layerShift({ x: 1, y: 1 }, 7)).toEqual({ x: 7, y: 7 * PARALLAX.vertical });
    expect(layerShift({ x: -0.5, y: 0 }, PARALLAX.depth.fore)).toEqual({ x: -0.5 * PARALLAX.depth.fore, y: 0 * PARALLAX.depth.fore * PARALLAX.vertical });
    expect(layerShift(NO_TILT, 7)).toEqual({ x: 0, y: 0 });
    const sill = layerShift({ x: 1, y: -1 }, PARALLAX.depth.sill);
    expect(Math.abs(sill.x) + Math.abs(sill.y)).toBe(0);
  });

  it("goes opposite ways behind and in front of the sill", () => {
    const tilt = { x: 0.6, y: 0.4 };
    expect(layerShift(tilt, PARALLAX.depth.sky).x).toBeGreaterThan(0);
    expect(layerShift(tilt, PARALLAX.depth.fore).x).toBeLessThan(0);
    expect(layerShift(tilt, PARALLAX.depth.card).y).toBeLessThan(0);
  });
});

describe("standing in for the tilt", () => {
  it("the web's pointer: its place in the window, -1..1 from the middle", () => {
    expect(pointerTilt(195, 422, 390, 844)).toEqual({ x: 0, y: 0 });
    expect(pointerTilt(0, 0, 390, 844)).toEqual({ x: -1, y: -1 });
    expect(pointerTilt(390, 844, 390, 844)).toEqual({ x: 1, y: 1 });
    expect(pointerTilt(900, -40, 390, 844)).toEqual({ x: 1, y: -1 });
    expect(pointerTilt(10, 10, 0, 0)).toEqual(NO_TILT);
  });

  it("a tilt pinned by hand for screenshots: two numbers, clamped; anything else is no pin", () => {
    expect(parseTilt("0.5,-1")).toEqual({ x: 0.5, y: -1 });
    expect(parseTilt("3,-9")).toEqual({ x: 1, y: -1 });
    expect(parseTilt("left")).toBeNull();
    expect(parseTilt("")).toBeNull();
    expect(parseTilt(null)).toBeNull();
  });
});
