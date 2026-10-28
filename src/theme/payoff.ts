// The payoff's own palette and type (docs/ART_DIRECTION.md, the mystery-book
// core): case closed's last page, the way out's page of light and the build
// wait's polaroids. The modes' colours are theirs (modeThemes: glow, sweet,
// foil, the hand face); these are the paper things laid on them: warm cream
// book paper and its inks, each mode's stamp ink deepened to read on that
// paper, the gold-foil seal, the polaroid's print paper, and the faces of a
// book's last page. Screen code reads them from here and writes none of its own.
// (A candidate for tokens.ts's ref.layout.play.complete when the palette
// settles.)
import type { TextStyle } from "react-native";
import type { Genre } from "@/lib/puzzle-types";
import { font, ref } from "./tokens";

/**
 * The page: warm cream book paper (the last page, a library card), its ink,
 * its quieter ink and its ruling. Both inks read at 4.5:1 or more on it
 * (complete-test, contrast).
 */
export const PAGE = {
  paper: "#F7EFE4",
  /** The paper a shade deeper: the book's next leaf under the page. */
  deep: "#E6D9C6",
  ink: "#2A1C24",
  muted: "#6E5B63",
  rule: "rgba(42, 28, 36, 0.16)",
  /** Antique brass for the magnifiers on paper (the theme's brass is too pale on cream). */
  brass: "#93692A",
  /** Gold foil on paper: rules and fleurons. */
  foilOnPaper: "#B08A3E",
  /** A polaroid's print paper: whiter than the page, so it reads as a print tucked in. */
  print: "#FFFCF6",
  /** Behind a print's photo while it loads. */
  photoBack: "#1A1418",
  /** A print's soft shadow on the page. */
  printShade: "rgba(42, 28, 36, 0.28)",
} as const;

/** Each mode's stamp ink on the page (a library stamp, the series line, the moons): its accent, deepened to read on cream (4.5:1 or more). */
export const PAGE_INK: Record<Genre, string> = {
  noir: "#7B3557",
  crime_scene: "#A82638",
  paranormal: "#4A3F9E",
};

/** The seal's gold: a foil's light and shade round the theme's foil, the dark ink pressed into it (4.5:1 or more on its light and the foil), its shadow. */
export const SEAL = { light: "#F6E3A6", shade: "#A97F33", ink: "#3A270B", shadow: "0px 5px 10px rgba(20, 8, 16, 0.4)" } as const;

/** Light things: a highlight's white (tape's sheen, a ribbon's fold, the light's hot core), a print's sheen, a hanging print's shadow. */
export const LIGHT = {
  white: "#FFFFFF",
  sheen: "rgba(255, 255, 255, 0.04)",
  hangShade: "0px 6px 14px rgba(0, 0, 0, 0.45)",
} as const;

/** The build wait's prints: their paper and the milky blank they develop from. */
export const DEVELOPING = { paper: "#FBF6EE", blank: "#E9E0D3" } as const;

/** The payoff's faces: a book's last line, its page number, a chapter kicker, "The End", a seal's word, a library stamp, the app's name. */
export const PAYOFF_TYPE = {
  last: { fontFamily: font.narrativeItalic, fontSize: 17, lineHeight: 23 },
  lastLarge: { fontFamily: font.narrativeItalic, fontSize: 19, lineHeight: 27 },
  folio: { fontFamily: font.narrativeItalic, fontSize: 15, lineHeight: 20 },
  chapter: { fontFamily: ref.font.cover, fontSize: 13, lineHeight: 18, letterSpacing: 2.3, textTransform: "uppercase" },
  theEnd: { fontFamily: ref.font.coverItalic, fontSize: 30, lineHeight: 38 },
  seal: { fontFamily: ref.font.cover, textTransform: "uppercase", letterSpacing: 0.8 },
  library: { fontFamily: "CourierPrime_700Bold", fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase" },
  brand: { fontFamily: ref.font.cover, fontSize: 13, lineHeight: 18, letterSpacing: 2.4 },
} as const satisfies Record<string, TextStyle>;

/** Handwriting at `size` (never below ref.type.handSmall), in the hand face. */
export function handType(size: number, lineHeight = Math.round(size * 1.3)): TextStyle {
  const s = Math.max(size, ref.type.handSmall.fontSize);
  return { ...ref.type.hand, fontSize: s, lineHeight: Math.max(lineHeight, Math.round(s * 1.05)) };
}

/** `a` mixed toward `b` by `t` (0 to 1), as a hex colour. */
export function mix(a: string, b: string, t: number): string {
  const parse = (h: string) => {
    const n = parseInt(h.replace("#", "").slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [x, y] = [parse(a), parse(b)];
  return `#${x.map((c, i) => Math.round(c + (y[i] - c) * t).toString(16).padStart(2, "0")).join("")}`;
}

/** A hex colour at `alpha`, as rgba(). */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
