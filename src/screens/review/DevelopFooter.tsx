// The reference's pinned "Next" bar, here "Build the case": a band in the page colour over the
// scrolling content (footer.pad above and below the bar, then the bottom safe
// area), holding a full control-width bar footer.bar tall with footer.radius
// corners in the strongest fill on this ground (paper, as the reference's
// black on white) and a Semibold 16 label in the page colour. When the case
// can't be built yet, the reason sits over the bar (Regular 14, centred:
// warning colour for marked photos, grey for too few) and the bar dims to
// ref.button.disabledOpacity.pill. Pressing in on the live bar gives the
// medium `thud` haptic: committing to build a case (as PillButton haptic="thud").
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FocusRing, useFocusRing } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { curve, ref } from "@/theme/tokens";
import { COPY } from "./copy";

const L = ref.layout.review;
const F = L.footer;

export interface DevelopFooterProps {
  bottom: number;
  /** "flagged": photos still marked; "few": fewer than MIN_PLATES; null: ready. */
  blocked: { kind: "flagged" } | { kind: "few"; min: number } | null;
  onDevelop: () => void;
}

export function DevelopFooter({ bottom, blocked, onDevelop }: DevelopFooterProps) {
  const focus = useFocusRing();
  const disabled = blocked !== null;
  const feedback = useFeedback();
  return (
    <View style={[styles.footer, { paddingBottom: F.pad + bottom }]} testID="develop-footer">
      {blocked ? (
        <Text style={[styles.helper, blocked.kind === "flagged" && styles.warning]} testID="develop-helper">
          {blocked.kind === "flagged" ? COPY.flaggedHelp : COPY.tooFew(blocked.min)}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={COPY.develop}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPressIn={disabled ? undefined : feedback.thud}
        onPress={onDevelop}
        onFocus={focus.onFocus}
        onBlur={focus.onBlur}
        testID="develop"
        style={({ pressed }) => [styles.bar, disabled ? styles.disabled : pressed ? styles.pressed : null]}
      >
        <Text style={styles.label}>{COPY.develop}</Text>
        <FocusRing visible={focus.focused} shape="panel" radius={F.radius} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingTop: F.pad,
    paddingHorizontal: ref.space.edge,
    gap: F.helperGap,
    backgroundColor: ref.color.ground,
  },
  helper: { ...L.type.hint, color: ref.color.textSecondary, textAlign: "center" },
  warning: { color: L.warning },
  bar: {
    minHeight: F.bar,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: ref.space.lg,
    borderRadius: F.radius,
    backgroundColor: F.fill,
    ...curve,
  },
  label: { ...L.type.action, color: F.label, textAlign: "center" },
  pressed: { opacity: L.pressedOpacity },
  disabled: { opacity: ref.button.disabledOpacity.pill },
});
