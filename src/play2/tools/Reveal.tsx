// A note that only reads with something in the room, brought to light by hand.
//
//   heat:   a blank letter written in lemon juice, dropped on a lamp that's on. The page is drawn
//           under the lamp's warm bulb; drag it up into the warmth and the writing browns in, the
//           closer the browner, until it holds.
//   mirror: a note in mirror writing, dropped on the room's mirror. The note is drawn above a
//           mirror; drag it down to the glass and its reflection reads plainly.
//
// The card is already in the casebook when this opens (the engine showed it): this is the moment of
// reading it. Under reduced motion, or for a screen reader (activate), it reads at once. Inky paper
// and line art, like the journal; the mode's colours only.
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { Easing, ReduceMotion, interpolate, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";

import { HOLD_AT, progressFor, REACH, type RevealKind, splitCard } from "./revealText";

export { revealOf, type RevealKind } from "./revealText";
/** Lemon juice, scorched: the colour it browns to. */
const SCORCH = "#7A4A1E";
const PAPER = "#F3EAD6";
const PAPER_EDGE = "#D9C9A6";



export function Reveal({ kind, title, text: card, onClose }: { kind: RevealKind; title: string; text: string; onClose: () => void }) {
  const { lead, writing: text } = splitCard(card);
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  const feedback = useFeedback();
  const { width: screenW } = useWindowDimensions();
  const pageW = Math.min(screenW - ref.space.lg * 2, 340);
  // How far the writing has come up (0..1): it only ever grows, so letting go keeps what's been read.
  const shown = useSharedValue(reducedMotion ? 1 : 0);
  const drag = useSharedValue(0);
  // Set once the writing holds (the drag keeps updating after; it finishes once).
  const held = useSharedValue(reducedMotion);
  const [done, setDone] = useState(reducedMotion);

  const finish = () => {
    if (done) return;
    setDone(true);
    feedback.paper();
  };
  useEffect(() => {
    if (reducedMotion) shown.set(1);
  }, [reducedMotion, shown]);

  const pan = usePanGesture({
    enabled: !done,
    minDistance: 2,
    maxPointers: 1,
    testID: "v2-reveal-pan",
    onUpdate: (e) => {
      "worklet";
      const p = progressFor(kind, e.translationY);
      drag.set(kind === "heat" ? -p * REACH : p * REACH);
      if (p > shown.get()) shown.set(p);
      if (p >= HOLD_AT && !held.get()) {
        held.set(true);
        shown.set(withTiming(1, { duration: 260, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }));
        scheduleOnRN(finish);
      }
    },
    onDeactivate: () => {
      "worklet";
      drag.set(withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }));
    },
  });
  // A screen reader (or a tap, once it's done) reads it at once.
  const readNow = () => {
    held.set(true);
    shown.set(1);
    finish();
  };

  const pageStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drag.get() }] }));
  const prompt = done ? null : kind === "heat" ? "Drag the page up to the warm bulb." : "Drag the note down to the mirror.";

  return (
    <View style={[StyleSheet.absoluteFill, styles.backdrop]} testID={`v2-reveal-${kind}`}>
      <View style={[styles.sheet, { width: pageW + ref.space.lg * 2, backgroundColor: theme.surface, borderColor: theme.rim }]}>
        {kind === "heat" ? <Bulb width={pageW} shown={shown} /> : null}
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[styles.page, { width: pageW }, pageStyle]}
            accessible
            accessibilityRole="button"
            accessibilityLabel={kind === "heat" ? `${title}: hold it to the warm bulb to read it` : `${title}: hold it to the mirror to read it`}
            accessibilityActions={[{ name: "activate" }]}
            onAccessibilityAction={readNow}
            testID="v2-reveal-page"
          >
            <Text style={[ref.type.handSmall, styles.title, { color: "#3B2F25" }]}>{title}</Text>
            {kind === "heat" ? <Browning text={text} shown={shown} /> : <Text style={[ref.type.hand, styles.text, text.length < 24 && styles.big, styles.backwards]}>{text}</Text>}
          </Animated.View>
        </GestureDetector>
        {kind === "mirror" ? <Glass width={pageW} text={text} shown={shown} /> : null}
        {prompt ? <Text style={[ref.type.handSmall, { color: theme.inkMuted, textAlign: "center" }]}>{prompt}</Text> : null}
        {done && lead ? <Text style={[ref.type.handSmall, { color: theme.inkMuted, textAlign: "center" }]} testID="v2-reveal-lead">{lead.replace(/:$/, ".")}</Text> : null}
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={done ? "Done" : "Put it away"} style={[styles.close, { borderColor: theme.rim }]} testID="v2-reveal-close">
          <Text style={[ref.type.headline, { color: theme.ink }]}>{done ? "Done" : "Put it away"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** The lemon-juice writing: invisible, browning in as the page warms (a faint first, then scorched). */
function Browning({ text, shown }: { text: string; shown: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: interpolate(shown.get(), [0, 0.15, 1], [0, 0.18, 1]) }));
  return (
    <Animated.Text style={[ref.type.hand, styles.text, text.length < 24 && styles.big, { color: SCORCH }, style]} testID="v2-reveal-text">
      {text}
    </Animated.Text>
  );
}

