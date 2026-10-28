// Home's reading nook (docs/ART_DIRECTION.md, "velvet & ink" and the
// mystery-book core): the numbers and the few light colours the window, its
// rain, the candle and the fairy lights are drawn with. Colours that belong
// to the palette come from the shell's theme (useModeTheme() on home: glow,
// sweet, foil); these are only the window's own lights (rain on the glass, a
// far-off flash), which no theme names. Kept here, beside the art, so the
// screens' source stays tokens-only (hub-test).

/** The window art's geometry as fractions (scripts/brand/window.py): frame, sill, mullion, the cross's height. */
export const WINDOW_ART = {
  frameX: 0.0496,
  frameY: 0.0229,
  sill: 0.0536,
  mullion: 0.0357,
  cross: 0.5,
  /** The art's size in pixels. */
  width: 1290,
  height: 2796,
  /** The candle's flame on the sill (window.py's FLAME), as shares of the art. */
  flame: { x: 0.2248, y: 0.8498 },
} as const;

/** The rain the app adds on the glass: fewer and softer than before (the rain stays subtle). */
export const RAIN = {
  drops: 30,
  /** The bead's body, its dark edge, its lit highlight and a running drop's wet trail. */
  body: "rgba(214, 200, 246, 0.22)",
  edge: "rgba(18, 10, 34, 0.35)",
  highlight: "rgba(255, 238, 230, 0.7)",
  trail: "rgba(214, 200, 246, 0.08)",
  /** Bead radius (points): `min` plus up to `spread`. */
  radius: { min: 2.2, spread: 3.6 },
  /** Seconds per cycle: `min` plus up to `spread`. */
  period: { min: 4, spread: 5 },
  /** Share of drops that run down after beading; how far (points). */
  runs: 0.4,
  run: { min: 70, spread: 220 },
  /** Its life as shares of the cycle: lands, beads, starts to run, fades out. */
  land: 0.06,
  fadeIn: 0.04,
  runAt: 0.55,
  fadeAt: 0.9,
  /** The highlight's place and size, as shares of the bead. */
  glint: { dy: 0.35, r: 0.45 },
  /** The bead swells from this share of its size as it lands, and shrinks to `running` once it runs. */
  from: 0.4,
  running: 0.85,
  trailWidth: 1.5,
} as const;

/** Far-off lightning, softer than before: a lavender flicker every `every` + up to `spread` ms. */
export const LIGHTNING = {
  color: "rgb(214, 204, 255)",
  first: 3500,
  firstSpread: 4000,
  every: 9000,
  spread: 10000,
  // Two flickers and a fade: peak, dip, peak, out.
  steps: [
    { to: 0.2, ms: 60 },
    { to: 0.03, ms: 90 },
    { to: 0.14, ms: 70 },
    { to: 0, ms: 300 },
  ],
} as const;

/** The candle's flame light over the art: a warm halo that breathes and flickers. */
export const CANDLE = {
  /** The halo's radius (points), and the core's. */
  halo: 64,
  core: 14,
  /** Halo opacity: its rest and how far it flickers. */
  rest: 0.34,
  flicker: 0.12,
  /** A slow breath and a quicker flutter, in radians per second. */
  breath: 1.7,
  flutter: 7.3,
  wobble: 13.1,
} as const;

/**
 * Fairy lights strung along the top of the window, in front of the glass:
 * `swags` loops of wire across the screen, each sagging `sag` points, `top`
 * below the safe top, a bulb every `pitch` points. Bulbs glow in the theme's
 * glow, sweet and foil in turn, and twinkle slowly (still under reduced motion).
 */
export const FAIRY = {
  swags: 3,
  sag: 26,
  top: 2,
  pitch: 30,
  bulb: 3.2,
  glow: 13,
  wire: "rgba(20, 12, 24, 0.75)",
  wireWidth: 1.1,
  /** Twinkle: opacity rest, swing and speed (radians per second). */
  rest: 0.78,
  swing: 0.22,
  speed: 1.3,
} as const;

/** How much of the column the deck fills: smaller cards, the sill and the cat in view below them. */
export const DECK_SHARE = 0.8;

/**
 * The sill cat: `width` at most, never under `minWidth` (else it's left
 * out); its art's height / width (assets/characters/cat_sit.png); its feet
 * `sink` below the sill's top edge; at least `gap` clear of the deck; `right`
 * from the screen's right edge.
 */
export const CAT = { width: 64, minWidth: 34, aspect: 640 / 444, sink: 6, gap: 6, right: 32 } as const;

/** Home's elements arrive a beat after the window: they fall into place (fade only under reduced motion). */
export const FALL = { delay: 1000, stagger: 120, from: -70, duration: 620, reducedDuration: 200, back: 1.1, fade: 1.6, /** The cat pops up after the logo and the three cards. */ cat: 4 } as const;

/** The logo's sparkle: a four-point glint that blooms on a letter every `every` + up to `spread` ms. */
export const SPARKLE = {
  size: 14,
  /** It turns this far (degrees) as it blooms. */
  turn: 90,
  percent: 100,
  first: 2600,
  every: 5200,
  spread: 4200,
  rise: 260,
  hold: 120,
  fade: 420,
  /** Where on the wordmark it may bloom (shares of its box): the E's top, the keyhole, the D's shoulder. */
  spots: [
    { x: 0.06, y: 0.22 },
    { x: 0.53, y: 0.3 },
    { x: 0.95, y: 0.28 },
    { x: 0.3, y: 0.75 },
  ],
} as const;

