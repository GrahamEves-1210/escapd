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

/** The payoff's faces: a book's last line, its page number, a chapter kicker, "The End", a seal's word, a library stamp, the app's name, the recap's story. */
export const PAYOFF_TYPE = {
  last: { fontFamily: font.narrativeItalic, fontSize: 17, lineHeight: 23 },
  lastLarge: { fontFamily: font.narrativeItalic, fontSize: 19, lineHeight: 27 },
  folio: { fontFamily: font.narrativeItalic, fontSize: 15, lineHeight: 20 },
  chapter: { fontFamily: ref.font.cover, fontSize: 13, lineHeight: 18, letterSpacing: 2.3, textTransform: "uppercase" },
  theEnd: { fontFamily: ref.font.coverItalic, fontSize: 30, lineHeight: 38 },
  seal: { fontFamily: ref.font.cover, textTransform: "uppercase", letterSpacing: 0.8 },
  library: { fontFamily: "CourierPrime_700Bold", fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase" },
  brand: { fontFamily: ref.font.cover, fontSize: 13, lineHeight: 18, letterSpacing: 2.4 },
  /** Case closed's recap: the solution's story in the book face, its answer called out in the bold cut. */
  story: { fontFamily: font.narrative, fontSize: 16, lineHeight: 22 },
  storyStrong: { fontFamily: font.wordmark, fontVariant: ["lining-nums"] },
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

/**
 * The letters (src/play2/letters: the brief before a case and its reply at
 * the way out, one correspondence per mode). Each mode's paper and the inks
 * on it; every ink reads at 4.5:1 or more on the paper it is written on
 * (brief-test, contrast).
 * - noir: a typed letter on thin hotel onion-skin. The typewriter's ribbon
 *   (near-black, and its red half for what's underlined), the letterhead's
 *   engraved plum, a fountain pen's ink for the handwritten line, a lipstick blot.
 * - crime scene: a case intake sheet on bond paper in a kraft evidence
 *   envelope. The form's printed oxblood, the typed report, a blue ballpoint
 *   for what's filled in by hand, the rubber stamp's red, the sticky note.
 * - paranormal: a letter on old laid paper, deckled and foxed, sealed in
 *   wax. Iron-gall ink (and the same ink faded, for the quieter lines), the
 *   wax, a pressed sprig of lavender.
 */
export const LETTER = {
  noir: {
    paper: "#F6EFE9",
    under: "#E9DCD3",
    ink: "#2A2127",
    muted: "#6A5560",
    ribbon: "#9A2B45",
    head: "#7B3557",
    pen: "#5B2A4A",
    lipstick: "#B53A5F",
    clip: "#8A8391",
    shade: "rgba(8, 2, 10, 0.55)",
  },
  crime_scene: {
    paper: "#F8F4EA",
    under: "#E8E0CF",
    ink: "#2A1C24",
    muted: "#5E4A45",
    form: "#7A2433",
    rule: "rgba(122, 36, 51, 0.35)",
    pen: "#23358C",
    stamp: "#B0263A",
    kraft: "#C29561",
    kraftDeep: "#9E7443",
    note: "#F6D776",
    noteInk: "#3A2A12",
    clip: "#8C8478",
    shade: "rgba(10, 2, 4, 0.55)",
  },
  paranormal: {
    paper: "#EEE4D0",
    under: "#DDD0B8",
    ink: "#2A2347",
    muted: "#594E78",
    faded: "#5E4F72",
    wax: "#6C3478",
    waxLight: "#A86AB3",
    waxDeep: "#43204D",
    sprig: "#7D67AE",
    stem: "#6B7550",
    fox: "#8A5A2B",
    candle: "#F4EDDC",
    shade: "rgba(4, 4, 20, 0.6)",
  },
} as const;

/** The letters' faces: a typewriter's (noir), a printed form's labels and a typed report (crime scene), an old letterpress face (paranormal). */
/**
 * A whole page of the correspondence that isn't a letter (case closed's
 * card): the paper its brief was written on (Paper.tsx's settings), and the
 * sheet under it (noir's second sheet, the crime file's kraft envelope, the
 * old letter's next leaf).
 */
export const LETTER_SHEET = {
  noir: { under: LETTER.noir.under, paper: { color: LETTER.noir.paper, grain: 0.5, age: 0.16, ageColor: "#B07A62", ring: { x: 0.9, y: 0.93, r: 0.13 } } },
  crime_scene: { under: LETTER.crime_scene.kraft, paper: { color: LETTER.crime_scene.paper, grain: 0.4, age: 0.08, ageColor: "#9A7A50" } },
  paranormal: {
    under: LETTER.paranormal.under,
    paper: { color: LETTER.paranormal.paper, edges: "deckle" as const, grain: 0.6, age: 0.5, ageColor: LETTER.paranormal.fox, foxing: 26, foxColor: LETTER.paranormal.fox, laid: true },
  },
} as const;

/** The short texts on a page of the correspondence (case closed's card): each mode's letter face, and its labels. */
export const LETTER_TEXT: Record<Genre, { body: TextStyle; label: TextStyle }> = {
  noir: {
    body: { fontFamily: "SpecialElite_400Regular", fontSize: 16, lineHeight: 23 },
    label: { fontFamily: "SpecialElite_400Regular", fontSize: 15, lineHeight: 20, textDecorationLine: "underline" },
  },
  crime_scene: {
    body: { fontFamily: "CourierPrime_400Regular", fontSize: 16, lineHeight: 22 },
    label: { fontFamily: "Archivo_700Bold", fontSize: 13, lineHeight: 17, letterSpacing: 1.1, textTransform: "uppercase" },
  },
  paranormal: {
    body: { fontFamily: "IMFellEnglish_400Regular", fontSize: 17, lineHeight: 23 },
    label: { fontFamily: "IMFellEnglish_400Regular_Italic", fontSize: 17, lineHeight: 22 },
  },
};

export const LETTER_FONT = {
  typewriter: "SpecialElite_400Regular",
  report: "CourierPrime_400Regular",
  reportBold: "CourierPrime_700Bold",
  form: "Archivo_700Bold",
  formHeavy: "Archivo_800ExtraBold",
  fell: "IMFellEnglish_400Regular",
  fellItalic: "IMFellEnglish_400Regular_Italic",
  engraved: ref.font.coverItalic,
} as const;
