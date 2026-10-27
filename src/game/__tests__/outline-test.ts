// The outline tracer on a drawn scene: a dark disc on a light, textured wall.
import { traceOutline } from "../outline";

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

  it("trusts no shape when nothing stands out", () => {
    const W = 80, H = 80;
    const flat = scene(W, H, -100, -100, 1);
    expect(traceOutline({ data: flat, width: W, height: H, box: { x: 10, y: 10, w: 60, h: 60 } })).toBeNull();
  });
});
