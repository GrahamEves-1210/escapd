// PARANORMAL's cover: a dim parlour wall papered in a faded trellis, and on it
// an old oval mirror, hung a little askew, whose glass gives back a pale
// woman who isn't in the room. Her cold light is the only light: it spills
// out of the glass onto the wall, catches the frame's inner bevel and beads,
// and falls on the console table beneath, where a drawer stands ajar and a
// candle burns blue, its smoke leaning toward the glass. An empty chair
// stands at the right. Motes drift in the light and mist lies low across the
// floor. Pale ectoplasmic blue-grey with lifted blacks; the top left and the
// bottom left stay dark for the card's chip and words.
// Drawn in points on a cover `w` x `h`: placed by share of the cover and
// scaled by its height (DESIGN_H).
import type { SkPath } from "@shopify/react-native-skia";
import type { ModeTheme } from "@/theme/tokens";
import { type Art, between, grain, linear, mix, noise, paint, radial, rgba, svgPath, tone, wash } from "./kit";

// The woman in the glass, facing out, in her own units with the top of her
// head at (0, 0): her gown (sloping shoulders, a narrow waist, the skirt
// falling away), her head, and her long hair framing her face and falling
// over her shoulders.
const GOWN =
  "M-5.4 12L5.4 12L6.4 21C9 22.4 13 24 16.4 27C19 30 19.6 36 19.4 44C19.2 54 17 62 13.6 70" +
  "C18 94 23 120 30 150L-30 150C-23 120-18 94-13.6 70C-17 62-19.2 54-19.4 44C-19.6 36-19 30-16.4 27" +
  "C-13 24-9 22.4-6.4 21Z";
const FACE = "M0 1.6C4.2 1.6 6 5.4 6 10C6 15.4 3.4 19 0 19C-3.4 19-6 15.4-6 10C-6 5.4-4.2 1.6 0 1.6Z";
const HAIR =
  "M0-1.5C7.5-1.5 11.5 4 11.6 11C11.8 20 12.4 30 15 42C11 43.5 7.5 41 6.4 36C5.8 30 6.2 22 5.6 16" +
  "C5.2 12 3.8 8.6 0 8.4C-3.8 8.6-5.2 12-5.6 16C-6.2 22-5.8 30-6.4 36C-7.5 41-11 43.5-15 42" +
  "C-12.4 30-11.8 20-11.6 11C-11.5 4-7.5-1.5 0-1.5Z";

// The empty chair, a balloon back seen from the front, in its own units with
// the foot of its front legs at (0, 0), drawn as strokes: [path, width].
const CHAIR: readonly (readonly [string, number])[] = [
  // The back legs below the seat and the stretcher between the front ones.
  ["M-15-38L-14.4-6M15-38L14.4-6", 2.2],
  ["M-19.6-14L19.6-14", 1.6],
  // The stiles and the arched crest rail as one loop, waisted above the seat.
  ["M-16-42C-14-58-20-70-19-88C-18-108-8-114 0-114C8-114 18-108 19-88C20-70 14-58 16-42", 3.4],
  // The vase-shaped splat inside it, and the rail it stands on.
  ["M-3-48C-9-60-2-70-6-82C-8-94-3-101 0-103C3-101 8-94 6-82C2-70 9-60 3-48", 2],
  ["M-15-49L15-49", 2],
  // The seat's edge and the front legs, turned.
  ["M-24-40L24-40", 5],
  ["M-21-38C-19.6-28-21-14-19.4 0M21-38C19.6-28 21-14 19.4 0", 3.2],
];

// The black cat on the chair's seat, in the chair's units: her body sitting
// upright, her head turned toward the glass (to the left), two ears, and her
// tail hanging over the seat's front edge.
const CAT =
  "M-10-41C-12-48-11-56-7-60C-9-63-10-67-9.5-71L-11.5-77L-7-73.5C-5-75-2-75 0-73.5L3.5-77L2.5-70.5C3.5-66 2-62 0-60" +
  "C4.5-57 7.5-50 7-41Z";
