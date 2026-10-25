import { clampTransform, containBox, doubleTapTarget, hitSlopFor, maxTranslate, zoomAround } from "../geometry";

describe("containBox", () => {
  it("letterboxes a portrait photo top and bottom on a tall viewport", () => {
    expect(containBox({ width: 390, height: 600 }, 3 / 4)).toEqual({ x: 0, y: 40, width: 390, height: 520 });
  });

  it("pillarboxes when the viewport is wider than the photo", () => {
    expect(containBox({ width: 800, height: 600 }, 3 / 4)).toEqual({ x: 175, y: 0, width: 450, height: 600 });
  });

  it("returns an empty box before layout", () => {
    expect(containBox({ width: 0, height: 0 }, 1)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it("keeps a normalized rect on the same image point at any viewport", () => {
    // The drawer's centre must land on the same fraction of the image.
    for (const viewport of [{ width: 320, height: 480 }, { width: 430, height: 700 }, { width: 1024, height: 700 }]) {
      const box = containBox(viewport, 3 / 4);
      const cx = box.x + (0.10 + 0.25 / 2) * box.width;
      expect((cx - box.x) / box.width).toBeCloseTo(0.225);
    }
  });
});

describe("zoom and pan", () => {
  const viewport = { width: 400, height: 600 };
  const image = { width: 400, height: 533 };

  it("keeps the image covering the viewport when panning", () => {
    expect(maxTranslate(400, 400, 1)).toBe(0);
    expect(maxTranslate(400, 400, 2)).toBe(200);
    expect(clampTransform({ scale: 2, tx: 999, ty: -999 }, viewport, image)).toEqual({ scale: 2, tx: 200, ty: -233 });
  });

  it("clamps scale to the supported range", () => {
    expect(clampTransform({ scale: 0.3, tx: 50, ty: 0 }, viewport, image).scale).toBe(1);
    expect(clampTransform({ scale: 12, tx: 0, ty: 0 }, viewport, image).scale).toBe(4);
  });

  it("zooms around the focal point so the pinched spot stays under the fingers", () => {
    const focal = { x: 300, y: 200 };
    const t = zoomAround({ scale: 1, tx: 0, ty: 0 }, focal, focal, 2, viewport);
    // Image-local point under the focal before and after must match.
    const before = { x: (focal.x - 200 - 0) / 1, y: (focal.y - 300 - 0) / 1 };
    const after = { x: (focal.x - 200 - t.tx) / t.scale, y: (focal.y - 300 - t.ty) / t.scale };
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("double-tap toggles between 1x and 2x", () => {
    const zoomed = doubleTapTarget({ scale: 1, tx: 0, ty: 0 }, { x: 200, y: 300 }, viewport, image);
    expect(zoomed.scale).toBe(2);
    expect(doubleTapTarget(zoomed, { x: 10, y: 10 }, viewport, image)).toEqual({ scale: 1, tx: 0, ty: 0 });
  });
});

describe("hitSlopFor", () => {
  it("pads small hotspots up to the minimum target", () => {
    expect(hitSlopFor({ width: 20, height: 60 }, 48)).toEqual({ left: 14, right: 14, top: 0, bottom: 0 });
    expect(hitSlopFor({ width: 100, height: 100 }, 48)).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
  });
});
