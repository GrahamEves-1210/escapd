// What the mechanisms are made of: wood with grain, brass, felt, cloth, iron,
// enamel and the pen's line, drawn with react-native-svg in the house hand
// (docs/ART_DIRECTION.md: inky, hand-made, velvet and brass; lit from the
// upper left like the brass magnifier and flashlight). Everything here is
// static art: paths are worked out once (useMemo) from a seed, so a drawer's
// grain is the same every time and nothing is allocated while a thing moves.
// The moving is the mechanisms' own (transforms on the views these sit in).
import { memo, useId, useMemo, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, Line as SvgLine, LinearGradient, Mask, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { useModeTheme } from "@/game/mode";
import { mix } from "@/theme/payoff";

/** The pen's ink: every outline. */
export const INK = "#1E1418";
/** Brass: one heirloom brass for every mode (as the magnifier's and the flashlight's). */
export const BRASS = { deep: "#5E4116", shade: "#8A6529", mid: "#B28A45", light: "#E9CD8A", sheen: "#F7E6B8" } as const;
/** Blued steel: a clock's hands, a lock's shackle. */
export const STEEL = { deep: "#141B2A", mid: "#2F3D58", light: "#7C8FB0", sheen: "#C9D4E6" } as const;
/** Enamel and paper: a dial, a label, a page. */
export const ENAMEL = { light: "#FBF4E2", mid: "#F1E6CB", shade: "#D9C9A4", ink: "#2A1F22" } as const;

export const hidden = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" as const };

/** A small seeded generator (mulberry32): the same grain, weave and wobble every time. */
export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f1 = (n: number) => Math.round(n * 10) / 10;

/** The mode's materials: the same things in each book's own light. */
export interface Materials {
  wood: { deep: string; mid: string; light: string; sheen: string };
  /** The carcass a front sits in: the same wood, a shade down. */
  carcass: { deep: string; mid: string; light: string; sheen: string };
  /** A lining: velvet in the mode's colour. */
  felt: { deep: string; mid: string; light: string };
  /** A fabric: a rug, a cushion, a cloth. */
  cloth: { deep: string; mid: string; light: string; trim: string; under: string };
  /** The wall behind a frame, and its paper's pattern. */
  wall: { base: string; pattern: string; faded: string };
  /** The floor or tabletop under things. */
  floor: { deep: string; mid: string; light: string; sheen: string };
  /** A shadow, coloured by the ground (never black). */
  shadow: string;
  glow: string;
}

const DYES = {
  noir: { cloth: "#7A3044", felt: "#4B2440" },
  crime_scene: { cloth: "#33574A", felt: "#5A2028" },
  paranormal: { cloth: "#54478F", felt: "#233A5A" },
} as const;

export function useMaterials(): Materials {
  const theme = useModeTheme();
  return useMemo(() => {
    const tint = (c: string, t = 0.2) => mix(c, theme.raised, t);
    const wood = { deep: tint("#2B1810", 0.25), mid: tint("#6A4129"), light: tint("#96643F", 0.14), sheen: tint("#C99A68", 0.1) };
    const carcass = { deep: tint("#1D100B", 0.3), mid: tint("#43281A", 0.26), light: tint("#5E3B26", 0.22), sheen: tint("#8A5E3C", 0.2) };
    // Each book's own cloth and lining: wine and plum for noir, bottle green and oxblood for the
    // crime club, violet and deep teal by moonlight (never candy).
    const dye = DYES[theme.genre ?? "noir"];
    const velvet = mix(dye.felt, theme.ground, 0.12);
    const cloth = mix(dye.cloth, theme.ground, 0.1);
    return {
      wood, carcass,
      felt: { deep: mix(velvet, "#000000", 0.6), mid: mix(velvet, "#000000", 0.18), light: mix(velvet, theme.ink, 0.16) },
      cloth: { deep: mix(cloth, theme.ground, 0.55), mid: cloth, light: mix(cloth, theme.ink, 0.22), trim: mix(theme.foil, theme.raised, 0.25), under: mix(mix(cloth, "#B9A58A", 0.6), theme.ground, 0.25) },
      wall: { base: mix(theme.raised, theme.surface, 0.35), pattern: mix(theme.raised, theme.ink, 0.1), faded: mix(theme.raised, theme.ink, 0.05) },
      floor: { deep: tint("#150C09", 0.35), mid: tint("#33201A", 0.3), light: tint("#4A3024", 0.26), sheen: tint("#6B4A36", 0.22) },
      shadow: mix(theme.ground, "#000000", 0.55),
      glow: theme.glow,
    };
  }, [theme]);
}

/**
 * A rounded rectangle as a pen draws it: a touch off true at each corner and
 * along each side (never a ruler's edge). `j` is how far off (points).
 */
export function inkRect(x: number, y: number, w: number, h: number, r: number, seed: number, j = 0.7): string {
  const rnd = rng(seed);
  const o = () => (rnd() - 0.5) * 2 * j;
  const rr = Math.min(r, w / 2, h / 2);
  const p = (px: number, py: number) => `${f1(px + o())} ${f1(py + o())}`;
  return [
    `M${p(x + rr, y)}`,
    `Q${p(x + w / 2, y)} ${p(x + w - rr, y)}`,
    `Q${f1(x + w)} ${f1(y)} ${p(x + w, y + rr)}`,
    `Q${p(x + w, y + h / 2)} ${p(x + w, y + h - rr)}`,
    `Q${f1(x + w)} ${f1(y + h)} ${p(x + w - rr, y + h)}`,
    `Q${p(x + w / 2, y + h)} ${p(x + rr, y + h)}`,
    `Q${f1(x)} ${f1(y + h)} ${p(x, y + h - rr)}`,
    `Q${p(x, y + h / 2)} ${p(x, y + rr)}`,
    `Q${f1(x)} ${f1(y)} ${f1(x + rr)} ${f1(y)}Z`,
  ].join("");
}

/** Wood grain inside a box: long, slightly wandering lines along it, closer in places, with a knot or two. */
export function grainPath(x: number, y: number, w: number, h: number, seed: number, vertical = false): { lines: string; knots: { cx: number; cy: number; rx: number; ry: number }[] } {
  const rnd = rng(seed);
  const long = vertical ? h : w, across = vertical ? w : h;
  const knots = Array.from({ length: long > 150 && across > 40 ? 1 + Math.floor(rnd() * 2) : 0 }, () => ({
    l: long * (0.15 + rnd() * 0.7), a: across * (0.25 + rnd() * 0.5), r: 3 + rnd() * 3,
  }));
  const out: string[] = [];
  let a = 2 + rnd() * 4;
  while (a < across - 2) {
    const amp = 0.6 + rnd() * 1.4, phase = rnd() * 6, wave = 40 + rnd() * 60;
    const from = rnd() < 0.3 ? long * rnd() * 0.4 : 0, to = rnd() < 0.3 ? long * (0.6 + rnd() * 0.4) : long;
    let d = "";
    for (let l = from; l <= to; l += 10) {
      let off = Math.sin(l / wave + phase) * amp;
      // The grain runs round a knot.
      for (const k of knots) {
        const dl = l - k.l, da = a - k.a, dist = Math.hypot(dl, da * 2.2);
        if (dist < k.r * 5) off += (da >= 0 ? 1 : -1) * k.r * 1.3 * Math.exp(-(dist * dist) / (k.r * k.r * 7));
      }
      const px = vertical ? x + a + off : x + l, py = vertical ? y + l : y + a + off;
      d += `${d ? "L" : "M"}${f1(px)} ${f1(py)}`;
    }
    out.push(d);
    a += 3 + rnd() * 7;
  }
  return {
    lines: out.join(""),
    knots: knots.map((k) => (vertical ? { cx: x + k.a, cy: y + k.l, rx: k.r * 0.6, ry: k.r } : { cx: x + k.l, cy: y + k.a, rx: k.r, ry: k.r * 0.6 })),
  };
}

/** The pen's line, gone over twice (the second pass a hair off and fainter). */
export function Ink({ d, w = 1.8, color = INK, opacity = 1 }: { d: string; w?: number; color?: string; opacity?: number }) {
  return (
    <>
      <Path d={d} stroke={color} strokeOpacity={opacity} strokeWidth={w} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Path d={d} stroke={color} strokeOpacity={0.3 * opacity} strokeWidth={w * 0.7} fill="none" strokeLinejoin="round" strokeLinecap="round" transform="translate(0.7 0.5)" />
    </>
  );
}

/** Gradient ids are the document's on the web: one per drawing. */
export function useGradId(): (name: string) => { id: string; url: string } {
  const base = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (name: string) => ({ id: `m${base}${name}`, url: `url(#m${base}${name})` });
}

/** Brass across a turned part: dark edge, a band of light, dark edge (a cylinder's shading). `vertical`: the light runs across its height. */
export function BrassGradient({ id, vertical = false }: { id: string; vertical?: boolean }) {
  return (
    <LinearGradient id={id} x1="0" y1="0" x2={vertical ? "0" : "1"} y2={vertical ? "1" : "0"}>
      <Stop offset="0" stopColor={BRASS.deep} />
      <Stop offset="0.28" stopColor={BRASS.mid} />
      <Stop offset="0.45" stopColor={BRASS.light} />
      <Stop offset="0.64" stopColor={BRASS.mid} />
      <Stop offset="1" stopColor={BRASS.deep} />
    </LinearGradient>
  );
}

/**
 * A board: wood lit from the upper left, its grain, a knot, a highlight along
 * its top and left edges, a shade along its bottom and right, and the pen
 * round it. `panel` routs a moulding into its face, `inset` from the edge.
 */
export const Wood = memo(function Wood({ w, h, seed, tone, r = 5, vertical = false, panel, style, children }: {
  w: number; h: number; seed: number; tone: Materials["wood"]; r?: number; vertical?: boolean;
  panel?: number; style?: StyleProp<ViewStyle>; children?: ReactNode;
}) {
  const g = useGradId();
  const face = g("wood");
  const art = useMemo(() => {
    const grain = grainPath(2, 2, w - 4, h - 4, seed, vertical);
    return {
      grain,
      edge: inkRect(1.2, 1.2, w - 2.4, h - 2.4, r, seed + 7),
      moulding: panel ? { out: inkRect(panel, panel, w - 2 * panel, h - 2 * panel, 3, seed + 11, 0.5), inn: inkRect(panel + 5, panel + 5, w - 2 * panel - 10, h - 2 * panel - 10, 2, seed + 13, 0.5) } : null,
    };
  }, [w, h, seed, r, vertical, panel]);
  return (
    <Svg width={w} height={h} style={style}>
      <Defs>
        <LinearGradient id={face.id} x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor={tone.light} />
          <Stop offset="0.5" stopColor={tone.mid} />
          <Stop offset="1" stopColor={mix(tone.mid, tone.deep, 0.55)} />
        </LinearGradient>
      </Defs>
      <Rect x={1.2} y={1.2} width={w - 2.4} height={h - 2.4} rx={r} fill={face.url} />
      <Path d={art.grain.lines} stroke={tone.deep} strokeOpacity={0.42} strokeWidth={0.9} fill="none" strokeLinecap="round" />
      <Path d={art.grain.lines} stroke={tone.sheen} strokeOpacity={0.16} strokeWidth={0.7} fill="none" transform="translate(0 1.1)" />
      {art.grain.knots.map((k, i) => (
        <G key={i}>
          <Ellipse cx={k.cx} cy={k.cy} rx={k.rx} ry={k.ry} fill={tone.deep} fillOpacity={0.55} />
          <Ellipse cx={k.cx} cy={k.cy} rx={k.rx * 1.9} ry={k.ry * 1.9} fill="none" stroke={tone.deep} strokeOpacity={0.35} strokeWidth={0.8} />
        </G>
      ))}
      {art.moulding ? (
        <>
          {/* A routed panel: dark on the sides the light misses, a line of light on the ones it catches. */}
          <Path d={art.moulding.out} fill="none" stroke={tone.deep} strokeOpacity={0.8} strokeWidth={2.4} />
          <Path d={art.moulding.inn} fill="none" stroke={tone.sheen} strokeOpacity={0.4} strokeWidth={1.2} />
          <Path d={art.moulding.out} fill="none" stroke={INK} strokeOpacity={0.55} strokeWidth={0.9} />
        </>
      ) : null}
      {/* Light on the top and left edges, shade under the bottom and right. */}
      <Path d={`M${r + 2} 3.2H${w - r - 2}`} stroke={tone.sheen} strokeOpacity={0.6} strokeWidth={1.4} strokeLinecap="round" />
      <Path d={`M3.2 ${r + 2}V${h - r - 2}`} stroke={tone.sheen} strokeOpacity={0.3} strokeWidth={1.2} strokeLinecap="round" />
      <Path d={`M${r + 2} ${h - 3.2}H${w - r - 2}`} stroke={tone.deep} strokeOpacity={0.7} strokeWidth={1.8} strokeLinecap="round" />
      <Path d={`M${w - 3.2} ${r + 2}V${h - r - 2}`} stroke={tone.deep} strokeOpacity={0.5} strokeWidth={1.4} strokeLinecap="round" />
      <Ink d={art.edge} w={2} />
      {children}
    </Svg>
  );
});

/** A lined inside seen from above: velvet, dark toward its walls (an inner shadow all round, deepest under the near wall), a nap of fine flecks. */
export const Felt = memo(function Felt({ w, h, seed, tone, r = 4, style }: { w: number; h: number; seed: number; tone: Materials["felt"]; r?: number; style?: StyleProp<ViewStyle> }) {
  const g = useGradId();
  const [top, side, pool] = [g("ft"), g("fs"), g("fp")];
  const nap = useMemo(() => {
    const rnd = rng(seed);
    let d = "";
    for (let i = 0; i < Math.round((w * h) / 90); i++) {
      const x = 3 + rnd() * (w - 6), y = 3 + rnd() * (h - 6);
      d += `M${f1(x)} ${f1(y)}l${f1(0.8 + rnd() * 1.4)} ${f1(-0.6 - rnd())}`;
    }
    return d;
  }, [w, h, seed]);
  return (
    <Svg width={w} height={h} style={style}>
      <Defs>
        <LinearGradient id={top.id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000000" stopOpacity={0.75} />
          <Stop offset="0.3" stopColor="#000000" stopOpacity={0.12} />
          <Stop offset="0.82" stopColor="#000000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0.35} />
        </LinearGradient>
        <LinearGradient id={side.id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#000000" stopOpacity={0.6} />
          <Stop offset="0.12" stopColor="#000000" stopOpacity={0} />
          <Stop offset="0.9" stopColor="#000000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0.45} />
        </LinearGradient>
        <RadialGradient id={pool.id} cx="50%" cy="60%" rx="55%" ry="60%">
          <Stop offset="0" stopColor={tone.light} stopOpacity={0.55} />
          <Stop offset="1" stopColor={tone.light} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={w} height={h} rx={r} fill={tone.mid} />
      <Rect width={w} height={h} rx={r} fill={pool.url} />
      <Path d={nap} stroke={tone.light} strokeOpacity={0.35} strokeWidth={0.7} strokeLinecap="round" />
      <Rect width={w} height={h} rx={r} fill={top.url} />
      <Rect width={w} height={h} rx={r} fill={side.url} />
    </Svg>
  );
});

/** A soft shadow on whatever is under a thing: an ellipse fading out, in the mode's shadow. */
export const SoftShadow = memo(function SoftShadow({ w, h, color, strength = 0.7, style }: { w: number; h: number; color: string; strength?: number; style?: StyleProp<ViewStyle> }) {
  const g = useGradId()("sh");
  return (
    <Svg width={w} height={h} style={style}>
      <Defs>
        <RadialGradient id={g.id} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={color} stopOpacity={strength} />
          <Stop offset="0.6" stopColor={color} stopOpacity={strength * 0.5} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={w} height={h} fill={g.url} />
    </Svg>
  );
});

/** A shadow cast straight down from an edge: dark under it, gone a little way on. */
export const CastShadow = memo(function CastShadow({ w, h, color, strength = 0.75, style }: { w: number; h: number; color: string; strength?: number; style?: StyleProp<ViewStyle> }) {
  const g = useGradId()("cs");
  return (
    <Svg width={w} height={h} style={style}>
      <Defs>
        <LinearGradient id={g.id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={strength} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width={w} height={h} rx={6} fill={g.url} />
    </Svg>
  );
});

/**
 * Inside an Svg: what's in it fades to nothing toward the drawing's edges (a real fade, whatever is behind
 * it), so a floor or a wall is lost in the dark round it and never ends on a ruled line. `side`, `top` and
 * `bottom`: how far in each fade runs (a share of the width or height).
 */
export function Fade({ w, h, side = 0.18, top = 0.4, bottom = 0.14, children }: { w: number; h: number; side?: number; top?: number; bottom?: number; children: ReactNode }) {
  const g = useGradId();
  const [gh, gv, mh, mv] = [g("fgh"), g("fgv"), g("fmh"), g("fmv")];
  return (
    <>
      <Defs>
        <LinearGradient id={gh.id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset={side} stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset={1 - side} stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id={gv.id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset={top} stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset={1 - bottom} stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
        <Mask id={mh.id} x={0} y={0} width={w} height={h} maskUnits="userSpaceOnUse">
          <Rect width={w} height={h} fill={gh.url} />
        </Mask>
        <Mask id={mv.id} x={0} y={0} width={w} height={h} maskUnits="userSpaceOnUse">
          <Rect width={w} height={h} fill={gv.url} />
        </Mask>
      </Defs>
      <G mask={mv.url}>
        <G mask={mh.url}>{children}</G>
      </G>
    </>
  );
}

/** A brass screw head: a dome, its slot at `turn` degrees. */
export function Screw({ cx, cy, r = 3.2, turn = 30 }: { cx: number; cy: number; r?: number; turn?: number }) {
  return (
    <G>
      <Circle cx={cx} cy={cy} r={r} fill={BRASS.mid} stroke={INK} strokeWidth={1} />
      <Circle cx={cx - r * 0.25} cy={cy - r * 0.3} r={r * 0.45} fill={BRASS.sheen} fillOpacity={0.7} />
      <SvgLine x1={cx - r * 0.7} y1={cy} x2={cx + r * 0.7} y2={cy} stroke={BRASS.deep} strokeWidth={1.1} strokeLinecap="round" transform={`rotate(${turn} ${cx} ${cy})`} />
    </G>
  );
}

/** Floorboards (or a tabletop) seen from above: boards along it, their joints, a grain. */
export const Boards = memo(function Boards({ w, h, seed, tone, board = 34, r = 0, style, fade }: {
  w: number; h: number; seed: number; tone: Materials["floor"]; board?: number; r?: number; style?: StyleProp<ViewStyle>;
  /** Lost in the dark at its edges (Fade's top share). */
  fade?: number;
}) {
  const g = useGradId()("bd");
  const art = useMemo(() => {
    const rnd = rng(seed);
    let joints = "";
    let grain = "";
    const rows = Math.ceil(h / board);
    for (let i = 0; i < rows; i++) {
      const y = i * board;
      if (i > 0) joints += `M0 ${f1(y)}H${w}`;
      // Where two boards butt, staggered row to row.
      let x = rnd() * w * 0.8;
      while (x < w) {
        joints += `M${f1(x)} ${f1(y)}V${f1(Math.min(h, y + board))}`;
        x += w * (0.5 + rnd() * 0.5);
      }
      grain += grainPath(0, y + 1, w, board - 2, seed + i * 31).lines;
    }
    return { joints, grain };
  }, [w, h, seed, board]);
  const boards = (
    <>
      <Rect width={w} height={h} rx={r} fill={g.url} />
      <Path d={art.grain} stroke={tone.deep} strokeOpacity={0.4} strokeWidth={0.8} fill="none" />
      <Path d={art.joints} stroke={tone.deep} strokeOpacity={0.9} strokeWidth={1.4} fill="none" />
      <Path d={art.joints} stroke={tone.sheen} strokeOpacity={0.22} strokeWidth={0.8} fill="none" transform="translate(0 1.4)" />
    </>
  );
  return (
    <Svg width={w} height={h} style={style}>
      <Defs>
        <LinearGradient id={g.id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={tone.light} />
          <Stop offset="1" stopColor={tone.mid} />
        </LinearGradient>
      </Defs>
      {fade === undefined ? boards : <Fade w={w} h={h} top={fade}>{boards}</Fade>}
    </Svg>
  );
});
