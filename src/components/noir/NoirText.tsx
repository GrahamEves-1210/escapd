import type { ComponentRef, Ref } from "react";
import { Platform, Text, type TextProps, type TextStyle } from "react-native";
import { ref } from "@/theme/tokens";

export type NoirTextVariant = keyof typeof ref.type;

/**
 * The colour roles Noir allows for text (DESIGN.md, Colours). `signal` and
 * `error` are fills and marks only and are deliberately missing.
 */
export type NoirTextTone = "bright" | "read" | "meta" | "signalText" | "inverseInk" | "warning";

/** Each style's own colour from the Typography table. */
const DEFAULT_TONE: Record<NoirTextVariant, NoirTextTone> = {
  escape: "bright",
  caseTitle: "bright",
  statement: "bright",
  title: "bright",
  headline: "bright",
  button: "bright",
  body: "read",
  meta: "meta",
  label: "meta",
  note: "meta",
  code: "bright",
};

export type NoirTextRef = ComponentRef<typeof Text>;

export interface NoirTextProps extends Omit<TextProps, "adjustsFontSizeToFit" | "minimumFontScale" | "allowFontScaling"> {
  ref?: Ref<NoirTextRef>;
  /** A `ref.type` style. Default "body". */
  variant?: NoirTextVariant;
  /** Defaults to the style's own colour (bright for titles, read for body, meta for meta/label/note). */
  tone?: NoirTextTone;
  align?: "left" | "center" | "right";
  /**
   * For tracked mono text centred in its box (a centred note or label): iOS
   * adds tracking after the last glyph, so this pads the leading side by one
   * tracking step to centre the glyphs. No effect on Android or untracked text.
   */
  centerTracking?: boolean;
}

/**
 * Text in a Noir style. It always follows the system text size and never
 * shrinks to fit: `adjustsFontSizeToFit`, `minimumFontScale` and
 * `allowFontScaling` are not accepted. `maxFontSizeMultiplier` is, for the
 * places the spec caps it.
 */
export function NoirText({ ref: textRef, variant = "body", tone, align, centerTracking, style, ...rest }: NoirTextProps) {
  const typeStyle: TextStyle = ref.type[variant];
  const trackingFix = centerTracking ? trackingPad(typeStyle) : null;
  return (
    <Text
      ref={textRef}
      {...rest}
      style={[typeStyle, { color: ref.color[tone ?? DEFAULT_TONE[variant]] }, align && { textAlign: align }, trackingFix, style]}
    />
  );
}

/**
 * Leading pad that centres iOS-tracked text in its box (see `centerTracking`).
 * iOS applies letterSpacing unscaled after every glyph, the last one included;
 * Android splits it around each glyph, so it needs nothing.
 */
export function trackingPad(typeStyle: TextStyle): TextStyle | null {
  const tracking = typeStyle.letterSpacing ?? 0;
  return Platform.OS === "ios" && tracking > 0 ? { paddingLeft: tracking } : null;
}
