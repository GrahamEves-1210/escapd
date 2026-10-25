import { render } from "@testing-library/react-native";
import { ref } from "@/theme/tokens";
import { artBox } from "../GuideArt";
import { drawList, type DrawList, type DrawOp } from "../art/draw";
import { phoneScreen, type Box } from "../art/geometry";
import { SCENES } from "../art/scenes";
import { StepArt } from "../art/StepArt";
import { CLOSE_SLOP } from "../layout";

const ART = ref.layout.guide.art;
const ILL = ref.illustration;
const TONES = [ILL.hero, ILL.mid, ILL.back, ILL.context];

type P = readonly [number, number];
/** A straight piece of a stroke; a curve contributes its control polygon (which bounds it). */
interface Seg {
  a: P;
  b: P;
  curve: boolean;
}

/** M/L/H/V/C/Z path data as segments. Each cubic adds all six control-point pairs: its hull's edges. */
function segments(d: string): Seg[] {
  const tokens = d.match(/[MLHVCZ]|-?\d*\.?\d+/gi) ?? [];
  const out: Seg[] = [];
  let cmd = "M";
  let at: P = [0, 0];
  let start: P = [0, 0];
  const line = (b: P) => {
    // A close that ends where it starts draws nothing.
    if (b[0] !== at[0] || b[1] !== at[1]) out.push({ a: at, b, curve: false });
    at = b;
  };
  for (let i = 0; i < tokens.length; ) {
    const t = tokens[i];
    if (/^[MLHVCZ]$/i.test(t)) {
      cmd = t.toUpperCase();
      i += 1;
      if (cmd === "Z") line(start);
      continue;
    }
    const num = (k: number) => Number(tokens[i + k]);
    if (cmd === "M") {
      at = [num(0), num(1)];
      start = at;
      // Further pairs after a moveto are linetos.
      cmd = "L";
      i += 2;
    } else if (cmd === "L") {
      line([num(0), num(1)]);
      i += 2;
    } else if (cmd === "H") {
      line([num(0), at[1]]);
      i += 1;
    } else if (cmd === "V") {
      line([at[0], num(0)]);
      i += 1;
    } else {
      const hull: P[] = [at, [num(0), num(1)], [num(2), num(3)], [num(4), num(5)]];
      hull.forEach((p, j) => hull.slice(j + 1).forEach((q) => out.push({ a: p, b: q, curve: true })));
      at = hull[3];
      i += 6;
    }
  }
  return out;
}

function rectSegments(box: Box): Seg[] {
  const { x, y, width, height } = box;
  const corners: P[] = [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ];
  return corners.map((a, i) => ({ a, b: corners[(i + 1) % corners.length], curve: false }));
}

/** Every stroked segment an op draws (rect corners taken square). */
function opSegments(op: DrawOp): Seg[] {
  if (op.strokeWidth === 0) return [];
  return op.kind === "rect" ? rectSegments(op.box) : segments(op.d);
}

function pointToSegment(p: P, a: P, b: P): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

const turn = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** The closest two segments come (0 where they cross). */
function segmentDistance(s: Seg, t: Seg): number {
  const crosses = turn(t.a, t.b, s.a) > 0 !== turn(t.a, t.b, s.b) > 0 && turn(s.a, s.b, t.a) > 0 !== turn(s.a, s.b, t.b) > 0;
  if (crosses) return 0;
  return Math.min(pointToSegment(s.a, t.a, t.b), pointToSegment(s.b, t.a, t.b), pointToSegment(t.a, s.a, s.b), pointToSegment(t.b, s.a, s.b));
}

/** Every coordinate in M/L/H/V/C/Z path data (curves stay inside their control points). */
function points(d: string): [number, number][] {
  const tokens = d.match(/[MLHVCZ]|-?\d*\.?\d+/gi) ?? [];
  const out: [number, number][] = [];
  let cmd = "M";
  let x = 0;
  let y = 0;
  for (let i = 0; i < tokens.length; ) {
    const t = tokens[i];
    if (/^[MLHVCZ]$/i.test(t)) {
      cmd = t.toUpperCase();
      i += 1;
      continue;
    }
    if (cmd === "H") {
      x = Number(t);
      i += 1;
    } else if (cmd === "V") {
      y = Number(t);
      i += 1;
    } else {
      x = Number(t);
      y = Number(tokens[i + 1]);
      i += 2;
    }
    out.push([x, y]);
  }
  return out;
}

