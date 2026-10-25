import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { color, hit, radius, space } from "@/theme/tokens";
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      hitSlop={4}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        variant === "primary" && pressed && styles.primaryPressed,
        pressed && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? color.onAccent : color.text} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text variant="control" tone={labelTone ?? (variant === "primary" ? "onAccent" : variant === "destructive" ? "error" : "primary")}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: hit.min,
    paddingHorizontal: space.gutter,
    paddingVertical: space.md,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  primary: { backgroundColor: color.accent },
  primaryPressed: { backgroundColor: color.accentPressed },
  secondary: { backgroundColor: color.raised, borderWidth: 1, borderColor: color.hairline },
  quiet: { backgroundColor: "transparent" },
  destructive: { backgroundColor: color.raised, borderWidth: 1, borderColor: color.hairline },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.45 },
});
