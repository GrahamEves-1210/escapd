// The reference-look kit: shared pieces for the hub, camera, permission, photo
// guide and Pro screens, and the mode photo treatment (TreatedImage). Every
// value comes from `ref` and `modeThemes` in src/theme/tokens.ts.
// Import from "@/components/noir".
export { DarkSheet, useSheetClose, type DarkSheetProps } from "./DarkSheet";
export { FocusRing, focusRingStyle, useFocusRing, type FocusShape } from "./focus";
export { GlyphStack, type GlyphLayerSpec } from "./Glyph";
export { gradientLine, gradientStops } from "./gradient";
export {
  FloorGlow,
  LightPool,
  LightPools,
  type FloorGlowProps,
  type FloorGlowToken,
  type LightPoolProps,
  type LightPoolSpec,
  type LightPoolsProps,
  type RadialGlow,
} from "./LightPool";
export { PaperHaze } from "./PaperHaze";
export {
  controlTiming,
  paletteColor,
  sheetEntering,
  sheetExiting,
  sheetRiseTiming,
  timingFor,
  toEasing,
  useFadeIn,
  usePaletteTransition,
  usePressProgress,
  useStateProgress,
  type EasingToken,
  type PaletteTransition,
} from "./motion";
export { PillButton, type PillButtonProps, type PillGround, type PillVariant } from "./PillButton";
export { SquashPressable, usePressSquash, type SquashPressableProps } from "./squash";
export { trackingPad } from "./text";
export { ThinkingStates, type ThinkingGround, type ThinkingStatesProps, type ThinkingVariant } from "./ThinkingStates";
export { TreatedImage, type TreatedImageProps } from "./TreatedImage";
export {
  clearTreatedPhotos,
  peekTreatedPhoto,
  treatPhoto,
  useTreatedPhoto,
  type TreatOptions,
  type TreatSource,
} from "./treatPhoto";
export type { NoirIcon } from "./types";
export { useShowAfter } from "./useShowAfter";
