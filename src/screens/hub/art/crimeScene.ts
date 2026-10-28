// CRIME SCENE's cover, "A True Crime Club Mystery" (docs/ART_DIRECTION.md,
// the mystery-book core): the club's evidence board, a corkboard under a warm
// desk lamp. Pinned to it with cherry pushpins: three polaroids (a house at
// night with one window lit, the black cat sitting in a lit window, a brass
// key), sticky notes in the mode's sweet yellow covered in scribbled notes
// (one thing circled in cherry), and an index card; red string runs from pin
// to pin between them. Cozy, not grim: no body, no blood, the red only in the
// string and the pins. The lamp's pool is brightest low on the right, where
// the board is busiest; the top left stays plain cork for the card's words.
// Drawn in points on a cover `w` x `h`: placed by share of the cover and
// sized by its height (DESIGN_H).
import type { SkPath } from "@shopify/react-native-skia";
import type { ModeTheme } from "@/theme/tokens";
import { type Art, between, grain, linear, mix, noise, paint, radial, rgba, tone, wash } from "./kit";

/** The cover's design height: lengths are points at this height. */
const DESIGN_H = 260;

/** Something pinned to the board: its centre (shares of the cover), its size (design points) and its turn (degrees). */
interface Pinned {
  x: number;
  y: number;
  w: number;
  h: number;
  deg: number;
}

const HOUSE: Pinned = { x: 0.82, y: 0.4, w: 64, h: 76, deg: 7 };
const CAT: Pinned = { x: 0.53, y: 0.64, w: 68, h: 80, deg: -6 };
const KEY: Pinned = { x: 0.13, y: 0.82, w: 58, h: 69, deg: 5 };
const NOTE: Pinned = { x: 0.74, y: 0.8, w: 50, h: 50, deg: 6 };
const NOTE_SMALL: Pinned = { x: 0.27, y: 0.58, w: 40, h: 40, deg: -9 };
const CARD: Pinned = { x: 0.97, y: 0.78, w: 76, h: 48, deg: -8 };

