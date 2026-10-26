// The focus outline: a 2 pt brass ring (ref.focus) at a 2 pt offset that
// follows the control's own shape. It shows while the control has keyboard,
// D-pad or switch focus. VoiceOver and TalkBack draw their own cursor on top.
import { useState } from "react";
import { Platform, StyleSheet, View, type NativeSyntheticEvent, type TargetedEvent, type ViewStyle } from "react-native";
import { radius, ref } from "@/theme/tokens";

/**
 * "pill" for round controls (pills, chips, discs, the shutter); "control" for
 * the play screen's 8 pt buttons (radius.control); "panel" for a rounded
 * rectangle: ref.radius.sheet unless the control passes its own radius
 * (ref.radius.square, ref.radius.frame, a game card's ...).
 */
export type FocusShape = "pill" | "control" | "panel";

type FocusHandler = (e: NativeSyntheticEvent<TargetedEvent>) => void;

// On the web a click also focuses the element; only keyboard focus (the
// browser's :focus-visible) should draw the ring. Native touches never focus.
function isKeyboardFocus(e: NativeSyntheticEvent<TargetedEvent>): boolean {
  if (Platform.OS !== "web") return true;
  const target = (e as unknown as { target?: { matches?: (selector: string) => boolean } }).target;
  return target?.matches ? target.matches(":focus-visible") : true;
}

/** Tracks focus for a control. Spread `onFocus` / `onBlur` onto its Pressable. */
export function useFocusRing(handlers?: { onFocus?: FocusHandler | null; onBlur?: FocusHandler | null }) {
  const [focused, setFocused] = useState(false);
  const onFocus: FocusHandler = (e) => {
    setFocused(isKeyboardFocus(e));
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

function ringRadius(shape: FocusShape, controlRadius?: number): number {
  if (shape === "pill") return ref.radius.round;
  // Concentric with the control: its radius plus the ring's distance out.
  return (controlRadius ?? (shape === "control" ? radius.control : ref.radius.sheet)) - RING_INSET;
}

/**
 * Absolutely positioned ring style, for a control that draws its own outline.
 * `controlRadius` is the control's own corner radius ("control" and "panel").
 */
export function focusRingStyle(shape: FocusShape, controlRadius?: number): ViewStyle {
  return {
    position: "absolute",
    top: RING_INSET,
    left: RING_INSET,
    right: RING_INSET,
    bottom: RING_INSET,
    borderWidth: ref.focus.width,
    borderColor: ref.focus.color,
    borderRadius: ringRadius(shape, controlRadius),
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
 * `radius` is the control's own corner radius for "control" and "panel" shapes.
 */
export function FocusRing({ visible, shape, edge = 0, radius: controlRadius }: { visible: boolean; shape: FocusShape; edge?: number; radius?: number }) {
  if (!visible) return null;
  const rounded = shape !== "pill" && (edge || controlRadius !== undefined);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles[shape],
        edge ? { top: RING_INSET - edge, left: RING_INSET - edge, right: RING_INSET - edge, bottom: RING_INSET - edge } : null,
        rounded ? { borderRadius: ringRadius(shape, controlRadius) + edge } : null,
      ]}
    />
  );
}
