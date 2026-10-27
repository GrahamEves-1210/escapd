// The way out (gameplay v2 §2 pacing, "Payoff"): every room ends at its real
// door. The close-up of the door, then light floods out of it and fills the
// screen, and the ending's lines come up in it. "Close the case" goes on to
// case closed.
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { Canvas, Circle, RadialGradient, vec } from "@shopify/react-native-skia";
import type { Rect as Box } from "@/engine/v2";
import type { Genre } from "@/lib/puzzle-types";
import { TreatedImage } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import type { SceneSource } from "@/render/SceneView";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { V2 } from "./layout";

export function Ending({ text, door, genre, onDone }: {
  text: string;
  door?: { source: SceneSource; cacheKey?: string; box: Box };
  genre: Genre;
  onDone: () => void;
}) {
  const theme = useModeTheme();
  const feedback = useFeedback();
  const { reducedMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const light = useSharedValue(0);
  const words = useSharedValue(0);

  useEffect(() => {
    feedback.unlock();
    const d = reducedMotion ? 200 : V2.ending.lightMs;
    light.set(withTiming(1, { duration: d, easing: Easing.in(Easing.quad) }));
    words.set(withDelay(reducedMotion ? 150 : V2.ending.lightMs * 0.6, withTiming(1, { duration: 500 })));
    const t = setTimeout(() => feedback.solved(), d);
    return () => clearTimeout(t);
  }, [feedback, light, words, reducedMotion]);

  // The door's close-up fills the screen; the light spreads from its middle.
  const box = door?.box;
  const scale = box ? Math.min(3, 0.9 / Math.max(box.w, box.h)) : 1;
  const imgW = width * scale;
  const imgH = (width / 0.75) * scale;
  const left = box ? width / 2 - (box.x + box.w / 2) * imgW : 0;
  const top = box ? height / 2 - (box.y + box.h / 2) * imgH : 0;
  const reach = Math.hypot(width, height);
  const r = useDerivedValue(() => 20 + light.get() * reach);
  const wash = useAnimatedStyle(() => ({ opacity: Math.max(0, light.get() - 0.55) * 1.6 }));
  const lines = useAnimatedStyle(() => ({ opacity: words.get(), transform: [{ translateY: (1 - words.get()) * 12 }] }));

  return (
    <View style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: theme.ground }]} testID="v2-ending">
      {door ? (
        <TreatedImage source={door.source} cacheKey={door.cacheKey} genre={null} contentFit="fill" accessible={false} style={{ position: "absolute", width: imgW, height: imgH, left, top }} />
      ) : null}
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={width / 2} cy={height / 2} r={r}>
          <RadialGradient c={vec(width / 2, height / 2)} r={r} colors={["rgba(255,244,220,1)", "rgba(255,236,200,0.85)", "rgba(255,230,190,0)"]} positions={[0, 0.5, 1]} />
        </Circle>
      </Canvas>
      <Animated.View style={[StyleSheet.absoluteFill, styles.wash, wash]} pointerEvents="none" />
      <Animated.View style={[styles.words, { paddingBottom: insets.bottom + ref.space.lg }, lines]}>
        <Text style={[ref.type.serifTitle, styles.center, styles.dark]} accessibilityRole="header">You're out.</Text>
        <Text style={[ref.type.body, styles.center, styles.dark]}>{text}</Text>
        <Pressable onPress={onDone} accessibilityRole="button" accessibilityLabel="Close the case" testID="v2-ending-done" style={styles.button}>
          <Text style={[ref.type.headline, styles.buttonText]}>Close the case</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 80, overflow: "hidden" },
  wash: { backgroundColor: "rgb(255,244,226)" },
  words: { position: "absolute", left: ref.space.lg, right: ref.space.lg, bottom: 0, gap: ref.space.lg, alignItems: "stretch" },
  center: { textAlign: "center" },
  dark: { color: "rgb(36,28,20)" },
  button: { minHeight: 52, borderRadius: 26, backgroundColor: "rgb(36,28,20)", alignItems: "center", justifyContent: "center", marginTop: ref.space.sm },
  buttonText: { color: "rgb(255,244,226)" },
});
