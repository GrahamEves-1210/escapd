/// <reference types="node" />
import fs from "fs";
import path from "path";
import { modeThemes, ref, shellTheme, type ModeTheme, type PhotoTreatment } from "../tokens";

const ROOT = path.join(__dirname, "../../..");
const THEMES: [string, ModeTheme][] = [...Object.entries(modeThemes), ["shell", shellTheme]];

/** WCAG relative luminance of a #RRGGBB colour. */
function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Hue in degrees and HSL saturation of a #RRGGBB colour. */
function hueOf(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  const saturation = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d === 0) return { hue: 0, saturation };
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { hue: (h * 60 + 360) % 360, saturation };
}

const HEX_ROLES = ["ground", "surface", "raised", "ink", "inkMuted", "accent", "accentInk", "stamp", "glow", "detail"] as const;

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/** A colour matrix applied to an opaque rgb (0 to 1), clamped to 0 to 1 as Skia clamps it. */
function apply(matrix: readonly number[], [r, g, b]: [number, number, number]) {
  return [0, 1, 2].map((row) => clamp(matrix[row * 5] * r + matrix[row * 5 + 1] * g + matrix[row * 5 + 2] * b + matrix[row * 5 + 4]));
}

/** What the bake's grade does to an rgb: the matrix over its toe, the brighter of the two in each channel. */
function treat({ matrix, toe }: PhotoTreatment, rgb: [number, number, number]) {
  const graded = apply(matrix, rgb);
  if (!toe) return graded;
  const floor = apply(toe, rgb);
  return graded.map((v, i) => Math.max(v, floor[i]));
}

const lumaOf = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const grey = (v: number): [number, number, number] => [v, v, v];

describe("modeThemes", () => {
  it("names the three modes and their taglines", () => {
    expect(Object.keys(modeThemes)).toEqual(["noir", "crime_scene", "paranormal"]);
    expect(Object.values(modeThemes).map((t) => [t.genre, t.name, t.tagline])).toEqual([
      ["noir", "Detective Noir", "Solve the case"],
      ["crime_scene", "Crime Scene", "Find the killer"],
      ["paranormal", "Paranormal", "Face the unknown"],
    ]);
  });

  it.each(THEMES)("%s: every text colour reads at 4.5:1 or more on every ground it sits on", (_name, theme) => {
    const grounds = { ground: theme.ground, surface: theme.surface, raised: theme.raised };
    const pairs: [string, string, number][] = [];
    for (const text of ["ink", "inkMuted", "stamp"] as const) {
      for (const [ground, value] of Object.entries(grounds)) pairs.push([`${text} on ${ground}`, theme[text], contrast(theme[text], value)]);
    }
    pairs.push(["accentInk on accent", theme.accentInk, contrast(theme.accentInk, theme.accent)]);
    if (theme.detail) pairs.push(["detail on ground", theme.detail, contrast(theme.detail, theme.ground)]);
    for (const [pair, , ratio] of pairs) expect({ pair, ok: ratio >= 4.5, ratio }).toMatchObject({ pair, ok: true });
  });

  it("paranormal's glow, a meter and a haze rather than text, still stands out at 3:1 on its grounds", () => {
    const { glow, ground, surface } = modeThemes.paranormal;
    expect(contrast(glow!, ground)).toBeGreaterThanOrEqual(3);
    expect(contrast(glow!, surface)).toBeGreaterThanOrEqual(3);
  });

  it("no theme has a green or mint colour; paranormal stays cold, between 185° and 205°", () => {
    for (const [name, theme] of THEMES) {
      for (const role of HEX_ROLES) {
        const value = theme[role];
        if (!value) continue;
        const { hue, saturation } = hueOf(value);
        expect({ name, role, greenOrMint: saturation > 0.1 && hue >= 75 && hue <= 175 }).toEqual({ name, role, greenOrMint: false });
      }
    }
    const { accent, glow, stamp, ink, inkMuted } = modeThemes.paranormal;
    for (const value of [accent, glow!, stamp, ink, inkMuted]) {
      const { hue } = hueOf(value);
      expect({ value, cold: hue >= 185 && hue <= 205 }).toEqual({ value, cold: true });
    }
  });

  it("keeps noir's brass and the brief's crime-scene reds", () => {
    expect(modeThemes.noir.accent).toBe("#C89D54");
    // The accent sits in the user's range, #8E1B1B to #A3201F; the stamp is the same hue, lifted for text.
    expect(modeThemes.crime_scene.accent).toBe("#A3201F");
    expect(hueOf(modeThemes.crime_scene.stamp).hue).toBeLessThan(5);
  });

  it("sets each mode's name in a loaded Google face", () => {
    const layout = fs.readFileSync(path.join(ROOT, "app/_layout.tsx"), "utf8");
    const faces = Object.values(modeThemes).map((t) => t.display.fontFamily);
    expect(faces).toEqual([ref.font.noirDisplay, ref.font.crimeDisplay, ref.font.paranormalDisplay]);
    for (const face of faces) expect(layout).toMatch(new RegExp(`^\\s*${face},$`, "m"));
    expect(layout).not.toMatch(/Outfit|Inter_/);
  });
});

