// Home's mode covers (docs/DESIGN.md, Modes › Mode art): one illustrated cover
// per mode, composed procedurally in Skia from the mode's palette. No
// photographs. Each is drawn once into a picture the size of its card (bake.ts)
// and never again: there is no animation in them.
import type { SkCanvas } from "@shopify/react-native-skia";
import type { Genre } from "@/lib/puzzle-types";
import type { ModeTheme } from "@/theme/tokens";
import { drawCrimeScene } from "./crimeScene";
import { type ArtFonts, type SkiaLib, seeded } from "./kit";
import { drawNoir } from "./noir";
import { drawParanormal } from "./paranormal";

const DRAW: Record<Genre, (art: Parameters<typeof drawNoir>[0], theme: ModeTheme) => void> = {
  noir: drawNoir,
  crime_scene: drawCrimeScene,
  paranormal: drawParanormal,
};

/** Each cover's own seed: its rain, motes and specks fall the same way every time. */
const SEEDS: Record<Genre, number> = { noir: 1947, crime_scene: 1991, paranormal: 1888 };

export interface CoverSize {
  /** In points. */
  w: number;
  h: number;
  /** Device pixels per point. */
  scale: number;
}

/** Draws a mode's cover on a canvas already scaled to points. */
export function drawCover(lib: SkiaLib, canvas: SkCanvas, genre: Genre, theme: ModeTheme, size: CoverSize, fonts: ArtFonts) {
  DRAW[genre]({ lib, canvas, w: size.w, h: size.h, scale: size.scale, rand: seeded(SEEDS[genre]), fonts }, theme);
}
