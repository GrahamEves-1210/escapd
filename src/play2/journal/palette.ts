// The casebook's paper and pens, per mode (docs/ART_DIRECTION.md, "velvet &
// ink"): a warm paper page inside the mode's dark sheet. Noir writes on blush
// cream in a rose-gold pen; crime scene keeps a manila case file and a cherry
// marker; paranormal's page is lavender and moonlit, in a violet pen. Gold
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
  /** Washi tape rolls. */
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
  /** Soft light and delight (stars, hearts, the hint sticker). */
  glow: string;
  sweet: string;
  /** Soft shadow under paper, tinted by the mode's ground. */
  shadow: string;
}

/** UV findings are the same in every mode: violet ink glowing on a dark scrap. */
export const UV = { paper: "#2B1F52", ink: "#E6DAFF", glow: "#B98CFF", edge: "#3B2C6B" } as const;

const PALETTES: Record<Genre, Omit<JournalPalette, "glow" | "sweet" | "shadow" | "foil" | "foilInk">> = {
  noir: {
    paper: "#F7ECE6",
    rule: "rgba(122, 72, 112, 0.13)",
    margin: "rgba(196, 120, 120, 0.45)",
    note: "#FFF8F1",
    ink: "#2E1A30",
    inkSoft: "#644A63",
    pen: "#A04E52",
    marker: "#C9344B",
    tape: ["#F4A7C0", "#E9B8A6", "#FFD9A8"],
    polaroid: "#FDF9F5",
    photo: "#2A1E30",
    chalk: "#F3D9DE",
    ribbon: "#7E2F4F",
    series: "A Detective Noir Mystery",
  },
  crime_scene: {
    paper: "#EBDAB5",
    rule: "rgba(112, 82, 40, 0.15)",
    margin: "rgba(214, 47, 72, 0.45)",
    note: "#FBF3E2",
    ink: "#2A1712",
    inkSoft: "#5E4433",
    pen: "#B3182F",
    marker: "#D62F48",
    tape: ["#F6D776", "#E8475D", "#F4B6A6"],
    polaroid: "#FDFAF4",
    photo: "#2A161B",
    chalk: "#FBE3DA",
    ribbon: "#B3182F",
    series: "A True Crime Club Mystery",
  },
  paranormal: {
    paper: "#E9E5F8",
    rule: "rgba(90, 80, 170, 0.15)",
    margin: "rgba(150, 125, 235, 0.5)",
    note: "#F7F5FF",
    ink: "#1F1C45",
    inkSoft: "#4E4A7C",
    pen: "#5A3EC0",
    marker: "#C9344B",
    tape: ["#B8A6F7", "#9FF2D8", "#F3B6E6"],
    polaroid: "#FBFAFF",
    photo: "#191C38",
    chalk: "#DCD6FF",
    ribbon: "#4B3A9E",
    series: "A Moonlit Mystery",
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
