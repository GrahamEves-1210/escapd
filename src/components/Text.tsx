import type { ComponentRef, Ref } from "react";
import { Text as RNText, type TextProps } from "react-native";
import { color as palette, type as typeScale, type TypeVariant } from "@/theme/tokens";

type Tone = "primary" | "secondary" | "accent" | "error" | "warning" | "onAccent" | "ink" | "verdigris";

const TONES: Record<Tone, string> = {
  primary: palette.text,
  secondary: palette.textSecondary,
  accent: palette.accent,
  error: palette.error,
  warning: palette.warning,
  onAccent: palette.onAccent,
  ink: palette.ink,
  verdigris: palette.verdigris,
};

export type TextRef = ComponentRef<typeof RNText>;

export interface AppTextProps extends TextProps {
  ref?: Ref<TextRef>;
  variant?: TypeVariant;
  tone?: Tone;
  align?: "left" | "center" | "right";
}

/** Text in the ESCAPD type scale. Honors system text scaling; never shrinks to fit. */
export function Text({ ref, variant = "body", tone = "primary", align, style, ...rest }: AppTextProps) {
  return <RNText ref={ref} {...rest} style={[typeScale[variant], { color: TONES[tone] }, align && { textAlign: align }, style]} />;
}
