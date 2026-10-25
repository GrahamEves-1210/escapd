import type { ReactNode } from "react";
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { color, hit, radius } from "@/theme/tokens";
import { FocusRing, useFocusRing } from "./noir/focus";

export interface IconButtonProps extends Omit<PressableProps, "children" | "style"> {
  /** Required: icons never stand alone for assistive technology. */
  accessibilityLabel: string;
  icon: ReactNode;
  /** "photo" sits on a solid scrim so it stays legible over any room photo. */
  surface?: "photo" | "plain" | "raised";
  style?: StyleProp<ViewStyle>;
}

export function IconButton({ icon, surface = "plain", style, ...rest }: IconButtonProps) {
  // Keyboard, D-pad and switch focus draw the brass ring; the caller's handlers still run.
  const focus = useFocusRing({ onFocus: rest.onFocus, onBlur: rest.onBlur });
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={4}
      {...rest}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={({ pressed }) => [styles.base, styles[surface], pressed && styles.pressed, rest.disabled && styles.disabled, style]}
    >
      {icon}
      <FocusRing visible={focus.focused} shape="pill" edge={surface === "raised" ? styles.raised.borderWidth : 0} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: hit.min,
    height: hit.min,
    borderRadius: radius.round,
    alignItems: "center",
    justifyContent: "center",
  },
  photo: { backgroundColor: color.photoScrim },
  plain: { backgroundColor: "transparent" },
  raised: { backgroundColor: color.raised, borderWidth: 1, borderColor: color.hairline },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
});
