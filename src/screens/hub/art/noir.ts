// DETECTIVE NOIR's cover: a dark office wall raked by light through
// venetian blinds, rain on the window throwing its runs into the light,
// smoke hanging in the beams, and a detective in a fedora standing in it in
// silhouette, his hat and shoulder caught in brass. Monochrome, with the
// mode's brass only in the light. The top of the wall stays dark for the
// card's words.
// Drawn in points on a cover `w` x `h`: placed by share of the cover and
// scaled by its height (DESIGN_H).
import type { ModeTheme } from "@/theme/tokens";
import { type Art, between, grain, linear, mix, noise, paint, poly, radial, rgba, svgPath, tone, wash } from "./kit";

// The detective, facing left, in his own units with the crown's top at (0, 0):
// the fedora's brim (snapped down at the front) and pinched crown, its band,
// then his profile under the brim, the raised collar of his coat and his shoulders.
const BRIM = "M-37 29.5C-31 25-25 22.6-19 22L20 22C26 21.6 31 20.6 35 18.4L35.6 21.6C31 24.6 26 26 20 26.4L-19 26.4C-26 27.2-31 29.4-36.4 33.6Z";
const CROWN = "M-19 22.4C-18.6 15-17.2 8-13.2 3.2C-8.4 0.6-3.4 3.6 1.4 3.6C6 3.6 10.4 0.4 15.2 2C19 4 20.6 12 20.2 22.4Z";
const BAND = "M-19.1 17.2L20.4 17.2L20.3 22.4L-19.1 22.4Z";
const FIGURE =
  "M-18 26L-19 31C-21 33-23 35-23.5 37L-20 39.5L-20.5 42L-17 44.5L-16 46C-24 52-42 58-60 66C-70 72-73 90-75 200" +
  "L92 200C90 120 88 84 80 70C68 58 48 54 37 50L26 31L16.5 34L17.5 26Z";

/** The cover's design height: the figure's units are points at this height times FIGURE_SCALE. */
const DESIGN_H = 260;
const FIGURE_SCALE = 1.3;

