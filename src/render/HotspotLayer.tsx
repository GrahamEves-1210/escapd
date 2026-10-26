import { memo, useEffect, type ComponentRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming,
} from "react-native-reanimated";
import Svg, { Line, Path } from "react-native-svg";
import { CheckIcon } from "@/components/icons";
import { FocusRing, useFocusRing } from "@/components/noir";
import type { Hotspot, Id } from "@/lib/puzzle-types";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { hit, motion, ref } from "@/theme/tokens";
import { hitSlopFor, type Size } from "./geometry";

// The mode's ink and muted ink, as 02's cue ring in white and grey: open
// brackets in ink, solved ones muted with a check, a just-revealed one
// heavier. A void halo keeps them legible on a bright wall (02's privacy-note black).
const B = ref.layout.play.brackets;
const SEAL = ref.layout.play.seal;
const TRACE = ref.layout.play.trace;
const THREAD = ref.layout.play.thread;
const SUBTLE = B.subtle;

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
  /** Hotspots whose puzzles are already solved: grey brackets and a check seal. */
  solvedIds?: ReadonlySet<Id>;
  /** A hotspot that just appeared. Its brackets open heavier, in white. */
  irisId?: Id;
  /** A dashed white thread from the object that revealed something, in image fractions. */
  thread?: Thread;
  labelFor: (hotspot: Hotspot) => string;
  onPress: (hotspot: Hotspot) => void;
  /** A finger came down on a hotspot (after the press delay, so a swipe doesn't count). */
  onPressIn?: () => void;
  registerRef?: (id: Id, node: HotspotRef | null) => void;
}

const nativeIdFor = (id: Id) => `hotspot-${id}`;

/**
 * Screen-reader order: reading order on the photo (top to bottom, then left
 * to right, by each target's top-left corner). Drawing order stays largest
 * first, so a small object inside a large one is on top for touch.
 */
export function readingOrder(hotspots: readonly Hotspot[]): Id[] {
  return [...hotspots]
    .sort((a, b) => a.shape.y - b.shape.y || a.shape.x - b.shape.x)
    .map((h) => h.id);
}

export function HotspotLayer({
  hotspots, stage, persistent, highlightId, flash, solvedIds, irisId, thread, labelFor, onPress, onPressIn, registerRef,
}: HotspotLayerProps) {
  const theme = useModeTheme();
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      experimental_accessibilityOrder={readingOrder(hotspots).map(nativeIdFor)}
      testID="hotspot-layer"
    >
      {thread ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Svg width={stage.width} height={stage.height}>
            <Line
              x1={thread.x1 * stage.width}
              y1={thread.y1 * stage.height}
              x2={thread.x2 * stage.width}
              y2={thread.y2 * stage.height}
              stroke={ref.color.void}
              strokeOpacity={THREAD.haloOpacity}
              strokeWidth={THREAD.halo}
              strokeLinecap="round"
            />
            <Line
              x1={thread.x1 * stage.width}
              y1={thread.y1 * stage.height}
              x2={thread.x2 * stage.width}
              y2={thread.y2 * stage.height}
              stroke={theme.ink}
              strokeWidth={THREAD.width}
              strokeDasharray={[THREAD.dash, THREAD.dash]}
            />
          </Svg>
        </View>
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
          onPressIn={onPressIn}
          registerRef={registerRef}
        />
      ))}
    </View>
  );
}

const HotspotTarget = memo(function HotspotTarget({ hotspot, stage, bright, solved, iris, flashKey, label, onPress, onPressIn, registerRef }: {
  hotspot: Hotspot;
  stage: Size;
  bright: boolean;
  solved: boolean;
  iris: boolean;
  flashKey?: number;
  label: string;
  onPress: (hotspot: Hotspot) => void;
  onPressIn?: () => void;
  registerRef?: (id: Id, node: HotspotRef | null) => void;
}) {
  const { reducedMotion } = useTheme();
  const theme = useModeTheme();
  const focus = useFocusRing();
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
      nativeID={nativeIdFor(hotspot.id)}
      hitSlop={hitSlopFor(rect, hit.min)}
      unstable_pressDelay={ref.layout.play.hotspotPressDelay}
      onPressIn={onPressIn}
      onPress={() => onPress(hotspot)}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      testID={`hotspot-${hotspot.id}`}
      style={[styles.target, rect]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, bracketStyle]} pointerEvents="none">
        <Brackets width={rect.width} height={rect.height} tone={iris ? "iris" : solved ? "spent" : "open"} />
      </Animated.View>
      {solved ? (
        <View pointerEvents="none" style={styles.seal} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.sealFill} />
          <CheckIcon size={SEAL.icon} weight="bold" color={theme.ink} />
        </View>
      ) : null}
      <Animated.View style={[StyleSheet.absoluteFill, styles.trace, { borderColor: theme.ink }, traceStyle]} pointerEvents="none" />
      <FocusRing visible={focus.focused} shape="panel" radius={TRACE.radius} />
    </Pressable>
  );
});

/** Four 10 pt corner brackets, with a tick at the middle of each side, on a void halo. */
function Brackets({ width, height, tone }: Size & { tone: "open" | "spent" | "iris" }) {
  const theme = useModeTheme();
  const len = B.arm;
  const i = B.inset;
  const tick = B.tick;
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
  const stroke = tone === "spent" ? theme.inkMuted : theme.ink;
  const weight = tone === "iris" ? B.iris : B.stroke;
  return (
    <View style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height}>
        <Path d={d} stroke={ref.color.void} strokeOpacity={B.haloOpacity} strokeWidth={B.halo + weight - B.stroke} fill="none" />
        <Path d={d} stroke={stroke} strokeWidth={weight} fill="none" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  target: { position: "absolute" },
  // The solve flash: a white outline round the target.
  trace: { borderWidth: TRACE.width, borderColor: ref.color.textPrimary, borderRadius: TRACE.radius },
  // Solved: a white check in a see-through void disc at the top right.
  seal: {
    position: "absolute",
    top: SEAL.inset,
    right: SEAL.inset,
    width: SEAL.size,
    height: SEAL.size,
    alignItems: "center",
    justifyContent: "center",
  },
  sealFill: { ...StyleSheet.absoluteFill, borderRadius: ref.radius.round, backgroundColor: ref.color.void, opacity: SEAL.fillOpacity },
});
