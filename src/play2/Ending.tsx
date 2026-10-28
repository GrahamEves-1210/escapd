// The way out (gameplay v2 §2 pacing, "Payoff"): every room ends at its real
// door. First a beat for the door itself (the close-up's last moment shows
// under it, then the door's photo comes up and the view pushes in), then
// light floods out of it and fills the screen in the mode's glow (candle,
// desk lamp, spirit mint: theme.glow), settling to a warm page of that light,
// and the ending comes up on it as the last page of her mystery novel
// (docs/ART_DIRECTION.md, the mystery-book core). "Close the case" goes on to
// case closed.
//
// The page: the cat sitting in the doorway light with a few foil twinkles
// round it; a headline in the mode's voice and display face (never one that
// says what the ending's own text already says); the ending's text set as a
// book's last line; a fleuron rule and "The End" in the cover face's italic,
// in the mode's page ink. The button at the foot, at least ref.space.lg off
// the bottom edge.
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { Canvas, Circle, RadialGradient, vec } from "@shopify/react-native-skia";
import Svg, { Defs, RadialGradient as SvgRadial, Rect, Stop } from "react-native-svg";
import type { Rect as Box } from "@/engine/v2";
import type { Genre } from "@/lib/puzzle-types";
import { TreatedImage } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { themeFor } from "@/game/mode";
import type { SceneSource } from "@/render/SceneView";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { FleuronRule, Twinkle } from "@/render/keepsake";
import { LIGHT, PAGE_INK, PAYOFF_TYPE, alpha, mix } from "@/theme/payoff";
import { SittingCat } from "./SittingCat";

/** The beats, in ms after the room is solved. */
export const ENDING = {
  /** The close-up's last moment (the door giving) shows under it, then the door's photo fades up. */
  appear: 450,
  fade: 350,
  /** The light starts out of the door, and fills the screen over `light`. */
  lightAt: 1100,
  light: 1400,
  /** The view pushes in on the door until the light is full. */
  push: 1.12,
  /** Reduced motion: no push, no hold; the light simply comes up. */
  reducedLight: 200,
} as const;

/** The headline, in the mode's voice; the second when the ending's text already says the first. */
const HEADLINES: Record<Genre, readonly string[]> = {
  noir: ["Out into the night.", "You walk out."],
  crime_scene: ["You named them.", "Out past the tape."],
  paranormal: ["It lets you go.", "Into the light."],
};

/**
 * Each mode's light, from its glow: the light's stops (white-hot at the
 * door, the glow round it, fading out), the page of light it settles to (the
 * glow, mostly white), and the inks that read on that page: the mode's ground
 * for the words, its page ink (keepsake.PAGE_INK) for "The End".
 */
export function endingLight(genre: Genre): { glow: [string, string, string]; wash: string; ink: string; accent: string } {
  const theme = themeFor(genre);
  return {
    glow: [mix(theme.glow, LIGHT.white, 0.75), alpha(mix(theme.glow, LIGHT.white, 0.35), 0.9), alpha(theme.glow, 0)],
    wash: mix(theme.glow, LIGHT.white, 0.8),
    ink: theme.ground,
    accent: PAGE_INK[genre],
  };
}

