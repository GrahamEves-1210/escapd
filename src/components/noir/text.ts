import { Platform, type TextStyle } from "react-native";

/**
 * Leading pad that centres tracked text in its box (the counter's +1.75, a
 * centred tag's +0.4). iOS applies letterSpacing unscaled after every glyph,
 * the last one included, so the glyphs sit half a step left of centre; this
 * pads the leading side by one step. Android splits it around each glyph, so
 * it needs nothing. Untracked text gets nothing.
 */
export function trackingPad(typeStyle: TextStyle): TextStyle | null {
  const tracking = typeStyle.letterSpacing ?? 0;
  return Platform.OS === "ios" && tracking > 0 ? { paddingLeft: tracking } : null;
}
