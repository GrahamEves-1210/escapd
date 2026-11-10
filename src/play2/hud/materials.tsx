// What the game's frame is made of (docs/ART_DIRECTION.md: velvet and brass,
// made by hand): the wood of the rail over the room and the shelf under it,
// the felt its slots are lined with, the one heirloom brass of the magnifier
// and the flashlight, and the papers the case is written on. The same things
// in each book's own light: walnut and plum velvet (noir), mahogany and
// oxblood baize (crime scene), ebony and indigo velvet (paranormal). The
// colours follow the mechanisms' (mechanisms/materials.tsx), so a close-up's
// table and what lies on it are one desk.
//
// Everything drawn here is static: a strip's grain is worked out once from a
// seed (useMemo) and the SVG never redraws while anything moves.
import { memo, useId, useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import type { Genre } from "@/lib/puzzle-types";
import { useModeTheme } from "@/game/mode";
import { LETTER, mix } from "@/theme/payoff";

/** The pen's ink: every outline. */
export const INK = "#1E1418";
/** Brass: one heirloom brass for every mode (as the magnifier's and the flashlight's). */
export const BRASS = { deep: "#5E4116", shade: "#8A6529", mid: "#B28A45", light: "#E9CD8A", sheen: "#F7E6B8" } as const;

export const hidden = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" as const, pointerEvents: "none" as const };

export interface HudMaterials {
  genre: Genre;
  wood: { deep: string; mid: string; light: string; sheen: string };
  felt: { deep: string; mid: string; light: string };
  /** A shadow coloured by the ground (never black). */
  shadow: string;
  /** The slip the case is written on, its ink, its quieter ink and its coloured pen. */
  paper: { fill: string; shade: string; ink: string; muted: string; pen: string };
  /** The casebook's cover, its spine and its ribbon. */
  book: { cover: string; spine: string; ribbon: string; tab: string; tabInk: string };
  glow: string;
  foil: string;
}

const PAPER: Record<Genre, HudMaterials["paper"]> = {
  noir: { fill: "#EADFD3", shade: "#CDBBAA", ink: LETTER.noir.ink, muted: LETTER.noir.muted, pen: LETTER.noir.ribbon },
  crime_scene: { fill: "#E6C892", shade: LETTER.crime_scene.kraft, ink: LETTER.crime_scene.ink, muted: LETTER.crime_scene.muted, pen: LETTER.crime_scene.form },
  paranormal: { fill: "#E2D6BF", shade: "#C6B595", ink: LETTER.paranormal.ink, muted: LETTER.paranormal.muted, pen: LETTER.paranormal.wax },
};

/** The table's cloth and the tray's lining: plum velvet, oxblood baize, indigo velvet (deep jewel tones, never a grey). */
const FELT: Record<Genre, HudMaterials["felt"]> = {
  noir: { deep: "#170D1B", mid: "#2C1A32", light: "#44294C" },
  crime_scene: { deep: "#1D090D", mid: "#381219", light: "#531B26" },
  paranormal: { deep: "#0D0F26", mid: "#1C1F45", light: "#2E3268" },
};

const BOOK: Record<Genre, HudMaterials["book"]> = {
  noir: { cover: "#7E2F4F", spine: "#571D36", ribbon: "#E9B8A6", tab: "#FFF1DC", tabInk: "#2E1A30" },
  crime_scene: { cover: "#A12D3F", spine: "#6E1B29", ribbon: "#F6D776", tab: "#F6D776", tabInk: "#3A2A12" },
  paranormal: { cover: "#4B3A9E", spine: "#30246E", ribbon: "#9FF2D8", tab: "#EDE8FF", tabInk: "#1F1C45" },
};

export function useHudMaterials(): HudMaterials {
  const theme = useModeTheme();
  return useMemo(() => {
    const genre: Genre = theme.genre ?? "noir";
    const tint = (c: string, t = 0.2) => mix(c, theme.raised, t);
    return {
      genre,
      wood: { deep: tint("#1D100B", 0.3), mid: tint("#43281A", 0.26), light: tint("#6A4129", 0.2), sheen: tint("#96643F", 0.14) },
      felt: FELT[genre],
      shadow: mix(theme.ground, "#000000", 0.55),
      paper: PAPER[genre],
      book: BOOK[genre],
      glow: theme.glow,
      foil: theme.foil,
    };
  }, [theme]);
}

/** A small seeded generator (mulberry32): the same grain every time. */
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

/** Long, slightly wandering grain lines along a `w` x `h` plank. */
export function grain(w: number, h: number, seed: number): string {
  const rnd = rng(seed);
  const out: string[] = [];
  let y = 1.5 + rnd() * 3;
  while (y < h - 1) {
    const amp = 0.4 + rnd() * 1.1, phase = rnd() * 6, wave = 50 + rnd() * 70;
    const from = rnd() < 0.35 ? w * rnd() * 0.5 : 0, to = rnd() < 0.35 ? w * (0.5 + rnd() * 0.5) : w;
    let d = "";
    for (let x = from; x <= to; x += 14) d += `${d ? "L" : "M"}${f1(x)} ${f1(y + Math.sin(x / wave + phase) * amp)}`;
    out.push(d);
    y += 2.5 + rnd() * 5.5;
  }
  return out.join("");
}

/**
 * A plank of the mode's wood, stretched to whatever it backs: lit along one
 * edge (`lit`: its top or its bottom), grained, with a brass strip let into
 * that edge (`brass` points thick; 0 for none).
 */
export const Plank = memo(function Plank({ height, lit = "top", brass = 3, seed = 7, style }: {
  height: number; lit?: "top" | "bottom"; brass?: number; seed?: number; style?: StyleProp<ViewStyle>;
}) {
  const m = useHudMaterials();
  const id = `pl${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const W = 400;
  const lines = useMemo(() => grain(W, height, seed), [height, seed]);
  const top = lit === "top";
  const by = top ? 0 : height - brass;
  return (
    <View style={[StyleSheet.absoluteFill, style]} {...hidden}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor={top ? m.wood.light : m.wood.deep} />
            <Stop offset={top ? 0.35 : 0.55} stopColor={m.wood.mid} />
            <Stop offset={1} stopColor={top ? m.wood.deep : m.wood.light} />
          </LinearGradient>
          <LinearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset={0} stopColor={BRASS.shade} />
            <Stop offset={0.22} stopColor={BRASS.light} />
            <Stop offset={0.5} stopColor={BRASS.mid} />
            <Stop offset={0.78} stopColor={BRASS.sheen} />
            <Stop offset={1} stopColor={BRASS.shade} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={height} fill={`url(#${id}w)`} />
        <Path d={lines} stroke={m.wood.deep} strokeWidth={1} opacity={0.5} fill="none" />
        <Path d={lines} stroke={m.wood.sheen} strokeWidth={0.5} opacity={0.22} fill="none" transform="translate(0 0.8)" />
        {brass > 0 ? (
          <>
            <Rect x={0} y={by} width={W} height={brass} fill={`url(#${id}b)`} />
            <Rect x={0} y={top ? brass : by - 1.2} width={W} height={1.2} fill={INK} opacity={0.55} />
            <Rect x={0} y={top ? 0 : by} width={W} height={0.8} fill={BRASS.sheen} opacity={0.7} />
          </>
        ) : null}
      </Svg>
    </View>
  );
});

/** A soft shadow cast along an edge (`from` the edge it falls from), `height` deep: the rail's on the room, the table's on it. */
export const EdgeShadow = memo(function EdgeShadow({ height, from, color, opacity = 0.6, style }: {
  height: number; from: "top" | "bottom"; color: string; opacity?: number; style?: StyleProp<ViewStyle>;
}) {
  const id = `es${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  return (
    <View style={[{ height }, style]} {...hidden}>
      <Svg width="100%" height={height} viewBox={`0 0 10 ${height}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1={from === "top" ? "0" : "1"} x2="0" y2={from === "top" ? "1" : "0"}>
            <Stop offset={0} stopColor={color} stopOpacity={opacity} />
            <Stop offset={0.45} stopColor={color} stopOpacity={opacity * 0.35} />
            <Stop offset={1} stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={10} height={height} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
});

/** A brass face stretched to its box (a plate, a stud): lit from the upper left, a bright bevel, an inked edge. Round with `radius`. */
export const Brass = memo(function Brass({ radius = 6, style }: { radius?: number; style?: StyleProp<ViewStyle> }) {
  const id = `br${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden", borderWidth: 1.2, borderColor: INK }, style]} {...hidden}>
      <Svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset={0} stopColor={BRASS.sheen} />
            <Stop offset={0.3} stopColor={BRASS.light} />
            <Stop offset={0.62} stopColor={BRASS.mid} />
            <Stop offset={1} stopColor={BRASS.shade} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={100} height={40} fill={`url(#${id})`} />
        <Rect x={0} y={0} width={100} height={2.2} fill={BRASS.sheen} opacity={0.75} />
        <Rect x={0} y={37} width={100} height={3} fill={BRASS.deep} opacity={0.45} />
      </Svg>
    </View>
  );
});

/** The soft shadow under a thing lying on felt or paper: an ellipse that fades out (never a hard-edged bar). */
export const GroundShadow = memo(function GroundShadow({ width, height, color = "#000000", opacity = 0.55, style }: {
  width: number; height: number; color?: string; opacity?: number; style?: StyleProp<ViewStyle>;
}) {
  const id = `gs${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  return (
    <View style={[{ position: "absolute", width, height }, style]} {...hidden}>
      <Svg width={width} height={height} viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
            <Stop offset={0} stopColor={color} stopOpacity={opacity} />
            <Stop offset={0.55} stopColor={color} stopOpacity={opacity * 0.6} />
            <Stop offset={1} stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={100} height={100} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
});

/**
 * Felt (or velvet) stretched to its box, as a table lies under a lamp: the
 * mode's light pooled a little above its middle, the corners falling away.
 */
export const Felt = memo(function Felt({ style }: { style?: StyleProp<ViewStyle> }) {
  const m = useHudMaterials();
  const id = `fe${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: m.felt.mid }, style]} {...hidden}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={`${id}l`} cx="50%" cy="42%" rx="62%" ry="52%" fx="50%" fy="42%">
            <Stop offset={0} stopColor={m.glow} stopOpacity={0.1} />
            <Stop offset={0.55} stopColor={m.felt.light} stopOpacity={0.22} />
            <Stop offset={1} stopColor={m.felt.light} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${id}v`} cx="50%" cy="45%" rx="78%" ry="70%" fx="50%" fy="45%">
            <Stop offset={0.5} stopColor={m.felt.deep} stopOpacity={0} />
            <Stop offset={1} stopColor={m.shadow} stopOpacity={0.9} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={100} height={100} fill={`url(#${id}l)`} />
        <Rect x={0} y={0} width={100} height={100} fill={`url(#${id}v)`} />
      </Svg>
    </View>
  );
});