/**
 * The cards as book covers (docs/ART_DIRECTION.md, the mystery-book core):
 * corners `radius`; a foil frame `inset` inside the edge with `frameRadius`
 * corners, a second hairline `double` inside it; a darker spine band
 * `spine` wide down the left with a foil rule; the series line under the
 * tagline. The shadow each card casts is the ground's colour, not black.
 */
export const COVER = {
  radius: 24,
  inset: 9,
  frameRadius: 16,
  frameWidth: 1.2,
  double: 3.5,
  frameOpacity: 0.7,
  doubleOpacity: 0.35,
  spine: 12,
  spineShade: 0.38,
  spineRule: 0.55,
  /** The words sit inside the frame. */
  pad: 22,
  /** A fleuron's size in the frame's top corners (points). */
  fleuron: 6,
  /** The light on the cover in the glow colour, as a share of Moonlit's (its own is full). */
  glow: 0.55,
  shadow: { opacity: 0.85, radius: 26, y: 14, elevation: 14 },
  /** The page block glimpsed at the cover's right edge (a hardback's fore-edge), points. */
  pages: 3,
  /** The series line: its size and the gap above it. */
  series: { fontSize: 13, lineHeight: 18, letterSpacing: 0.4, gap: 4 },
} as const;

/** One drop on the glass: where (shares of the glass), its bead, its cycle, and whether and how far it runs. */
export interface DropSpec {
  x: number;
  y: number;
  r: number;
  period: number;
  phase: number;
  runs: boolean;
  run: number;
}

/** A fixed shower (the same every launch), from a cheap hash; drops start in the top 90 % of the glass. */
export const SHOWER: readonly DropSpec[] = Array.from({ length: RAIN.drops }, (_, i) => {
  const h = (n: number) => {
    const v = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  return {
    x: h(1),
    y: h(2) * 0.9,
    r: RAIN.radius.min + h(3) * RAIN.radius.spread,
    period: RAIN.period.min + h(4) * RAIN.period.spread,
    phase: h(5),
    runs: h(6) < RAIN.runs,
    run: RAIN.run.min + h(7) * RAIN.run.spread,
  };
});

/** The candle's flicker at `seconds`: a slow breath and two quicker flutters, about -1 to 1. */
export function flicker(seconds: number): number {
  "worklet";
  return Math.sin(seconds * CANDLE.breath) * 0.5 + Math.sin(seconds * CANDLE.flutter) * 0.3 + Math.sin(seconds * CANDLE.wobble) * 0.2;
}

/** A swag's sag at `k` (0 to 1 along it): 0 at the anchors, 1 in the middle. */
export function sag(k: number): number {
  return 4 * k * (1 - k);
}

/** Each bulb's twinkle phase: the golden angle apart, so neighbours never pulse together. */
export const BULB_PHASE = 2.399;
/** The bulb's soft glow's opacity under its bulb. */
export const BULB_GLOW = 0.55;

/** A four-point sparkle in a -1..1 box: the house's little star (foil on the covers, the logo's glint). */
export const SPARK_PATH = "M0 -1C0.12 -0.3 0.3 -0.12 1 0C0.3 0.12 0.12 0.3 0 1C-0.12 0.3 -0.3 0.12 -1 0C-0.3 -0.12 -0.12 -0.3 0 -1Z";

/** The ornamental rule (mode intros): two `rule`-long foil lines `weight` thick and a sparkle `spark` across between them. */
export const FLEURON = { rule: 36, weight: 1, spark: 12, gap: 8, margin: 14, opacity: 0.8 } as const;

/** The intro's book furniture: the series line, the chapter line and the handwritten p.s. */
export const PAGE = {
  series: { fontSize: 15, lineHeight: 20, letterSpacing: 0.3 },
  chapter: { fontSize: 12, lineHeight: 16, letterSpacing: 2.4, textTransform: "uppercase" as const },
  chapterTitle: { fontSize: 22, lineHeight: 28 },
  note: { fontSize: 19, lineHeight: 24 },
  /** The note leans a little, as if written in the margin. */
  noteTurn: "-2deg",
  noteTop: 28,
} as const;

/** Settings on home: rounder groups (the doc's ~24 for sheets, a little less for panels inside one) and its section headings. */
export const SETTINGS = { radius: 18, heading: { fontSize: 17, lineHeight: 22 } } as const;

/** A bookmark ribbon, its tail notched (the continue prompt: her place in this book). */
export const RIBBON = { width: 14, height: 24, viewBox: "0 0 14 24", path: "M1 0H13V23L7 18L1 23Z" } as const;

/** The Settings chip's magnifier over the gear (Chip.tsx): its rim's width, its handle's length and width (points). */
export const LENS = { rim: 2, handle: 7, handleWidth: 3.5 } as const;
/** cos 45°: the handle leaves the lens at its lower right. */
export const DIAGONAL = Math.SQRT1_2;

/** Radians per degree. */
export const RADIANS = Math.PI / 180;

/** Seconds per millisecond: a Skia clock (ms) to seconds. */
export const MS_TO_S = 1 / 1000;

/** The drawn cover's own proportions (height / width, as home's cards): a mode intro's banner never grows taller than the art at full width. */
export const COVER_ASPECT = 3 / 4;
