// The player's own controls in the reference look (docs/DESIGN.md, the
// in-game player): 02's square header button, the quiet toggle, 07's card,
// and 02's error line. Every value is a `ref` token; ref.layout.play holds
// the player's own geometry. Inside a mode the colours are the mode's
// (useModeTheme): its raised fill, ink, accent and stamp. The player's
// actions are the photo guide's pills (ModePill, src/capture/ui): "ghost"
// for the one strong action (the guide's "Next": the mode's accent capsule,
// 52 tall, the headline label), "quiet" for the ways out.
import type { ReactNode } from "react";
import {
  Pressable, StyleSheet, Text, View, useWindowDimensions,
  type PressableProps, type StyleProp, type ViewStyle,
} from "react-native";
import { FocusRing, useFocusRing, type FocusShape, type NoirIcon } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { ref } from "@/theme/tokens";

const P = ref.layout.play;
const SQ = ref.button.square;
const SLOP = (SQ.hit - SQ.size) / 2;

/**
 * 02's 44 square: raised, 14 corners, the measured rim, a bold 18 glyph in
 * the mode's ink; 48 hit. A `badge` (a short count) sits on a stamp-coloured
 * disc over its top right corner; the label says the same in words. A
 * `caption` (crime scene's "Suspects") names the square on screen, under it
 * in the meta line's type; the caption is part of the button, so it is
 * tapped with it, and the label (which starts with the same word) speaks it.
 */
export function SquareButton({ icon: Icon, caption, accessibilityLabel, accessibilityHint, onPress, badge, testID }: {
  icon: NoirIcon;
  caption?: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress: () => void;
  badge?: string;
  testID?: string;
}) {
  const focus = useFocusRing();
  const feedback = useFeedback();
  const theme = useModeTheme();
  const face = [styles.square, { backgroundColor: theme.raised }];
  const inner = (
    <>
      <Icon size={P.headerIcon.size} weight={P.headerIcon.weight} color={theme.ink} />
      {badge ? (
        <View
          pointerEvents="none"
          style={[styles.badge, { backgroundColor: theme.stamp }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          testID={testID ? `${testID}-badge` : undefined}
        >
          <Text style={[styles.badgeText, { color: theme.ground }]}>{badge}</Text>
        </View>
      ) : null}
      <FocusRing visible={focus.focused} shape="panel" edge={SQ.borderWidth} radius={SQ.radius} />
    </>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPressIn={feedback.press}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      hitSlop={SLOP}
      testID={testID}
      style={({ pressed }) => [caption ? styles.captioned : face, pressed && styles.pressed]}
    >
      {caption ? (
        <>
          <View style={face} testID={testID ? `${testID}-square` : undefined}>{inner}</View>
          {/* The box takes the width: one-line text is capped at its parent's width on the web. */}
          <View style={styles.captionBox} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text numberOfLines={1} style={[styles.caption, { color: theme.inkMuted }]} testID={testID ? `${testID}-caption` : undefined}>
              {caption}
            </Text>
          </View>
        </>
      ) : inner}
    </Pressable>
  );
}

/**
 * The kit's quiet pill on dark (the mode's ink headline, 48 tall, muted while
 * pressed), for a toggle that needs its own accessibilityState (expanded).
 */
export function QuietToggle({ label, onPress, expanded, testID }: { label: string; onPress: () => void; expanded: boolean; testID?: string }) {
  const focus = useFocusRing();
  const feedback = useFeedback();
  const theme = useModeTheme();
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
          <Text style={[ref.type.headline, { color: pressed ? theme.inkMuted : theme.ink }]}>{label}</Text>
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

/** 07's card: the mode's raised fill, 8 corners, 16 padding. */
export function Card({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const theme = useModeTheme();
  return <View style={[styles.card, { backgroundColor: theme.raised }, style]} testID={testID}>{children}</View>;
}

/**
 * 02's error line: a glyph centred on the first line, then the words, both in
 * the mode's ink. Ink where detail is muted, so it reads as more urgent; no
 * amber, no red.
 */
export function NoticeLine({ icon: Icon, text, size = "hint" }: { icon: NoirIcon; text: string; size?: "hint" | "meta" }) {
  const { fontScale } = useWindowDimensions();
  const theme = useModeTheme();
  const type = size === "meta" ? ref.type.meta : P.type.hint;
  return (
    <View style={styles.notice}>
      <View style={[styles.noticeIcon, { height: type.lineHeight * fontScale }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon size={P.code.noticeIcon} weight="regular" color={theme.ink} />
      </View>
      <Text style={[type, styles.noticeText, { color: theme.ink }]}>{text}</Text>
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
  // A captioned square: the square, then its word centred under it. The
  // column stays the square's width; the word's wider box spills evenly
  // either side (into the empty band under the header row).
  captioned: { width: SQ.size, alignItems: "center" },
  captionBox: { width: P.suspects.captionWidth, marginTop: P.suspects.captionGap, alignItems: "center" },
  caption: { ...ref.type.meta, textAlign: "center" },
  badge: {
    position: "absolute",
    top: P.suspects.badgeInset,
    right: P.suspects.badgeInset,
    minWidth: P.suspects.badge,
    height: P.suspects.badge,
    paddingHorizontal: ref.space.xs,
    borderRadius: ref.radius.round,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { ...P.type.badge, textAlign: "center" },
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
