import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { color, hit, radius, space } from "@/theme/tokens";
import { FocusRing, useFocusRing } from "./noir/focus";
import { SquashPressable } from "./noir/squash";
import { Text, type AppTextProps } from "./Text";

type Variant = "primary" | "secondary" | "quiet" | "destructive";

export interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  label: string;
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
  /** Override the label colour when the button sits on manila or brass. */
  labelTone?: AppTextProps["tone"];
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, variant = "primary", loading, disabled, icon, labelTone, style, ...rest }: ButtonProps) {
  const inactive = disabled || loading;
  // Keyboard, D-pad and switch focus draw the brass ring; the caller's handlers still run.
  const focus = useFocusRing({ onFocus: rest.onFocus, onBlur: rest.onBlur });
  return (
    <SquashPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      hitSlop={4}
      {...rest}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={[styles.base, style]}
    >
      {({ pressed }) => (
        <>
          {/* The fill and edge, and the label, dim when pressed or inactive; the focus ring doesn't. */}
          <View
            pointerEvents="none"
            testID="button-surface"
            style={[
              styles.surface,
              styles[variant],
              variant === "primary" && pressed && styles.primaryPressed,
              pressed && styles.pressed,
              inactive && styles.disabled,
            ]}
          />
          <View style={[styles.row, pressed && styles.pressed, inactive && styles.disabled]}>
            {loading ? (
              <ActivityIndicator color={variant === "primary" ? color.onAccent : color.text} />
            ) : (
              <>
                {icon}
                <Text
                  variant="control"
                  align="center"
                  tone={labelTone ?? (variant === "primary" ? "onAccent" : variant === "destructive" ? "error" : "primary")}
                >
                  {label}
                </Text>
              </>
            )}
          </View>
          <FocusRing visible={focus.focused} shape="control" />
        </>
      )}
    </SquashPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: hit.min,
    paddingHorizontal: space.gutter,
    paddingVertical: space.md,
    alignItems: "center",
    justifyContent: "center",
  },
  surface: { ...StyleSheet.absoluteFill, borderRadius: radius.control },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  primary: { backgroundColor: color.accent },
  primaryPressed: { backgroundColor: color.accentPressed },
  secondary: { backgroundColor: color.raised, borderWidth: 1, borderColor: color.hairline },
  quiet: { backgroundColor: "transparent" },
  destructive: { backgroundColor: color.raised, borderWidth: 1, borderColor: color.hairline },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.45 },
});
