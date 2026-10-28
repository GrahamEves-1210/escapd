// 06 · The room, turning: the build wait's one visual. The player's photos
// (a 360: each one a turn to the right of the last, the last back beside the
// first) stand side by side as tiles in a frame with the camera viewfinder's
// corners, and the row drifts slowly to the left round the loop, as if
// someone stood in the middle of the room and turned. Over it, a torch beam
// wanders: the room sits under a dark veil except a soft pool of light,
// faintly tinted in the mode's colour.
//
// It is a toy, not a progress bar: nothing here measures or claims progress
// (no markers, no percentages). A drag takes the room at once and turns it by
// hand; let go and it coasts, rests, then eases back into its drift. When the
// case is ready (`ready`) the drift eases to rest and the lights come up.
//
// Performance: the drift and the beam run in one frame callback on the UI
// thread, moving transforms and opacity only; nothing re-renders per frame.
// Tiles are TreatedImage at the review tiles' bake size, so the bakes made on
// the review screen are the ones shown here (each photo is baked once).
//
// Reduced motion: no drift and no wandering beam. One photo at a time fills
// the frame and cross-fades to the next; the pool of light stays still in the
// middle. No drag.
//
// With no photos on this phone (a case followed from home after the app
// restarted), the mode's drawn cover fills the frame instead and the beam
// wanders over it; in the shell, the empty well.
//
// Decorative: hidden from screen readers (the status line carries the status).
import { useEffect, useId, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withDecay,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useCapturePalette } from "@/capture/ui/palette";
import { TreatedImage } from "@/components/noir";
import { ModeCover } from "@/screens/hub/art/ModeCover";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";

const D = ref.layout.develop;
const DRIFT = D.drift;
const BEAM = D.beam;
const TURN = 2 * Math.PI;
const BAKE = ref.layout.review.tile.bake;
/** The drag's dead zone before it takes the room, and the vertical travel that hands the touch back. */
const DRAG = { activeOffset: 8, failOffset: 16 } as const;

export interface PanoramaPhoto {
  uri: string;
}

/** `n` round a loop `length` long (0 to length). */
export function wrapOffset(n: number, length: number): number {
  "worklet";
  if (length <= 0) return 0;
  return ((n % length) + length) % length;
}

/** The tiles for a frame `width` x `height`: each tile's width, the pitch, one turn's length and how many tiles to draw so the loop never shows a gap. */
export function panoramaLayout(count: number, width: number, height: number) {
  const tile = Math.round(height * D.tile.aspect);
  const pitch = tile + D.tile.gap;
  const loop = count * pitch;
  const copies = count === 0 ? 0 : count + Math.ceil(width / pitch) + 1;
  return { tile, pitch, loop, copies };
}