export function drawCrimeScene(art: Art, theme: ModeTheme) {
  const { lib, canvas, w, h } = art;
  const { Skia, BlendMode } = lib;
  const s = h / DESIGN_H;

  const ground = tone(theme.ground);
  const surface = tone(theme.surface);
  const raised = tone(theme.raised);
  const ink = tone(theme.ink);
  const muted = tone(theme.inkMuted);
  const cherry = tone(theme.accent);
  const lamp = tone(theme.glow);
  const yellow = tone(theme.sweet);
  const foil = tone(theme.foil);
  // What things are made of, before the lamp lights them.
  const cork = mix(raised, lamp, 0.26);
  const paper = mix(ink, lamp, 0.12);
  const scribble = mix(ground, surface, 0.4);

  const rect = (x: number, y: number, rw: number, rh: number) => Skia.XYWHRect(x, y, rw, rh);
  const centre = (p: Pinned): [number, number] => [w * p.x, h * p.y];
  /** Draws `body` in a pinned thing's own frame: centred on it, turned, in points. */
  const at = (p: Pinned, body: (pw: number, ph: number) => void, lift = 0) => {
    const [cx, cy] = centre(p);
    canvas.save();
    canvas.translate(cx + lift * -0.5 * s, cy + lift * s);
    canvas.rotate(p.deg, 0, 0);
    body(p.w * s, p.h * s);
    canvas.restore();
  };
  /** The pushpin's place on the board: a little below the thing's top edge, turned with it. */
  const pinOf = (p: Pinned): [number, number] => {
    const [cx, cy] = centre(p);
    const a = (p.deg * Math.PI) / 180;
    const dy = -p.h * s * 0.5 + 7 * s;
    return [cx - dy * Math.sin(a), cy + dy * Math.cos(a)];
  };
  /** A soft shadow under a pinned thing, cast down and a little left by the lamp. */
  const shadow = (p: Pinned, lift = 2.4) =>
    at(
      p,
      (pw, ph) => {
        canvas.drawRect(rect(-pw / 2, -ph / 2, pw, ph), paint(art, { color: rgba(ground, 0.55), blur: 2.6 * s, blend: BlendMode.Multiply }));
      },
      lift,
    );

  // 1. The cork: warm brown, flecked darker and lighter.
  wash(art, { color: rgba(cork) });
  noise(art, { fx: 0.5 / s, fy: 0.5 / s, octaves: 2, seed: 21, tone: ground, contrast: 3.2, bias: -0.18, alpha: 0.55 }, 0.6);
  noise(art, { fx: 0.42 / s, fy: 0.42 / s, octaves: 2, seed: 33, tone: lamp, contrast: 3.4, bias: -0.3, alpha: 0.35 }, 0.6);
  noise(art, { fx: 0.03 / s, fy: 0.03 / s, octaves: 3, seed: 8, tone: ground, contrast: 1.4, bias: -0.1, alpha: 0.35 });
  // Old pin holes, scattered.
  for (let i = 0; i < 26; i += 1) {
    canvas.drawCircle(between(art, 0, w), between(art, 0, h), 0.7 * s, paint(art, { color: rgba(ground, 0.55) }));
  }

  // 2. The polaroids: a cream frame, deeper at the foot; the photo inside drawn by `photo` (clipped to its window).
  const polaroid = (p: Pinned, photo: (x: number, y: number, pw: number, ph: number) => void) => {
    shadow(p);
    at(p, (pw, ph) => {
      canvas.drawRect(rect(-pw / 2, -ph / 2, pw, ph), paint(art, { color: rgba(paper) }));
      const m = pw * 0.08;
      const px = -pw / 2 + m;
      const py = -ph / 2 + m;
      const iw = pw - m * 2;
      const ih = ph - m - ph * 0.22;
      canvas.save();
      canvas.clipRect(rect(px, py, iw, ih), lib.ClipOp.Intersect, true);
      photo(px, py, iw, ih);
      canvas.restore();
      // The print's sheen, and the frame's edge.
      canvas.drawRect(rect(px, py, iw, ih), paint(art, { shader: linear(art, px, py, px + iw, py + ih, [[0, ink, 0.12], [0.5, ink, 0], [1, ground, 0.12]]) }));
      canvas.drawRect(rect(-pw / 2, -ph / 2, pw, ph), paint(art, { color: rgba(ground, 0.25), stroke: 0.4 * s }));
    });
  };

  // The house at night: one window lit, the moon over it.
  polaroid(HOUSE, (x, y, pw, ph) => {
    canvas.drawRect(rect(x, y, pw, ph), paint(art, { shader: linear(art, 0, y, 0, y + ph, [[0, mix(ground, cherry, 0.12), 1], [1, mix(surface, cherry, 0.25), 1]]) }));
    canvas.drawCircle(x + pw * 0.76, y + ph * 0.2, pw * 0.09, paint(art, { color: rgba(ink, 0.9) }));
    const house = Skia.PathBuilder.Make()
      .moveTo(x + pw * 0.14, y + ph)
      .lineTo(x + pw * 0.14, y + ph * 0.56)
      .lineTo(x + pw * 0.44, y + ph * 0.3)
      .lineTo(x + pw * 0.74, y + ph * 0.56)
      .lineTo(x + pw * 0.74, y + ph)
      .close()
      .build();
    canvas.drawPath(house, paint(art, { color: rgba(ground) }));
    const wx = x + pw * 0.38;
    const wy = y + ph * 0.62;
    canvas.drawCircle(wx + pw * 0.06, wy + ph * 0.08, pw * 0.2, paint(art, { color: rgba(lamp, 0.35), blur: 3 * s }));
    canvas.drawRect(rect(wx, wy, pw * 0.13, ph * 0.16), paint(art, { color: rgba(lamp) }));
  });

  // The cat in a lit window: the house's own black cat, sitting on the sill.
  polaroid(CAT, (x, y, pw, ph) => {
    canvas.drawRect(rect(x, y, pw, ph), paint(art, { color: rgba(mix(ground, surface, 0.5)) }));
    const fx = x + pw * 0.18;
    const fy = y + ph * 0.1;
    const fw = pw * 0.64;
    const fh = ph * 0.66;
    canvas.drawRect(rect(fx - 4 * s, fy - 4 * s, fw + 8 * s, fh + 8 * s), paint(art, { color: rgba(lamp, 0.4), blur: 5 * s }));
    canvas.drawRect(rect(fx, fy, fw, fh), paint(art, { shader: linear(art, 0, fy, 0, fy + fh, [[0, mix(lamp, ink, 0.4), 1], [1, lamp, 1]]) }));
    canvas.drawRect(rect(fx + fw / 2 - 0.8 * s, fy, 1.6 * s, fh), paint(art, { color: rgba(ground) }));
    canvas.drawRect(rect(fx, fy + fh / 2 - 0.8 * s, fw, 1.6 * s), paint(art, { color: rgba(ground) }));
    canvas.drawRect(rect(x, fy + fh, pw, ph), paint(art, { color: rgba(ground) }));
    // The cat: a body, a head, two ears, a tail curled round.
    const cx = x + pw * 0.5;
    const base = fy + fh;
    const cat = Skia.PathBuilder.Make()
      .addOval(rect(cx - pw * 0.12, base - ph * 0.3, pw * 0.24, ph * 0.32))
      .addCircle(cx, base - ph * 0.34, pw * 0.1)
      .addPoly(
        [
          { x: cx - pw * 0.1, y: base - ph * 0.36 },
          { x: cx - pw * 0.085, y: base - ph * 0.48 },
          { x: cx - pw * 0.02, y: base - ph * 0.42 },
        ],
        true,
      )
      .addPoly(
        [
          { x: cx + pw * 0.1, y: base - ph * 0.36 },
          { x: cx + pw * 0.085, y: base - ph * 0.48 },
          { x: cx + pw * 0.02, y: base - ph * 0.42 },
        ],
        true,
      )
      .build();
    canvas.drawPath(cat, paint(art, { color: rgba(ground) }));
    const tail = Skia.PathBuilder.Make()
      .moveTo(cx + pw * 0.1, base - ph * 0.04)
      .cubicTo(cx + pw * 0.3, base, cx + pw * 0.3, base - ph * 0.2, cx + pw * 0.2, base - ph * 0.22)
      .build();
    canvas.drawPath(tail, paint(art, { color: rgba(ground), stroke: 2.4 * s, round: true }));
    // Its eyes catch the light.
    for (const side of [-1, 1]) canvas.drawCircle(cx + side * pw * 0.04, base - ph * 0.345, 0.9 * s, paint(art, { color: rgba(yellow) }));
  });

  // A brass key on dark velvet.
  polaroid(KEY, (x, y, pw, ph) => {
    canvas.drawRect(rect(x, y, pw, ph), paint(art, { shader: radial(art, x + pw * 0.5, y + ph * 0.45, pw * 0.8, [[0, mix(surface, cherry, 0.3), 1], [1, ground, 1]]) }));
    canvas.save();
    canvas.translate(x + pw * 0.5, y + ph * 0.5);
    canvas.rotate(-35, 0, 0);
    const brass = paint(art, { shader: linear(art, 0, -pw * 0.1, 0, pw * 0.1, [[0, mix(foil, ink, 0.4), 1], [1, mix(foil, ground, 0.35), 1]]) });
    const bow: SkPath = Skia.PathBuilder.Make().addCircle(-pw * 0.22, 0, pw * 0.13).addCircle(-pw * 0.22, 0, pw * 0.065).setFillType(lib.FillType.EvenOdd).build();
    canvas.drawPath(bow, brass);
    canvas.drawRect(rect(-pw * 0.1, -pw * 0.025, pw * 0.42, pw * 0.05), brass);
    canvas.drawRect(rect(pw * 0.2, pw * 0.02, pw * 0.05, pw * 0.08), brass);
    canvas.drawRect(rect(pw * 0.27, pw * 0.02, pw * 0.04, pw * 0.06), brass);
    canvas.restore();
  });

  // 3. Sticky notes: the sweet yellow, a fold of shade at the foot, notes scribbled in pencil.
  const sticky = (p: Pinned, lines: number, circle: boolean) => {
    shadow(p, 1.6);
    at(p, (pw, ph) => {
      canvas.drawRect(rect(-pw / 2, -ph / 2, pw, ph), paint(art, { shader: linear(art, 0, -ph / 2, 0, ph / 2, [[0, yellow, 1], [0.8, yellow, 1], [1, mix(yellow, ground, 0.18), 1]]) }));
      const m = pw * 0.14;
      for (let i = 0; i < lines; i += 1) {
        const ly = -ph / 2 + m + 4 * s + i * (ph - m * 2) / lines;
        const len = (pw - m * 2) * between(art, 0.55, 1);
        const b = Skia.PathBuilder.Make().moveTo(-pw / 2 + m, ly);
        for (let k = 1; k <= 8; k += 1) b.lineTo(-pw / 2 + m + (len * k) / 8, ly + Math.sin(k * 2.1 + i) * 0.7 * s);
        canvas.drawPath(b.build(), paint(art, { color: rgba(scribble, 0.75), stroke: 0.8 * s, round: true }));
      }
      if (circle) {
        const ring = Skia.PathBuilder.Make().addOval(rect(-pw * 0.18, -ph * 0.06, pw * 0.5, ph * 0.3)).build();
        canvas.drawPath(ring, paint(art, { color: rgba(cherry, 0.9), stroke: 1.1 * s, round: true }));
      }
    });
  };
  sticky(NOTE_SMALL, 3, false);

  // The index card: cream, a cherry rule along its head, faint lines below.
  shadow(CARD, 1.8);
  at(CARD, (pw, ph) => {
    canvas.drawRect(rect(-pw / 2, -ph / 2, pw, ph), paint(art, { color: rgba(paper) }));
    canvas.drawRect(rect(-pw / 2, -ph / 2 + ph * 0.24, pw, 0.7 * s), paint(art, { color: rgba(cherry, 0.8) }));
    for (let i = 1; i <= 3; i += 1) canvas.drawRect(rect(-pw / 2, -ph / 2 + ph * 0.24 + i * ph * 0.18, pw, 0.4 * s), paint(art, { color: rgba(muted, 0.6) }));
    canvas.drawRect(rect(-pw / 2 + pw * 0.08, -ph / 2 + ph * 0.08, pw * 0.4, 1.4 * s), paint(art, { color: rgba(scribble, 0.7) }));
  });
  sticky(NOTE, 4, true);

  // 4. The red string, pin to pin, sagging a little, with its faint shadow on the board.
  const pins = [pinOf(HOUSE), pinOf(CAT), pinOf(KEY), pinOf(NOTE), pinOf(NOTE_SMALL), pinOf(CARD)];
  const links: [number, number][] = [
    [0, 1],
    [1, 2],
    [1, 3],
    [3, 5],
    [4, 1],
    [4, 0],
  ];
  const string = Skia.PathBuilder.Make();
  for (const [a, b] of links) {
    const [x0, y0] = pins[a];
    const [x1, y1] = pins[b];
    string.moveTo(x0, y0).quadTo((x0 + x1) / 2, (y0 + y1) / 2 + Math.hypot(x1 - x0, y1 - y0) * 0.06, x1, y1);
  }
  const strung = string.build();
  canvas.save();
  canvas.translate(-0.8 * s, 2 * s);
  canvas.drawPath(strung, paint(art, { color: rgba(ground, 0.45), stroke: 1.2 * s, blur: 1 * s, blend: BlendMode.Multiply }));
  canvas.restore();
  canvas.drawPath(strung, paint(art, { color: rgba(cherry), stroke: 1.1 * s, round: true }));

  // 5. The pushpins: cherry heads with a bright glint, each with its shadow.
  for (const [px, py] of pins) {
    canvas.drawCircle(px - 1.2 * s, py + 2.4 * s, 3.4 * s, paint(art, { color: rgba(ground, 0.5), blur: 1.4 * s, blend: BlendMode.Multiply }));
    canvas.drawCircle(px, py, 3.4 * s, paint(art, { shader: radial(art, px - 1 * s, py - 1.2 * s, 4 * s, [[0, mix(cherry, ink, 0.45), 1], [0.6, cherry, 1], [1, mix(cherry, ground, 0.4), 1]]) }));
    canvas.drawCircle(px - 1.1 * s, py - 1.2 * s, 0.9 * s, paint(art, { color: rgba(ink, 0.8) }));
  }

  // 6. The desk lamp: a warm pool low on the right, the board falling away into the oxblood dark round it.
  const lx = w * 0.66;
  const ly = h * 0.66;
  const lr = Math.max(w * 0.7, h * 0.85);
  wash(art, {
    blend: BlendMode.Multiply,
    shader: radial(art, lx, ly, lr, [
      [0, mix(ink, lamp, 0.5), 1],
      [0.45, mix(lamp, cork, 0.6), 1],
      [0.8, mix(cork, ground, 0.55), 1],
      [1, mix(ground, raised, 0.4), 1],
    ]),
  });
  wash(art, { blend: BlendMode.Screen, shader: radial(art, lx, ly, lr * 0.5, [[0, lamp, 0.16], [1, lamp, 0]]) });
  grain(art, 0.08, 19);

  // 7. The top of the board in shade for the card's words, and the corners falling away.
  wash(art, { shader: linear(art, 0, 0, 0, h * 0.45, [[0, ground, 0.5], [0.6, ground, 0.18], [1, ground, 0]]) });
  wash(art, { shader: radial(art, lx, ly, Math.hypot(w, h) * 0.75, [[0, ground, 0], [0.6, ground, 0.08], [1, ground, 0.55]]) });
}
