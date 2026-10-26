// CRIME SCENE's cover: a dark room at night, seen from its threshold. Across
// it stands an open doorway onto a hall, lit by a harsh pale light through the
// window at its far end and washed with the police red it bleeds into. That
// light pours through the door in a hazy beam, dust turning in it, and lies
// across the floorboards toward us in a long wedge, pale at the threshold and
// blood red at its edges. Police tape is crossed over the doorway, backlit,
// throwing its shadows down the beam; the door stands swung back into the room.
// In the light on the floor: a chalk outline, arms flung out, and numbered
// evidence markers, each throwing a long shadow away from the door. Nothing
// but the outline says who was here. Desaturated, with red only as light and
// shadow; the tape's yellow is a detail on the strips and markers (the card
// lays its own strip across the top-right corner). The left of the room and
// its top stay dark for the count chip and the card's words.
// The room is drawn in one-point perspective: a back wall facing us and a floor
// running back to it, in units of the cover's height at the back wall (P()),
// placed by share of the cover and scaled by its height (DESIGN_H).
import type { SkPaint } from "@shopify/react-native-skia";
import type { ModeTheme } from "@/theme/tokens";
import { type Art, between, grain, linear, mix, noise, paint, poly, radial, rgba, tone, wash, words } from "./kit";

/** The cover's design height: lines and blurs are points at this height. */
const DESIGN_H = 260;

/** A point on the floor: across (x) and depth (z: 1 at the back wall, smaller nearer us). */
type Floor = readonly [x: number, z: number];

// The chalk outline, seen from above, in its own units (about 1 long, head at
// the top): round the head, down the arm flung out to the left, the bent left
// leg and the straight right one, then up the right arm, raised by the head.
const OUTLINE: readonly Floor[] = (() => {
  const head: Floor[] = [];
  for (let a = 65; a >= -245; a -= 31) head.push([0.09 * Math.cos((a * Math.PI) / 180), -0.4 + 0.09 * Math.sin((a * Math.PI) / 180)]);
  return [
    ...head,
    [-0.14, -0.28], [-0.27, -0.2], [-0.37, -0.07], [-0.41, -0.02], [-0.36, 0.03], [-0.31, -0.01], [-0.21, -0.09], [-0.13, -0.17],
    [-0.13, -0.03], [-0.15, 0.07], [-0.2, 0.16], [-0.29, 0.3], [-0.19, 0.47], [-0.15, 0.55], [-0.08, 0.53], [-0.1, 0.44],
    [-0.18, 0.3], [-0.07, 0.22], [0.01, 0.13], [0.1, 0.32], [0.13, 0.53], [0.18, 0.6], [0.24, 0.57], [0.2, 0.5], [0.17, 0.28],
    [0.14, 0.07], [0.13, -0.03], [0.13, -0.18], [0.32, -0.26], [0.34, -0.42], [0.33, -0.52], [0.29, -0.57], [0.25, -0.52],
    [0.24, -0.4], [0.22, -0.33], [0.13, -0.29], [0.04, -0.31],
  ];
})();

/** Keeps the part of a floor polygon further back than `z` (cuts off what falls behind the viewer). */
function clipNear(points: readonly Floor[], z: number): Floor[] {
  const out: Floor[] = [];
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length];
    const inA = a[1] >= z;
    if (inA) out.push(a);
    if (inA !== b[1] >= z) {
      const t = (z - a[1]) / (b[1] - a[1]);
      out.push([a[0] + t * (b[0] - a[0]), z]);
    }
  });
  return out;
}

/** The tape's words, centred on (x, y)'s baseline, placed to the subpixel so small letters keep their spacing. */
function tapeWords(art: Art, text: string, size: number, x: number, y: number, p: SkPaint) {
  const face = art.fonts.grotesk;
  if (!face) return;
  const font = art.lib.Skia.Font(face, size);
  font.setSubpixel(true);
  font.setLinearMetrics(true);
  art.canvas.drawText(text, x - font.measureText(text).width / 2, y, p, font);
}