export function drawNoir(art: Art, theme: ModeTheme) {
  const { lib, canvas, w, h } = art;
  const { Skia, BlendMode } = lib;
  const ground = tone(theme.ground);
  const surface = tone(theme.surface);
  const raised = tone(theme.raised);
  const ink = tone(theme.ink);
  const brass = tone(theme.accent);
  // The window's light: white warmed toward the brass.
  const light = mix(ink, brass, 0.42);
  const s = h / DESIGN_H;
  const fs = s * FIGURE_SCALE;

  // 1. The wall: near black at the left, lifting toward the window at the right.
  wash(art, { shader: linear(art, 0, 0, w, h * 0.7, [[0, ground, 1], [0.5, surface, 1], [1, mix(surface, raised, 0.7), 1]]) });
  // The warmth where the window's light lands.
  wash(art, { shader: radial(art, w * 0.7, h * 0.52, w * 0.72, [[0, light, 0.18], [0.5, light, 0.07], [1, light, 0]]) });

  // 2. The blinds: the window's slats thrown across the wall as slanted bands,
  // split by the window's middle bar, brightest where the window is nearest
  // (right of centre, below the words).
  const pitch = h * 0.046;
  const open = pitch * 0.48;
  const W = w * 1.3;
  const H = h * 1.3;
  const mullion = w * 0.075;
  const bands = Skia.PathBuilder.Make();
  for (let y = -H / 2; y < H / 2; y += pitch) {
    bands.addRect(Skia.XYWHRect(-W / 2, y, W / 2 - mullion / 2, open));
    bands.addRect(Skia.XYWHRect(mullion / 2, y, W / 2 - mullion / 2, open));
  }
  const bandPath = bands.build();
  const place = () => {
    canvas.translate(w * 0.72, h * 0.5);
    canvas.rotate(-13, 0, 0);
    canvas.skew(-0.42, 0);
  };
  const falloff = (alpha: number) =>
    radial(art, W * 0.26, -H * 0.06, W * 0.82, [[0, light, alpha], [0.4, light, alpha * 0.6], [0.78, light, alpha * 0.15], [1, light, 0]]);

  canvas.save();
  place();
  // The light's halo (a wide soft bloom), then the bands with soft edges.
  canvas.drawPath(bandPath, paint(art, { shader: falloff(0.3), blur: 8 * s, blend: BlendMode.Screen }));
  canvas.drawPath(bandPath, paint(art, { shader: falloff(0.92), blur: 0.8 * s }));
  // The rain on the glass, its runs thrown into the light as fine wavering shadows.
  for (let i = 0; i < 70; i += 1) {
    const x = between(art, -W * 0.5, W * 0.5);
    const top = between(art, -H * 0.5, H * 0.45);
    const length = between(art, H * 0.02, H * 0.16);
    const run = Skia.PathBuilder.Make().moveTo(x, top);
    const steps = 4;
    for (let k = 1; k <= steps; k += 1) run.lineTo(x + between(art, -0.7, 0.7) * s, top + (length * k) / steps);
    canvas.drawPath(run.build(), paint(art, { color: rgba(ground, between(art, 0.25, 0.5)), stroke: between(art, 0.5, 1.1) * s, blur: 0.35 * s, round: true, blend: BlendMode.Multiply }));
  }
  canvas.restore();

  // 3. Shafts of light through the smoky air, from the window beyond the frame's right edge.
  for (let i = 0; i < 5; i += 1) {
    const spread = i / 4;
    const x0 = w * (1.04 + spread * 0.04);
    const y0 = h * (0.06 + spread * 0.1);
    const x1 = w * (0.18 + spread * 0.3);
    const y1 = h * (0.72 + spread * 0.24);
    const width = w * 0.045;
    const beam = poly(art, [[x0, y0 - width * 0.3], [x0, y0 + width * 0.3], [x1 + width, y1], [x1 - width, y1]]);
    canvas.drawPath(beam, paint(art, { shader: linear(art, x0, y0, x1, y1, [[0, light, 0.12], [0.55, light, 0.05], [1, light, 0]]), blur: 9 * s, blend: BlendMode.Screen }));
  }
  // Smoke hanging in the light.
  noise(art, {
    fx: 0.012 / s,
    fy: 0.02 / s,
    octaves: 4,
    seed: 11,
    tone: light,
    contrast: 2.6,
    bias: -0.12,
    alpha: 0.4,
    blend: BlendMode.Screen,
    mask: radial(art, w * 0.62, h * 0.5, w * 0.62, [[0, ink, 1], [0.6, ink, 0.45], [1, ink, 0]]),
  });

  // 4. The detective. His shadow first, thrown down and to the left across the bands.
  const ax = w * 0.73;
  const ay = h * 0.32;
  const hat = [svgPath(art, BRIM, ax, ay, fs), svgPath(art, CROWN, ax, ay, fs)];
  const figure = [svgPath(art, FIGURE, ax, ay, fs), ...hat];
  canvas.save();
  canvas.translate(-w * 0.2, h * 0.03);
  canvas.scale(1.04, 1.04);
  for (const part of figure) canvas.drawPath(part, paint(art, { color: rgba(ground, 0.78), blur: 1.6 * s, blend: BlendMode.Multiply }));
  canvas.restore();
  // His edge where the window's light catches it: a soft brass glow up and to
  // the right, then the silhouette nudged the same way, then the silhouette
  // itself over both, so only the lit side keeps a rim.
  canvas.save();
  canvas.translate(5 * s, -4 * s);
  for (const part of figure) canvas.drawPath(part, paint(art, { color: rgba(brass, 0.22), blur: 8 * s, blend: BlendMode.Screen }));
  canvas.restore();
  canvas.save();
  canvas.translate(1.3 * s, -1.1 * s);
  for (const part of figure) canvas.drawPath(part, paint(art, { color: rgba(mix(brass, ink, 0.4), 0.95), blur: 0.7 * s }));
  canvas.restore();
  for (const part of figure) canvas.drawPath(part, paint(art, { color: rgba(ground, 1) }));
  // The blinds' light across his coat and hat, a little off the wall's (he stands nearer the window).
  for (const part of figure) {
    canvas.save();
    canvas.clipPath(part, lib.ClipOp.Intersect, true);
    place();
    canvas.translate(0, pitch * 0.35);
    canvas.drawPath(bandPath, paint(art, { shader: falloff(0.13), blur: 1.2 * s }));
    canvas.restore();
  }
  // The hat band: a dull brass sheen, brightest on the lit side.
  canvas.drawPath(
    svgPath(art, BAND, ax, ay, fs),
    paint(art, { shader: linear(art, ax - 19 * fs, 0, ax + 20 * fs, 0, [[0, ground, 1], [0.55, mix(raised, brass, 0.25), 1], [1, mix(brass, ink, 0.15), 1]]) }),
  );

  // 5. The top of the wall in shade for the card's words, and the room's dark corners.
  wash(art, { shader: linear(art, 0, 0, 0, h * 0.5, [[0, ground, 0.72], [0.55, ground, 0.32], [1, ground, 0]]) });
  wash(art, { shader: radial(art, 0, 0, w * 0.8, [[0, ground, 0.6], [0.6, ground, 0.25], [1, ground, 0]]) });
  wash(art, { shader: radial(art, w * 0.6, h * 0.5, Math.hypot(w, h) * 0.62, [[0, ground, 0], [0.62, ground, 0.12], [1, ground, 0.75]]) });
  grain(art, 0.07, 7);
}
