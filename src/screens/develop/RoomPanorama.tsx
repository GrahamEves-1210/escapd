// 06 · The room, turning: the build wait's one visual, as pages being pinned
// into her journal (docs/ART_DIRECTION.md, the mystery-book core). The
// player's photos (a 360: each one a turn to the right of the last, the last
// back beside the first) hang side by side as polaroids, pegged with washi
// tape to a string of little warm lights, each leaning a touch and swaying,
// and the row drifts slowly to the left round the loop, as if someone stood
// in the middle of the room and turned. Each print develops as it comes in:
// milky at the right edge, its picture surfacing as it drifts across. Over
// it, a candle's pool of light wanders: the room sits under a dark veil
// except a soft pool, tinted in the mode's glow.
//
// It is a toy, not a progress bar: nothing here measures or claims progress
// (no markers, no percentages). A drag takes the room at once and turns it by
// hand; let go and it coasts, rests, then eases back into its drift. When the
// case is ready (`ready`) the drift eases to rest and the lights come up.
//
// Performance: the drift, the sway, the developing and the beam run off one
// frame callback on the UI thread, moving transforms and opacity only;
// nothing re-renders per frame.
// Tiles are TreatedImage at the review tiles' bake size, so the bakes made on
// the review screen are the ones shown here (each photo is baked once).
//
// Reduced motion: no drift, sway, developing or wandering beam. One polaroid
// at a time hangs in the middle and cross-fades to the next; the pool of
// light stays still in the middle. No drag.
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
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { useCapturePalette } from "@/capture/ui/palette";
import { TreatedImage } from "@/components/noir";
import { useModeTheme } from "@/game/mode";
import { Washi } from "@/render/keepsake";
import { DEVELOPING, LIGHT } from "@/theme/payoff";
import { ModeCover } from "@/screens/hub/art/ModeCover";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";

const D = ref.layout.develop;
const DRIFT = D.drift;
const BEAM = D.beam;
const TURN = 2 * Math.PI;
const BAKE = ref.layout.review.tile.bake;
/** A print's slot: this share of the frame's height across (a polaroid and the air round it). */
export const TILE_ASPECT = 0.44;
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
  const tile = Math.round(height * TILE_ASPECT);
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
  const theme = useModeTheme();
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
                <FairyLights width={copies * pitch} pitch={pitch} y={PIN.string} line={theme.foil} bulb={theme.glow} />
                {Array.from({ length: copies }, (_, i) => (
                  <HangingPrint
                    key={i}
                    index={i}
                    uri={photos[i % count].uri}
                    genre={palette.genre}
                    left={i * pitch}
                    tile={tile}
                    height={height}
                    frameWidth={width}
                    pitch={pitch}
                    loop={loop}
                    offset={offset}
                    clock={clock}
                    lights={lights}
                    tape={i % 2 ? theme.glow : theme.sweet}
                    thread={theme.foil}
                  />
                ))}
              </Animated.View>
            )}
            <Animated.View pointerEvents="none" style={[styles.beam, { left: -width, top: -height, width: width * 3, height: height * 3 }, beam]} testID="build-beam">
              <Beam width={width} height={height} veil={palette.well} tint={palette.genre ? theme.glow : null} />
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

/** A print on the string: `string` pt from the top; its `frame` of paper and deeper `foot`; `inset` from its slot's sides; how far it `lean`s and sways. */
const PIN = { string: 16, top: 26, frame: 7, foot: 24, inset: 12, bottom: 14, aspect: 0.8, lean: 2.6, sway: 1.2, swayPeriod: 2600 } as const;
/** How far down each print hangs on its thread, as shares of the room left under it: a garland of different lengths. */
const DROPS = [0.1, 0.75, 0.35, 0.95, 0.5] as const;
const PRINT = DEVELOPING;

/**
 * One polaroid on the string: pegged with washi tape, leaning a touch and
 * swaying; developing (a milky blank over the picture) by where it is in the
 * frame: blank at the right edge, the picture fully up by the left third.
 * When the case is ready (`lights` down) every print is fully developed.
 */
