// The way out (gameplay v2 §2 pacing, "Payoff"): every room ends at its real
// door. First a beat for the door itself (the close-up's last moment shows
// under it, then the door's photo comes up and the view pushes in), then
// light floods out of it and fills the screen, in the mode's light, and the
// ending's lines come up in it. "Close the case" goes on to case closed.
//
// The lines: a headline in the mode's voice and face (never one that says
// what the ending's own text already says), the ending's text, the cat
// sitting in the doorway light, centred in the screen; the button at the
// foot, at least ref.space.lg off the bottom edge.
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { Canvas, Circle, RadialGradient, vec } from "@shopify/react-native-skia";
import type { Rect as Box } from "@/engine/v2";
import type { Genre } from "@/lib/puzzle-types";
import { TreatedImage } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { themeFor } from "@/game/mode";
import type { SceneSource } from "@/render/SceneView";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
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

/** Each mode's light: the glow's stops, the wash it settles to, and the ink that reads on it. */
const LIGHT: Record<Genre, { glow: [string, string, string]; wash: string; ink: string }> = {
  // Warm lamplight on a wet street.
  noir: { glow: ["rgba(255,244,220,1)", "rgba(255,236,200,0.85)", "rgba(255,230,190,0)"], wash: "rgb(255,244,226)", ink: "rgb(36,28,20)" },
  // Plain, cool daylight.
  crime_scene: { glow: ["rgba(246,247,249,1)", "rgba(234,238,243,0.85)", "rgba(226,232,240,0)"], wash: "rgb(244,245,247)", ink: "rgb(30,24,24)" },
  // A pale, clean dawn.
  paranormal: { glow: ["rgba(240,250,248,1)", "rgba(222,242,240,0.85)", "rgba(210,236,234,0)"], wash: "rgb(238,247,245)", ink: "rgb(18,32,34)" },
};

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
  const look = LIGHT[genre];
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
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: look.wash }, wash]} pointerEvents="none" />
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
          <SittingCat width={112} delay={reducedMotion ? 0 : ENDING.lightAt + ENDING.light * 0.6 + 200} label="The black cat, sitting in the doorway light" />
          <Text style={[styles.headline, { fontFamily: theme.display.fontFamily }, ink]} accessibilityRole="header" testID="v2-ending-headline">{headline}</Text>
          {text ? <Text style={[styles.text, ink]}>{text}</Text> : null}
        </View>
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
  headline: { fontSize: 30, lineHeight: 36, textAlign: "center" },
  text: { fontSize: 17, lineHeight: 24, fontWeight: "500", textAlign: "center", maxWidth: 320 },
  button: { alignSelf: "stretch", minHeight: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
});
