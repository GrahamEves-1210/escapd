import { render } from "@testing-library/react-native";
import { color, ref } from "@/theme/tokens";
import { artBox } from "../GuideArt";
import { FILLS, INKS, drawList, type DrawList, type DrawOp, type Gradient } from "../art/draw";
import { pathBounds, pathPoints } from "../art/geometry";
import { SCENES } from "../art/scenes";
import { StepArt } from "../art/StepArt";

const G = ref.layout.guide;
const ART = G.art;
const INK = G.ink;
const STROKE = ref.icon.illustrationStroke;

const steps = SCENES.map((scene, i) => [i + 1, scene] as const);

const gradientOf = (list: DrawList, paint: string): Gradient | undefined => {
  const id = /^url\(#(.+)\)$/.exec(paint)?.[1];
  return id ? list.gradients.find((g) => g.id === id) : undefined;
};

/** The ink's bounding box, stroke included (curves stay inside their control points). */
function inkBounds(list: DrawList) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const op of list.ops) {
    for (const [x, y] of pathPoints(op.d)) {
      xs.push(x);
      ys.push(y);
    }
  }
  const half = STROKE / 2;
  return { left: Math.min(...xs) - half, right: Math.max(...xs) + half, top: Math.min(...ys) - half, bottom: Math.max(...ys) + half };
}

/** The hero-ink shapes: the phone that is taking the shot. */
const heroOps = (list: DrawList) => list.ops.filter((op) => op.stroke === INKS.hero);