export function drawCrimeScene(art: Art, theme: ModeTheme) {
  const { lib, canvas, w, h } = art;
  const { Skia, BlendMode, ClipOp } = lib;
  const ground = tone(theme.ground);
  const surface = tone(theme.surface);
  const raised = tone(theme.raised);
  const bone = tone(theme.ink);
  const muted = tone(theme.inkMuted);
  const blood = tone(theme.accent);
  const stamp = tone(theme.stamp);
  const yellow = tone(theme.detail ?? theme.accent);
  // Two lights: a harsh pale one (the flash, the work lamp beyond the window),
  // bone barely warmed, and the police red it bleeds into at its edges and in the shadows.
  const flash = mix(bone, stamp, 0.1);
  const red = mix(blood, stamp, 0.3);
  const hot = mix(flash, red, 0.3);
  const pool = mix(flash, red, 0.45);
  const shadowRed = mix(ground, blood, 0.32);
  // The tape in the room's dark: its yellow dulled toward the deep red, never toward the ground (that reads green).
  const tape = mix(yellow, mix(blood, ground, 0.5), 0.42);
  const s = h / DESIGN_H;

  // The room: eye level, the foot of the back wall, and where the floor's lines meet.
  const eye = h * 0.22;
  const foot = h * 0.56;
  const vx = w * 0.62;
  /** A point in the room (across, height, depth) on the cover. */
  const P = (x: number, y: number, z: number): [number, number] => [vx + (x * h) / z, eye + (foot - eye - y * h) / z];
  const onFloor = ([x, z]: Floor) => P(x, 0, z);
  /** A floor polygon, cut off past the cover's foot, as a path on the cover. */
  const NEAR = 0.3;
  const floorPath = (points: readonly Floor[]) => poly(art, clipNear(points, NEAR).map(onFloor));

  // The doorway, right of centre: its jambs and head (in room units), and the
  // hallway's far window, the light's source, a little left of the door's middle.
  const doorX = (w * 0.675 - vx) / h;
  const half = 0.13;
  const xl = doorX - half;
  const xr = doorX + half;
  const top = 0.44;
  const [dl, dt] = P(xl, top, 1);
  const [dr, db] = P(xr, 0, 1);
  const src = { x: doorX - 0.03, y: 0.32, z: 3.4 };
  /** Where the window's light through (x, y, z) lands on the floor (y below the window). */
  const cast = (x: number, y: number, z: number): Floor => {
    const t = src.y / (src.y - y);
    return [src.x + t * (x - src.x), src.z + t * (z - src.z)];
  };
  /** Across, at depth z, the light's edge through the jamb at x. */
  const spread = (x: number, z: number) => src.x + ((x - src.x) * (src.z - z)) / (src.z - 1);

  // 1. The back wall and floor: near black, lifting a little toward the door.
  wash(art, { shader: linear(art, 0, 0, w, 0, [[0, ground, 1], [0.5, surface, 1], [1, mix(surface, raised, 0.4), 1]]) });
  canvas.drawRect(Skia.XYWHRect(0, foot, w, h - foot), paint(art, { shader: linear(art, 0, foot, 0, h, [[0, mix(ground, surface, 0.6), 1], [1, ground, 1]]) }));
  // Old plaster: a faint mottle on the wall.
  noise(art, {
    fx: 0.035 / s,
    fy: 0.035 / s,
    octaves: 3,
    seed: 4,
    tone: raised,
    contrast: 2,
    bias: -0.1,
    alpha: 0.6,
    mask: linear(art, 0, 0, 0, foot, [[0, raised, 0.3], [1, raised, 1]]),
  });
  // The skirting board along the foot of the wall, its top edge just catching the light.
  const skirt = h * 0.028;
  canvas.drawRect(Skia.XYWHRect(0, foot - skirt, w, skirt), paint(art, { color: rgba(mix(ground, raised, 0.6), 1) }));
  canvas.drawRect(Skia.XYWHRect(0, foot - skirt, w, 0.7 * s), paint(art, { shader: linear(art, 0, 0, w, 0, [[0, red, 0], [0.45, red, 0.1], [0.62, red, 0.35], [0.9, red, 0.06]]) }));

  // 2. The floorboards: seams running back to the wall and the boards' ends, staggered.
  const boards = Skia.PathBuilder.Make();
  const pitch = 0.07;
  for (let x = -2.5; x <= 2.5; x += pitch) {
    const [x0, y0] = P(x, 0, 1);
    const [x1, y1] = P(x, 0, NEAR);
    boards.moveTo(x0, y0).lineTo(x1, y1);
    for (let z = 1 - between(art, 0, 0.3); z > NEAR; z -= between(art, 0.3, 0.5)) {
      const [ex0, ey] = P(x, 0, z);
      const [ex1] = P(x + pitch, 0, z);
      boards.moveTo(ex0, ey).lineTo(ex1, ey);
    }
  }
  const boardPath = boards.build();
  canvas.drawPath(boardPath, paint(art, { color: rgba(ground, 0.8), stroke: 0.7 * s }));

  // 3. Through the doorway: the hall, dark but for the light through its far
  // window, which rakes its walls and lays a pool on its floor.
  const far = 1.9;
  const opening = Skia.XYWHRect(dl, dt, dr - dl, db - dt);
  const [fl, ft] = P(xl, top, far);
  const [fr, fb] = P(xr, 0, far);
  // The hall's red, a little greyed (the look is desaturated; the red is in the shadows).
  const hall = mix(blood, muted, 0.22);
  canvas.save();
  canvas.clipRect(opening, ClipOp.Intersect, true);
  canvas.drawRect(opening, paint(art, { color: rgba(shadowRed) }));
  // Its walls, lit along their length toward the window, and its ceiling in the dark.
  const side = (x: number, x0: number, x1: number) =>
    canvas.drawPath(
      poly(art, [P(x, 0, 1), P(x, 0, far), P(x, top, far), P(x, top, 1)]),
      paint(art, { shader: linear(art, x0, 0, x1, 0, [[0, mix(ground, blood, 0.1), 1], [0.6, shadowRed, 1], [0.88, hall, 1], [1, mix(hall, flash, 0.45), 1]]) }),
    );
  side(xl, dl, fl);
  side(xr, dr, fr);
  canvas.drawPath(poly(art, [P(xl, top, 1), P(xr, top, 1), P(xr, top, far), P(xl, top, far)]), paint(art, { color: rgba(ground, 0.9) }));
  // The far wall, and the window in it: hot, quartered by its bars, blooming.
  canvas.drawRect(Skia.XYWHRect(fl, ft, fr - fl, fb - ft), paint(art, { color: rgba(mix(shadowRed, hall, 0.4)) }));
  const [wx0, wy0] = P(src.x - 0.055, 0.38, far);
  const [wx1, wy1] = P(src.x + 0.055, 0.18, far);
  const [wcx, wcy] = [(wx0 + wx1) / 2, (wy0 + wy1) / 2];
  canvas.drawRect(Skia.XYWHRect(wx0, wy0, wx1 - wx0, wy1 - wy0), paint(art, { shader: radial(art, wcx, wcy, (wy1 - wy0) * 0.75, [[0, bone, 1], [0.7, flash, 1], [1, hot, 1]]), blur: 0.4 * s }));
  const bars = paint(art, { color: rgba(mix(ground, blood, 0.35)), stroke: 1.2 * s });
  canvas.drawLine(wcx, wy0, wcx, wy1, bars);
  canvas.drawLine(wx0, wcy, wx1, wcy, bars);
  // The hall's floor: a pool under the window, fading toward us.
  canvas.drawPath(poly(art, [P(xl, 0, far), P(xr, 0, far), P(xr, 0, 1), P(xl, 0, 1)]), paint(art, { shader: linear(art, 0, fb, 0, db, [[0, flash, 0.7], [0.3, hall, 0.6], [0.7, shadowRed, 0.7], [1, mix(hall, flash, 0.35), 0.7]]) }));
  canvas.drawCircle(wcx, wcy, h * 0.2, paint(art, { shader: radial(art, wcx, wcy, h * 0.2, [[0, hot, 0.6], [0.3, red, 0.25], [1, red, 0]]), blend: BlendMode.Screen }));
  canvas.restore();

  // 4. The door, swung back into the room on its right-hand hinges: a dark
  // slab, its two panels just showing, a line of red down its edge.
  const swing = (100 * Math.PI) / 180;
  const ex = xr - 2 * half * Math.cos(swing) + 0.02;
  const ez = 1 - 2 * half * Math.sin(swing);
  const leaf = poly(art, [P(xr, 0, 1), P(xr, top, 1), P(ex, top, ez), P(ex, 0, ez)]);
  const [lx] = P(ex, 0, ez);
  canvas.drawPath(leaf, paint(art, { shader: linear(art, dr, 0, lx, 0, [[0, mix(raised, blood, 0.3), 1], [0.3, raised, 1], [1, ground, 1]]) }));
  const leafAt = (u: number, v: number) => P(xr + (ex - xr) * u, top * v, 1 + (ez - 1) * u);
  for (const [v0, v1] of [[0.56, 0.9], [0.1, 0.46]]) {
    const panel = poly(art, [leafAt(0.18, v0), leafAt(0.18, v1), leafAt(0.82, v1), leafAt(0.82, v0)]);
    canvas.drawPath(panel, paint(art, { color: rgba(ground, 0.5), stroke: 1.1 * s }));
  }
  canvas.drawLine(...P(xr, 0, 1), ...P(xr, top, 1), paint(art, { color: rgba(red, 0.8), stroke: 1.2 * s }));

  // The door frame round the opening: a dark casing, its inner edges catching the light.
  const casing = 0.02 * h;
  canvas.drawRect(Skia.XYWHRect(dl - casing / 2, dt - casing / 2, dr - dl + casing, db - dt + casing / 2), paint(art, { color: rgba(mix(ground, raised, 0.5)), stroke: casing }));
  canvas.drawRect(Skia.XYWHRect(dl, dt, dr - dl, db - dt), paint(art, { shader: linear(art, 0, dt, 0, db, [[0, red, 0.12], [1, red, 0.4]]), stroke: 0.7 * s }));
  // The opening's light wrapping round the frame.
  canvas.drawRect(opening, paint(art, { color: rgba(red, 0.22), blur: 9 * s, blend: BlendMode.Screen }));

  // 5. The light on our floor: the window's light through the doorway, a wedge
  // widening toward us, brightest at the threshold, edged soft (the window isn't a point).
  const wedge = floorPath([[xl, 1], [xr, 1], [spread(xr, NEAR), NEAR], [spread(xl, NEAR), NEAR]]);
  const [sx, sy] = P(doorX, 0, 1);
  canvas.drawPath(wedge, paint(art, { shader: radial(art, sx, sy, h * 0.8, [[0, blood, 0.75], [0.45, blood, 0.42], [1, blood, 0.08]], h * 0.5), blur: 5 * s }));
  canvas.drawPath(wedge, paint(art, { shader: radial(art, sx, sy, h * 0.6, [[0, flash, 0.8], [0.2, pool, 0.42], [0.5, red, 0.08], [1, red, 0]], h * 0.4), blur: 1 * s, blend: BlendMode.Screen }));
  // The opening's reflection in the boards' old varnish, a soft streak toward us.
  canvas.drawRect(Skia.XYWHRect(dl + (dr - dl) * 0.2, db, (dr - dl) * 0.6, h * 0.16), paint(art, { shader: linear(art, 0, db, 0, db + h * 0.16, [[0, flash, 0.16], [1, red, 0]]), blur: 4 * s, blend: BlendMode.Screen }));
  // The boards' seams again over the light, so they show in it, and their grain.
  canvas.save();
  canvas.clipPath(wedge, ClipOp.Intersect, true);
  canvas.drawPath(boardPath, paint(art, { color: rgba(ground, 0.6), stroke: 0.8 * s, blend: BlendMode.Multiply }));
  noise(art, {
    fx: 0.004 / s,
    fy: 0.25 / s,
    octaves: 2,
    seed: 9,
    tone: ground,
    contrast: 1.8,
    bias: -0.05,
    alpha: 0.35,
    mask: radial(art, sx, sy, h * 0.6, [[0, ground, 1], [1, ground, 0]]),
  });
  canvas.restore();

  // 6. The tape across the doorway, crossed, on the room side. Its shadows
  // first, thrown down the beam (only where the light is).
  const band = 0.028;
  const tapes = [
    { a: [xl - 0.04, 0.24] as const, b: [xr + 0.035, 0.1] as const },
    { a: [xl - 0.035, 0.07] as const, b: [xr + 0.04, 0.29] as const },
  ];
  canvas.save();
  canvas.clipPath(wedge, ClipOp.Intersect, true);
  for (const { a, b } of tapes) {
    const shadow = [cast(a[0], a[1] - band / 2, 0.99), cast(b[0], b[1] - band / 2, 0.99), cast(b[0], b[1] + band / 2, 0.99), cast(a[0], a[1] + band / 2, 0.99)];
    canvas.drawPath(floorPath(shadow), paint(art, { color: rgba(ground, 0.7), blur: 1.4 * s, blend: BlendMode.Multiply }));
  }
  canvas.restore();

  // 7. The chalk outline on the boards, lying across the light, its legs trailing off into the dark.
  // Drawn a little wider than it lies (`wide`), against the floor's foreshortening, so its limbs still read.
  const body = { x: ((w * 0.73 - vx) / h) * 0.82, z: 0.82, length: 0.36, turn: -1.42, wide: 1.6 };
  const cos = Math.cos(body.turn);
  const sin = Math.sin(body.turn);
  const pts = OUTLINE.map(([u0, v]) => {
    const u = u0 * body.wide;
    return onFloor([body.x + (u * cos - v * sin) * body.length, body.z + (u * sin + v * cos) * body.length]);
  });
  const mid = (i: number): [number, number] => {
    const p = pts[i % pts.length];
    const q = pts[(i + 1) % pts.length];
    return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  };
  const chalk = Skia.PathBuilder.Make().moveTo(...mid(0));
  for (let i = 1; i <= pts.length; i += 1) chalk.quadTo(...pts[i % pts.length], ...mid(i));
  const chalkPath = chalk.close().build();
  const chalkLine = (alpha: number, width: number, seed: number) => {
    const p = paint(art, { color: rgba(mix(bone, muted, 0.25), alpha), stroke: width * s, round: true, blur: 0.3 * s });
    p.setPathEffect(Skia.PathEffect.MakeDiscrete(3 * s, 0.45 * s, seed));
    return p;
  };
  canvas.drawPath(chalkPath, chalkLine(0.14, 1.6, 1));
  canvas.save();
  canvas.clipPath(wedge, ClipOp.Intersect, true);
  canvas.drawPath(chalkPath, chalkLine(0.6, 1.7, 2));
  canvas.drawPath(chalkPath, chalkLine(0.2, 3.2, 3));
  canvas.restore();

  // 8. The evidence markers: small tents, the flash on their faces, the door's
  // light along their ridges, their shadows thrown long toward us (only where the light reaches).
  const markers: { at: Floor; n: string }[] = [
    { at: [body.x - 0.25, body.z + 0.07], n: "1" },
    { at: [body.x + 0.2, body.z + 0.1], n: "2" },
    { at: [body.x + 0.04, body.z - 0.2], n: "3" },
  ];
  const tall = 0.036;
  canvas.save();
  canvas.clipPath(wedge, ClipOp.Intersect, true);
  for (const { at } of markers) {
    const [x, z] = at;
    const foot2 = tall * 0.5;
    const shade: Floor[] = [[x - foot2, z], [x + foot2, z], cast(x + foot2 * 0.7, tall, z), cast(x - foot2 * 0.7, tall, z)];
    canvas.drawPath(floorPath(shade), paint(art, { color: rgba(ground, 0.75), blur: 1.1 * s, blend: BlendMode.Multiply }));
  }
  canvas.restore();
  for (const { at, n } of [...markers].sort((p, q) => q.at[1] - p.at[1])) {
    const [bx, by] = onFloor(at);
    const k = h / at[1];
    const wide = tall * 0.5 * k;
    const high = tall * k;
    const face = poly(art, [[bx - wide, by], [bx + wide, by], [bx + wide * 0.84, by - high], [bx - wide * 0.84, by - high]]);
    canvas.drawPath(face, paint(art, { shader: linear(art, 0, by - high, 0, by, [[0, mix(yellow, bone, 0.1), 1], [1, mix(yellow, ground, 0.45), 1]]), alpha: 0.9 }));
    canvas.drawLine(bx - wide * 0.84, by - high, bx + wide * 0.84, by - high, paint(art, { color: rgba(hot, 0.85), stroke: 0.8 * s, round: true }));
    words(art, art.fonts.grotesk, n, high * 0.7, bx, by - high * 0.24, paint(art, { color: rgba(ground, 0.9) }));
  }

  // 9. The beam in the air: haze lit from the doorway, slanting down to the
  // floor, and the glow round the opening.
  const [nl, nb] = onFloor([spread(xl, 0.6), 0.6]);
  const [nr] = onFloor([spread(xr, 0.6), 0.6]);
  const beam = poly(art, [[dl, dt], [dr, dt], [nr, nb], [nl, nb]]);
  canvas.drawPath(beam, paint(art, { shader: linear(art, 0, dt, 0, nb, [[0, red, 0.12], [0.6, red, 0.07], [1, red, 0]]), blur: 8 * s, blend: BlendMode.Screen }));
  wash(art, { shader: radial(art, sx, (dt + db) / 2, h * 0.55, [[0, red, 0.14], [0.5, blood, 0.06], [1, blood, 0]]), blend: BlendMode.Screen });
  noise(art, {
    fx: 0.014 / s,
    fy: 0.028 / s,
    octaves: 4,
    seed: 23,
    tone: mix(red, flash, 0.2),
    contrast: 3,
    bias: -0.12,
    alpha: 0.5,
    blend: BlendMode.Screen,
    mask: radial(art, sx, (dt + db) * 0.55, h * 0.5, [[0, bone, 1], [0.45, bone, 0.4], [1, bone, 0]]),
  });

  // Dust turning in the beam, a few specks caught bright.
  for (let i = 0; i < 46; i += 1) {
    const t = Math.pow(art.rand(), 0.8);
    const across = art.rand();
    const y = dt + (nb - dt) * t;
    const x = dl + (nl - dl) * t + (dr + (nr - dr) * t - (dl + (nl - dl) * t)) * across;
    const r = between(art, 0.3, 0.85) * s;
    canvas.drawCircle(x, y, r, paint(art, { color: rgba(mix(pool, bone, 0.4), between(art, 0.15, 0.6) * (1 - t * 0.6)), blur: r * 0.6, blend: BlendMode.Screen }));
  }

  // 10. The tape itself, backlit: dull in the room's dark, brightest across
  // the opening, its upper edges rimmed red, its words in the ground.
  for (const { a, b } of tapes) {
    const [ax, ay] = P(a[0], a[1], 0.99);
    const [bx, by] = P(b[0], b[1], 0.99);
    const length = Math.hypot(bx - ax, by - ay);
    const wide = band * h;
    canvas.save();
    canvas.translate(ax, ay);
    canvas.rotate((Math.atan2(by - ay, bx - ax) * 180) / Math.PI, 0, 0);
    const strip = Skia.XYWHRect(0, -wide / 2, length, wide);
    canvas.drawRect(
      strip,
      paint(art, { shader: linear(art, 0, 0, length, 0, [[0, mix(tape, ground, 0.6), 1], [0.3, tape, 1], [0.7, mix(tape, yellow, 0.15), 1], [1, mix(tape, ground, 0.5), 1]]) }),
    );
    canvas.drawRect(Skia.XYWHRect(0, -wide / 2, length, 0.5 * s), paint(art, { color: rgba(red, 0.7) }));
    canvas.save();
    canvas.clipRect(strip, ClipOp.Intersect, true);
    const size = wide * 0.66;
    tapeWords(art, "CRIME SCENE · DO NOT CROSS · CRIME SCENE · DO NOT CROSS", size, length / 2, size * 0.36, paint(art, { color: rgba(ground, 0.8) }));
    canvas.restore();
    canvas.restore();
  }

  // 11. The dark for the card's words: the left and the top in shade, the corners deep.
  wash(art, { shader: linear(art, 0, 0, w * 0.62, 0, [[0, ground, 0.75], [0.55, ground, 0.35], [1, ground, 0]]) });
  wash(art, { shader: linear(art, 0, 0, 0, h * 0.35, [[0, ground, 0.5], [1, ground, 0]]) });
  wash(art, { shader: radial(art, w * 0.64, h * 0.5, Math.hypot(w, h) * 0.6, [[0, ground, 0], [0.6, ground, 0.15], [1, ground, 0.8]]) });
  grain(art, 0.08, 13);
}
