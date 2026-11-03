// The outline tracer on drawn scenes: a dark disc on a light, textured wall; a
// drawer front filling its box; a lamp whose stem is a few pixels wide.
import { cleanOutline, outlinePath, traceOutline, type Point } from "../outline";
import { outlineOfMask } from "../../../supabase/functions/_shared/v2/outline";

type Paint = (x: number, y: number) => [number, number, number];

function draw(w: number, h: number, paint: Paint) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const n = ((x * 7 + y * 13) % 11) - 5;   // texture
      const [r, g, b] = paint(x, y);
      data[i] = r + n; data[i + 1] = g + n; data[i + 2] = b + n; data[i + 3] = 255;
    }
  }
  return data;
}

function scene(w: number, h: number, cx: number, cy: number, r: number) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const inside = (x - cx) ** 2 + (y - cy) ** 2 < r * r;
      const n = ((x * 7 + y * 13) % 11) - 5;   // wallpaper texture
      const v = inside ? 40 + n : 200 + n;
      data[i] = v; data[i + 1] = inside ? v + 10 : v; data[i + 2] = v; data[i + 3] = 255;
    }
  }
  return data;
}

describe("traceOutline", () => {
  it("hugs a round object inside its box, not the box", () => {
    const W = 120, H = 120;
    const pts = traceOutline({ data: scene(W, H, 60, 60, 30), width: W, height: H, box: { x: 20, y: 20, w: 80, h: 80 } })!;
    expect(pts).not.toBeNull();
    const radii = pts.map((p) => Math.hypot(p.x - 60, p.y - 60));
    // Every point near the disc's rim (r = 30), far inside the box's corners (r ~ 56).
    expect(Math.max(...radii)).toBeLessThan(35);
    expect(Math.min(...radii)).toBeGreaterThan(24);
  });

  it("keeps the edge of an object that fills its box (a drawer front in a desk)", () => {
    const W = 140, H = 100;
    const front = (x: number, y: number) => x >= 30 && x < 110 && y >= 25 && y < 75;
    const data = draw(W, H, (x, y) => (front(x, y) ? [150, 100, 60] : [105, 68, 40]));
    const pts = traceOutline({ data, width: W, height: H, box: { x: 30, y: 25, w: 80, h: 50 } })!;
    expect(pts).not.toBeNull();
    // Every point on the front's rectangle (within 2 px), and its corners reached.
    for (const p of pts) {
      const edge = Math.min(Math.abs(p.x - 30), Math.abs(p.x - 110), Math.abs(p.y - 25), Math.abs(p.y - 75));
      expect(edge).toBeLessThan(2);
    }
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    expect(Math.min(...xs)).toBeLessThan(32);
    expect(Math.max(...xs)).toBeGreaterThan(108);
    expect(Math.min(...ys)).toBeLessThan(27);
    expect(Math.max(...ys)).toBeGreaterThan(73);
  });

  it("follows a lamp from its shade down a thin stem to its base, in one outline", () => {
    const W = 120, H = 140;
    const shade = (x: number, y: number) => y >= 25 && y < 60 && Math.abs(x - 60) < 18 + (y - 25) * 0.6;
    const stem = (x: number, y: number) => y >= 60 && y < 100 && Math.abs(x - 60) < 2.5;
    const base = (x: number, y: number) => ((x - 60) / 20) ** 2 + ((y - 106) / 7) ** 2 < 1;
    const data = draw(W, H, (x, y) => (shade(x, y) ? [225, 205, 160] : stem(x, y) || base(x, y) ? [60, 52, 45] : [170, 160, 140]));
    const pts = traceOutline({ data, width: W, height: H, box: { x: 18, y: 20, w: 84, h: 96 } })!;
    expect(pts).not.toBeNull();
    const ys = pts.map((p) => p.y);
    expect(Math.min(...ys)).toBeLessThan(28);    // the shade's top
    expect(Math.max(...ys)).toBeGreaterThan(110); // the base's bottom
    // Halfway down the stem the outline is narrow (no wall between shade and base): where its edges cross y = 80.
    const crossings: number[] = [];
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length];
      if ((p.y - 80) * (q.y - 80) < 0) crossings.push(p.x + ((80 - p.y) / (q.y - p.y)) * (q.x - p.x));
    });
    expect(crossings.length).toBe(2);
    for (const x of crossings) expect(Math.abs(x - 60)).toBeLessThan(5);
  });

  it("trusts no shape when nothing stands out", () => {
    const W = 80, H = 80;
    const flat = scene(W, H, -100, -100, 1);
    expect(traceOutline({ data: flat, width: W, height: H, box: { x: 10, y: 10, w: 60, h: 60 } })).toBeNull();
  });
});