describe("photo treatments", () => {
  it("each is a 4 x 5 matrix, and its toe too, that leaves alpha alone", () => {
    for (const theme of Object.values(modeThemes)) {
      const { matrix, toe } = theme.treatment!;
      for (const m of toe ? [matrix, toe] : [matrix]) {
        expect(m).toHaveLength(20);
        expect(m.slice(15)).toEqual([0, 0, 0, 1, 0]);
      }
    }
    expect(shellTheme.treatment).toBeNull();
  });

  it.each(Object.entries(modeThemes))("%s keeps its shadows: black, 0.05 and 0.12 grey come out distinct, and above black", (_genre, theme) => {
    const t = theme.treatment!;
    const [black, deep, dark] = [0, 0.05, 0.12].map((v) => lumaOf(treat(t, grey(v))));
    // At least 3/255 apart: the darkest tones of a room keep their steps instead of clipping to one black.
    expect(deep).toBeGreaterThan(0);
    expect(deep - black).toBeGreaterThan(3 / 255);
    expect(dark - deep).toBeGreaterThan(3 / 255);
    // Whatever gives the floor (the toe, or a grade with no toe) never takes black below 0.
    const floor = t.toe ?? t.matrix;
    for (const row of [0, 1, 2]) expect(floor[row * 5 + 4]).toBeGreaterThanOrEqual(0);
  });

  it("noir is grey: every row the same, so red, green and blue come out equal", () => {
    const t = modeThemes.noir.treatment!;
    for (const m of [t.matrix, t.toe!]) {
      expect(m.slice(0, 5)).toEqual(m.slice(5, 10));
      expect(m.slice(0, 5)).toEqual(m.slice(10, 15));
    }
    // Black lands near black, 8 to 12/255, not on it.
    const [black] = treat(t, grey(0));
    expect(black * 255).toBeGreaterThanOrEqual(8);
    expect(black * 255).toBeLessThanOrEqual(12);
    // High contrast: a step in the midtones comes out steeper.
    const [dark] = treat(t, grey(0.3));
    const [light] = treat(t, grey(0.6));
    expect(light - dark).toBeGreaterThan(0.3 * 1.3);
  });

  it("crime scene pushes red into the shadows and keeps white nearly neutral", () => {
    const t = modeThemes.crime_scene.treatment!;
    const [r, g, b] = treat(t, grey(0.12));
    expect(r - Math.max(g, b)).toBeGreaterThan(0.06);
    // Black is red's: about (23, 0, 0).
    const [br, bg, bb] = treat(t, grey(0)).map((v) => v * 255);
    expect(br).toBeGreaterThan(18);
    expect(Math.max(bg, bb)).toBeLessThan(3);
    const white = treat(t, grey(1));
    expect(Math.min(...white)).toBeGreaterThan(0.9);
    // Desaturated: a saturated green comes out close to grey.
    const [gr, gg, gb] = treat(t, [0.2, 0.6, 0.3]);
    expect(Math.abs(gg - gb)).toBeLessThan(0.1);
    expect(gg - gr).toBeLessThan(0.1);
  });

  it("paranormal lifts black to a cold blue-green and glows", () => {
    const { matrix, bloom } = modeThemes.paranormal.treatment!;
    const [r, g, b] = apply(matrix, [0, 0, 0]);
    expect(b).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(0.08);
    expect(bloom).toBeGreaterThan(0);
    expect(modeThemes.noir.treatment!.bloom).toBe(0);
    expect(modeThemes.crime_scene.treatment!.bloom).toBe(0);
  });

  it("strengths stay between 0 and 1, paranormal's grain the lightest", () => {
    for (const theme of Object.values(modeThemes)) {
      for (const strength of [theme.treatment!.grain, theme.treatment!.vignette, theme.treatment!.bloom]) {
        expect(strength).toBeGreaterThanOrEqual(0);
        expect(strength).toBeLessThanOrEqual(1);
      }
    }
    expect(modeThemes.paranormal.treatment!.grain).toBeLessThan(modeThemes.noir.treatment!.grain);
  });
});