function HangingPrint({ index, uri, genre, left, tile, height, frameWidth, pitch, loop, offset, clock, lights, tape, thread }: {
  index: number;
  uri: string;
  genre: ReturnType<typeof useCapturePalette>["genre"];
  left: number;
  tile: number;
  height: number;
  frameWidth: number;
  pitch: number;
  loop: number;
  offset: SharedValue<number>;
  clock: SharedValue<number>;
  lights: SharedValue<number>;
  tape: string;
  thread: string;
}) {
  const lean = (index % 2 ? 1 : -1) * PIN.lean;
  const sway = useAnimatedStyle(() => ({
    transform: [{ rotate: `${lean + PIN.sway * Math.sin((TURN * clock.get()) / PIN.swayPeriod + index * 1.7)}deg` }],
  }));
  const blank = useAnimatedStyle(() => {
    const x = index * pitch - wrapOffset(offset.get(), loop);
    const developed = Math.min(1, Math.max(0, (frameWidth * 0.95 - x) / (frameWidth * 0.6)));
    return { opacity: (1 - developed) * 0.88 * lights.get() };
  });
  const w = tile - PIN.inset * 2;
  const h = Math.min(height - PIN.top - PIN.bottom, Math.round(w / PIN.aspect));
  const drop = Math.max(0, height - PIN.top - PIN.bottom - h) * DROPS[index % DROPS.length];
  return (
    <Animated.View style={[styles.hang, { left: left + PIN.inset, top: PIN.string + 4, width: w, height: h + drop + PIN.top - PIN.string - 4 }, sway]}>
      {/* Its thread, from the string down to the peg. */}
      <View style={[styles.thread, { height: drop + PIN.top - PIN.string, backgroundColor: thread }]} />
      <View style={[styles.hung, { top: drop + PIN.top - PIN.string - 4, height: h }]}>
      <View style={[styles.print, StyleSheet.absoluteFill]}>
        <View style={styles.printPhoto}>
          <TreatedImage source={uri} genre={genre} maxEdge={BAKE} contentFit="cover" style={StyleSheet.absoluteFill} testID={`build-photo-${index}`} />
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: PRINT.blank }, blank]} />
        </View>
      </View>
        <Washi color={tape} width={Math.min(44, w * 0.4)} height={16} tilt={index % 2 ? 5 : -5} style={styles.peg} />
      </View>
    </Animated.View>
  );
}

/** The string the prints hang from: a gold thread with little warm lights along it, glowing. */
function FairyLights({ width, pitch, y, line, bulb }: { width: number; pitch: number; y: number; line: string; bulb: string }) {
  const id = `fl${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const sag = 5;
  let d = `M0 ${y}`;
  for (let x = 0; x < width; x += pitch / 2) d += ` Q${x + pitch / 4} ${y + sag} ${x + pitch / 2} ${y}`;
  const bulbs = Array.from({ length: Math.ceil(width / (pitch / 2)) }, (_, i) => i * (pitch / 2) + pitch / 4);
  return (
    <Svg width={width} height={y + 18} style={styles.lights} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset={0} stopColor={bulb} stopOpacity={0.75} />
          <Stop offset={1} stopColor={bulb} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Path d={d} stroke={line} strokeOpacity={0.75} strokeWidth={1.2} fill="none" />
      {bulbs.map((x) => (
        <Circle key={`h${x}`} cx={x} cy={y + sag * 0.75 + 4} r={9} fill={`url(#${id})`} />
      ))}
      {bulbs.map((x) => (
        <Circle key={`b${x}`} cx={x} cy={y + sag * 0.75 + 4} r={2.6} fill={bulb} />
      ))}
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
    <Animated.View key={at} entering={index === 0 ? undefined : STILL_IN} exiting={STILL_OUT} style={[StyleSheet.absoluteFill, styles.still]} testID={`build-still-${at}`}>
      <View style={[styles.print, styles.stillPrint, { transform: [{ rotate: "-2deg" }] }]}>
        <TreatedImage source={photos[at].uri} genre={palette.genre} maxEdge={BAKE} contentFit="cover" style={styles.printPhoto} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: { alignSelf: "stretch", overflow: "hidden", borderRadius: ref.radius.frame, ...ref.curve },
  strip: { position: "absolute", top: 0, left: 0 },
  lights: { position: "absolute", left: 0, top: 0 },
  hang: { position: "absolute", transformOrigin: "50% 0%" },
  thread: { position: "absolute", top: 0, left: "50%", width: 1, opacity: 0.7 },
  hung: { position: "absolute", left: 0, right: 0 },
  print: { backgroundColor: PRINT.paper, padding: PIN.frame, paddingBottom: PIN.foot, borderRadius: 3, boxShadow: LIGHT.hangShade },
  printPhoto: { flex: 1, overflow: "hidden", borderRadius: 1, backgroundColor: PRINT.blank },
  peg: { position: "absolute", top: -8, alignSelf: "center" },
  still: { alignItems: "center", justifyContent: "center", paddingVertical: PIN.top },
  stillPrint: { width: "62%", height: "100%" },
  beam: { position: "absolute" },
  // The frame's 1 pt edge, over the photos, so the frame holds its shape where the veil meets the page.
  rim: { ...StyleSheet.absoluteFill, borderWidth: D.frame.rim, borderRadius: ref.radius.frame, ...ref.curve },
});
