// The focus outline (DESIGN.md, Radii, borders, focus, hit targets): a 2 pt
// brass ring at a 2 pt offset that follows the control's own shape. It shows
// while the control has keyboard, D-pad or switch focus. VoiceOver and
// TalkBack draw their own cursor on top.
import { useState } from "react";
import { StyleSheet, View, type NativeSyntheticEvent, type TargetedEvent, type ViewStyle } from "react-native";
import { radius, ref } from "@/theme/tokens";

/**
 * "pill" for round controls (icon buttons, glyphs, segments); "control" for the
 * play screen's 8 pt buttons (radius.control); "panel" for 6 pt panel shapes.
 */
export type FocusShape = "pill" | "control" | "panel";

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
    // A "control" ring stays concentric with its 8 pt button: radius plus the inset.
    borderRadius: shape === "pill" ? ref.radius.pill : shape === "control" ? radius.control - RING_INSET : ref.radius.panel,
    ...ref.curve,
  };
}

const styles = StyleSheet.create({
  pill: focusRingStyle("pill"),
  control: focusRingStyle("control"),
  panel: focusRingStyle("panel"),
});

/**
 * Draw as the last child of the focused control. Never a touch or accessibility target.
 * Yoga places absolute children inside the border, so on a bordered control pass
 * its border width as `edge`: the ring then still sits 2 outside the visible edge.
 */
export function FocusRing({ visible, shape, edge = 0 }: { visible: boolean; shape: FocusShape; edge?: number }) {
  if (!visible) return null;
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles[shape],
        edge ? { top: RING_INSET - edge, left: RING_INSET - edge, right: RING_INSET - edge, bottom: RING_INSET - edge } : null,
        edge && shape === "control" ? { borderRadius: radius.control - RING_INSET + edge } : null,
      ]}
    />
  );
}
