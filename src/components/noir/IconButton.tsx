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
import Animated, { interpolateColor, useAnimatedStyle } from "react-native-reanimated";
import { ref } from "@/theme/tokens";
import { FocusRing, useFocusRing } from "./focus";
import { usePressProgress } from "./motion";
import type { NoirIcon } from "./types";

const B = ref.button.icon;

// 44 + 2 on each side = 48, ref.hit.comfortable, as every Noir header button is specced.
const DEFAULT_SLOP = (ref.hit.comfortable - B.size) / 2;

export interface IconButtonProps {
  /** A Phosphor icon component from src/components/icons.ts, drawn at ref.button.icon.iconSize in ref.button.icon.glyph. */
  icon: NoirIcon;
  /** Required: an icon never carries meaning alone. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress?: (e: GestureResponderEvent) => void;
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
 * Round icon button (ref.button.icon): a 44 circle in panel with a 1 pt
 * hairline edge and a bright 20 glyph. Pressed: fill to panelPressed over
 * ref.motion.control. Focus: a 52 circle.
 */
export function IconButton({
  icon: Icon,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  disabled = false,
  hitSlop = DEFAULT_SLOP,
  testID,
  style,
  ref: pressableRef,
  onFocus,
  onBlur,
}: IconButtonProps) {
  const press = usePressProgress();
  const focus = useFocusRing({ onFocus, onBlur });
  const fillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(press.progress.get(), [0, 1], [B.fill, B.pressedFill]),
  }));
  return (
    <Pressable
      ref={pressableRef}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
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
      <Animated.View pointerEvents="none" style={[styles.surface, fillStyle]} />
      <Icon size={B.iconSize} color={B.glyph} weight="regular" />
      <FocusRing visible={focus.focused} shape="pill" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { width: B.size, height: B.size, alignItems: "center", justifyContent: "center" },
  surface: {
    ...StyleSheet.absoluteFill,
    borderRadius: B.radius,
    borderWidth: B.borderWidth,
    borderColor: B.border,
    ...ref.curve,
  },
  disabled: { opacity: ref.button.disabledOpacity },
});
