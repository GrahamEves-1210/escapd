// The charms, drawn (docs/ART_DIRECTION.md: made by hand, spooky-cute): nine
// tiny badges, three per mode, in the cat's inky line. Each is a few filled
// shapes on a 64 box, drawn in layers so it reads as one object:
// - a gold or silver pin: an ink outline, the metal rim round its shapes, the
//   enamel colours inside, raised metal lines for its details, a glint;
// - a sticker (the plain finish): a die-cut white border, a thin ink line,
//   the same colours, flat like a sticker;
// - not earned yet: just its shape, a soft silhouette in the board's tone.
// Mystery things, not sweets: a skeleton key, a fedora, a struck matchbook; a
// magnifier, a fingerprint, an evidence tag; a sleepy moon, a planchette, a
// candle. Also here: the cat's outfits as little preview icons (the cats draw
// them on themselves; these only show the choice).
import type { ReactNode } from "react";
import Svg, { G, Path } from "react-native-svg";
import type { Accessory, AccessoryChoice, CharmKind, Finish } from "@/game/collection/charms";

type Part = { d: string; fill: string; transform?: string };
/** A raised line: in the pin's metal (`metal`), or a fixed colour; on a sticker `alt` (default the ink). */
type Line = { d: string; w?: number; color?: string; alt?: string };
interface Drawing {
  base: Part[];
  details?: Part[];
  lines?: Line[];
  /** The glint, in white. */
  shine?: string;
  tilt?: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
/** A circle as a path. */
const circ = (cx: number, cy: number, r: number) => `M${r2(cx - r)} ${cy} a${r} ${r} 0 1 0 ${r2(2 * r)} 0 a${r} ${r} 0 1 0 ${r2(-2 * r)} 0 Z`;
/** A four-point sparkle. */
const spark = (cx: number, cy: number, r: number) => {
  const w = r * 0.26;
  return `M${cx} ${r2(cy - r)} Q${r2(cx + w)} ${r2(cy - w)} ${r2(cx + r)} ${cy} Q${r2(cx + w)} ${r2(cy + w)} ${cx} ${r2(cy + r)} Q${r2(cx - w)} ${r2(cy + w)} ${r2(cx - r)} ${cy} Q${r2(cx - w)} ${r2(cy - w)} ${cx} ${r2(cy - r)} Z`;
};
const INK = "#2A1620";

export const DRAWINGS: Record<CharmKind, Drawing> = {
  // A skeleton key, its round bow cut through with a keyhole.
  key: {
    tilt: -16,
    base: [
      { d: circ(32, 17, 11), fill: "#7B4A80" },
      { d: "M29 26 H35 V53.5 Q32 57.5 29 53.5 Z", fill: "#7B4A80" },
      { d: "M34 41.5 H42.5 Q44 41.5 44 43 V46.5 Q44 48 42.5 48 H34 Z", fill: "#7B4A80" },
      { d: "M34 50 H40 Q41.5 50 41.5 51.5 V53.5 Q41.5 55 40 55 H34 Z", fill: "#7B4A80" },
    ],
    details: [
      { d: circ(32, 15.2, 3.4), fill: "#2A1620" },
      { d: "M30.3 16.5 H33.7 L34.8 22.6 H29.2 Z", fill: "#2A1620" },
    ],
    lines: [{ d: "M28.6 32.5 H35.4" }, { d: "M28.6 35.8 H35.4" }],
    shine: "M23.4 14 Q24.2 9.6 28.4 8",
  },
  // A fedora with an ink band and a press card tucked in it.
  fedora: {
    tilt: -6,
    base: [
      { d: "M18.5 37 Q17 24 21 17.5 Q24.5 12.5 29 15.5 Q32 17 35 15.5 Q39.5 12.5 43 17.5 Q47 24 45.5 37 Z", fill: "#5A3560" },
      { d: "M40.5 31.5 L44.5 19 L52.5 21.6 L48.5 34 Z", fill: "#F4E6C8" },
      { d: "M7 41 Q8.5 35.5 19 35 Q32 34 45 35 Q55.5 35.5 57 41 Q56 46.5 45 46.5 Q32 48.5 19 46.5 Q8 46.5 7 41 Z", fill: "#432748" },
    ],
    details: [{ d: "M18.2 30.5 Q32 33.5 45.8 30.5 L45.6 36.2 Q32 38.8 18.4 36.2 Z", fill: "#21121C" }],
    lines: [
      { d: "M32 17.5 Q30.8 22 32 26.5" },
      { d: "M44.6 23.4 L50.4 25.3 M43.7 26.4 L48.4 27.9", w: 1.1, color: "#5A3560", alt: "#5A3560" },
    ],
    shine: "M22 25 Q22 19.5 25 17",
  },
  // A matchbook from a hotel bar, one match struck.
  matchbook: {
    tilt: 8,
    base: [
      { d: "M15.5 12.5 H20.5 V24 H15.5 Z", fill: "#F4E6C8" },
      { d: "M22.5 12.5 H27.5 V24 H22.5 Z", fill: "#F4E6C8" },
      { d: "M29.5 12.5 H34.5 V24 H29.5 Z", fill: "#F4E6C8" },
      { d: "M39.5 31.5 L50.6 14.2 L54.4 16.6 L43.3 33.9 Z", fill: "#F4E6C8" },
      { d: "M55.5 3.5 Q61 9.5 59.5 13.5 Q58 16.8 54.6 16 Q51.2 15 51.6 11.2 Q52 7.5 55.5 3.5 Z", fill: "#FFD9A8" },
      { d: "M14 22 H44 Q47 22 47 25 V53 Q47 56 44 56 H14 Q11 56 11 53 V25 Q11 22 14 22 Z", fill: "#7A2A3C" },
    ],
    details: [
      { d: circ(18, 12.5, 3), fill: "#C83D50" },
      { d: circ(25, 12.5, 3), fill: "#C83D50" },
      { d: circ(32, 12.5, 3), fill: "#C83D50" },
      { d: circ(52.6, 15.4, 2.8), fill: "#3A2630" },
      { d: "M55.6 7.6 Q58.2 10.6 57.4 12.6 Q56.6 14.2 55 13.8 Q53.4 13.2 53.6 11.4 Q53.8 9.6 55.6 7.6 Z", fill: "#F5A25A" },
      { d: "M11 40 H47 V45 H11 Z", fill: "#F4E6C8" },
      { d: "M11 49.5 H47 V53 Q47 56 44 56 H14 Q11 56 11 53 Z", fill: "#3A2630" },
      { d: spark(29, 31.5, 5.6), fill: "#E9C97F" },
    ],
    lines: [{ d: "M11 26.5 H47", w: 1.2 }],
    shine: "M14.5 29 V37",
  },
  // A magnifier, a fingerprint's ridges caught in its lens.
  magnifier: {
    tilt: 0,
    base: [
      { d: "M38 42 L42 38 L54.5 50.5 Q57 53 55 55 Q53 57 50.5 54.5 Z", fill: "#6A3036" },
      { d: circ(27, 27, 17), fill: "#C83D50" },
    ],
    details: [{ d: circ(27, 27, 11.5), fill: "#FFF3D6" }],
    lines: [
      { d: "M44.4 47.2 L47.2 44.4" },
      { d: "M48.4 51.2 L51.2 48.4" },
      { d: "M21.5 32 Q20.6 23.5 27.6 23.2 Q33.6 23 34 29.5", w: 1.5, color: "#C83D50", alt: "#C83D50" },
      { d: "M25 33 Q24.4 27 28 27 Q30.8 27 30.8 30.4", w: 1.5, color: "#C83D50", alt: "#C83D50" },
    ],
    shine: "M19.6 24 Q20.6 19.4 25 18",
  },
  // A fingerprint, its ridges whorled.
  fingerprint: {
    tilt: -5,
    base: [{ d: "M32 8 C44.5 8 52.5 18 52.5 31 C52.5 46 43.5 56 32 56 C20.5 56 11.5 46 11.5 31 C11.5 18 19.5 8 32 8 Z", fill: "#C83D50" }],
    lines: [
      { d: "M32 29.5 Q34 29.5 34 31.5 Q34 34 31.5 36", alt: "#FBEFE8" },
      { d: "M27.5 31.5 Q27.5 25.5 32 25.5 Q38 25.5 38 31.5 Q38 37 33 41", alt: "#FBEFE8" },
      { d: "M23.5 33 Q22.5 21.5 32 21.5 Q42 21.5 42 31.5 Q42 39.5 35.5 45", alt: "#FBEFE8" },
      { d: "M18.5 30 Q19.5 17.5 32 17.5 Q45 17.5 46.5 30", alt: "#FBEFE8" },
      { d: "M27.5 44.5 Q31 40.5 30 35.5", alt: "#FBEFE8" },
      { d: "M17.5 37 Q19.5 45.5 26 50.5", alt: "#FBEFE8" },
    ],
    shine: "M16.5 22 Q17.5 15.5 22.5 12.5",
  },
  // An evidence tag on its red string, checked off.
  tag: {
    tilt: -10,
    base: [{ d: "M13 24 L23 13 H51 Q54.5 13 54.5 16.5 V45.5 Q54.5 49 51 49 H23 L13 38 Z", fill: "#F6D776" }],
    details: [
      { d: "M28 18.5 H50 V25 H28 Z", fill: "#C83D50" },
      { d: circ(20.5, 31, 3.2), fill: "#2A161B" },
      { d: circ(45, 40.5, 4.8), fill: "#C83D50" },
    ],
    lines: [
      { d: "M28 31 H48", w: 1.6, color: "#7A5A33", alt: "#7A5A33" },
      { d: "M28 36.5 H39", w: 1.6, color: "#7A5A33", alt: "#7A5A33" },
      { d: "M42.6 40.6 L44.4 42.5 L47.6 38.8", w: 1.5, color: "#FBEFE8", alt: "#FBEFE8" },
      { d: "M20.5 31 Q11 22 6.5 29 Q6 36 20.5 31", w: 2, color: "#C83D50", alt: "#C83D50" },
    ],
    shine: "M16.5 26 L21.5 20.5",
  },
  // A sleepy crescent moon and its star.
  moon: {
    tilt: -4,
    base: [
      { d: "M40 7 C25 7.5 13.5 19 14 32.5 C14.5 46 26 57 41 56 C45.5 55.7 49.5 54.2 52.5 52 C40 52.5 30.5 43.5 30 32 C29.6 21 34.5 11.5 40 7 Z", fill: "#F6E7B0" },
      { d: spark(46, 22, 8), fill: "#9FF2D8" },
    ],
    details: [{ d: circ(21.5, 39, 2.4), fill: "#C9B6F5" }],
    lines: [{ d: "M18.5 32.5 Q21.5 35.5 24.5 32.5", w: 1.8, color: "#3A2E5C", alt: "#3A2E5C" }],
    shine: "M19 21 Q21 15.5 25.5 12.5",
  },
  // A planchette, its little window and its star.
  planchette: {
    tilt: 10,
    base: [{ d: "M32 5.5 C35.5 10.5 52 21 54.2 34.5 C55.8 46 46.5 55 32 55 C17.5 55 8.2 46 9.8 34.5 C12 21 28.5 10.5 32 5.5 Z", fill: "#B8A6F7" }],
    details: [
      { d: circ(32, 29, 8.5), fill: "#F6E7B0" },
      { d: circ(32, 29, 6), fill: "#252949" },
      { d: spark(32, 29, 3.4), fill: "#9FF2D8" },
      { d: circ(20, 42, 1.8), fill: "#F6E7B0" },
      { d: circ(44, 42, 1.8), fill: "#F6E7B0" },
    ],
    lines: [{ d: "M20 48.5 Q32 52 44 48.5" }],
    shine: "M15.5 31 Q17 21.5 23 15.5",
  },
  // A candle with a spirit-mint flame and lavender drips.
  candle: {
    tilt: 0,
    base: [
      { d: "M32 5.5 Q38.5 13.5 37.5 19 Q36.5 24 32 24 Q27.5 24 26.5 19 Q25.5 13.5 32 5.5 Z", fill: "#9FF2D8" },
      { d: "M25 26 H39 V49 H25 Z", fill: "#EEF0FF" },
      { d: "M15 50.5 Q16 46.5 32 46.5 Q48 46.5 49 50.5 Q48.5 56.5 32 56.5 Q15.5 56.5 15 50.5 Z", fill: "#8F7FE0" },
    ],
    details: [
      { d: "M32 12.5 Q35 16.5 34.6 19.2 Q34 21.6 32 21.6 Q30 21.6 29.4 19.2 Q29 16.5 32 12.5 Z", fill: "#FFFBEA" },
      { d: "M25 26 H39 V31 Q37.5 34 36.5 31.5 Q35.5 36.5 33.8 31.8 Q32 29.5 30 32.5 Q28.5 37 27.5 32 Q26.5 30 25 31.5 Z", fill: "#C9B6F5" },
    ],
    lines: [{ d: "M32 23.6 V26.4", w: 1.6, color: "#252949", alt: "#252949" }, { d: "M19.5 50.6 Q32 53 44.5 50.6" }],
    shine: "M28 35 V44",
  },
};

/** Each finish's look: the outline, the rim, the raised lines, the shadow under it. */
const FINISH_LOOK: Record<Finish, { outline: string; outer: number; rim: string; rimW: number; metal: string; shadow: string }> = {
  gold: { outline: INK, outer: 7.2, rim: "#D9B26A", rimW: 4.4, metal: "#E9C97F", shadow: "rgba(20, 8, 16, 0.38)" },
  silver: { outline: INK, outer: 7.2, rim: "#C9CEDA", rimW: 4.4, metal: "#DDE1EA", shadow: "rgba(20, 8, 16, 0.38)" },
  sticker: { outline: "#FFFDF8", outer: 9, rim: "#3A2630", rimW: 2.2, metal: "#3A2630", shadow: "rgba(20, 8, 16, 0.3)" },
};

/**
 * A charm, `size` across. `silhouette`: not earned yet, its soft shape in
 * `tone`. Decorative (the caller labels it).
 */
export function Charm({ kind, finish = "gold", size, silhouette = false, tone = "#3A2C42" }: {
  kind: CharmKind;
  finish?: Finish;
  size: number;
  silhouette?: boolean;
  tone?: string;
}) {
  const art = DRAWINGS[kind];
  const look = FINISH_LOOK[finish];
  const rotate = `rotate(${art.tilt ?? 0} 32 32)`;
  if (silhouette) {
    return (
      <Svg width={size} height={size} viewBox="0 0 64 64" pointerEvents="none">
        <G transform={rotate}>
          {art.base.map((p, i) => <Path key={i} d={p.d} fill={tone} stroke={tone} strokeWidth={5} strokeLinejoin="round" />)}
        </G>
      </Svg>
    );
  }
  const sticker = finish === "sticker";
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" pointerEvents="none">
      <G transform={rotate}>
        {/* Its shadow on the board. */}
        <G transform="translate(0.9 2.2)">
          {art.base.map((p, i) => <Path key={i} d={p.d} fill={look.shadow} stroke={look.shadow} strokeWidth={look.outer} strokeLinejoin="round" />)}
        </G>
        {/* The outline (a sticker's die-cut border), then the rim, each round every shape so they read as one. */}
        {art.base.map((p, i) => <Path key={`o${i}`} d={p.d} fill={look.outline} stroke={look.outline} strokeWidth={look.outer} strokeLinejoin="round" />)}
        {art.base.map((p, i) => <Path key={`r${i}`} d={p.d} fill={look.rim} stroke={look.rim} strokeWidth={look.rimW} strokeLinejoin="round" />)}
        {/* The colours. */}
        {[...art.base, ...(art.details ?? [])].map((p, i) => <Path key={`f${i}`} d={p.d} fill={p.fill} transform={p.transform} />)}
        {/* The raised lines. */}
        {(art.lines ?? []).map((l, i) => (
          <Path key={`l${i}`} d={l.d} fill="none" stroke={sticker ? (l.alt ?? look.metal) : (l.color ?? look.metal)} strokeWidth={l.w ?? 1.8} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {art.shine ? <Path d={art.shine} fill="none" stroke="#FFFFFF" strokeOpacity={sticker ? 0.55 : 0.8} strokeWidth={2.2} strokeLinecap="round" /> : null}
      </G>
      {finish === "gold" ? <Path d={spark(54, 10, 5)} fill="#F6E3A6" /> : null}
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// The cat's outfits, as preview icons (a 40 box)
// ---------------------------------------------------------------------------

/** One of the cat's outfits (or "none": a paw), `size` across, in its own colours; `muted` when locked. */
export function AccessoryIcon({ accessory, size, muted = false, tone = "#4A3A52" }: { accessory: AccessoryChoice; size: number; muted?: boolean; tone?: string }) {
  const c = (hex: string) => (muted ? tone : hex);
  const ink = muted ? tone : INK;
  const glint = muted ? null : (d: string, o = 0.8) => <Path d={d} fill="none" stroke="#FFFFFF" strokeOpacity={o} strokeWidth={1.4} strokeLinecap="round" />;
  const body = ((): ReactNode => {
    switch (accessory) {
      case "none":
        return (
          <G fill={c("#F8EEF1")}>
            <Path d="M20 21 C25.5 21 29.5 26 29.5 29.5 C29.5 32.5 27 33.5 24.5 32.8 C22.5 32.3 21.5 31.6 20 31.6 C18.5 31.6 17.5 32.3 15.5 32.8 C13 33.5 10.5 32.5 10.5 29.5 C10.5 26 14.5 21 20 21 Z" />
            <Path d={circ(11, 17.5, 3.2)} />
            <Path d={circ(17, 12.5, 3.4)} />
            <Path d={circ(23, 12.5, 3.4)} />
            <Path d={circ(29, 17.5, 3.2)} />
          </G>
        );
      case "collar":
        return (
          <G strokeLinejoin="round">
            <Path d="M4 9 Q20 17 36 9 L35.4 14.2 Q20 22.4 4.6 14.2 Z" fill={c("#6E3B24")} stroke={ink} strokeWidth={1.4} />
            <Path d="M6.4 12.4 Q20 18.6 33.6 12.4" fill="none" stroke={c("#D9B98A")} strokeWidth={0.9} strokeDasharray="1.8 2" />
            <Path d="M8 10.4 L12.4 12.2 L11.6 17.4 L7.2 15.6 Z" fill="none" stroke={c("#E8C36F")} strokeWidth={1.4} />
            <Path d={circ(20, 20.2, 1.8)} fill="none" stroke={ink} strokeWidth={1.3} />
            <Path d={circ(20, 27, 7.4)} fill={c("#E8C36F")} stroke={ink} strokeWidth={1.6} />
            <Path d="M13.2 25.6 Q20 28.2 26.8 25.6" fill="none" stroke={c("#A97F33")} strokeWidth={1.3} />
            <Path d={circ(20, 29.6, 1.6)} fill={ink} />
            <Path d="M20 30.6 V33.6" stroke={ink} strokeWidth={1.5} strokeLinecap="round" />
            {glint?.("M15.6 24 Q16.4 21.6 18.6 21.1", 0.85)}
          </G>
        );
      case "scarf":
        return (
          <G strokeLinejoin="round">
            <Path d="M14.4 18 L10.6 33.6 L17.2 34.8 L19.4 18.6 Z" fill={c("#E8DCC3")} stroke={ink} strokeWidth={1.3} />
            <Path d="M11.6 28.4 L17.9 29.6" stroke={c("#5A2E4A")} strokeWidth={1.8} strokeLinecap="round" />
            <Path d="M19 18 L22 32.8 L28 31 L23.4 17.4 Z" fill={c("#E8DCC3")} stroke={ink} strokeWidth={1.3} />
            <Path d="M21.2 27 L26.4 25.4" stroke={c("#5A2E4A")} strokeWidth={1.8} strokeLinecap="round" />
            <Path d="M3.5 9 Q20 18 36.5 9 L35.8 15.6 Q20 25 4.2 15.6 Z" fill={c("#E8DCC3")} stroke={ink} strokeWidth={1.5} />
            <Path d="M8 13.6 L9.4 15.4 L10.8 13.6 M14 16 L15.4 17.8 L16.8 16 M23.2 16 L24.6 17.8 L26 16 M29.2 13.6 L30.6 15.4 L32 13.6" fill="none" stroke={c("#BFA983")} strokeWidth={0.9} strokeLinecap="round" />
            <Path d={circ(17.6, 18.4, 3.8)} fill={c("#E8DCC3")} stroke={ink} strokeWidth={1.3} />
          </G>
        );
      case "specs":
        return (
          <G>
            <Path d={circ(11.5, 21, 7.6)} fill={muted ? "none" : "rgba(255, 244, 226, 0.1)"} stroke={ink} strokeWidth={3.4} />
            <Path d={circ(11.5, 21, 7.6)} fill="none" stroke={c("#E8C36F")} strokeWidth={1.6} />
            <Path d={circ(28.5, 21, 7.6)} fill={muted ? "none" : "rgba(255, 244, 226, 0.1)"} stroke={ink} strokeWidth={3.4} />
            <Path d={circ(28.5, 21, 7.6)} fill="none" stroke={c("#E8C36F")} strokeWidth={1.6} />
            <Path d="M18.6 19.4 Q20 16.8 21.4 19.4" fill="none" stroke={ink} strokeWidth={3} strokeLinecap="round" />
            <Path d="M18.6 19.4 Q20 16.8 21.4 19.4" fill="none" stroke={c("#E8C36F")} strokeWidth={1.4} strokeLinecap="round" />
            {glint?.("M7.4 19.2 Q8 16.4 10.6 15.8", 0.7)}
            {glint?.("M24.4 19.2 Q25 16.4 27.6 15.8", 0.7)}
          </G>
        );
      case "deerstalker":
        return (
          <G strokeLinejoin="round">
            <Path d="M10.4 25.6 Q5.6 25.4 3 28.8 Q8.4 30.2 12.6 27.8 Z" fill={c("#6A4E31")} stroke={ink} strokeWidth={1.3} />
            <Path d="M29.6 25.6 Q34.4 25.4 37 28.8 Q31.6 30.2 27.4 27.8 Z" fill={c("#6A4E31")} stroke={ink} strokeWidth={1.3} />
            <Path d="M8 27.4 Q6.8 13.6 20 11.6 Q33.2 13.6 32 27.4 Q20 30.4 8 27.4 Z" fill={c("#9C7A52")} stroke={ink} strokeWidth={1.5} />
            <Path d="M9.2 21.6 Q20 19 30.8 21.6 M15 28.4 Q13.8 18.4 18.6 12 M25 28.4 Q26.2 18.4 21.4 12" fill="none" stroke={c("#6A4E31")} strokeWidth={0.9} strokeLinecap="round" />
            <Path d="M10.4 17.4 Q20 15 29.6 17.4" fill="none" stroke={c("#B4553F")} strokeWidth={0.7} strokeLinecap="round" />
            <Path d="M10.6 24.8 Q9.8 19.6 13.2 19.4 Q14.4 22.6 12.6 25.4 Z M29.4 24.8 Q30.2 19.6 26.8 19.4 Q25.6 22.6 27.4 25.4 Z" fill={c("#6A4E31")} stroke={ink} strokeWidth={1.1} />
            <Path d={circ(20, 11.4, 1.8)} fill={c("#6A4E31")} stroke={ink} strokeWidth={1.1} />
            {glint?.("M11.6 19.6 Q12.6 15.6 16.4 14", 0.45)}
          </G>
        );
    }
  })();
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" pointerEvents="none">
      {body}
    </Svg>
  );
}

/** A tiny padlock, drawn (a locked outfit). */
export function LockMark({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none" pointerEvents="none">
      <Path d="M5 7 V5.2 C5 3.4 6.3 2.2 8 2.2 C9.7 2.2 11 3.4 11 5.2 V7" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M3.6 7 H12.4 Q13.2 7 13.2 7.8 V13 Q13.2 13.8 12.4 13.8 H3.6 Q2.8 13.8 2.8 13 V7.8 Q2.8 7 3.6 7 Z" fill={color} />
    </Svg>
  );
}

export type { Accessory };
