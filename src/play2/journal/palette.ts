// The casebook's paper and pens, per mode (docs/ART_DIRECTION.md, "velvet &
// ink"): a warm paper page inside the mode's dark sheet. Noir writes on warm
// cream in a wine-dark pen; crime scene keeps a manila case file and an
// oxblood marker; paranormal's page is lavender and moonlit, in a violet pen.
// Tape is kraft paper tape in every mode, pins brass, ink, green or teal:
// never a pink anywhere (the user's rule). Gold
// foil (one gold for the series) for the fleurons and chapter numbers. Every
// writing colour is 4.5:1 or more on its paper (ink and inkSoft well over 6:1).
import type { TextStyle } from "react-native";
import type { Genre } from "@/lib/puzzle-types";
import { ref, type ModeTheme } from "@/theme/tokens";

export interface JournalPalette {
  /** The page. */
  paper: string;
  /** Ruled lines on the page. */
  rule: string;
  /** The page's margin line. */
  margin: string;
  /** Notes and scraps taped onto the page (a shade lighter than it). */
  note: string;
  /** Writing: titles, notes, the objective. */
  ink: string;
  /** Quieter writing. */
  inkSoft: string;
  /** The coloured pen: hints, labels, underlines. Text-safe on paper and note. */
  pen: string;
  /** The marker that strikes an option off the evidence board. */
  marker: string;
  /** Kraft paper tape: three shades of brown paper. */
  tape: readonly [string, string, string];
  /** A polaroid's frame, and its photo's dark. */
  polaroid: string;
  photo: string;
  /** Chalky ink for doodles drawn on a polaroid's dark photo. */
  chalk: string;
  /** Gold-foil touches (fleurons, the series line, chapter numbers): text-safe on paper. */
  foilInk: string;
  /** Foil as a sheen, for decoration only: light, mid and deep stops. */
  foil: readonly [string, string, string];
  /** The bookmark ribbon. */
  ribbon: string;
  /** The book's series line ("A Moonlit Mystery"). */
  series: string;
  /** The corkboard's red string between cards that belong together. */
  string: string;
  /** Push pins, one colour per lead. */
  pins: readonly [string, string, string];
  /** A coffee (or tea) ring left on the page. */
  ring: string;
  /** Soft light and delight (stars, sparkles, the hint sticker). */
  glow: string;
  sweet: string;
  /** Soft shadow under paper, tinted by the mode's ground. */
  shadow: string;
}

/** UV findings are the same in every mode: violet ink glowing on a dark scrap. */
export const UV = { paper: "#2B1F52", ink: "#E6DAFF", glow: "#B98CFF", edge: "#3B2C6B" } as const;

const PALETTES: Record<Genre, Omit<JournalPalette, "glow" | "sweet" | "shadow" | "foil" | "foilInk">> = {
  noir: {
    paper: "#F3EADB",
    rule: "rgba(90, 64, 52, 0.13)",
    margin: "rgba(122, 46, 58, 0.4)",
    note: "#FBF6EC",
    ink: "#2E1A30",
    inkSoft: "#5E4A5A",
    pen: "#7A2E3A",
    marker: "#8E2626",
    tape: ["#C8A878", "#B8955F", "#D6BE92"],
    polaroid: "#F6F0E4",
    photo: "#2A1E30",
    chalk: "#EDE3CF",
    ribbon: "#6A2638",
    series: "A Detective Noir Mystery",
    string: "#9E2B2B",
    pins: ["#B8873A", "#5B2D4A", "#2F4F4A"],
    ring: "rgba(120, 70, 50, 0.2)",
  },
  crime_scene: {
    paper: "#EBDAB5",
    rule: "rgba(112, 82, 40, 0.15)",
    margin: "rgba(150, 40, 36, 0.45)",
    note: "#FBF3E2",
    ink: "#2A1712",
    inkSoft: "#5E4433",
    pen: "#9A1F1F",
    marker: "#A52A2A",
    tape: ["#C8A878", "#D3BC8C", "#B8955F"],
    polaroid: "#F8F2E6",
    photo: "#2A161B",
    chalk: "#F0E6D2",
    ribbon: "#7A1F1F",
    series: "A True Crime Club Mystery",
    string: "#A11F1F",
    pins: ["#A52A2A", "#C9973C", "#2F5D46"],
    ring: "rgba(100, 60, 25, 0.24)",
  },
  paranormal: {
    paper: "#E9E5F8",
    rule: "rgba(90, 80, 170, 0.15)",
    margin: "rgba(150, 125, 235, 0.5)",
    note: "#F7F5FF",
    ink: "#1F1C45",
    inkSoft: "#4E4A7C",
    pen: "#5A3EC0",
    marker: "#4B3A9E",
    tape: ["#C9B98F", "#B7A97E", "#D3C6A0"],
    polaroid: "#FBFAFF",
    photo: "#191C38",
    chalk: "#DCD6FF",
    ribbon: "#4B3A9E",
    series: "A Moonlit Mystery",
    string: "#2F7F7A",
    pins: ["#8B6FE6", "#3FB592", "#3A5BA8"],
    ring: "rgba(150, 110, 60, 0.22)",
  },
};

/** Foil as text on paper: the same gold, deepened to 4.6:1 or more on every page. */
const FOIL_INK = "#74561A";

/** The mode's journal: its paper and pens, with the theme's glow, sweet and the series' gold foil. */
export function journalPalette(theme: ModeTheme): JournalPalette {
  const genre: Genre = theme.genre ?? "noir";
  return {
    ...PALETTES[genre],
    glow: theme.glow,
    sweet: theme.sweet,
    foil: ["#F6E7C1", theme.foil, "#8C6A22"],
    foilInk: FOIL_INK,
    shadow: theme.ground,
  };
}

// ---------------------------------------------------------------------------
// Handwriting (theme.hand): anything written in the world.
// ---------------------------------------------------------------------------

export interface HandType {
  family: string;
  /** The objective, a big note. */
  lead: TextStyle;
  /** A card's title. */
  title: TextStyle;
  /** Notes, hints. */
  body: TextStyle;
  /** Captions, labels. */
  small: TextStyle;
}

/** Her hand at the journal's sizes (theme.hand's face; body at its 18/24). */
export function handType(theme: ModeTheme): HandType {
  const family = typeof theme.hand.fontFamily === "string" ? theme.hand.fontFamily : ref.font.hand;
  return {
    family,
    lead: { fontFamily: family, fontSize: 22, lineHeight: 29 },
    title: { fontFamily: family, fontSize: 20, lineHeight: 26 },
    body: { fontFamily: family, fontSize: 18, lineHeight: 24 },
    small: { fontFamily: family, fontSize: 15, lineHeight: 20 },
  };
}

/** A small, stable number from a string (rotations and offsets that don't change between renders). */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A deterministic random in [0, 1) from a seed string and a step. */
export function rand(seed: string, i: number): number {
  return (hash(`${seed}:${i}`) % 10000) / 10000;
}
