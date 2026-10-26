import type { ModeTheme } from "@/theme/tokens";
import { type Art, tone, wash } from "./kit";

export function drawCrimeScene(art: Art, theme: ModeTheme) {
  wash(art, { color: Float32Array.of(...tone(theme.surface), 1) });
}
