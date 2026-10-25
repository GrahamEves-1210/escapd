import type { Ref } from "react";
import {
  type HostInstance,
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type Insets,
  type NativeSyntheticEvent,
  type StyleProp,
  type TargetedEvent,
  type ViewStyle,
} from "react-native";
import { ref } from "@/theme/tokens";
import { FocusRing, useFocusRing } from "./focus";
import { GlyphStack, type GlyphLayerSpec } from "./Glyph";
import { usePressProgress, useStateProgress } from "./motion";
import type { NoirIcon } from "./types";

const B = ref.button.bare;

// 44 + 2 on each side = 48, ref.hit.comfortable.
const DEFAULT_SLOP = (ref.hit.comfortable - B.hit) / 2;

export interface BareIconButtonProps {
  /**
   * A Phosphor icon component from src/components/icons.ts, drawn at
   * ref.button.bare.iconSize. A toggle that swaps glyphs (flash) passes the
   * glyph for its current state.
   */
  icon: NoirIcon;
  /** Required: an icon never carries meaning alone. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress?: (e: GestureResponderEvent) => void;
  /**
   * Makes it a utility toggle: role `switch`, `accessibilityState.checked`, glyph
   * bright when on and meta when off (eased over ref.motion.control). Never
   * signal. Leave undefined for a plain bare button (bright glyph).
   */
  checked?: boolean;
  disabled?: boolean;
  /**
   * Default 2 on each side (44 to 48). Slop never reaches outside a parent's
   * bounds, on Android and on iOS (Fabric) alike, so every ancestor (including
   * an Animated.View wrapper, which never flattens) must contain the 48 box.
   */
  hitSlop?: number | Insets;
  testID?: string;
  /** Outer layout only (position, margins). */
  style?: StyleProp<ViewStyle>;
  ref?: Ref<HostInstance>;
  onFocus?: (e: NativeSyntheticEvent<TargetedEvent>) => void;
  onBlur?: (e: NativeSyntheticEvent<TargetedEvent>) => void;
}

/**
 * Bare icon button (ref.button.bare): a 24 glyph centred in a 44 box with no
 * visible shape. Pressed: glyph to read over ref.motion.control, in either
 * toggle state. Focus: a 52 circle.
 */
export function BareIconButton({
  icon,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  checked,
  disabled = false,
  hitSlop = DEFAULT_SLOP,
  testID,
  style,
  ref: pressableRef,
  onFocus,
  onBlur,
}: BareIconButtonProps) {
  const toggle = checked !== undefined;
  const press = usePressProgress();
  const on = useStateProgress(checked !== false);
  const focus = useFocusRing({ onFocus, onBlur });

  // Plain: bright, read on press. Toggle: meta when off, bright when on, read on press.
  const base = toggle ? ref.color.meta : B.glyph;
  const layers: GlyphLayerSpec[] = toggle
    ? [{ color: B.glyph, opacity: on }, { color: B.pressedGlyph, opacity: press.progress }]
    : [{ color: B.pressedGlyph, opacity: press.progress }];

  return (
    <Pressable
      ref={pressableRef}
      accessibilityRole={toggle ? "switch" : "button"}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={toggle ? { checked, disabled } : { disabled }}
      disabled={disabled}
      hitSlop={hitSlop}
      testID={testID}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={[styles.box, disabled && styles.disabled, style]}
    >
      <GlyphStack icon={icon} size={B.iconSize} base={base} layers={layers} />
      <FocusRing visible={focus.focused} shape="pill" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { width: B.hit, height: B.hit, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: ref.button.disabledOpacity },
});