function opsOf(list: DrawList): DrawOp[] {
  return [...list.under, ...list.clipped, ...list.over];
}

/** The ink's bounding box, stroke included, as a conservative bound. */
function inkBounds(list: DrawList) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const op of opsOf(list)) {
    if (op.kind === "rect") {
      xs.push(op.box.x, op.box.x + op.box.width);
      ys.push(op.box.y, op.box.y + op.box.height);
    } else {
      for (const [x, y] of points(op.d)) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  const half = ILL.stroke / 2;
  return { left: Math.min(...xs) - half, right: Math.max(...xs) + half, top: Math.min(...ys) - half, bottom: Math.max(...ys) + half };
}

const steps = SCENES.map((scene, i) => [i + 1, scene] as const);

describe("guide line art", () => {
  it("has one scene per step", () => {
    expect(SCENES).toHaveLength(4);
  });

  it.each(steps)("step %i keeps its ink inside the art box and no wider than inkMax, centred", (_, scene) => {
    const ink = inkBounds(drawList(scene, "t"));
    expect(ink.right - ink.left).toBeLessThanOrEqual(ART.inkMax);
    expect(ink.left).toBeGreaterThanOrEqual(0);
    expect(ink.right).toBeLessThanOrEqual(ART.width);
    expect(ink.top).toBeGreaterThanOrEqual(0);
    expect(ink.bottom).toBeLessThanOrEqual(ART.height);
    // Visual centre on the art box's centre (196.5 on screen).
    expect(Math.abs((ink.left + ink.right) / 2 - ART.width / 2)).toBeLessThanOrEqual(ref.space.xs);
  });

  it.each(steps)("step %i draws only in illustration tones, with surface fills and no colour", (_, scene) => {
    const list = drawList(scene, "t");
    const gradientColour = new Map(list.gradients.map((g) => [`url(#${g.id})`, g.color]));
    for (const op of opsOf(list)) {
      const stroke = gradientColour.get(op.stroke) ?? op.stroke;
      if (op.strokeWidth > 0) expect(TONES).toContain(stroke);
      expect([ILL.stroke, ref.border.hairline, 0]).toContain(op.strokeWidth);
      expect(["none", ref.color.panel, ref.color.ground]).toContain(op.fill);
    }
  });

  it("fades every faded line to transparent over exactly contextFade", () => {
    for (const scene of SCENES) {
      for (const g of drawList(scene, "t").gradients) {
        expect(Math.hypot(g.x2 - g.x1, g.y2 - g.y1)).toBeCloseTo(ILL.contextFade, 5);
      }
    }
  });

  it("draws the hero phone on steps 1, 3 and 4: 70 x 137, a 44 x 85.5 screen and four bright brackets inside it", () => {
    const phone = ref.layout.guide.phone;
    [0, 2, 3].forEach((i) => {
      const scene = SCENES[i];
      const list = drawList(scene, "t");
      const body = list.under.find((op) => op.key === "body");
      expect(body).toMatchObject({ kind: "rect", fill: ref.color.panel, stroke: ILL.hero, box: { width: phone.width, height: phone.height } });
      expect(list.clip).toMatchObject({ width: 44, height: 85.5 });
      const screen = phoneScreen(scene.phone?.x ?? 0, scene.phone?.y ?? 0);
      const brackets = list.over.filter((op) => op.key.startsWith("k"));
      expect(brackets).toHaveLength(4);
      for (const op of brackets) {
        expect(op.stroke).toBe(ILL.hero);
        for (const [x, y] of points(op.kind === "path" ? op.d : "")) {
          expect(x).toBeGreaterThanOrEqual(screen.x + ref.layout.guide.bracket.inset);
          expect(x).toBeLessThanOrEqual(screen.x + screen.width - ref.layout.guide.bracket.inset);
          expect(y).toBeGreaterThanOrEqual(screen.y + ref.layout.guide.bracket.inset);
          expect(y).toBeLessThanOrEqual(screen.y + screen.height - ref.layout.guide.bracket.inset);
        }
      }
      // The framed subject is redrawn inside the clipped screen.
      expect(list.clipped.length).toBeGreaterThan(0);
    });
  });

  it("step 2 is a plan with three panel-filled phone symbols, one hero, wedges fading where they are context, and no brackets", () => {
    const list = drawList(SCENES[1], "t");
    const phones = list.under.filter((op) => op.fill === ref.color.panel);
    expect(phones).toHaveLength(3);
    expect(phones.filter((op) => op.stroke === ILL.hero)).toHaveLength(1);
    expect(list.clip).toBeNull();
    expect(list.over).toHaveLength(0);
    const contextWedges = SCENES[1].behind.filter((mark) => mark.tone === "context");
    expect(contextWedges).toHaveLength(4);
    contextWedges.forEach((mark) => expect(mark.fade).toBe(true));
  });

  it.each([1, 3, 4])("step %i's screen subject keeps a stroke's width clear of the brackets, so they stay four L-shapes", (n) => {
    const list = drawList(SCENES[n - 1], "t");
    const brackets = list.over.filter((op) => op.key.startsWith("k")).flatMap(opSegments);
    expect(brackets.length).toBeGreaterThan(0);
    const tooClose = list.clipped
      .flatMap(opSegments)
      .flatMap((s) => brackets.filter((k) => segmentDistance(s, k) < ILL.stroke * 2).map((k) => ({ subject: s, bracket: k })));
    expect(tooClose).toEqual([]);
  });

  // Details no longer than a bracket arm: ray ticks, key teeth, book tops, sills.
  const SHORT = ref.layout.guide.bracket.arm;

  it.each(steps)("step %i hides no short line under another stroke", (_, scene) => {
    const lines = opsOf(drawList(scene, "t"))
      .flatMap(opSegments)
      .filter((s) => !s.curve);
    const hidden = lines
      .filter((s) => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) <= SHORT)
      .flatMap((s) =>
        lines
          .filter((t) => t !== s && pointToSegment(s.a, t.a, t.b) < ILL.stroke && pointToSegment(s.b, t.a, t.b) < ILL.stroke)
          .map((t) => ({ short: s, under: t })),
      );
    expect(hidden).toEqual([]);
  });

  it("renders every step as SVG", async () => {
    for (let i = 0; i < SCENES.length; i += 1) {
      await render(<StepArt step={i} width={ART.width} height={ART.height} />);
    }
  });
});

