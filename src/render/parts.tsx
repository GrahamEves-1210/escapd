// The player's own controls in the reference look (docs/DESIGN.md, the
// in-game player): 02's square header button, 07's white bar and its outlined
// pill (small), 07's card, and 02's error line. Every value is a `ref` token;
// ref.layout.play holds the player's own geometry.
import type { ReactNode } from "react";
import {
  ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions,
  type PressableProps, type StyleProp, type ViewStyle,
} from "react-native";
import { FocusRing, useFocusRing, type FocusShape, type NoirIcon } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { ref } from "@/theme/tokens";

const P = ref.layout.play;
const SQ = ref.button.square;
const SLOP = (SQ.hit - SQ.size) / 2;

/** 02's 44 square: raised, 14 corners, the measured rim, a bold 18 white glyph; 48 hit. */
export function SquareButton({ icon: Icon, accessibilityLabel, onPress, testID }: {
  icon: NoirIcon;
  accessibilityLabel: string;
  onPress: () => void;
  testID?: string;
}) {
  const focus = useFocusRing();
  const feedback = useFeedback();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={feedback.press}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      hitSlop={SLOP}
      testID={testID}
      style={({ pressed }) => [styles.square, pressed && styles.pressed]}
    >
      <Icon size={P.headerIcon.size} weight={P.headerIcon.weight} color={ref.color.textPrimary} />
      <FocusRing visible={focus.focused} shape="panel" edge={SQ.borderWidth} radius={SQ.radius} />
    </Pressable>
  );
}

/**
 * 07's white bar: the strongest fill on the dark ground, the label in the
 * ground colour. Disabled at disabledOpacity.pill; busy keeps full strength,
 * ignores taps and shows a small indicator at its right. `haptic` on
 * press-in: "press" (default), or false where an outcome haptic follows.
 */
export function WhiteBar({ label, onPress, disabled = false, busy = false, haptic = "press", testID, accessibilityLabel }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  haptic?: "press" | false;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const focus = useFocusRing();
  const feedback = useFeedback();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || undefined}
      onPressIn={haptic && !busy ? feedback[haptic] : undefined}
      onPress={busy ? undefined : onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      testID={testID}
      style={({ pressed }) => [styles.bar, disabled ? styles.disabled : pressed && !busy ? styles.pressed : null]}
    >
      <Text style={styles.barLabel}>{label}</Text>
      {busy ? (
        <View pointerEvents="none" style={styles.spinner}>
          <ActivityIndicator size="small" color={P.bar.label} testID={testID ? `${testID}-spinner` : undefined} />
        </View>
      ) : null}
      <FocusRing visible={focus.focused} shape="panel" radius={P.bar.radius} />
    </Pressable>
  );
}

/** 07's outlined pill at 44: a 1 pt white outline, Semibold 16 white; fills raised while pressed. */
export function OutlinePill({ label, onPress, accessibilityLabel, testID, style }: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const focus = useFocusRing();
  const feedback = useFeedback();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPressIn={feedback.press}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      testID={testID}
      style={({ pressed }) => [styles.outline, pressed && styles.outlinePressed, style]}
    >
      <Text style={styles.outlineLabel}>{label}</Text>
      <FocusRing visible={focus.focused} shape="pill" edge={P.outline.border} />
    </Pressable>
  );
}

/**
 * The kit's quiet pill on dark (white headline, 48 tall, grey while pressed),
 * for a toggle that needs its own accessibilityState (expanded).
 */
export function QuietToggle({ label, onPress, expanded, testID }: { label: string; onPress: () => void; expanded: boolean; testID?: string }) {
  const focus = useFocusRing();
  const feedback = useFeedback();
  const Q = ref.button.quiet;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded }}
      onPressIn={feedback.press}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      testID={testID}
      style={styles.quiet}
    >
      {({ pressed }) => (
        <>
          <Text style={[ref.type.headline, { color: pressed ? Q.dark.pressedLabel : Q.dark.label }]}>{label}</Text>
          <FocusRing visible={focus.focused} shape="pill" />
        </>
      )}
    </Pressable>
  );
}

/** A Pressable that draws the kit's brass focus ring in its own shape. */
export function RingPressable({ ring, radius, edge, children, ...props }: Omit<PressableProps, "children" | "onFocus" | "onBlur"> & {
  ring: FocusShape;
  radius?: number;
  edge?: number;
  children: ReactNode | ((state: { pressed: boolean }) => ReactNode);
}) {
  const focus = useFocusRing();
  return (
    <Pressable {...props} onFocus={focus.onFocus} onBlur={focus.onBlur}>
      {(state) => (
        <>
          {typeof children === "function" ? children(state) : children}
          <FocusRing visible={focus.focused} shape={ring} radius={radius} edge={edge} />
        </>
      )}
    </Pressable>
  );
}

/** 07's card: raised, 8 corners, 16 padding. */
export function Card({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return <View style={[styles.card, style]} testID={testID}>{children}</View>;
}

/**
 * 02's error line: a white glyph centred on the first line, then white words.
 * White where detail is grey, so it reads as more urgent; no amber, no red.
 */
export function NoticeLine({ icon: Icon, text, size = "hint" }: { icon: NoirIcon; text: string; size?: "hint" | "meta" }) {
  const { fontScale } = useWindowDimensions();
  const type = size === "meta" ? ref.type.meta : P.type.hint;
  return (
    <View style={styles.notice}>
      <View style={[styles.noticeIcon, { height: type.lineHeight * fontScale }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon size={P.code.noticeIcon} weight="regular" color={ref.color.textPrimary} />
      </View>
      <Text style={[type, styles.noticeText]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  square: {
    width: SQ.size,
    height: SQ.size,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SQ.fill,
    borderWidth: SQ.borderWidth,
    borderColor: P.squareRim,
    borderRadius: SQ.radius,
    ...ref.curve,
  },
  pressed: { opacity: P.pressedOpacity },
  disabled: { opacity: ref.button.disabledOpacity.pill },
  bar: {
    alignSelf: "stretch",
    minHeight: P.bar.height,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: ref.space.xl + ref.space.lg,
    borderRadius: P.bar.radius,
    backgroundColor: P.bar.fill,
    ...ref.curve,
  },
  barLabel: { ...P.type.action, color: P.bar.label, textAlign: "center" },
  spinner: { position: "absolute", top: 0, bottom: 0, right: ref.space.lg, justifyContent: "center" },
  outline: {
    minHeight: P.outline.height,
    paddingHorizontal: P.outline.padX,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: ref.radius.round,
    borderWidth: P.outline.border,
    borderColor: ref.color.textPrimary,
    ...ref.curve,
  },
  outlinePressed: { backgroundColor: P.outline.pressedFill },
  outlineLabel: { ...P.type.action, color: ref.color.textPrimary, textAlign: "center" },
  quiet: { alignSelf: "center", minHeight: ref.button.quiet.height, paddingHorizontal: ref.button.quiet.padX, alignItems: "center", justifyContent: "center" },
  card: {
    padding: P.card.pad,
    borderRadius: P.card.radius,
    backgroundColor: ref.color.raised,
    ...ref.curve,
  },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: ref.space.xs },
  noticeIcon: { justifyContent: "center" },
  noticeText: { flexShrink: 1, color: ref.color.textPrimary },
});
