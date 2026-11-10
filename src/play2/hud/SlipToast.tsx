// A word from the game ("Nothing happens.", "It's locked."): a torn slip of
// the mode's paper dropped on the top of the room, the line on it typed or
// written as the mode writes, a little askew. It drops in, lies a moment and
// lifts away; a newer one takes its place. Announced politely. Shared-value
// motion only (no layout animations: a tap that brings one can land while an
// item is in flight). Reduced motion: a plain fade.
import { useEffect } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import type { Genre } from "@/lib/puzzle-types";
import { LETTER_FONT } from "@/theme/payoff";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import { TornEdge } from "../journal/Paper";
import { useHudMaterials } from "./materials";

const FACE: Record<Genre, object> = {
  noir: { fontFamily: LETTER_FONT.typewriter, fontSize: 14, lineHeight: 19 },
  crime_scene: { fontFamily: LETTER_FONT.report, fontSize: 14, lineHeight: 19 },
  paranormal: { fontFamily: LETTER_FONT.fellItalic, fontSize: 16, lineHeight: 20 },
};

/** A small, stable tilt from the slip's words (degrees). */
function tiltOf(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) n = (n * 31 + text.charCodeAt(i)) % 997;
  return ((n % 7) - 3) * 0.5;
}

export function SlipToast({ text, onHide }: { text: string; onHide: () => void }) {
  const { reducedMotion } = useTheme();
  const m = useHudMaterials();
  const d = reducedMotion ? motion.reducedFade : 220;
  const shown = useSharedValue(0);
  const tilt = tiltOf(text);
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(text);
    const timing = { duration: d, reduceMotion: ReduceMotion.Never, easing: Easing.out(Easing.cubic) };
    shown.set(withTiming(1, timing));
    const out = setTimeout(() => shown.set(withTiming(0, { ...timing, easing: Easing.in(Easing.quad) })), Math.max(0, motion.toast - d));
    const t = setTimeout(onHide, motion.toast);
    return () => {
      clearTimeout(out);
      clearTimeout(t);
    };
    // Once per slip (its caller keys each one).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, onHide, shown]);
  const drop = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: reducedMotion ? [{ rotate: `${tilt}deg` }] : [{ translateY: (shown.get() - 1) * 14 }, { rotate: `${tilt - (1 - shown.get()) * 3}deg` }],
  }));
  return (
    <Animated.View style={[styles.slip, { shadowColor: m.shadow }, drop]} pointerEvents="none" testID="toast">
      <View style={[styles.body, { backgroundColor: m.paper.fill }]}>
        <Text style={[FACE[m.genre], styles.text, { color: m.paper.ink }]}>{text}</Text>
      </View>
      <TornEdge color={m.paper.fill} side="bottom" seed={text} height={5} teeth={22} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slip: { alignSelf: "center", maxWidth: 320, marginHorizontal: ref.space.lg, shadowOpacity: 0.6, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  body: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 5, borderTopLeftRadius: 1.5, borderTopRightRadius: 1.5 },
  text: { textAlign: "center" },
});
