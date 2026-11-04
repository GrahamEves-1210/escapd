// A length of red string between two pins in the casebook (journal/threads.ts
// says which cards it joins). It runs down the page's margin, bowing out a
// little while the lead is new (and swaying, just, as if the page breathed);
// once the case has moved on it pulls taut with a twang: a springy snap past
// straight and back, a sparkle where it sang. Drawn in Skia: a soft shadow on
// the paper, the thread, and a fine dashed highlight that reads as twist.
// Reduced motion: no sway, no twang; it is simply slack or taut.
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { BlurMask, Canvas, DashPathEffect, Group, Path } from "@shopify/react-native-skia";
import { skiaAvailable } from "@/lib/skiaReady";
import { Sparkle } from "./Doodles";

export interface Point {
  x: number;
  y: number;
}

/** How far a string bows out of line at rest (px of its bezier's handles; the curve itself reaches 3/4 of it). */
export function slackOf(a: Point, b: Point, side: "left" | "right"): number {
  const dy = Math.abs(b.y - a.y);
  const max = side === "left" ? 30 : 16;
  return Math.min(max, (side === "left" ? 16 : 10) + dy * 0.03);
}

/** A taut string keeps a hair of bow: thread, not a ruler's edge. */
const TAUT = 1.2;
/** Room around the string's line on its canvas, for the bow and the shadow. */
const PAD = 36;

export function RedString({ a, b, side, color, shadow, taut, twang, delay = 0, appear = 0, reduced, testID }: {
  a: Point;
  b: Point;
  side: "left" | "right";
  color: string;
  /** The paper's shadow colour. */
  shadow: string;
  taut: boolean;
  /** Pull taut now (it was slack when last seen). */
  twang: boolean;
  /** When the twang starts (ms). */
  delay?: number;
  /** Fade in after this long (ms): a card it ties to is still dropping in. 0: there at once. */
  appear?: number;
  reduced: boolean;
  testID?: string;
}) {
  const dir = side === "left" ? -1 : 1;
  const slack = slackOf(a, b, side);
  const rest = taut ? TAUT : slack;
  const bow = useSharedValue(twang && !reduced ? slack : rest);
  const sway = useSharedValue(0);
  const shown = useSharedValue(appear && !reduced ? 0 : 1);
  const spark = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      bow.set(rest);
      shown.set(1);
      return;
    }
    if (twang) {
      // Past straight and back: a plucked string settling.
      bow.set(withDelay(delay, withSpring(TAUT, { damping: 3.4, stiffness: 340, mass: 0.55 })));
      spark.set(withDelay(delay + 60, withSequence(withTiming(1, { duration: 160 }), withTiming(0, { duration: 520 }))));
    } else if (!taut) {
      sway.set(withRepeat(withTiming(1, { duration: 2400 + Math.round(Math.abs(b.y - a.y)) % 900, easing: Easing.inOut(Easing.sin) }), -1, true));
    }
    if (appear) shown.set(withDelay(appear, withTiming(1, { duration: 320 })));
    // Once, as the string comes up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const left = Math.min(a.x, b.x) - PAD;
  const top = Math.min(a.y, b.y) - 8;
  const width = Math.abs(a.x - b.x) + PAD * 2;
  const height = Math.abs(b.y - a.y) + 16;
  const ax = a.x - left, ay = a.y - top, bx = b.x - left, by = b.y - top;
  const k = (by - ay) * 0.32;

  const path = useDerivedValue(() => {
    const s = (bow.get() + sway.get() * 1.8) * dir;
    return `M ${ax} ${ay} C ${ax + s} ${ay + k} ${bx + s} ${by - k} ${bx} ${by}`;
  });
  const opacity = useDerivedValue(() => shown.get());
  const sparkStyle = useAnimatedStyle(() => ({ opacity: spark.get(), transform: [{ scale: 0.4 + spark.get() * 0.8 }, { rotate: `${spark.get() * 40}deg` }] }));

  if (!skiaAvailable()) return null;
  return (
    <View style={[styles.box, { left, top, width, height }]} pointerEvents="none" testID={testID} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Canvas style={StyleSheet.absoluteFill}>
        <Group opacity={opacity}>
          <Group transform={[{ translateX: 0.8 }, { translateY: 2 }]}>
            <Path path={path} style="stroke" strokeWidth={2.6} strokeCap="round" color={shadow} opacity={0.3}>
              <BlurMask blur={1.6} style="normal" />
            </Path>
          </Group>
          <Path path={path} style="stroke" strokeWidth={2} strokeCap="round" color={color} />
          <Path path={path} style="stroke" strokeWidth={0.8} strokeCap="round" color="rgba(255,236,236,0.55)">
            <DashPathEffect intervals={[1.4, 2.8]} />
          </Path>
        </Group>
      </Canvas>
      {twang && !reduced ? (
        <Animated.View style={[styles.spark, { left: (ax + bx) / 2 - 9, top: (ay + by) / 2 - 9 }, sparkStyle]}>
          <Sparkle color={color} size={18} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: "absolute" },
  spark: { position: "absolute" },
});
