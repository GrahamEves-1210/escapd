// Noir kit: shared pieces for the screens in docs/DESIGN.md. Every value comes
// from `ref` in src/theme/tokens.ts. Import from "@/components/noir".
export { BackgroundStill } from "./BackgroundStill";
export { BareIconButton, type BareIconButtonProps } from "./BareIconButton";
export { Dither, type DitherProps } from "./Dither";
export { FocusRing, focusRingStyle, useFocusRing, type FocusShape } from "./focus";
export { GlyphStack, type GlyphLayerSpec } from "./Glyph";
export { IconButton, type IconButtonProps } from "./IconButton";
export { LightPool, LightPools, type LightPoolProps, type LightPoolSpec, type LightPoolsProps } from "./LightPool";
export {
  controlTiming,
  paletteColor,
  timingFor,
  toEasing,
  usePaletteTransition,
  usePressProgress,
  useStateProgress,
  type EasingToken,
  type PaletteTransition,
} from "./motion";
export { NoirText, trackingPad, type NoirTextProps, type NoirTextRef, type NoirTextTone, type NoirTextVariant } from "./NoirText";
export { NoticeLine, type NoticeLineProps } from "./NoticeLine";
export { Panel, Rule, type PanelProps, type RuleProps } from "./Panel";
export { PillButton, type PillButtonProps, type PillScheme, type PillVariant } from "./PillButton";
export { Segment, type SegmentOption, type SegmentProps } from "./Segment";
export { Stamp, type StampProps } from "./Stamp";
export { ThinkingStates, type ThinkingStatesProps, type ThinkingTone, type ThinkingVariant } from "./ThinkingStates";
export type { NoirIcon } from "./types";
export { useShowAfter } from "./useShowAfter";
