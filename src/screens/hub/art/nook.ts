// Home's reading nook (docs/ART_DIRECTION.md, "velvet & ink" and the
// mystery-book core): the numbers and the few light colours the window, its
// rain, the candle and the fairy lights are drawn with. Colours that belong
// to the palette come from the shell's theme (useModeTheme() on home: glow,
// sweet, foil); these are only the window's own lights (rain on the glass,
// the clouds, the moon's light through them, the tea's steam), which no theme names. Kept here, beside the art, so the
// screens' source stays tokens-only (hub-test).

/**
 * The set's geometry as fractions of its art (scripts/blender/props/home_set.py
 * builds it, scripts/brand/window.py finishes it and writes
 * assets/home/set/set.json: each layer's place on the art, the moon, the
 * candle's flame): the frame at the sides and the top, the sill's height at
 * the foot (its back edge, where the glass meets it), the bars between the
 * panes and the cross's height.
 */
export const WINDOW_ART = {
  frameX: 0.0496,
  frameY: 0.0229,
  sill: 0.0536,
  mullion: 0.0357,
  cross: 0.5,
  /** The art's size in pixels: three to a point on the phone it was drawn for. */
  width: 1290,
  height: 2796,
  density: 3,
} as const;

/**
 * Home's motion parallax (parallax/tilt.ts, useTilt, ParallaxLayer): the set
 * is rendered in depth layers that slide against each other as the phone
 * tilts, turning about the sill (the cat's place: it never moves).
 * `depth`: each layer's slide in points at full tilt: what lies behind the
 * sill follows the eye (+), further for what is further; what is nearer than
 * the sill goes the other way (-); the cards and the logo are held in the
 * hand, in front of it all, each card a little nearer than the one under it.
 * Up and down they slide `vertical` of that. `turn`: the curtains lean this
 * many degrees at full tilt as they slide.
 * Full tilt is `range` radians from however the phone is being held: that
 * rest pose follows the phone with a time constant of `recentre` seconds.
 * The layers glide to the tilt on a critically damped spring (`glide`: no
 * overshoot, no ringing), and hold still while it stays inside `dead` of
 * where they are headed (a still hand, a still picture). The sensor is read
 * every `interval` ms; under `minGravity` (m/s²) there is no tilt to read.
 * Every layer has `bleed` points of picture to spare beyond the screen.
 */
export const PARALLAX = {
  depth: { sky: 7, far: 5.4, near: 4, rain: 2.4, glass: 2, frame: 1.2, lights: 0.8, sill: 0, fore: -14, logo: -2.4, card: -1.2, cardStep: -0.9 },
  vertical: 0.6,
  turn: 0.5,
  range: 0.24,
  recentre: 5,
  glide: { stiffness: 170, damping: 26, mass: 1, overshootClamping: true },
  dead: 0.006,
  interval: 33,
  minGravity: 1,
  bleed: 18,
} as const;

/**
 * The candle's flame (assets/home/flame.png, home_set.py --flame): `frames`
 * rendered frames in a row, played at `fps` (the cat's stop-motion), each
 * `width` x `height` art pixels, the wick's tip `foot` of the way down a
 * frame, in its middle. Under reduced motion it holds its first frame.
 */
export const FLAME = { frames: 8, fps: 12, width: 39, height: 72, foot: 0.92 } as const;

/**
 * Thin rain cloud drifting across the glass, left to right, most of it in a
 * band over the moon (veiling it as it passes) and a few wisps higher up:
 * each a soft oval, `x`, `y` its start as shares of the art, `w`, `h` its size
 * as shares of the art's width, drifting `speed` points a second and wrapping
 * round the glass. A cloud lights up silver as it nears the moon (its `lit`
 * twin's opacity, by its distance in moon radii, out to `reach`). Under
 * reduced motion they hold their starting places (one across the moon).
 */
export const CLOUDS = {
  list: [
    { x: 0.62, y: 0.792, w: 0.46, h: 0.05, speed: 5, alpha: 0.5 },
    { x: 0.08, y: 0.818, w: 0.6, h: 0.04, speed: 3.4, alpha: 0.42 },
    { x: 0.95, y: 0.776, w: 0.38, h: 0.03, speed: 6.2, alpha: 0.36 },
    { x: 0.35, y: 0.835, w: 0.5, h: 0.035, speed: 4.2, alpha: 0.34 },
    { x: 0.3, y: 0.11, w: 0.7, h: 0.06, speed: 3, alpha: 0.3 },
    { x: 0.8, y: 0.46, w: 0.55, h: 0.05, speed: 3.8, alpha: 0.26 },
  ],
  /** Dusky plum cloud, and its moonlit silver. */
  color: "rgb(98, 74, 118)",
  lit: "rgb(218, 206, 232)",
  clear: "rgba(218, 206, 232, 0)",
  /** How far past the glass's edges a cloud goes before it wraps, as a share of the glass's width. */
  margin: 0.45,
  /** Blur, as a share of the cloud's height. */
  blur: 0.45,
  /** A cloud is lit out to this many moon radii from the moon; at most `litMax`. */
  reach: 4,
  litMax: 0.75,
  /** The moon's light over the clouds: a soft silver corona `corona` moon radii wide, at `glow` (screen). */
  corona: 3.2,
  glow: 0.22,
} as const;