/** Points along an SVG path of M/C/Z commands (the cubics sampled). */
function sample(d: string, per = 12): Point[] {
  const nums = d.replace(/[MCZ]/g, " ").trim().split(/\s+/).map(Number);
  expect(nums.every(Number.isFinite)).toBe(true);
  const out: Point[] = [{ x: nums[0], y: nums[1] }];
  for (let i = 2; i + 5 < nums.length + 0; i += 6) {
    const p0 = out[out.length - 1];
    const [x1, y1, x2, y2, x3, y3] = nums.slice(i, i + 6);
    for (let k = 1; k <= per; k++) {
      const t = k / per, u = 1 - t;
      out.push({
        x: u * u * u * p0.x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
        y: u * u * u * p0.y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
      });
    }
  }
  return out;
}

describe("cleanOutline", () => {
  const door = [
    { x: 100, y: 100 }, { x: 108, y: 58 }, { x: 114, y: 100 },   // an ear: the trace jumping off the edge
    { x: 300, y: 100 }, { x: 300, y: 400 }, { x: 196, y: 400 }, { x: 200, y: 410 }, { x: 204, y: 400 }, // a notch... out
    { x: 100, y: 400 },
  ];

  it("drops a spike off a door's top edge and a nick in its bottom, keeping its four corners", () => {
    const pts = cleanOutline(door);
    expect(Math.min(...pts.map((p) => p.y))).toBe(100);
    expect(Math.max(...pts.map((p) => p.y))).toBe(400);
    for (const c of [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 400 }, { x: 100, y: 400 }]) {
      expect(pts.some((p) => p.x === c.x && p.y === c.y)).toBe(true);
    }
  });

  it("keeps a real part: a long arm that is a real share of the shape", () => {
    const lamp = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 40 }, { x: 55, y: 40 }, { x: 55, y: 160 }, { x: 45, y: 160 }, { x: 45, y: 40 }, { x: 0, y: 40 }];
    expect(cleanOutline(lamp)).toHaveLength(8);
  });

  it("undoes a loop that crosses itself, keeping the bigger part", () => {
    const bow = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 110, y: 90 }, { x: 90, y: 90 }, { x: 0, y: 100 }];
    const pts = cleanOutline(bow);
    // No two edges cross any more.
    const n = pts.length;
    const cross = (a: Point, b: Point, c: Point, d: Point) => {
      const o = (p: Point, q: Point, r: Point) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
      return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
    };
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      expect(cross(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])).toBe(false);
    }
  });
});

describe("outlinePath", () => {
  it("draws a polygon round a curve as a smooth curve (no kinks)", () => {
    const ring = Array.from({ length: 14 }, (_, i) => ({ x: 0.5 + 0.3 * Math.cos((i / 14) * 2 * Math.PI), y: 0.5 + 0.3 * Math.sin((i / 14) * 2 * Math.PI) }));
    const pts = sample(outlinePath(ring, 300, 300)!);
    let worst = 0;
    for (let i = 1; i + 1 < pts.length; i++) {
      const a = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
      const b = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
      let t = Math.abs(b - a);
      if (t > Math.PI) t = 2 * Math.PI - t;
      worst = Math.max(worst, (t * 180) / Math.PI);
    }
    expect(worst).toBeLessThan(6);
    // And it stays on the circle (no bulges between the points).
    for (const p of pts) expect(Math.abs(Math.hypot(p.x - 150, p.y - 150) - 90)).toBeLessThan(2.5);
  });

  it("keeps a door's corners crisp and its edges straight", () => {
    const door = [{ x: 0.2, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.5, y: 0.9 }, { x: 0.2, y: 0.9 }];
    const pts = sample(outlinePath(door, 400, 400)!);
    for (const p of pts) {
      const edge = Math.min(Math.abs(p.x - 80), Math.abs(p.x - 200), Math.abs(p.y - 40), Math.abs(p.y - 360));
      expect(edge).toBeLessThan(1.2);
    }
    // Into each corner within a couple of pixels.
    for (const c of [{ x: 80, y: 40 }, { x: 200, y: 40 }, { x: 200, y: 360 }, { x: 80, y: 360 }]) {
      expect(Math.min(...pts.map((p) => Math.hypot(p.x - c.x, p.y - c.y)))).toBeLessThan(2);
    }
  });

  it("is null for fewer than three points", () => {
    expect(outlinePath([{ x: 0, y: 0 }, { x: 1, y: 1 }], 100, 100)).toBeNull();
  });
});

describe("outlineOfMask (shared with the server)", () => {
  it("traces a door's mask without the ear stuck to its corner, on its real edge", () => {
    const W = 80, H = 140;
    const m = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const door = x >= 10 && x < 70 && y >= 20 && y < 130;
      const ear = x >= 14 && x < 17 && y >= 12 && y < 20;   // a few pixels of the frame caught beside the door
      m[y * W + x] = door || ear ? 1 : 0;
    }
    const pts = outlineOfMask(m, W, H)!;
    expect(pts).not.toBeNull();
    expect(Math.min(...pts.map((p) => p.y))).toBeGreaterThan(19);
    // On the door's edge (pixels 10..70, 20..130), not half a pixel inside it.
    for (const p of pts) {
      const edge = Math.min(Math.abs(p.x - 10), Math.abs(p.x - 70), Math.abs(p.y - 20), Math.abs(p.y - 130));
      expect(edge).toBeLessThan(1);
    }
  });
});
