import { memo, useEffect, type ComponentRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming,
} from "react-native-reanimated";
import Svg, { Line, Path } from "react-native-svg";
import type { Hotspot, Id } from "@/lib/puzzle-types";
import { useTheme } from "@/theme/ThemeProvider";
import { color, hit, motion } from "@/theme/tokens";
import { hitSlopFor, type Size } from "./geometry";

const SUBTLE = 0.42;

export type HotspotRef = ComponentRef<typeof View>;

export interface Thread {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface HotspotLayerProps {
  /** Visible hotspots for this scene, largest first (smaller ones end up on top). */
  hotspots: Hotspot[];
  /** The image box at 1x, in points. */
  stage: Size;
  /** Keep brackets bright: hotspot assistance, Use mode. */
  persistent: boolean;
  /** A coach mark points here, so keep this one bright. */
  highlightId?: Id;
  /** Draw the solved trace on this hotspot once per key. */
  flash?: { id: Id; key: number };
  /** Hotspots whose puzzles are already solved: pewter brackets and a verdigris seal. */
  solvedIds?: ReadonlySet<Id>;
  /** A hotspot that just appeared. Its brackets open in crimson. */
  irisId?: Id;
  /** Crimson thread from the object that revealed something, in image fractions. */
  thread?: Thread;
  labelFor: (hotspot: Hotspot) => string;
  onPress: (hotspot: Hotspot) => void;
  registerRef?: (id: Id, node: HotspotRef | null) => void;
}

export function HotspotLayer({
  hotspots, stage, persistent, highlightId, flash, solvedIds, irisId, thread, labelFor, onPress, registerRef,
}: HotspotLayerProps) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {thread ? (
        <Svg
          width={stage.width}
          height={stage.height}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Line
            x1={thread.x1 * stage.width}
            y1={thread.y1 * stage.height}
            x2={thread.x2 * stage.width}
            y2={thread.y2 * stage.height}
            stroke={color.wax}
            strokeWidth={1.5}
          />
        </Svg>
      ) : null}
      {hotspots.map((h) => (
        <HotspotTarget
          key={h.id}
          hotspot={h}
          stage={stage}
          bright={persistent || h.id === highlightId || h.id === irisId}
          solved={solvedIds?.has(h.id) ?? false}
          iris={h.id === irisId}
          flashKey={flash?.id === h.id ? flash.key : undefined}
          label={labelFor(h)}
          onPress={onPress}
          registerRef={registerRef}
        />
      ))}
    </View>
  );
}

const HotspotTarget = memo(function HotspotTarget({ hotspot, stage, bright, solved, iris, flashKey, label, onPress, registerRef }: {
  hotspot: Hotspot;
  stage: Size;
  bright: boolean;
  solved: boolean;
  iris: boolean;
  flashKey?: number;
  label: string;
  onPress: (hotspot: Hotspot) => void;
  registerRef?: (id: Id, node: HotspotRef | null) => void;
}) {
  const { reducedMotion } = useTheme();
  const rect = {
    left: hotspot.shape.x * stage.width,
    top: hotspot.shape.y * stage.height,
    width: hotspot.shape.w * stage.width,
    height: hotspot.shape.h * stage.height,
  };

  const opacity = useSharedValue(0);
  const scale = useSharedValue(reducedMotion ? 1 : 1.1);
  const trace = useSharedValue(0);

  // On mount (scene entry or first reveal): brackets contract by a few points
  // as if a caliper is focusing, hold, then rest. No perpetual animation.
  useEffect(() => {
    const rest = bright ? 1 : SUBTLE;
    if (reducedMotion) {
      opacity.set(withSequence(
        withTiming(1, { duration: motion.reducedFade }),
        withDelay(motion.bracketHold, withTiming(rest, { duration: motion.reducedFade })),
      ));
      return;
    }
    scale.set(withTiming(1, { duration: motion.bracketSettle, easing: Easing.bezier(0.2, 0, 0, 1) }));
    opacity.set(withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(motion.bracketHold, withTiming(rest, { duration: 400 })),
    ));
    // Only on mount; brightness changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    opacity.set(withTiming(bright ? 1 : SUBTLE, { duration: reducedMotion ? motion.reducedFade : 240 }));
  }, [bright, reducedMotion, opacity]);

  useEffect(() => {
    if (flashKey === undefined) return;
    const half = (reducedMotion ? motion.reducedFade * 2 : motion.solvedTrace) / 2;
    trace.set(withSequence(withTiming(1, { duration: half }), withTiming(0, { duration: half })));
  }, [flashKey, reducedMotion, trace]);

  const bracketStyle = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ scale: scale.get() }] }));
  const traceStyle = useAnimatedStyle(() => ({ opacity: trace.get() }));

  return (
    <Pressable
      ref={(node) => registerRef?.(hotspot.id, node)}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={hitSlopFor(rect, hit.min)}
      onPress={() => onPress(hotspot)}
      testID={`hotspot-${hotspot.id}`}
      style={[styles.target, rect]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, bracketStyle]} pointerEvents="none">
        <Brackets width={rect.width} height={rect.height} tone={iris ? "iris" : solved ? "spent" : "open"} />
      </Animated.View>
      {solved ? <View pointerEvents="none" style={styles.seal} /> : null}
      <Animated.View style={[StyleSheet.absoluteFill, styles.trace, traceStyle]} pointerEvents="none" />
    </Pressable>
  );
});

/** Four 10 pt corner brackets, with a tick at the middle of each side. */
function Brackets({ width, height, tone }: Size & { tone: "open" | "spent" | "iris" }) {
  const len = 10;
  const i = 1.5;
  const tick = 4;
  const mx = width / 2;
  const my = height / 2;
  const d = [
    `M${i} ${i + len}V${i}H${i + len}`,
    `M${width - i - len} ${i}H${width - i}V${i + len}`,
    `M${width - i} ${height - i - len}V${height - i}H${width - i - len}`,
    `M${i + len} ${height - i}H${i}V${height - i - len}`,
    `M${mx} ${i}V${i + tick}`,
    `M${width - i} ${my}H${width - i - tick}`,
    `M${mx} ${height - i}V${height - i - tick}`,
    `M${i} ${my}H${i + tick}`,
  ].join("");
  const stroke = tone === "iris" ? color.wax : tone === "spent" ? color.textSecondary : color.accent;
  return (
    <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={d} stroke={color.bracketShadow} strokeWidth={4} fill="none" />
      <Path d={d} stroke={stroke} strokeWidth={1.5} fill="none" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  target: { position: "absolute" },
  trace: { borderWidth: 2, borderColor: color.verdigris, borderRadius: 4 },
  seal: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color.verdigris,
    borderWidth: 1,
    borderColor: color.canvas,
  },
});