/** The last page's number: a book's length, the same for the same ending. */
export function pageNumber(text: string): number {
  let n = 0;
  for (const ch of text) n = (n * 31 + ch.charCodeAt(0)) % 997;
  return 180 + (n % 140);
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();

/** The mode's headline that doesn't say what `text` already says. */
export function endingHeadline(genre: Genre, text: string): string {
  const said = words(text);
  const options = HEADLINES[genre];
  return options.find((h) => !said.includes(words(h))) ?? options[options.length - 1];
}

export function Ending({ text, door, genre, onDone }: {
  text: string;
  door?: { source: SceneSource; cacheKey?: string; box: Box };
  genre: Genre;
  onDone: () => void;
}) {
  const theme = themeFor(genre);
  const look = endingLight(genre);
  const feedback = useFeedback();
  const { reducedMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const shown = useSharedValue(reducedMotion ? 1 : 0);
  const push = useSharedValue(1);
  const light = useSharedValue(0);
  const lines = useSharedValue(0);

  useEffect(() => {
    feedback.unlock();
    const lightAt = reducedMotion ? 0 : ENDING.lightAt;
    const d = reducedMotion ? ENDING.reducedLight : ENDING.light;
    if (!reducedMotion) {
      shown.set(withDelay(ENDING.appear, withTiming(1, { duration: ENDING.fade })));
      push.set(withDelay(ENDING.appear, withTiming(ENDING.push, { duration: lightAt + d - ENDING.appear, easing: Easing.inOut(Easing.quad) })));
    }
    light.set(withDelay(lightAt, withTiming(1, { duration: d, easing: Easing.in(Easing.quad) })));
    lines.set(withDelay(reducedMotion ? 150 : lightAt + d * 0.6, withTiming(1, { duration: 500 })));
    const t = setTimeout(() => feedback.solved(), lightAt + d);
    return () => clearTimeout(t);
  }, [feedback, shown, push, light, lines, reducedMotion]);

  // The door's close-up fills the screen; the light spreads from its middle.
  const box = door?.box;
  const scale = box ? Math.min(3, 0.9 / Math.max(box.w, box.h)) : 1;
  const imgW = width * scale;
  const imgH = (width / 0.75) * scale;
  const left = box ? width / 2 - (box.x + box.w / 2) * imgW : 0;
  const top = box ? height / 2 - (box.y + box.h / 2) * imgH : 0;
  const reach = Math.hypot(width, height);
  const r = useDerivedValue(() => 20 + light.get() * reach);
  const rootStyle = useAnimatedStyle(() => ({ opacity: shown.get() }));
  // The push centres on the door (the screen's middle).
  const pushStyle = useAnimatedStyle(() => ({ transform: [{ scale: push.get() }] }));
  const wash = useAnimatedStyle(() => ({ opacity: Math.max(0, light.get() - 0.55) * 1.6 }));
  const linesStyle = useAnimatedStyle(() => ({ opacity: lines.get(), transform: [{ translateY: (1 - lines.get()) * 12 }] }));
  const headline = endingHeadline(genre, text);
  const ink = { color: look.ink };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: theme.ground }, rootStyle]} testID="v2-ending">
      {door ? (
        <Animated.View style={[StyleSheet.absoluteFill, pushStyle]} pointerEvents="none">
          <TreatedImage source={door.source} cacheKey={door.cacheKey} genre={null} contentFit="fill" accessible={false} style={{ position: "absolute", width: imgW, height: imgH, left, top }} />
        </Animated.View>
      ) : null}
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={width / 2} cy={height / 2} r={r}>
          <RadialGradient c={vec(width / 2, height / 2)} r={r} colors={look.glow} positions={[0, 0.5, 1]} />
        </Circle>
      </Canvas>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: look.wash }, wash]} pointerEvents="none">
        {/* The page's edges warm in the glow, as a page does by candlelight. */}
        <Svg width="100%" height="100%">
          <Defs>
            <SvgRadial id="endPage" cx="50%" cy="45%" rx="75%" ry="65%" fx="50%" fy="45%">
              <Stop offset={0.55} stopColor={theme.glow} stopOpacity={0} />
              <Stop offset={1} stopColor={theme.glow} stopOpacity={0.55} />
            </SvgRadial>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#endPage)" />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.words,
          { paddingTop: insets.top + ref.space.xl, paddingBottom: Math.max(insets.bottom + ref.space.sm, ref.space.lg) },
          linesStyle,
        ]}
        testID="v2-ending-words"
      >
        <View style={styles.middle}>
          {/* The cat saw you out. */}
          <View>
            <SittingCat width={104} delay={reducedMotion ? 0 : ENDING.lightAt + ENDING.light * 0.6 + 200} label="The black cat, sitting in the doorway light" />
            <Twinkle size={14} color={theme.foil} reduced={reducedMotion} style={styles.twinkleA} />
            <Twinkle size={10} color={theme.sweet} delay={600} reduced={reducedMotion} style={styles.twinkleB} />
            <Twinkle size={12} color={theme.foil} delay={1100} reduced={reducedMotion} style={styles.twinkleC} />
          </View>
          <View style={styles.heading}>
            <Text style={[styles.chapter, { color: look.accent }]}>Chapter the last</Text>
            <Text style={[styles.headline, { fontFamily: theme.display.fontFamily }, ink]} accessibilityRole="header" testID="v2-ending-headline">{headline}</Text>
          </View>
          {text ? <Text style={[styles.text, ink]} testID="v2-ending-text">{text}</Text> : null}
          <View style={styles.end} accessible accessibilityLabel="The End" testID="v2-ending-end">
            <FleuronRule color={look.accent} width={150} />
            <Text style={[styles.theEnd, { color: look.accent }]}>The End</Text>
          </View>
        </View>
        {/* The page's number, as a book's last page has one. */}
        <Text style={[styles.folio, { color: alpha(look.ink, 0.7) }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {`· ${pageNumber(text)} ·`}
        </Text>
        <Pressable
          onPress={onDone}
          accessibilityRole="button"
          accessibilityLabel="Close the case"
          testID="v2-ending-done"
          style={[styles.button, { backgroundColor: look.ink }]}
        >
          <Text style={[ref.type.headline, { color: look.wash }]}>Close the case</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 80, overflow: "hidden" },
  words: { paddingHorizontal: ref.space.xl },
  // The cat, the headline and the lines, centred in the screen over the button.
  middle: { flex: 1, alignItems: "center", justifyContent: "center", gap: ref.space.lg },
  heading: { alignItems: "center", gap: 4 },
  chapter: PAYOFF_TYPE.chapter,
  folio: { ...PAYOFF_TYPE.folio, textAlign: "center", marginBottom: ref.space.sm },
  headline: { fontSize: 28, lineHeight: 34, textAlign: "center" },
  // The book's last line.
  text: { ...PAYOFF_TYPE.lastLarge, textAlign: "center", maxWidth: 320 },
  end: { alignItems: "center", gap: 2, marginTop: -ref.space.xs },
  theEnd: { ...PAYOFF_TYPE.theEnd, textAlign: "center" },
  twinkleA: { top: 8, left: -14 },
  twinkleB: { top: 36, right: -12 },
  twinkleC: { bottom: 18, left: -20 },
  button: { alignSelf: "stretch", minHeight: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
});
