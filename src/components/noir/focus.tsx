// The Noir focus outline (DESIGN.md, Radii, borders, focus, hit targets): a
// 2 pt bright ring at a 2 pt offset that follows the control's own shape. It
// shows while the control has keyboard, D-pad or switch focus. VoiceOver and
// TalkBack draw their own cursor on top.
import { useState } from "react";
import { StyleSheet, View, type NativeSyntheticEvent, type TargetedEvent, type ViewStyle } from "react-native";
import { ref } from "@/theme/tokens";

/** "pill" for buttons, icon buttons, bare glyphs, quiet buttons and segments; "panel" for panel shapes. */
export type FocusShape = "pill" | "panel";

type FocusHandler = (e: NativeSyntheticEvent<TargetedEvent>) => void;

/** Tracks focus for a control. Spread `onFocus` / `onBlur` onto its Pressable. */
export function useFocusRing(handlers?: { onFocus?: FocusHandler | null; onBlur?: FocusHandler | null }) {
  const [focused, setFocused] = useState(false);
  const onFocus: FocusHandler = (e) => {
    setFocused(true);
    handlers?.onFocus?.(e);
  };
  const onBlur: FocusHandler = (e) => {
    setFocused(false);
    handlers?.onBlur?.(e);
  };
  return { focused, onFocus, onBlur };
}

// Inset -4: the offset plus the ring's own width.
const RING_INSET = -(ref.focus.offset + ref.focus.width);

/** Absolutely positioned ring style, for a control that draws its own outline. */
export function focusRingStyle(shape: FocusShape): ViewStyle {
  return {
    position: "absolute",
    top: RING_INSET,
    left: RING_INSET,
    right: RING_INSET,
    bottom: RING_INSET,
    borderWidth: ref.focus.width,
    borderColor: ref.focus.color,
    borderRadius: shape === "pill" ? ref.radius.pill : ref.radius.panel,
    ...ref.curve,
  };
}

const styles = StyleSheet.create({
  pill: focusRingStyle("pill"),
  panel: focusRingStyle("panel"),
});

/**
 * Draw as the last child of the focused control. Never a touch or accessibility target.
 * The control itself must have no border: Yoga places absolute children inside
 * the border, so the -4 inset would land the ring on a bordered control's edge
 * instead of 2 outside it. Draw a bordered shape as a child layer instead.
 */
export function FocusRing({ visible, shape }: { visible: boolean; shape: FocusShape }) {
  if (!visible) return null;
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={shape === "pill" ? styles.pill : styles.panel}
    />
  );
}
