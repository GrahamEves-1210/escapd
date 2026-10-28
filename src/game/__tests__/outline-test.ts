// The outline tracer on drawn scenes: a dark disc on a light, textured wall; a
// drawer front filling its box; a lamp whose stem is a few pixels wide.
import { traceOutline } from "../outline";

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