describe("guide art box", () => {
  const CLEAR = ref.space.xl;
  // The band's void above the box: the header holds Close's slop.
  const ABOVE = ART.above - CLOSE_SLOP;
  // The band from Close's hit area to the title on the base device (y 117-620).
  const BASE = ABOVE + ART.height + ART.below;

  it("sits at y 266-532 on the base device, 151 below Close and 88 above the title, also before the first layout", () => {
    expect(artBox(BASE)).toEqual({ visible: true, width: ART.width, height: ART.height, scale: 1, above: ABOVE, below: ART.below });
    expect(artBox(null)).toEqual(artBox(BASE));
  });

  it("takes text growth out of the gap under the art first, so the art and the pool don't move", () => {
    const room = ART.below - CLEAR;
    for (const growth of [1, room / 2, room]) {
      const box = artBox(BASE - growth);
      expect(box).toMatchObject({ above: ABOVE, height: ART.height });
      expect(box.below).toBeCloseTo(ART.below - growth, 5);
    }
  });

  it("then takes it from the void above, then shrinks the box evenly with CLEAR above and below, and hides it below minHeight", () => {
    const gapUsed = BASE - (ART.below - CLEAR);
    expect(artBox(gapUsed - CLEAR)).toMatchObject({ above: ABOVE - CLEAR, height: ART.height, below: CLEAR });
    const smallest = artBox(CLEAR * 2 + ART.minHeight);
    expect(smallest).toMatchObject({ visible: true, above: CLEAR, height: ART.minHeight, below: CLEAR });
    expect(smallest.scale).toBeCloseTo(ART.minHeight / ART.height, 5);
    expect(smallest.width).toBeCloseTo(ART.width * smallest.scale, 5);
    expect(artBox(CLEAR * 2 + ART.minHeight - 1).visible).toBe(false);
  });

  it("shares a taller band's free height in the base device's proportions", () => {
    const box = artBox(BASE * 2 - ART.height);
    expect(box.height).toBe(ART.height);
    expect(box.above).toBeCloseTo(ABOVE * 2, 5);
    expect(box.below).toBeCloseTo(ART.below * 2, 5);
  });
});
