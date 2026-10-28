// DETECTIVE NOIR's cover: the detective's desk seen from directly above, in
// the one hard pool of a desk lamp. An open case file lies on it, a typed
// report clipped inside with a photograph of a lit doorway, and a brass
// magnifier rests on the page. Through its lens the type stands twice as
// large and a fingerprint shows on the paper that the rest of the page
// hides; under it, the lens's shadow gathers the lamp's light into a bright
// point. Monochrome, with brass only in the magnifier, the clip and the light.
// Drawn in points on a cover `w` x `h`: placed by share of the cover and
// sized by its height (DESIGN_H).
import type { SkFont, SkPaint, SkPath } from "@shopify/react-native-skia";
import type { ModeTheme } from "@/theme/tokens";
import { type Art, between, grain, linear, mix, noise, paint, radial, rgba, tone, wash } from "./kit";

/** The cover's design height: lengths are points at this height. */
const DESIGN_H = 260;
/** How much the lens magnifies. */
const ZOOM = 1.85;

/** A place on the desk: where an object's centre lies and how far it is turned (degrees). Frames nest. */
type Frame = readonly [x: number, y: number, deg: number];

/** A point in a chain of frames (outermost first) on the cover. */
function onCover(chain: readonly Frame[], px: number, py: number): [number, number] {
  let x = px;
  let y = py;
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    const [fx, fy, deg] = chain[i];
    const a = (deg * Math.PI) / 180;
    [x, y] = [fx + x * Math.cos(a) - y * Math.sin(a), fy + x * Math.sin(a) + y * Math.cos(a)];
  }
  return [x, y];
}

/** The report, typed. Words in [brackets] are blacked out. */
/** The report's type is set this many times larger and scaled down (see typeAt). */
const TYPE_UP = 10;

const REPORT = [
  "At 11:40 p.m. the night clerk of the Starlight Hotel heard one shot from Room 6. The door was locked from the inside, the key still in it, the window painted shut.",
  "The guest, a Mr. [Halloran], lay by the bed. No weapon was found in the room. The clerk swears no one used the stairs. The house cat sat in the hall all night and made no sound.",
  "One set of prints on the brass doorknob, and they match no one on the register. Whoever closed that door is still in the building.",
];
/** The word the lens rests on. */
const CLUE = "prints";

interface Typed {
  text: string;
  x: number;
  y: number;
  width: number;
  redacted: boolean;
}