describe("guide line art", () => {
  it("has one scene per step", () => {
    expect(SCENES).toHaveLength(4);
  });

  it.each(steps)("step %i keeps its ink inside the art box, no wider than inkMax", (_, scene) => {
    const ink = inkBounds(drawList(scene, "t"));
    expect(ink.right - ink.left).toBeLessThanOrEqual(ART.inkMax);
    // Context lines may run to the box's edge, where they have faded out.
    expect(ink.left).toBeGreaterThanOrEqual(-STROKE);
    expect(ink.right).toBeLessThanOrEqual(ART.width + STROKE);
    expect(ink.top).toBeGreaterThanOrEqual(-STROKE);
    expect(ink.bottom).toBeLessThanOrEqual(ART.height + STROKE);
  });

  it("draws in the reference's greys: white hero, #DDD mid, #7F7F7F back, #555 context, no brass", () => {
    expect(INKS).toMatchObject({
      hero: ref.color.textPrimary,
      mid: ref.color.lineMid,
      back: ref.color.lineBack,
      context: ref.color.lineContext,
      bezel: ref.color.lineBack,
      screen: ref.color.lineContext,
    });
    expect(FILLS.device).toBe(ref.gradient.deviceFill);
    const all = JSON.stringify(SCENES.map((scene, i) => drawList(scene, `s${i}`)));
    expect(all).not.toContain(color.accent);
    expect(all).not.toContain("rgba");
  });

  it.each(steps)("step %i strokes only in its inks and widths, and fills only black or the measured gradients", (_, scene) => {
    const list = drawList(scene, "t");
    const inks = Object.values(INKS);
    const fillStops = [...Object.values(FILLS).map((f) => f.stops)];
    for (const op of list.ops) {
      expect([STROKE, INK.thin, 0]).toContain(op.strokeWidth);
      if (op.strokeWidth > 0) {
        const g = gradientOf(list, op.stroke);
        // A gradient stroke starts at one of the inks (a fade, or the screen's edge).
        if (g) expect(inks).toContain(g.stops[0].color);
        else expect(inks).toContain(op.stroke);
      } else {
        expect(op.stroke).toBe("none");
      }
      if (op.fill !== "none" && op.fill !== ref.color.void) {
        expect(fillStops).toContainEqual(gradientOf(list, op.fill)?.stops);
      }
    }
  });

  it("gives every gradient plain hex stops with their own opacities", () => {
    for (const scene of SCENES) {
      for (const g of drawList(scene, "t").gradients) {
        for (const s of g.stops) {
          expect(s.color).toMatch(/^#[0-9A-F]{6}$/i);
          expect(s.opacity).toBeGreaterThanOrEqual(0);
          expect(s.opacity).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("fades context lines toward the bottom (fade.from to fade.to) and rays over their last endFade", () => {
    let downs = 0;
    let ends = 0;
    SCENES.forEach((scene, i) => {
      const list = drawList(scene, `s${i}`);
      scene.marks.forEach((mark, m) => {
        if (!mark.fade) return;
        const g = gradientOf(list, list.ops[m].stroke);
        expect(g).toBeDefined();
        if (!g) return;
        expect(g.stops.map((s) => s.opacity)).toEqual([1, 0]);
        if (mark.fade === "down") {
          downs += 1;
          expect(g).toMatchObject({ y1: INK.fade.from, y2: INK.fade.to, x1: g.x2 });
        } else {
          ends += 1;
          expect(Math.hypot(g.x2 - g.x1, g.y2 - g.y1)).toBeCloseTo(INK.endFade, 5);
        }
      });
    });
    expect(downs).toBeGreaterThan(0);
    expect(ends).toBeGreaterThan(0);
  });

  it("holds the hero phone in the same place on steps 1, 3 and 4: 70 x 137 at corners 10.5, the device fill, a thin inner screen darkening downward", () => {
    const P = G.phone;
    const boxes = [0, 2, 3].map((i) => {
      const list = drawList(SCENES[i], "t");
      const hero = heroOps(list);
      // The phone is the only hero shape.
      expect(hero).toHaveLength(1);
      const [body] = hero;
      expect(body.strokeWidth).toBe(STROKE);
      expect(gradientOf(list, body.fill)?.stops).toBe(ref.gradient.deviceFill.stops);
      const box = pathBounds(body.d);
      expect(box.width).toBeCloseTo(P.width, 5);
      expect(box.height).toBeCloseTo(P.height, 5);
      // The thin lineBack bezel just inside the outline.
      const bezel = list.ops.find((op) => op.stroke === INKS.bezel && op.strokeWidth === INK.thin);
      const inside = pathBounds(bezel?.d ?? "");
      expect(inside.x - box.x).toBeCloseTo(P.bezel.inset, 5);
      expect(inside.width).toBeCloseTo(P.width - P.bezel.inset * 2, 5);
      expect(inside.height).toBeCloseTo(P.height - P.bezel.inset * 2, 5);
      // The inner screen: inset 13 / 24.5 / 27, a lineContext edge darkening to screenBottom.
      const screen = list.ops.find((op) => {
        const g = gradientOf(list, op.stroke);
        return op.strokeWidth === INK.thin && g?.stops[1]?.color === INK.screenBottom;
      });
      expect(screen).toBeDefined();
      const inner = pathBounds(screen?.d ?? "");
      expect(inner.x - box.x).toBeCloseTo(P.screen.insetX, 5);
      expect(inner.y - box.y).toBeCloseTo(P.screen.insetTop, 5);
      expect(box.y + box.height - (inner.y + inner.height)).toBeCloseTo(P.screen.insetBottom, 5);
      expect(gradientOf(list, screen?.stroke ?? "")?.stops.map((s) => s.color)).toEqual([ref.color.lineContext, INK.screenBottom]);
      return box;
    });
    expect(boxes[1]).toEqual(boxes[0]);
    expect(boxes[2]).toEqual(boxes[0]);
  });

  it.each([1, 4])("step %i's fingertips are drawn over the phone, void-filled, and hide its right edge from y 181 to 242", (n) => {
    const list = drawList(SCENES[n - 1], "t");
    const phone = list.ops.findIndex((op) => op.stroke === INKS.hero);
    const front = list.ops.slice(phone + 1).filter((op) => op.fill === ref.color.void);
    expect(front).toHaveLength(3);
    const right = pathBounds(list.ops[phone].d);
    const edge = right.x + right.width;
    // Each lobe reaches left of the phone's edge; stacked, they span its run.
    const spans = front.map((op) => pathBounds(op.d));
    spans.forEach((b) => expect(b.x).toBeLessThan(edge - STROKE / 2));
    expect(Math.min(...spans.map((b) => b.y))).toBeLessThanOrEqual(181);
    expect(Math.max(...spans.map((b) => b.y + b.height))).toBeGreaterThanOrEqual(242);
  });

  it("step 2 is a plan: three device-filled phones, one of them hero, and one lit view", () => {
    const list = drawList(SCENES[1], "t");
    const phones = list.ops.filter((op) => op.strokeWidth > 0 && gradientOf(list, op.fill)?.stops === ref.gradient.deviceFill.stops);
    expect(phones).toHaveLength(3);
    expect(heroOps(list)).toHaveLength(1);
    // The hero's view: a device-filled shape with no stroke.
    const beams = list.ops.filter((op) => op.strokeWidth === 0 && gradientOf(list, op.fill)?.stops === ref.gradient.deviceFill.stops);
    expect(beams).toHaveLength(1);
  });

  it("renders every step as SVG", async () => {
    for (let i = 0; i < SCENES.length; i += 1) {
      await render(<StepArt step={i} width={ART.width} height={ART.height} />);
    }
  });

  it("draws only absolute M, L, H, V, C and Z path data", () => {
    const ops: DrawOp[] = SCENES.flatMap((scene) => drawList(scene, "t").ops);
    for (const op of ops) expect(op.d).toMatch(/^M[-\d. MLHVCZ]*$/);
  });
});

describe("guide art band", () => {
  const { above: ABOVE, below: BELOW, clear: CLEAR } = G.voids;
  // The band from the disc's bottom to the title on the base device (y 119-613).
  const BASE = ABOVE + ART.height + BELOW;

  it("puts the drawing at y 266-532 on the base device, 147 below the disc and 81 above the title, also before the first layout", () => {
    expect(BASE).toBe(494);
    expect(artBox(BASE)).toEqual({ visible: true, scale: 1, above: ABOVE, below: BELOW });
    expect(artBox(null)).toEqual(artBox(BASE));
  });

  it("takes text growth out of the void under the drawing first, so the drawing doesn't move", () => {
    const room = BELOW - CLEAR;
    for (const growth of [1, room / 2, room]) {
      const box = artBox(BASE - growth);
      expect(box).toMatchObject({ above: ABOVE, scale: 1 });
      expect(box.below).toBeCloseTo(BELOW - growth, 5);
    }
  });

  it("then takes it from the void above, then shrinks the drawing evenly with CLEAR above and below, and hides it below minHeight", () => {
    const gapUsed = BASE - (BELOW - CLEAR);
    expect(artBox(gapUsed - (ABOVE - CLEAR))).toMatchObject({ above: CLEAR, scale: 1, below: CLEAR });
    const smallest = artBox(CLEAR * 2 + ART.minHeight);
    expect(smallest.visible).toBe(true);
    expect(smallest.scale).toBeCloseTo(ART.minHeight / ART.height, 5);
    expect(smallest).toMatchObject({ above: CLEAR, below: CLEAR });
    expect(artBox(CLEAR * 2 + ART.minHeight - 1).visible).toBe(false);
  });

  it("shares a taller band's free height in the base device's proportions", () => {
    const box = artBox(BASE * 2 - ART.height);
    expect(box.scale).toBe(1);
    expect(box.above).toBeCloseTo(ABOVE * 2, 5);
    expect(box.below).toBeCloseTo(BELOW * 2, 5);
  });
});