export function RoomPanorama({ photos, ready, style }: {
  photos: readonly PanoramaPhoto[];
  /** The case is ready: the drift settles and the lights come up. */
  ready: boolean;
  /** The frame's place in the column (flex, min and max height). */
  style?: StyleProp<ViewStyle>;
}) {
  const palette = useCapturePalette();
  const { reducedMotion } = useTheme();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (size && size.width === width && size.height === height) return;
    setSize({ width, height });
  };
  const width = size?.width ?? 0;
  const height = size?.height ?? 0;
  const count = photos.length;
  const { tile, pitch, loop, copies } = panoramaLayout(count, width, height);
  const turning = !reducedMotion && count > 0;

  // The drift: offset (pt round the loop) grows at `speed` pt/s; `held` while a hand has it.
  const offset = useSharedValue(0);
  const speed = useSharedValue(0);
  const cruise = useSharedValue(ready ? 0 : DRIFT.speed);
  const held = useSharedValue(false);
  const start = useSharedValue(0);
  // The beam's own clock, in ms.
  const clock = useSharedValue(0);
  const lights = useSharedValue(ready ? 0 : 1);

  const frames = useFrameCallback((frame) => {
    "worklet";
    const dt = Math.min(frame.timeSincePreviousFrame ?? 0, 64);
    clock.set(clock.get() + dt);
    if (!held.get()) offset.set(offset.get() + (speed.get() * dt) / 1000);
  }, !reducedMotion);

  // Once ready has settled and the lights are up, nothing drifts: the frame callback stops.
  useEffect(() => {
    if (reducedMotion) return;
    if (!ready) {
      frames.setActive(true);
      return;
    }
    const id = setTimeout(() => frames.setActive(false), Math.max(DRIFT.settle, BEAM.lightsOn) + 100);
    return () => clearTimeout(id);
  }, [ready, reducedMotion, frames]);

  // Into the drift from rest; ready eases it back to rest.
  useEffect(() => {
    cruise.set(ready ? 0 : DRIFT.speed);
    if (reducedMotion) return;
    speed.set(
      ready
        ? withTiming(0, { duration: DRIFT.settle, easing: Easing.out(Easing.cubic) })
        : withTiming(DRIFT.speed, { duration: DRIFT.rampIn, easing: Easing.inOut(Easing.quad) }),
    );
  }, [ready, reducedMotion, speed, cruise]);

  // The lights come up when it's ready: they catch, stutter once, then come on (beam.flicker).
  // Reduced motion: a plain fade.
  useEffect(() => {
    if (!ready || reducedMotion) {
      lights.set(withTiming(ready ? 0 : 1, { duration: BEAM.lightsOn, easing: Easing.inOut(Easing.quad) }));
      return;
    }
    const [catchTo, catchMs, dipTo, dipMs] = BEAM.flicker;
    lights.set(
      withSequence(
        withTiming(catchTo, { duration: catchMs }),
        withTiming(dipTo, { duration: dipMs }),
        withTiming(0, { duration: BEAM.lightsOn, easing: Easing.out(Easing.quad) }),
      ),
    );
  }, [ready, reducedMotion, lights]);

  const pan = usePanGesture({
    enabled: turning,
    activeOffsetX: [-DRAG.activeOffset, DRAG.activeOffset],
    failOffsetY: [-DRAG.failOffset, DRAG.failOffset],
    maxPointers: 1,
    testID: "build-drag",
    onActivate: (e) => {
      "worklet";
      held.set(true);
      cancelAnimation(offset);
      cancelAnimation(speed);
      speed.set(0);
      // From where the finger is now, so the room doesn't jump by the dead zone.
      start.set(offset.get() + e.translationX);
    },
    onUpdate: (e) => {
      "worklet";
      offset.set(start.get() - e.translationX);
    },
    onDeactivate: (e) => {
      "worklet";
      offset.set(
        withDecay({ velocity: -e.velocityX, deceleration: DRIFT.deceleration }, (finished) => {
          // A new drag cancelled the coast: it holds the room now.
          if (!finished) return;
          held.set(false);
          speed.set(withDelay(DRIFT.resume, withTiming(cruise.get(), { duration: DRIFT.rampIn, easing: Easing.inOut(Easing.quad) })));
        }),
      );
    },
  });

  const strip = useAnimatedStyle(() => ({ transform: [{ translateX: -wrapOffset(offset.get(), loop) }] }));
  const beam = useAnimatedStyle(() => {
    const t = clock.get();
    return {
      opacity: lights.get(),
      transform: [
        { translateX: reducedMotion ? 0 : BEAM.x * width * Math.sin((TURN * t) / BEAM.periodX) },
        { translateY: reducedMotion ? 0 : BEAM.y * height * Math.sin((TURN * t) / BEAM.periodY) },
      ],
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <View
        onLayout={onLayout}
        style={[styles.frame, { backgroundColor: palette.well }, style]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="build-room"
      >
        {size && height > 0 ? (
          <>
            {count === 0 ? (
              palette.genre ? <ModeCover genre={palette.genre} style={StyleSheet.absoluteFill} testID="build-cover" /> : null
            ) : reducedMotion ? (
              <StillRoom photos={photos} ready={ready} />
            ) : (
              <Animated.View style={[styles.strip, { width: copies * pitch, height }, strip]} testID="build-strip">
                {Array.from({ length: copies }, (_, i) => (
                  <TreatedImage
                    key={i}
                    source={photos[i % count].uri}
                    genre={palette.genre}
                    maxEdge={BAKE}
                    contentFit="cover"
                    style={[styles.tile, { left: i * pitch, width: tile, height }]}
                    testID={`build-photo-${i}`}
                  />
                ))}
              </Animated.View>
            )}
            <Animated.View pointerEvents="none" style={[styles.beam, { left: -width, top: -height, width: width * 3, height: height * 3 }, beam]} testID="build-beam">
              <Beam width={width} height={height} veil={palette.well} tint={palette.genre ? palette.stamp : null} />
            </Animated.View>
            <View pointerEvents="none" style={[styles.rim, { borderColor: palette.rim }]} />
          </>
        ) : null}
      </View>
    </GestureDetector>
  );
}

/** The veil with its pool of light, three frames wide and tall so the pool can wander a frame either way and never show an edge. */
function Beam({ width, height, veil, tint }: { width: number; height: number; veil: string; tint: string | null }) {
  const id = `beam${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const cx = width * 1.5;
  const cy = height * 1.5;
  const r = BEAM.radius * width;
  return (
    <Svg width={width * 3} height={height * 3}>
      <Defs>
        <RadialGradient id={`${id}v`} cx={cx} cy={cy} r={r} fx={cx} fy={cy} gradientUnits="userSpaceOnUse">
          <Stop offset={0} stopColor={veil} stopOpacity={0} />
          <Stop offset={BEAM.soft} stopColor={veil} stopOpacity={BEAM.veil * 0.12} />
          <Stop offset={0.78} stopColor={veil} stopOpacity={BEAM.veil * 0.75} />
          <Stop offset={1} stopColor={veil} stopOpacity={BEAM.veil} />
        </RadialGradient>
        {tint ? (
          <RadialGradient id={`${id}t`} cx={cx} cy={cy} r={r} fx={cx} fy={cy} gradientUnits="userSpaceOnUse">
            <Stop offset={0} stopColor={tint} stopOpacity={BEAM.tint} />
            <Stop offset={0.7} stopColor={tint} stopOpacity={0} />
          </RadialGradient>
        ) : null}
      </Defs>
      <Rect x={0} y={0} width={width * 3} height={height * 3} fill={`url(#${id}v)`} />
      {tint ? <Rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill={`url(#${id}t)`} /> : null}
    </Svg>
  );
}

const STILL_IN = FadeIn.duration(D.still.fade).reduceMotion(ReduceMotion.Never);
const STILL_OUT = FadeOut.duration(D.still.fade).reduceMotion(ReduceMotion.Never);

/** Reduced motion: one photo filling the frame, cross-fading to the next every still.hold while it builds. */
function StillRoom({ photos, ready }: { photos: readonly PanoramaPhoto[]; ready: boolean }) {
  const palette = useCapturePalette();
  const [index, setIndex] = useState(0);
  const count = photos.length;
  useEffect(() => {
    if (ready || count < 2) return;
    const id = setInterval(() => setIndex((i) => i + 1), D.still.hold + D.still.fade);
    return () => clearInterval(id);
  }, [ready, count]);
  const at = index % count;
  return (
    <Animated.View key={at} entering={index === 0 ? undefined : STILL_IN} exiting={STILL_OUT} style={StyleSheet.absoluteFill} testID={`build-still-${at}`}>
      <TreatedImage source={photos[at].uri} genre={palette.genre} maxEdge={BAKE} contentFit="cover" style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: { alignSelf: "stretch", overflow: "hidden", borderRadius: ref.radius.viewfinder, ...ref.curve },
  strip: { position: "absolute", top: 0, left: 0 },
  tile: { position: "absolute", top: 0 },
  beam: { position: "absolute" },
  // The frame's 1 pt edge, over the photos, so the frame holds its shape where the veil meets the page.
  rim: { ...StyleSheet.absoluteFill, borderWidth: D.frame.rim, borderRadius: ref.radius.viewfinder, ...ref.curve },
});