export function drawNoir(art: Art, theme: ModeTheme) {
  const { lib, canvas, w, h } = art;
  const { Skia, BlendMode } = lib;
  const s = h / DESIGN_H;

  const ground = tone(theme.ground);
  const raised = tone(theme.raised);
  const ink = tone(theme.ink);
  const muted = tone(theme.inkMuted);
  // The magnifier's brass stays an heirloom in every palette (docs/ART_DIRECTION.md): the series' gold foil.
  const brass = tone(theme.foil);
  // What things are made of, before the lamp lights them.
  const desk = mix(raised, muted, 0.16);
  const board = mix(raised, muted, 0.42);
  const paper = mix(ink, muted, 0.08);
  const type = mix(ground, raised, 0.5);
  const brassLit = mix(brass, ink, 0.55);
  const brassDark = mix(brass, ground, 0.62);
  // The lamp: white warmed toward the brass.
  const lamp = mix(ink, brass, 0.16);

  // Hard light from a lamp beyond the top right: shadows fall down and to the left, `lift` above the desk.
  const fall = (lift: number): [number, number] => [-0.62 * lift * s, 0.78 * lift * s];

  // 0. The layout. The case file, turned a little, its foot off the cover's bottom edge.
  const folder: Frame = [w * 0.6, h * 0.73, -7];
  const PW = 162 * s;
  const PH = 214 * s;
  const sheet: Frame = [5 * s, 6 * s, 3];
  const SW = 140 * s;
  const SH = 186 * s;
  const photo: Frame = [44 * s, -70 * s, 9];
  const PHW = 46 * s;
  const PHH = 56 * s;

  // The report's lines, set in the sheet's own frame (centre at 0, 0).
  const typeSize = 3.5 * s;
  const lead = 6.1 * s;
  // Type this small is set at TYPE_UP times its size and drawn scaled back down: at a few points Skia
  // rounds each glyph's advance to a whole point, which ran letters together and swallowed spaces.
  const font: SkFont | null = art.fonts.grotesk ? Skia.Font(art.fonts.grotesk, typeSize * TYPE_UP) : null;
  const headFont: SkFont | null = art.fonts.grotesk ? Skia.Font(art.fonts.grotesk, 5 * s * TYPE_UP) : null;
  const measure = (text: string, f: SkFont | null, size: number) => (f ? f.measureText(text).width / TYPE_UP : text.length * size * 0.56);
  const typeAt = (text: string, x: number, yy: number, p: SkPaint, f: SkFont) => {
    canvas.save();
    canvas.translate(x, yy);
    canvas.scale(1 / TYPE_UP, 1 / TYPE_UP);
    canvas.drawText(text, 0, 0, p, f);
    canvas.restore();
  };
  const margin = 13 * s;
  const left = -SW / 2 + margin;
  const right = SW / 2 - margin;
  const typed: Typed[] = [];
  let y = -SH / 2 + 34 * s;
  // A word space as a share of the type size: measuring a lone space returns 0 in Skia.
  const space = typeSize * 0.34;
  for (const para of REPORT) {
    let x = left;
    for (const raw of para.split(" ")) {
      const redacted = raw.startsWith("[");
      const text = raw.replace(/[[\]]/g, "");
      const width = measure(text, font, typeSize);
      if (x + width > right) {
        x = left;
        y += lead;
      }
      typed.push({ text, x, y, width, redacted });
      x += width + space;
    }
    y += lead * 1.7;
  }
  const clue = typed.find((t) => t.text === CLUE) ?? typed[Math.floor(typed.length * 0.7)];
  // The lens, centred on the clue word.
  const lensAt: [number, number] = [clue.x + clue.width * 0.8, clue.y - typeSize * 0.4];
  const [lx, ly] = onCover([folder, sheet], lensAt[0], lensAt[1]);
  const R = 33 * s;
  const handleDeg = 38;

  const enter = (chain: readonly Frame[]) => {
    for (const [fx, fy, deg] of chain) {
      canvas.translate(fx, fy);
      canvas.rotate(deg, 0, 0);
    }
  };
  const rect = (x: number, yy: number, rw: number, rh: number) => Skia.XYWHRect(x, yy, rw, rh);
  const rectPath = (x: number, yy: number, rw: number, rh: number) => Skia.PathBuilder.Make().addRect(rect(x, yy, rw, rh)).build();
  /** A hard shadow of `path` (drawn in `chain`) cast `lift` above the desk. */
  const shadow = (chain: readonly Frame[], path: SkPath, lift: number, alpha = 0.6) => {
    const [dx, dy] = fall(lift);
    canvas.save();
    canvas.translate(dx, dy);
    enter(chain);
    canvas.drawPath(path, paint(art, { color: rgba(ground, alpha), blur: (0.5 + lift * 0.35) * s, blend: BlendMode.Multiply }));
    canvas.restore();
  };

  // The fingerprint: a loop's ridges, faint on the page and plain under the glass.
  const printAt: [number, number] = [lensAt[0] + 9 * s, lensAt[1] + 4 * s];
  const ridges = Skia.PathBuilder.Make();
  {
    const gap = 0.78 * s;
    for (let i = 1; i <= 15; i += 1) {
      const rx = i * gap;
      const ry = i * gap * 1.28;
      const cy = -i * gap * 0.18;
      // A loop: open at the bottom left, its arms running down and out.
      const start = 0.62 + between(art, -0.08, 0.08);
      const sweep = 1.76 + between(art, -0.06, 0.06);
      let first = true;
      for (let k = 0; k <= 40; k += 1) {
        const t = Math.PI * (start + (sweep * k) / 40);
        const wob = 1 + 0.03 * Math.sin(t * 3 + i);
        const px = Math.cos(t) * rx * wob;
        const py = cy - Math.sin(t) * ry * wob;
        // Breaks in a ridge, as a real print has.
        if (art.rand() < 0.035) {
          first = true;
          continue;
        }
        if (first) ridges.moveTo(px, py);
        else ridges.lineTo(px, py);
        first = false;
      }
    }
  }
  const ridgePath = ridges.build();

  // 1-4. The desk and everything on it, as it lies, unlit: drawn once on the
  // cover and once again, larger, through the lens (`near`).
  const scene = (near: boolean) => {
    wash(art, { color: rgba(desk) });
    if (!near) {
      // The desk's grain: long, faint streaks of darker wood.
      noise(art, { fx: 0.0035 / s, fy: 0.09 / s, octaves: 3, seed: 5, tone: ground, contrast: 2.2, bias: -0.05, alpha: 0.5 });
    }

    // The case file, open: the cover laid back to the left, the back board under the sheet, a tab at its head.
    const boards = Skia.PathBuilder.Make()
      .addRect(rect(-PW * 1.5 - 2 * s, -PH / 2 + 3 * s, PW, PH))
      .addRect(rect(-PW / 2, -PH / 2, PW, PH))
      .moveTo(PW * 0.06, -PH / 2)
      .lineTo(PW * 0.1, -PH / 2 - 11 * s)
      .lineTo(PW * 0.42, -PH / 2 - 11 * s)
      .lineTo(PW * 0.46, -PH / 2)
      .close()
      .build();
    shadow([folder], boards, 1.2);
    canvas.save();
    enter([folder]);
    canvas.drawPath(boards, paint(art, { color: rgba(board) }));
    // The spine's fold, and the edges of the boards catching the light.
    canvas.drawRect(rect(-PW / 2 - 2.5 * s, -PH / 2, 2.5 * s, PH), paint(art, { color: rgba(ground, 0.35) }));
    canvas.drawPath(boards, paint(art, { color: rgba(ink, 0.18), stroke: 0.5 * s }));
    canvas.restore();

    // A second sheet under the report, squared less carefully.
    const under: Frame = [sheet[0] - 3 * s, sheet[1] + 3 * s, sheet[2] - 2.2];
    const page = rectPath(-SW / 2, -SH / 2, SW, SH);
    shadow([folder, under], page, 0.6, 0.45);
    canvas.save();
    enter([folder, under]);
    canvas.drawPath(page, paint(art, { color: rgba(mix(paper, muted, 0.25)) }));
    canvas.restore();

    // The report.
    shadow([folder, sheet], page, 0.7, 0.4);
    canvas.save();
    enter([folder, sheet]);
    canvas.drawPath(page, paint(art, { color: rgba(paper) }));
    const inked = paint(art, { color: rgba(type, 0.92) });
    if (headFont) {
      typeAt("REPORT OF INVESTIGATION", left, -SH / 2 + 17 * s, inked, headFont);
      if (font) typeAt("CASE No. 1947-06   ROOM 6, STARLIGHT HOTEL", left, -SH / 2 + 24 * s, paint(art, { color: rgba(type, 0.7) }), font);
    } else {
      canvas.drawRect(rect(left, -SH / 2 + 13 * s, 70 * s, 4 * s), inked);
    }
    canvas.drawRect(rect(left, -SH / 2 + 27.5 * s, right - left, 0.5 * s), paint(art, { color: rgba(type, 0.5) }));
    for (const t of typed) {
      if (t.redacted) canvas.drawRect(rect(t.x - 0.6 * s, t.y - typeSize * 0.82, t.width + 1.2 * s, typeSize * 1.05), paint(art, { color: rgba(ground, 0.95) }));
      else if (font) typeAt(t.text, t.x, t.y, inked, font);
      else canvas.drawRect(rect(t.x, t.y - typeSize * 0.6, t.width, typeSize * 0.6), paint(art, { color: rgba(type, 0.5) }));
    }
    // The print, faint unless seen through the glass.
    canvas.save();
    canvas.translate(printAt[0], printAt[1]);
    canvas.rotate(-18, 0, 0);
    canvas.drawPath(ridgePath, paint(art, { color: rgba(type, near ? 0.5 : 0.06), stroke: 0.36 * s, round: true }));
    canvas.restore();
    // A cup's ring, low on the page.
    const ring = Skia.PathBuilder.Make().addOval(rect(-SW / 2 + 6 * s, SH / 2 - 52 * s, 36 * s, 36 * s)).build();
    canvas.drawPath(ring, paint(art, { color: rgba(muted, 0.4), stroke: 1.1 * s, blur: 0.3 * s }));
    canvas.restore();

    // The photograph, clipped at the report's top corner: a dark room, its door ajar on a lit hall.
    const chain = [folder, sheet, photo] as const;
    const print = rectPath(-PHW / 2, -PHH / 2, PHW, PHH);
    shadow(chain, print, 1.1, 0.55);
    canvas.save();
    enter(chain);
    canvas.drawPath(print, paint(art, { color: rgba(mix(ink, muted, 0.15)) }));
    const bx = -PHW / 2 + 3.5 * s;
    const by = -PHH / 2 + 3.5 * s;
    const bw = PHW - 7 * s;
    const bh = PHH - 12 * s;
    canvas.drawRect(rect(bx, by, bw, bh), paint(art, { color: rgba(mix(ground, raised, 0.6)) }));
    canvas.save();
    canvas.clipRect(rect(bx, by, bw, bh), lib.ClipOp.Intersect, true);
    const doorX = bx + bw * 0.56;
    const doorTop = by + bh * 0.18;
    const doorFoot = by + bh * 0.72;
    canvas.drawRect(rect(doorX, doorTop, bw * 0.07, doorFoot - doorTop), paint(art, { color: rgba(mix(ink, brass, 0.2)) }));
    const spill = Skia.PathBuilder.Make()
      .moveTo(doorX, doorFoot)
      .lineTo(doorX + bw * 0.07, doorFoot)
      .lineTo(bx + bw * 0.5, by + bh)
      .lineTo(bx + bw * 0.08, by + bh)
      .close()
      .build();
    canvas.drawPath(spill, paint(art, { shader: linear(art, 0, doorFoot, 0, by + bh, [[0, mix(ink, brass, 0.2), 0.9], [1, mix(ink, brass, 0.2), 0.35]]) }));
    canvas.restore();
    canvas.restore();

    // The brass clip holding it.
    const clip = Skia.PathBuilder.Make()
      .addRRect(Skia.RRectXY(rect(-3 * s, -9 * s, 6 * s, 20 * s), 3 * s, 3 * s))
      .addRRect(Skia.RRectXY(rect(-1.6 * s, -6.5 * s, 3.2 * s, 13 * s), 1.6 * s, 1.6 * s))
      .build();
    const clipAt: Frame = [-6 * s, -PHH / 2 + 2 * s, -2];
    shadow([...chain, clipAt], clip, 0.6, 0.5);
    canvas.save();
    enter([...chain, clipAt]);
    canvas.drawPath(clip, paint(art, { color: rgba(brass), stroke: 0.9 * s }));
    canvas.restore();
  };

  // 5. The lamp: one hard pool, brightest on the page, its edge the shade's rim.
  const poolX = w * 0.64;
  const poolY = h * 0.66;
  const poolR = Math.max(w * 0.58, h * 0.66);
  const light = () =>
    wash(art, {
      blend: BlendMode.Multiply,
      shader: radial(
        art,
        poolX,
        poolY,
        poolR,
        [
          [0, lamp, 1],
          [0.5, mix(lamp, ground, 0.12), 1],
          [0.8, mix(lamp, ground, 0.34), 1],
          [0.86, mix(ground, ink, 0.13), 1],
          [1, mix(ground, ink, 0.07), 1],
        ],
        poolR * 0.82,
      ),
    });

  scene(false);
  light();
  grain(art, 0.08, 7);

  // 6. The magnifier. Its shadow first, with the light the lens gathers into a point.
  const lens = Skia.PathBuilder.Make().addCircle(lx, ly, R).build();
  const lensInner = Skia.PathBuilder.Make().addCircle(lx, ly, R * 0.87).build();
  const handle = () => {
    const b = Skia.PathBuilder.Make();
    // The neck (brass) and the handle (black), along +x from the rim.
    b.addRRect(Skia.RRectXY(rect(R * 0.95, -3.4 * s, 12 * s, 6.8 * s), 1.2 * s, 1.2 * s));
    return b.build();
  };
  const grip = Skia.PathBuilder.Make()
    .moveTo(R + 11 * s, -4.6 * s)
    .lineTo(R + 88 * s, -5.6 * s)
    .quadTo(R + 96 * s, 0, R + 88 * s, 5.6 * s)
    .lineTo(R + 11 * s, 4.6 * s)
    .close()
    .build();
  const neck = handle();
  const [sx, sy] = fall(9);
  canvas.save();
  canvas.translate(sx, sy);
  canvas.drawPath(Skia.PathBuilder.Make().addCircle(lx, ly, R).addCircle(lx, ly, R * 0.87).setFillType(lib.FillType.EvenOdd).build(), paint(art, { color: rgba(ground, 0.55), blur: 2.2 * s, blend: BlendMode.Multiply }));
  canvas.save();
  canvas.translate(lx, ly);
  canvas.rotate(handleDeg, 0, 0);
  canvas.drawPath(grip, paint(art, { color: rgba(ground, 0.6), blur: 2.6 * s, blend: BlendMode.Multiply }));
  canvas.drawPath(neck, paint(art, { color: rgba(ground, 0.6), blur: 2.6 * s, blend: BlendMode.Multiply }));
  canvas.restore();
  // The lens's light: dimmed round its edge, then gathered to a hot point.
  canvas.drawPath(lensInner, paint(art, { color: rgba(ground, 0.22), blur: 3 * s, blend: BlendMode.Multiply }));
  canvas.drawCircle(lx, ly, R * 0.34, paint(art, { shader: radial(art, lx, ly, R * 0.34, [[0, ink, 0.95], [0.25, mix(ink, brass, 0.4), 0.6], [1, brass, 0]]), blend: BlendMode.Screen }));
  canvas.restore();

  // Through the glass: the page again, larger, under the same lamp.
  canvas.save();
  canvas.clipPath(lensInner, lib.ClipOp.Intersect, true);
  canvas.save();
  canvas.translate(lx, ly);
  canvas.scale(ZOOM, ZOOM);
  canvas.translate(-lx, -ly);
  scene(true);
  canvas.restore();
  light();
  grain({ ...art, scale: art.scale / ZOOM }, 0.1, 7);
  // The glass: a little brighter, darker toward its rim where it bends the light.
  wash(art, { shader: radial(art, lx, ly, R * 0.87, [[0, lamp, 0.06], [0.7, lamp, 0], [0.9, ground, 0.15], [1, ground, 0.5]]) });
  canvas.restore();
  // The lamp reflected in the glass: a crescent along the lit side and a small hard window.
  const glint = Skia.PathBuilder.Make().addArc(rect(lx - R * 0.78, ly - R * 0.78, R * 1.56, R * 1.56), -80, 62).build();
  canvas.drawPath(glint, paint(art, { color: rgba(ink, 0.5), stroke: 1.3 * s, round: true, blur: 0.5 * s }));
  canvas.drawOval(rect(lx + R * 0.28, ly - R * 0.56, R * 0.2, R * 0.13), paint(art, { color: rgba(ink, 0.55), blur: 0.6 * s }));

  // The brass rim: lit where it faces the lamp, dark where it turns away.
  const rim = Skia.PathBuilder.Make().addCircle(lx, ly, R).addCircle(lx, ly, R * 0.87).setFillType(lib.FillType.EvenOdd).build();
  const rimShade = linear(art, lx + R * 0.7, ly - R * 0.7, lx - R * 0.7, ly + R * 0.7, [[0, brassLit, 1], [0.45, brass, 1], [1, brassDark, 1]]);
  canvas.drawPath(rim, paint(art, { shader: rimShade }));
  canvas.drawPath(lens, paint(art, { color: rgba(brassDark, 0.8), stroke: 0.5 * s }));
  canvas.drawPath(lensInner, paint(art, { color: rgba(brassDark, 0.9), stroke: 0.6 * s }));
  canvas.drawPath(Skia.PathBuilder.Make().addArc(rect(lx - R * 0.94, ly - R * 0.94, R * 1.88, R * 1.88), -95, 80).build(), paint(art, { color: rgba(ink, 0.7), stroke: 0.7 * s, round: true }));

  // The neck and the black handle, its upper edge catching the lamp.
  canvas.save();
  canvas.translate(lx, ly);
  canvas.rotate(handleDeg, 0, 0);
  canvas.drawPath(neck, paint(art, { shader: linear(art, 0, -3.4 * s, 0, 3.4 * s, [[0, brassLit, 1], [0.5, brass, 1], [1, brassDark, 1]]) }));
  canvas.drawPath(grip, paint(art, { shader: linear(art, 0, -5.6 * s, 0, 5.6 * s, [[0, mix(raised, muted, 0.5), 1], [0.3, raised, 1], [1, ground, 1]]) }));
  canvas.drawLine(R + 13 * s, -3.4 * s, R + 86 * s, -4.2 * s, paint(art, { color: rgba(lamp, 0.45), stroke: 0.7 * s, round: true }));
  canvas.restore();

  // 7. The top of the desk in shade for the card's words, and the corners falling away.
  wash(art, { shader: linear(art, 0, 0, 0, h * 0.5, [[0, ground, 0.55], [0.6, ground, 0.2], [1, ground, 0]]) });
  wash(art, { shader: radial(art, poolX, poolY, Math.hypot(w, h) * 0.7, [[0, ground, 0], [0.6, ground, 0.1], [1, ground, 0.6]]) });
}