/** The lamp's bulb above the page, its warmth brightening as the page comes close. */
function Bulb({ width, shown }: { width: number; shown: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: 0.45 + 0.55 * shown.get() }));
  return (
    // Above the page (it slides up under the warmth, never over the bulb).
    <Animated.View style={[{ width, height: 96, alignItems: "center", zIndex: 2 }, style]} pointerEvents="none">
      <Svg width={width} height={96} viewBox={`0 0 ${width} 96`}>
        <Defs>
          <RadialGradient id="warm" cx="50%" cy="55%" r="50%">
            <Stop offset="0" stopColor="#FFD58A" stopOpacity="0.95" />
            <Stop offset="1" stopColor="#FFB24A" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx={width / 2} cy={52} rx={width * 0.42} ry={44} fill="url(#warm)" />
        {/* The bulb, inked: a glass pear on a screw cap. */}
        <Path d={`M${width / 2 - 16} 22 h32 v10 h-32 z`} fill="#8A7A62" stroke="#2B231C" strokeWidth={2} />
        <Path d={`M${width / 2 - 14} 32 C${width / 2 - 30} 50 ${width / 2 - 22} 76 ${width / 2} 78 C${width / 2 + 22} 76 ${width / 2 + 30} 50 ${width / 2 + 14} 32 Z`}
          fill="#FFF3D1" stroke="#2B231C" strokeWidth={2} strokeLinejoin="round" />
        <Path d={`M${width / 2 - 6} 60 q6 -12 12 0`} fill="none" stroke="#C98A2B" strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

/** The mirror under the note: the note's reflection reads the right way round as it comes close. */
function Glass({ width, text, shown }: { width: number; text: string; shown: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: interpolate(shown.get(), [0, 0.2, 1], [0, 0.15, 1]) }));
  return (
    <View style={[styles.glass, { width }]} pointerEvents="none">
      <Svg width={width} height={150} viewBox={`0 0 ${width} 150`} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="silver" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#DCE3E6" />
            <Stop offset="0.5" stopColor="#AEB9BE" />
            <Stop offset="1" stopColor="#E6ECEE" />
          </LinearGradient>
        </Defs>
        <Rect x={3} y={3} width={width - 6} height={144} rx={14} fill="url(#silver)" stroke="#2B231C" strokeWidth={3} />
        <Path d={`M${width * 0.12} 130 L${width * 0.42} 18 M${width * 0.2} 136 L${width * 0.5} 24`} stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={5} strokeLinecap="round" />
      </Svg>
      <Animated.Text style={[ref.type.hand, styles.text, text.length < 24 && styles.big, styles.reflection, style]} numberOfLines={5} testID="v2-reveal-text">
        {text}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(10,8,6,0.72)", alignItems: "center", justifyContent: "center", zIndex: 90 },
  sheet: { borderRadius: 18, borderWidth: 1, padding: ref.space.lg, gap: ref.space.sm, alignItems: "center" },
  page: { backgroundColor: PAPER, borderColor: PAPER_EDGE, borderWidth: 1, borderRadius: 6, padding: ref.space.lg, minHeight: 130, gap: ref.space.xs },
  title: { textTransform: "uppercase", letterSpacing: 1 },
  text: { color: "#3B2F25" },
  // A short line (a digit, a word) is written large, as a person would.
  big: { fontSize: 30, lineHeight: 36 },
  // The note as written: every letter back to front.
  backwards: { transform: [{ scaleX: -1 }] },
  glass: { height: 150, justifyContent: "center", paddingHorizontal: ref.space.lg },
  reflection: { color: "#24313A", textAlign: "left" },
  close: { borderWidth: 1, borderRadius: 999, paddingHorizontal: ref.space.xl, paddingVertical: ref.space.sm, marginTop: ref.space.xs },
});