const CAT_TAIL = "M5-42C9-38 10-31 7-25C5-21 6-17 9-16";

/** The cover's design height: every size below is points at this height. */
const DESIGN_H = 260;

/** An oval centred on (cx, cy). */
function oval(art: Art, cx: number, cy: number, rx: number, ry: number): SkPath {
  return art.lib.Skia.PathBuilder.Make()
    .addOval(art.lib.Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2))
    .build();
}

export function drawParanormal(art: Art, theme: ModeTheme) {
  const { lib, canvas, w, h } = art;
  const { Skia, BlendMode } = lib;
  const ground = tone(theme.ground);
  const surface = tone(theme.surface);
  const raised = tone(theme.raised);
  const ink = tone(theme.ink);
  const muted = tone(theme.inkMuted);
  const accent = tone(theme.accent);
  const glow = tone(theme.glow ?? theme.stamp);
  // The apparition's light: the glow whitened toward the ink.
  const cold = mix(glow, ink, 0.35);
  const s = h / DESIGN_H;

  // The mirror: its glass's centre and radii, its frame's width and its tilt (degrees).
  const mx = w * 0.69;
  const my = h * 0.39;
  const gx = 40 * s;
  const gy = 58 * s;
  const fw = 9 * s;
  const tilt = -3.5;
  // The console table under it.
  const top = h * 0.77;
  const tx0 = mx - 64 * s;
  const tx1 = mx + 64 * s;
  /** Draws in the mirror's own frame: about its centre, tilted. */
  const atMirror = (draw: () => void) => {
    canvas.save();
    canvas.translate(mx, my);
    canvas.rotate(tilt, 0, 0);
    draw();
    canvas.restore();
  };

  // 1. The wall: lifted black at the left, lifting toward the mirror.
  wash(art, { shader: linear(art, 0, 0, w, h * 0.4, [[0, ground, 1], [0.55, surface, 1], [1, mix(surface, raised, 0.6), 1]]) });
  // The glass's cold light thrown wide on the wall around it.
  wash(art, { shader: radial(art, mx, my, h * 1.1, [[0, cold, 0.2], [0.3, accent, 0.085], [0.7, accent, 0.02], [1, accent, 0]]) });

  // 2. The wallpaper: faint stripes and a trellis of lozenges, seen only where the light reaches.
  const lit = (alpha: number) => radial(art, mx, my, h * 1.1, [[0, cold, alpha], [0.4, cold, alpha * 0.45], [1, cold, 0]]);
  const pitch = 15 * s;
  const stripes = Skia.PathBuilder.Make();
  for (let x = -pitch; x < w + pitch; x += pitch) stripes.addRect(Skia.XYWHRect(x, 0, 0.8 * s, top));
  const trellis = Skia.PathBuilder.Make();
  for (let row = 0, y = pitch * 0.5; y < top; row += 1, y += pitch * 1.3) {
    for (let x = (row % 2) * (pitch / 2) - pitch / 2; x < w + pitch; x += pitch) {
      const cx = x + pitch / 2;
      const r = 2 * s;
      trellis.moveTo(cx, y - r * 1.5).lineTo(cx + r, y).lineTo(cx, y + r * 1.5).lineTo(cx - r, y).close();
    }
  }
  canvas.drawPath(stripes.build(), paint(art, { shader: lit(0.06), blur: 0.4 * s }));
  canvas.drawPath(trellis.build(), paint(art, { shader: lit(0.1), blur: 0.5 * s }));
  // Damp and age in the paper: blotches of darker wall.
  noise(art, { fx: 0.02 / s, fy: 0.014 / s, octaves: 3, seed: 5, tone: ground, contrast: 2, bias: -0.05, alpha: 0.55, blend: BlendMode.Multiply });

  // 3. The dado rail behind the table, and the darker panelling under it.
  const rail = top + 8 * s;
  canvas.drawRect(Skia.XYWHRect(0, rail, w, h - rail), paint(art, { shader: linear(art, 0, rail, 0, h, [[0, ground, 0.5], [1, ground, 0.8]]) }));
  canvas.drawRect(
    Skia.XYWHRect(0, rail - 1.6 * s, w, 2.2 * s),
    paint(art, { shader: linear(art, 0, 0, w, 0, [[0, raised, 0.15], [0.69, mix(raised, accent, 0.4), 0.85], [1, raised, 0.4]]) }),
  );

  // 4. The mirror's frame. First the glass's glow bleeding out over the wall,
  // then the frame's shadow under it.
  const glass = oval(art, 0, 0, gx, gy);
  const outer = oval(art, 0, 0, gx + fw, gy + fw);
  // The crest on the frame's top (a shell, ribbed, between two scrolls) and the drop at its foot.
  const crestY = -gy - fw + 1.5 * s;
  const crest = svgPath(art, "M-11 1C-11-5-6-9.5 0-9.5C6-9.5 11-5 11 1C7-0.4 4-0.4 0 1C-4-0.4-7-0.4-11 1Z", 0, crestY, s);
  const scrolls = svgPath(art, "M-11 0.6C-15 0.4-19 1.6-21.4 3.6C-23.6 5.2-25.6 3.4-24.6 1.4C-23.8-0.2-21.8-0.2-21.4 1.2M11 0.6C15 0.4 19 1.6 21.4 3.6C23.6 5.2 25.6 3.4 24.6 1.4C23.8-0.2 21.8-0.2 21.4 1.2", 0, crestY, s);
  const ribs = Skia.PathBuilder.Make();
  for (let i = 1; i < 8; i += 1) {
    const a = Math.PI * (1 + i / 8);
    ribs.moveTo(0, crestY + 0.6 * s).lineTo(Math.cos(a) * 9.6 * s, crestY + 0.6 * s + Math.sin(a) * 8.8 * s);
  }
  const drop = svgPath(art, "M-9 0C-6 3-3 4-1.6 7C-1.6 9-1 10 0 11C1 10 1.6 9 1.6 7C3 4 6 3 9 0Z", 0, gy + fw - 1.5 * s, s);
  atMirror(() => {
    canvas.drawPath(outer, paint(art, { color: rgba(accent, 0.3), blur: 26 * s, blend: BlendMode.Screen }));
    canvas.drawPath(outer, paint(art, { color: rgba(ground, 0.6), blur: 4 * s, blend: BlendMode.Multiply }));
    // Old gilt gone grey: lightest at the bevel by the glass, dark at its outer edge.
    const shade = radial(art, 0, 0, gy + fw, [[0, mix(raised, muted, 0.45), 1], [(gy + fw * 0.2) / (gy + fw), mix(raised, muted, 0.3), 1], [1, ground, 1]], gx + fw);
    for (const part of [outer, crest, drop]) canvas.drawPath(part, paint(art, { shader: shade }));
    canvas.drawPath(scrolls, paint(art, { color: rgba(mix(raised, muted, 0.35), 1), stroke: 2 * s, round: true }));
    const gilt = rgba(mix(muted, accent, 0.5), 0.5);
    for (const part of [crest, drop]) canvas.drawPath(part, paint(art, { color: gilt, stroke: 0.6 * s, blur: 0.2 * s }));
    canvas.drawPath(ribs.build(), paint(art, { color: gilt, stroke: 0.55 * s, round: true }));
    canvas.drawPath(scrolls, paint(art, { color: rgba(mix(muted, accent, 0.5), 0.35), stroke: 0.5 * s, round: true }));
    // The outer moulding's thin edge, and a ring of small beads.
    canvas.drawPath(oval(art, 0, 0, gx + fw * 0.82, gy + fw * 0.82), paint(art, { color: rgba(mix(muted, accent, 0.4), 0.35), stroke: 0.6 * s }));
    for (let i = 0; i < 64; i += 1) {
      const a = (i / 64) * Math.PI * 2;
      const r = 0.75 * s;
      canvas.drawCircle(Math.cos(a) * (gx + fw * 0.5), Math.sin(a) * (gy + fw * 0.5), r, paint(art, { color: rgba(mix(muted, accent, 0.5), 0.45), blur: 0.25 * s }));
    }
    // The inner bevel lit by the glass.
    canvas.drawPath(oval(art, 0, 0, gx + 1.6 * s, gy + 1.6 * s), paint(art, { color: rgba(mix(accent, ink, 0.4), 0.8), stroke: 1.6 * s, blur: 0.6 * s }));
  });

  // 5. The glass, clipped to its tilted oval but drawn in the cover's own
  // points: dark and cold, deepest at its rim.
  canvas.save();
  canvas.translate(mx, my);
  canvas.rotate(tilt, 0, 0);
  canvas.clipPath(glass, lib.ClipOp.Intersect, true);
  canvas.rotate(-tilt, 0, 0);
  canvas.translate(-mx, -my);
  canvas.drawRect(Skia.XYWHRect(mx - gx * 1.2, my - gy * 1.2, gx * 2.4, gy * 2.4), paint(art, { shader: radial(art, mx, my - gy * 0.15, gy * 1.05, [[0, mix(surface, accent, 0.2), 1], [0.6, mix(ground, accent, 0.07), 1], [1, ground, 1]], gx * 1.1) }));
  // The room behind her in the glass: a doorway, faintly lit, and the floor's line.
  canvas.drawRect(Skia.XYWHRect(mx - gx * 0.36, my - gy * 0.62, gx * 0.72, gy * 1.8), paint(art, { color: rgba(accent, 0.09), blur: 2.5 * s }));
  canvas.drawRect(Skia.XYWHRect(mx - gx, my + gy * 0.55, gx * 2, gy), paint(art, { color: rgba(ground, 0.35), blur: 2 * s }));

  // 6. The woman, standing a little off centre, her head tilted: a soft
  // bloom, then her form, translucent and fading out below the waist, with a
  // brighter edge, worn away by the mist.
  const fs = s * 0.92;
  const fx = mx + gx * 0.08;
  const fy = my - gy * 0.6;
  const gown = svgPath(art, GOWN, fx, fy, fs);
  const head = [svgPath(art, HAIR, 0, 0, fs), svgPath(art, FACE, 0, 0, fs)];
  const placeHead = () => {
    canvas.translate(fx, fy + 16 * fs);
    canvas.rotate(-9, 0, 0);
    canvas.translate(0, -16 * fs);
  };
  canvas.drawCircle(fx, fy + 28 * fs, 32 * fs, paint(art, { color: rgba(glow, 0.45), blur: 16 * s, blend: BlendMode.Screen }));
  canvas.saveLayer(paint(art), null);
  const body = linear(art, 0, fy, 0, fy + 120 * fs, [[0, cold, 0.95], [0.3, cold, 0.78], [0.65, accent, 0.26], [1, accent, 0]]);
  canvas.drawPath(gown, paint(art, { shader: body, blur: 1.1 * s }));
  canvas.drawPath(gown, paint(art, { shader: body, stroke: 1.4 * s, blur: 1.4 * s }));
  canvas.save();
  placeHead();
  canvas.drawPath(head[0], paint(art, { color: rgba(mix(cold, accent, 0.3), 0.85), blur: 1 * s }));
  canvas.drawPath(head[1], paint(art, { color: rgba(mix(cold, ink, 0.4), 0.92), blur: 0.9 * s }));
  canvas.restore();
  noise(art, {
    fx: 0.06 / s,
    fy: 0.03 / s,
    octaves: 3,
    seed: 23,
    tone: ink,
    contrast: 2.4,
    bias: -0.2,
    alpha: 0.8,
    blend: BlendMode.DstOut,
    mask: linear(art, 0, fy + 34 * fs, 0, fy + 90 * fs, [[0, ink, 0], [1, ink, 1]]),
  });
  canvas.restore();
  // The silvering failing at the glass's rim: dark blooms of tarnish, and a sheen across it.
  noise(art, {
    fx: 0.05 / s,
    fy: 0.05 / s,
    octaves: 3,
    seed: 31,
    tone: ground,
    contrast: 2.8,
    bias: 0.05,
    alpha: 0.85,
    blend: BlendMode.Multiply,
    mask: radial(art, mx, my, gy, [[0, ink, 0], [0.7, ink, 0.1], [1, ink, 1]], gx),
  });
  canvas.drawPath(
    Skia.PathBuilder.Make().moveTo(mx - gx, my - gy * 0.2).lineTo(mx - gx * 0.2, my - gy).lineTo(mx + gx * 0.05, my - gy).lineTo(mx - gx, my + gy * 0.15).close().build(),
    paint(art, { color: rgba(ink, 0.07), blur: 3 * s, blend: BlendMode.Screen }),
  );
  canvas.restore();
  // Mist drifting across the glass and out over the frame's foot.
  noise(art, {
    fx: 0.03 / s,
    fy: 0.06 / s,
    octaves: 3,
    seed: 3,
    tone: cold,
    contrast: 2.2,
    bias: -0.12,
    alpha: 0.45,
    blend: BlendMode.Screen,
    mask: radial(art, mx, my + gy * 0.45, gy * 0.85, [[0, ink, 1], [0.6, ink, 0.45], [1, ink, 0]], gx * 1.3),
  });

  // 7. The glass's light spilling down to the floor, past the table.
  const spill = Skia.PathBuilder.Make().moveTo(mx - gx * 0.8, my).lineTo(mx + gx * 0.8, my).lineTo(mx + gx * 2, h).lineTo(mx - gx * 2.4, h).close().build();
  canvas.drawPath(spill, paint(art, { shader: linear(art, 0, my, 0, h, [[0, cold, 0], [0.5, cold, 0.07], [1, cold, 0.1]]), blur: 10 * s, blend: BlendMode.Screen }));

  // A faint haze hanging in the room, thickest in the glass's light.
  noise(art, {
    fx: 0.008 / s,
    fy: 0.016 / s,
    octaves: 3,
    seed: 41,
    tone: accent,
    contrast: 2.2,
    bias: -0.1,
    alpha: 0.18,
    blend: BlendMode.Screen,
    mask: radial(art, mx, my, w * 0.75, [[0, ink, 1], [0.6, ink, 0.5], [1, ink, 0.15]]),
  });

  // 8. The console table: its top lit along the back edge, a drawer pulled out, tapering legs.
  const legs = Skia.PathBuilder.Make();
  for (const [x, d] of [[tx0 + 6 * s, 1], [tx1 - 6 * s, -1]] as const) {
    legs.moveTo(x, top + 18 * s).lineTo(x + d * 5 * s, top + 18 * s).lineTo(x + d * 3.6 * s, h + 2).lineTo(x + d * 1.6 * s, h + 2).close();
  }
  const dark = rgba(mix(ground, surface, 0.3), 1);
  canvas.drawPath(legs.build(), paint(art, { color: dark }));
  canvas.drawRect(Skia.XYWHRect(tx0, top, tx1 - tx0, 4.4 * s), paint(art, { color: dark }));
  canvas.drawRect(Skia.XYWHRect(tx0 + 5 * s, top + 4.4 * s, tx1 - tx0 - 10 * s, 14 * s), paint(art, { color: dark }));
  canvas.drawRect(Skia.XYWHRect(tx0, top - 0.4 * s, tx1 - tx0, 1.3 * s), paint(art, { shader: linear(art, tx0, 0, tx1, 0, [[0, accent, 0.12], [0.5, cold, 0.8], [1, accent, 0.18]]) }));
  canvas.drawOval(Skia.XYWHRect(mx - 50 * s, top - 3 * s, 100 * s, 5 * s), paint(art, { color: rgba(cold, 0.16), blur: 3 * s, blend: BlendMode.Screen }));
  // The drawer, out a hand's width: the dark of its opening, the tops of its
  // sides catching the light, and its front a little lower and wider.
  const dw = 40 * s;
  canvas.drawRect(Skia.XYWHRect(mx - dw / 2, top + 6.5 * s, dw, 9.5 * s), paint(art, { color: rgba(ground, 1) }));
  canvas.drawRect(Skia.XYWHRect(mx - dw / 2 - 1.2 * s, top + 8.2 * s, dw + 2.4 * s, 2.2 * s), paint(art, { color: rgba(mix(raised, accent, 0.45), 0.9) }));
  canvas.drawRect(Skia.XYWHRect(mx - dw / 2 - 2 * s, top + 10.4 * s, dw + 4 * s, 10 * s), paint(art, { color: rgba(mix(surface, raised, 0.5), 1) }));
  canvas.drawRect(Skia.XYWHRect(mx - dw / 2 - 2 * s, top + 10.4 * s, dw + 4 * s, 0.7 * s), paint(art, { color: rgba(mix(accent, ink, 0.3), 0.6) }));
  canvas.drawCircle(mx, top + 15.4 * s, 1.4 * s, paint(art, { color: rgba(mix(muted, accent, 0.4), 0.8) }));

  // 9. A candle on the table burning blue, its smoke drawn toward the glass.
  const cx = tx1 - 20 * s;
  const foot = top;
  const cy = foot - 27 * s;
  const stick = Skia.PathBuilder.Make()
    .moveTo(cx - 7 * s, foot).lineTo(cx + 7 * s, foot).lineTo(cx + 3 * s, foot - 3.5 * s).lineTo(cx + 1.4 * s, foot - 12 * s)
    .lineTo(cx + 4 * s, foot - 13.5 * s).lineTo(cx - 4 * s, foot - 13.5 * s).lineTo(cx - 1.4 * s, foot - 12 * s).lineTo(cx - 3 * s, foot - 3.5 * s).close()
    .addRect(Skia.XYWHRect(cx - 2.2 * s, cy + 2.5 * s, 4.4 * s, foot - 13.5 * s - cy - 2.5 * s))
    .build();
  canvas.drawPath(stick, paint(art, { color: dark }));
  // The candle's wax lit by its own flame, and the stick's rim.
  canvas.drawRect(Skia.XYWHRect(cx - 2.2 * s, cy + 2.5 * s, 4.4 * s, 8 * s), paint(art, { shader: linear(art, 0, cy + 2.5 * s, 0, cy + 10 * s, [[0, mix(muted, glow, 0.5), 0.75], [1, muted, 0]]) }));
  canvas.drawRect(Skia.XYWHRect(cx - 4 * s, foot - 13.5 * s, 8 * s, 0.7 * s), paint(art, { color: rgba(muted, 0.5) }));
  canvas.drawCircle(cx, cy - 1 * s, 18 * s, paint(art, { color: rgba(glow, 0.2), blur: 12 * s, blend: BlendMode.Screen }));
  const flame = svgPath(art, "M0-8C1.8-4.6 2.7-1.8 2.5 0.7C2.3 2.5 1.2 3.4 0 3.4C-1.2 3.4-2.3 2.5-2.5 0.7C-2.7-1.8-1.8-4.6 0-8Z", cx, cy, s);
  canvas.drawPath(flame, paint(art, { color: rgba(glow, 0.9), blur: 1 * s }));
  canvas.drawPath(flame, paint(art, { color: rgba(ink, 0.95), blur: 0.35 * s }));
  const smoke = Skia.PathBuilder.Make()
    .moveTo(cx, cy - 8 * s)
    .cubicTo(cx + 4 * s, cy - 20 * s, cx - 7 * s, cy - 28 * s, cx - 5 * s, cy - 40 * s)
    .cubicTo(cx - 3 * s, cy - 52 * s, cx - 16 * s, cy - 58 * s, cx - 24 * s, cy - 68 * s)
    .build();
  canvas.drawPath(smoke, paint(art, { shader: linear(art, cx, cy, cx - 24 * s, cy - 68 * s, [[0, cold, 0.75], [0.6, cold, 0.3], [1, cold, 0]]), stroke: 1.6 * s, blur: 1.1 * s, round: true }));

  // 10. The empty chair at the right, nearer than the table: a silhouette with
  // the glass's light along its near edge.
  const chair = CHAIR.map(([d, width]) => [svgPath(art, d, w - 30 * s, h + 4 * s, s * 1.1), width * s * 1.1] as const);
  const drawChair = (color: Float32Array, dx: number, dy: number, blur: number) => {
    for (const [part, width] of chair) {
      canvas.save();
      canvas.translate(dx, dy);
      canvas.drawPath(part, paint(art, { color, stroke: width, round: true, blur }));
      canvas.restore();
    }
  };
  drawChair(rgba(mix(accent, ink, 0.2), 0.45), -1.5 * s, -0.7 * s, 0.45 * s);
  drawChair(rgba(ground, 1), 0, 0, 0);
  // The black cat, sitting on the chair's seat, watching the glass: a silhouette with the glass's light on
  // its near edge, its eyes catching the mint glow.
  const cat = [svgPath(art, CAT, w - 30 * s, h + 4 * s, s * 1.1), svgPath(art, CAT_TAIL, w - 30 * s, h + 4 * s, s * 1.1)] as const;
  canvas.save();
  canvas.translate(-1.2 * s, -0.6 * s);
  canvas.drawPath(cat[0], paint(art, { color: rgba(mix(accent, ink, 0.2), 0.5), blur: 0.5 * s }));
  canvas.restore();
  canvas.drawPath(cat[0], paint(art, { color: rgba(ground) }));
  canvas.drawPath(cat[1], paint(art, { color: rgba(ground), stroke: 2.6 * s, round: true }));
  const glowTone = tone(theme.glow);
  for (const ex of [-5.6, -1]) {
    const [eyeX, eyeY] = [w - 30 * s + ex * s * 1.1, h + 4 * s - 66.5 * s * 1.1];
    canvas.drawCircle(eyeX, eyeY, 2.4 * s, paint(art, { color: rgba(glowTone, 0.35), blur: 1.6 * s }));
    canvas.drawCircle(eyeX, eyeY, 0.85 * s, paint(art, { color: rgba(glowTone) }));
  }

  // 11. Mist lying low across the floor and round the legs.
  noise(art, {
    fx: 0.012 / s,
    fy: 0.03 / s,
    octaves: 4,
    seed: 17,
    tone: cold,
    contrast: 2.4,
    bias: -0.08,
    alpha: 0.42,
    blend: BlendMode.Screen,
    mask: linear(art, 0, top, 0, h, [[0, ink, 0], [0.6, ink, 0.7], [1, ink, 1]]),
  });

  // 12. Motes drifting in the glass's light: fine specks near it, a few larger, out of focus.
  for (let i = 0; i < 70; i += 1) {
    const x = between(art, w * 0.35, w);
    const y = between(art, 0, h);
    const near = Math.max(0, 1 - Math.hypot((x - mx) / (w * 0.42), (y - my) / (h * 0.62)));
    const big = art.rand() < 0.15;
    const r = (big ? between(art, 1.6, 2.8) : between(art, 0.35, 0.9)) * s;
    canvas.drawCircle(x, y, r, paint(art, { color: rgba(cold, (big ? 0.2 : 0.75) * near), blur: big ? r * 0.8 : 0.3 * s }));
  }

  // 13. Shade for the card's chip (top left) and words (bottom left), and the room's dark corners.
  wash(art, { shader: radial(art, 0, 0, w * 0.6, [[0, ground, 0.7], [0.6, ground, 0.3], [1, ground, 0]]) });
  wash(art, { shader: radial(art, 0, h, w * 0.75, [[0, ground, 0.75], [0.6, ground, 0.35], [1, ground, 0]]) });
  wash(art, { shader: radial(art, mx, my, Math.hypot(w, h) * 0.7, [[0, ground, 0], [0.55, ground, 0.1], [1, ground, 0.7]]) });
  grain(art, 0.07, 9);
}
