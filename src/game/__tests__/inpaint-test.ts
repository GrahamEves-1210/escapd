import { FILL, featherAlpha, holeMask, makePatch, padRect, pushPullFill, ringStats, type PixelRegion, type Rect } from "../inpaint";

/** A region `w` x `h` coloured by `paint(x, y)`, its box at `box`. */
function region(w: number, h: number, box: Rect, paint: (x: number, y: number) => [number, number, number]): PixelRegion {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = paint(x, y);
      data.set([r, g, b, 255], (y * w + x) * 4);
    }
  }
  return { data, width: w, height: h, box };
}

/** A flat wall (rgb) with a bright object filling `box`. */
function wallWithObject(w: number, h: number, box: Rect, wall: [number, number, number]) {
  return region(w, h, box, (x, y) => (x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h ? [250, 240, 10] : wall));
}

const BOX: Rect = { x: 20, y: 16, w: 60, h: 48 };

describe("pushPullFill", () => {
  it("fills every hole pixel and leaves every other pixel as it was", () => {
    const r = wallWithObject(100, 80, BOX, [90, 100, 110]);
    const mask = holeMask(r.width, r.height, r.box);
    const out = pushPullFill(r.data, r.width, r.height, mask);
    for (let i = 0; i < mask.length; i++) {
      const px = Array.from(out.subarray(i * 4, i * 4 + 4));
      if (mask[i]) {
        // The object is gone: the wall's colour, give or take a level.
        expect(Math.abs(px[0] - 90)).toBeLessThanOrEqual(1);
        expect(Math.abs(px[1] - 100)).toBeLessThanOrEqual(1);
        expect(Math.abs(px[2] - 110)).toBeLessThanOrEqual(1);
        expect(px[3]).toBe(255);
      } else {
        expect(px).toEqual(Array.from(r.data.subarray(i * 4, i * 4 + 4)));
      }
    }
  });

  it("carries a gradient across the hole smoothly, with no frame at its edge", () => {
    const r = region(120, 90, BOX, (x) => {
      const v = Math.round(60 + x);
      return [v, v, v];
    });
    const mask = holeMask(r.width, r.height, r.box);
    const out = pushPullFill(r.data, r.width, r.height, mask);
    // Along the hole's middle row the fill rises steadily, close to the ramp it hides.
    const y = Math.round(BOX.y + BOX.h / 2);
    for (let x = 1; x < r.width; x++) {
      const step = out[(y * r.width + x) * 4] - out[(y * r.width + x - 1) * 4];
      expect(step).toBeGreaterThanOrEqual(-1);
      expect(step).toBeLessThanOrEqual(4);
    }
    const mid = out[(y * r.width + 50) * 4];
    expect(Math.abs(mid - 110)).toBeLessThanOrEqual(6);
  });

  it("gives finite bytes for any input, and leaves a region with nothing known alone", () => {
    const r = wallWithObject(9, 7, { x: 2, y: 2, w: 4, h: 3 }, [5, 250, 128]);
    const out = pushPullFill(r.data, r.width, r.height, holeMask(r.width, r.height, r.box));
    expect(out.every((v) => Number.isFinite(v) && v >= 0 && v <= 255)).toBe(true);
    const all = new Uint8Array(r.width * r.height).fill(1);
    expect(Array.from(pushPullFill(r.data, r.width, r.height, all))).toEqual(Array.from(r.data));
  });
});

describe("makePatch", () => {
  it("keeps a flat background flat within the grain, and the same seed gives the same bytes", () => {
    const r = wallWithObject(100, 80, BOX, [120, 120, 120]);
    const patch = makePatch(r, 7);
    const mask = holeMask(r.width, r.height, r.box);
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) continue;
      // A flat, noiseless ring: no grain is added, so the fill is the wall.
      expect(Math.abs(patch[i * 4] - 120)).toBeLessThanOrEqual(1);
    }
    expect(Array.from(makePatch(r, 7))).toEqual(Array.from(patch));
  });

  it("matches the ring's grain: a noisy wall's fill is about as noisy, never smeared flat", () => {
    let seed = 1;
    const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 24;
    const r = region(100, 80, BOX, (x, y) => {
      const inBox = x >= BOX.x && x < BOX.x + BOX.w && y >= BOX.y && y < BOX.y + BOX.h;
      const v = Math.round(inBox ? 240 : 120 + noise());
      return [v, v, v];
    });
    const ring = ringStats(r)!;
    expect(ring.noise).toBeGreaterThan(4);
    const patch = makePatch(r, 3);
    const mask = holeMask(r.width, r.height, r.box);
    const values: number[] = [];
    for (let i = 0; i < mask.length; i++) if (mask[i]) values.push(patch[i * 4]);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
    expect(Math.abs(mean - 120)).toBeLessThan(3);
    expect(sd).toBeGreaterThan(ring.noise * 0.6);
    expect(sd).toBeLessThan(FILL.maxGrain * 1.5);
  });

  it("is opaque over the hole and feathers to clear past it", () => {
    const r = wallWithObject(100, 80, BOX, [90, 90, 90]);
    const data = new Uint8Array(r.data);
    featherAlpha(data, r.width, r.height, r.box);
    const hole = padRect(BOX, FILL.holePad);
    const alpha = (x: number, y: number) => data[(y * r.width + x) * 4 + 3];
    expect(alpha(Math.round(hole.x + 1), Math.round(hole.y + 1))).toBe(255);
    expect(alpha(50, 40)).toBe(255);
    // Past the hole by more than the feather: clear.
    expect(alpha(0, 0)).toBe(0);
    expect(alpha(99, 79)).toBe(0);
    // Just past it: partly there.
    const edge = alpha(Math.floor(hole.x + hole.w) + 1, 40);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(255);
  });
});

describe("ringStats", () => {
  it("passes a lit wall's gradient as plain and finds a busy ring busy", () => {
    const lit = region(100, 80, BOX, (x, y) => {
      const v = Math.round(60 + x * 0.8 + y * 0.5);
      return [v, v, v];
    });
    expect(ringStats(lit)!.residual).toBeLessThan(1);
    const stripes = region(100, 80, BOX, (x) => (Math.floor(x / 3) % 2 ? [200, 60, 60] : [30, 30, 90]));
    expect(ringStats(stripes)!.residual).toBeGreaterThan(30);
  });

  it("can't measure a ring that falls outside the region", () => {
    expect(ringStats(wallWithObject(10, 10, { x: 0, y: 0, w: 10, h: 10 }, [1, 2, 3]))).toBeNull();
  });
});