/**
 * Steam off the coffee in the mug by the cat (src/play2/cat/Mug.tsx shows the
 * mug and its steam): `wisps` thin curls rising `rise` mug-widths from the
 * mug's mouth, swaying `amp` mug-widths as waves travel up them (`waves`
 * along each, `speed` radians a second), fading in just over the rim and out
 * at the top. Points: `width` and `blur`. Under reduced motion they hold
 * still at `still` seconds.
 */
export const STEAM = {
  wisps: [
    { dx: -0.18, phase: 0, rise: 1.7, lean: -0.14 },
    { dx: 0.06, phase: 2.1, rise: 2.1, lean: 0.08 },
    { dx: 0.26, phase: 4.2, rise: 1.5, lean: 0.22 },
  ],
  amp: 0.11,
  /** The sway grows from this share of `amp` at the rim to all of it at the top. */
  swayFrom: 0.3,
  waves: 1.6,
  speed: 2.2,
  /** How fast each wisp's strength breathes (radians a second), and between what opacities. */
  breath: 0.8,
  low: 0.45,
  high: 1,
  segments: 14,
  /** It starts this far over the rim, as a share of the mug's width. */
  lift: 0.12,
  width: 3.4,
  blur: 1.8,
  color: "rgba(255, 240, 232, 0.62)",
  clear: "rgba(255, 240, 232, 0)",
  /** Along each wisp, rim to top: clear, in, held, out. */
  fade: [0, 0.18, 0.5, 1],
  still: 1.3,
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

/** The candle's light over the set: a warm halo round its flame that breathes and flickers. */
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
 * The string lights across the top of the window (StringLights.tsx; rendered
 * by scripts/blender/props/home_lights.py): the lowest bulb's glass ends
 * `foot` points under the safe top, clear of the wordmark and the corner
 * buttons below it; the cord keeps `edge` under the screen's top where it
 * can; with no room above (the web) its swags flatten to `flat` of their
 * droop. Each bulb swings `sway` degrees at full tilt (less by up to
 * `swayVary` of that, each its own). `twinkle`: each bulb's light breathes
 * between `high` and its own low (from `low` up, by `shallow` of the way to
 * `high`), over its own period (`period` ms plus up to `spread`), starting
 * at its own moment: `down` of the period dimming, `hold` barely lifting
 * (`lift` of the way back), `up` brightening; `rest` under reduced motion.
 */
export const LIGHTS = {
  foot: 7,
  edge: 2,
  flat: 0.3,
  sway: 9,
  swayVary: 0.4,
  twinkle: { low: 0.5, high: 1, shallow: 0.6, period: 3400, spread: 4800, rest: 0.92, down: 0.46, hold: 0.14, lift: 0.12, up: 0.4 },
  /** Which of a bulb's own traits a scatter is for (scatter's `n`). */
  trait: { pace: 1, depth: 2, moment: 3, swing: 4 },
  percent: 100,
} as const;

/** A fixed scatter, 0..1, for thing `i`'s `n`th trait (the same every launch): a cheap hash. */
export function scatter(i: number, n: number): number {
  const v = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * Home's deck (deck.ts) leaves `peek` under each card's words before the
 * next card (less than ref.layout.hub.modes.deck.peek, the cards a little
 * shorter, so the sill cat has room under them); where room is tight (a
 * small phone, large text) as little as `peekMin`, and `last` under the
 * front card's words: home never scrolls, the cards shrink instead.
 */
export const DECK = { peek: 24, peekMin: 6, last: 12 } as const;

/**
 * The sill cat: `width` (the deck leaves room for it), on a small phone as
 * little as `minWidth` (it is never left out); its art's height / width
 * (assets/characters/cat_sit.png); its feet `sink` below the sill's top edge;
 * at least `gap` clear of the deck; `right` from the screen's right edge.
 */
export const CAT = { width: 104, minWidth: 56, aspect: 640 / 444, sink: 6, gap: 6, right: 30 } as const;

/**
 * The mode cards' dioramas (art/ModeScene.tsx): each layer's slide in points
 * at full tilt, inside the card's frame, about the table's things (`mid`
 * barely moves): the wall behind follows the eye, the nearest thing goes the
 * other way. Within the scenes' own bleed (assets/home/cards/cards.json).
 */
export const SCENE = { depth: { back: 4, mid: 1.2, front: -4 } } as const;

/** The cat's mug stands this far (points) in from the sill's back edge, on its top (the cat's feet are CAT.sink in). */
export const MUG_REST = 4;

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
