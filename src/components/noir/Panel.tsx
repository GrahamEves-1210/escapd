import { StyleSheet, View, type ViewProps } from "react-native";
import { ref } from "@/theme/tokens";

const P = ref.panel;
const EDGE = ref.border.hairline;

export interface PanelProps extends ViewProps {
  /**
   * "panel" (default): ref.panel, radius 6 all round with a 1 pt hairline edge.
   * "sheet": radius 6 on the top corners only, square bottom corners, the
   * hairline along the top edge and around the top corners. It runs 1 pt past
   * the left and right edges of its box so the side hairlines fall off-screen
   * when it spans the screen; padding still measures from the visible edge.
   */
  variant?: "panel" | "sheet";
}

/**
 * Opaque graphite panel (ref.panel). No shadow, elevation, gradient or blur,
 * and never a panel inside a panel. Padding and layout come from the caller.
 * A panel that is itself a target draws its own pressed fill (see usePressProgress).
 */
export function Panel({ variant = "panel", style, ...rest }: PanelProps) {
  return <View {...rest} style={[variant === "sheet" ? styles.sheet : styles.panel, style]} />;
}

export interface RuleProps extends Omit<ViewProps, "children"> {
  /** "hairline" (default) for dividers and form rules; "hairline2" where the spec says so. */
  tone?: "hairline" | "hairline2";
}

/** A 1 pt horizontal rule. Decorative: hidden from screen readers. Width comes from its parent or `style`. */
export function Rule({ tone = "hairline", style, ...rest }: RuleProps) {
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      {...rest}
      style={[styles.rule, { backgroundColor: ref.color[tone] }, style]}
    />
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: P.fill,
    borderWidth: P.borderWidth,
    borderColor: P.border,
    borderRadius: P.radius,
    ...ref.curve,
  },
  sheet: {
    backgroundColor: P.fill,
    borderColor: P.border,
    borderTopWidth: P.borderWidth,
    borderLeftWidth: P.borderWidth,
    borderRightWidth: P.borderWidth,
    borderBottomWidth: 0,
    borderTopLeftRadius: P.radius,
    borderTopRightRadius: P.radius,
    marginHorizontal: -P.borderWidth,
    ...ref.curve,
  },
  rule: { height: EDGE, alignSelf: "stretch" },
});
