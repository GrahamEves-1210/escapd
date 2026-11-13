// The way out's moment (Ending.tsx): what happens between the door giving and
// the reply letter, once per mode, from parts modelled and lit in Blender
// (scripts/blender/props/moment_noir.py, moment_crime.py, moment_moon.py).
// - noir: the door swings open on its hinges onto a wet street at night (a
//   streetlamp, its light run down the road, rain), and she walks out into it;
// - crime scene: the case's file lies shut on the desk, a rubber stamp comes
//   down on it and lifts off an imperfect CASE CLOSED;
// - paranormal: the candle gutters and goes out, a wisp of smoke curls up
//   off the wick, and what light is left is the room's own.
// Each is driven by one value, `m` (0 to 1 over the moment); nothing here
// keeps time of its own, and nothing is said.
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import Animated, { Easing, Extrapolation, interpolate, useAnimatedStyle, useDerivedValue, type SharedValue } from "react-native-reanimated";
import { BlurMask, Canvas, Path } from "@shopify/react-native-skia";
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from "react-native-svg";
import type { Genre } from "@/lib/puzzle-types";
import { themeFor } from "@/game/mode";
import { LIGHT, MOMENT_LIGHT, alpha, mix } from "@/theme/payoff";

const ART = {
  street: require("../../../assets/moments/end-noir-street.jpg") as number,
  door: require("../../../assets/moments/end-noir-door.jpg") as number,
  casing: require("../../../assets/moments/end-noir-casing.png") as number,
  file: require("../../../assets/moments/end-crime-file.png") as number,
  stamp: require("../../../assets/moments/end-crime-stamp.png") as number,
  impression: require("../../../assets/moments/end-crime-impression.png") as number,
  candleLit: require("../../../assets/moments/end-moon-candle-lit.png") as number,
  candleOut: require("../../../assets/moments/end-moon-candle-out.png") as number,
  flame: require("../../../assets/moments/end-moon-flame.png") as number,
} as const;

const SHOWN = { contentFit: "fill", cachePolicy: "memory-disk", transition: 0, accessible: false } as const;
const CLAMP = Extrapolation.CLAMP;
const BLACK = MOMENT_LIGHT.dark;
const CANDLE = MOMENT_LIGHT.candle;

/**
 * Each moment's parts, in points on a 390 x 844 screen (scaled to the screen
 * it is on), and its beats as shares of the moment. The prop scripts print
 * the sizes and the anchors.
 */
export const MOMENT = {
  /** Every moment comes up over the door's photo in this share of it. */
  rise: 0.12,
  noir: {
    leaf: { w: 240, h: 504 },
    casing: 26,
    street: { w: 280, h: 560 },
    /** The door's swing: from, to, how far (degrees), and its turn's depth. */
    swing: [0.14, 0.72],
    open: 84,
    perspective: 900,
    /** She walks out: the view pushes through the doorway. */
    walk: [0.52, 1],
    push: 1.5,
    /** The lock's hand lets go and the door sweeps the air (the sound's beat). */
    sweep: 0.16,
  },
  crime_scene: {
    file: { w: 300, h: 372 },
    /** Where the stamp lands, as shares of the file's picture; the impression it leaves, turned as a hand turns it. */
    lands: { x: 0.5053, y: 0.6508 },
    impression: { w: 204, h: 66, turn: -7 },
    stamp: { w: 150, h: 176, foot: { x: 0.5016, y: 0.7649 } },
    /** It comes in from up and to the right, lands, presses, lifts away. */
    from: { x: 78, y: -250, turn: 9, scale: 1.3 },
    approach: [0.1, 0.42],
    press: 0.56,
    lift: 0.92,
  },
  paranormal: {
    candle: { w: 284, h: 284, wick: { x: 0.5033, y: 0.0971 } },
    flame: { w: 108, h: 162, frames: 8, idle: 3, foot: 0.9, fps: 12 },
    /** It burns, gutters, and is out; then the smoke. */
    gutter: [0.3, 0.62],
    smoke: [0.6, 0.98],
    /** The flame's light, frame by frame (its height). */
    light: [1, 1.1, 0.94, 0.72, 1.02, 0.5, 0.3, 0.14],
  },
} as const;

type MomentProps = { m: SharedValue<number>; width: number; height: number; ms: number };

/** The mode's moment, filling the screen. */
export function Moment({ genre, ...rest }: MomentProps & { genre: Genre }) {
  const { m } = rest;
  const rise = useAnimatedStyle(() => ({ opacity: interpolate(m.get(), [0, MOMENT.rise], [0, 1], CLAMP) }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.clip, rise]} pointerEvents="none" testID={`v2-ending-moment-${genre}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {genre === "crime_scene" ? <Stamped {...rest} /> : genre === "paranormal" ? <Snuffed {...rest} /> : <DoorOpens {...rest} />}
    </Animated.View>
  );
}

/** Noir: the door swings open onto the wet street, and the view goes out through it. */
function DoorOpens({ m, width, height }: MomentProps) {
  const N = MOMENT.noir;
  const theme = themeFor("noir");
  const q = Math.min(width / 390, height / 844);
  const w = N.leaf.w * q, h = N.leaf.h * q, c = N.casing * q;
  const left = (width - w) / 2, top = (height - h) / 2 + 6 * q;
  const sw = N.street.w * q, sh = N.street.h * q;
  const swung = useDerivedValue(() => Easing.inOut(Easing.cubic)(interpolate(m.get(), N.swing, [0, 1], CLAMP)));
  const walk = useAnimatedStyle(() => ({ transform: [{ scale: 1 + (N.push - 1) * Easing.in(Easing.quad)(interpolate(m.get(), N.walk, [0, 1], CLAMP)) }] }));
  const leaf = useAnimatedStyle(() => ({ transform: [{ perspective: N.perspective * q }, { rotateY: `${swung.get() * N.open}deg` }] }));
  // The leaf turns its face from the room's light as it goes.
  const shade = useAnimatedStyle(() => ({ opacity: 0.15 + 0.6 * swung.get() }));
  // The street comes nearer as the door clears it.
  const street = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - swung.get()) * 10 * q }, { scale: 1.04 - 0.04 * swung.get() }] }));
  // The lamp's light reaches into the room round the doorway as it opens.
  const spill = useAnimatedStyle(() => ({ opacity: 0.9 * swung.get() }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: mix(theme.ground, BLACK, 0.45) }, walk]}>
      <Animated.View style={[StyleSheet.absoluteFill, spill]}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="noirSpill" cx={width / 2} cy={top + h * 0.62} rx={w * 1.25} ry={h * 0.8} gradientUnits="userSpaceOnUse">
              <Stop offset={0} stopColor={theme.glow} stopOpacity={0.3} />
              <Stop offset={0.55} stopColor={theme.glow} stopOpacity={0.09} />
              <Stop offset={1} stopColor={theme.glow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#noirSpill)" />
        </Svg>
      </Animated.View>
      <View style={[styles.part, styles.clip, { left, top, width: w, height: h, backgroundColor: BLACK }]}>
        <Animated.View style={[styles.part, { left: (w - sw) / 2, top: (h - sh) / 2, width: sw, height: sh }, street]}>
          <Image source={ART.street} style={{ width: sw, height: sh }} {...SHOWN} />
        </Animated.View>
      </View>
      <Animated.View style={[styles.part, styles.hinge, { left, top, width: w, height: h }, leaf]}>
        <Image source={ART.door} style={{ width: w, height: h }} {...SHOWN} />
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: mix(theme.ground, BLACK, 0.7) }, shade]} />
      </Animated.View>
      <Image source={ART.casing} style={[styles.part, { left: left - c, top: top - c, width: w + 2 * c, height: h + c }]} {...SHOWN} />
    </Animated.View>
  );
}

/** Crime scene: the stamp comes down on the file and leaves CASE CLOSED. */
function Stamped({ m, width, height }: MomentProps) {
  const S = MOMENT.crime_scene;
  const theme = themeFor("crime_scene");
  const q = Math.min(width / 390, height / 844);
  const fw = S.file.w * q, fh = S.file.h * q;
  const fl = (width - fw) / 2, ft = height * 0.47 - fh / 2;
  const at = { x: fw * S.lands.x, y: fh * S.lands.y };
  const iw = S.impression.w * q, ih = S.impression.h * q;
  const sw = S.stamp.w * q, sh = S.stamp.h * q;
  const down = useDerivedValue(() => Easing.in(Easing.cubic)(interpolate(m.get(), S.approach, [0, 1], CLAMP)));
  const up = useDerivedValue(() => Easing.inOut(Easing.quad)(interpolate(m.get(), [S.press, S.lift], [0, 1], CLAMP)));
  const stamp = useAnimatedStyle(() => {
    const away = 1 - down.get() + up.get() * 0.9;
    const pressed = m.get() >= S.approach[1] && m.get() < S.press ? 0.97 : 1;
    return {
      opacity: interpolate(m.get(), [S.approach[0], S.approach[0] + 0.08, S.press + (S.lift - S.press) * 0.55, S.lift], [0, 1, 1, 0], CLAMP),
      transform: [
        { translateX: S.from.x * q * away },
        { translateY: S.from.y * q * away },
        { rotate: `${S.from.turn * away}deg` },
        { scale: (1 + (S.from.scale - 1) * away) * pressed },
      ],
    };
  });
  // Its shadow gathers under it as it nears the file.
  const shadow = useAnimatedStyle(() => {
    const near = Math.max(0, down.get() - up.get());
    return { opacity: 0.6 * near, transform: [{ scale: 1.5 - 0.5 * near }] };
  });
  const left = useAnimatedStyle(() => ({ opacity: m.get() >= S.approach[1] ? 1 : 0 }));
  // The file takes the blow.
  const jolt = useAnimatedStyle(() => {
    const hit = interpolate(m.get(), [S.approach[1], S.approach[1] + 0.03, S.approach[1] + 0.12], [0, 1, 0], CLAMP);
    return { transform: [{ translateY: 2.5 * q * hit }, { scale: 1 - 0.012 * hit }, { rotate: `${-0.5 * hit}deg` }] };
  });
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.ground }]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="crimeLamp" cx="46%" cy="40%" rx="85%" ry="52%" fx="46%" fy="40%">
            <Stop offset={0} stopColor={theme.glow} stopOpacity={0.2} />
            <Stop offset={1} stopColor={theme.glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#crimeLamp)" />
      </Svg>
      <Animated.View style={[styles.part, { left: fl, top: ft, width: fw, height: fh }, jolt]}>
        <Image source={ART.file} style={{ width: fw, height: fh }} {...SHOWN} />
        <Animated.View style={[styles.part, { left: at.x - iw / 2, top: at.y - ih / 2, width: iw, height: ih, transform: [{ rotate: `${S.impression.turn}deg` }] }, left]} testID="v2-ending-impression">
          <Image source={ART.impression} style={{ width: iw, height: ih }} {...SHOWN} />
        </Animated.View>
        <Animated.View style={[styles.part, { left: at.x - iw * 0.6, top: at.y - ih * 0.6, width: iw * 1.2, height: ih * 1.2 }, shadow]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
            <Defs>
              <RadialGradient id="stampShade" cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset={0} stopColor={BLACK} stopOpacity={0.75} />
                <Stop offset={0.6} stopColor={BLACK} stopOpacity={0.35} />
                <Stop offset={1} stopColor={BLACK} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx={50} cy={20} rx={50} ry={20} fill="url(#stampShade)" />
          </Svg>
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.part, { left: fl + at.x - sw * S.stamp.foot.x, top: ft + at.y - sh * S.stamp.foot.y, width: sw, height: sh }, stamp]}>
        <Image source={ART.stamp} style={{ width: sw, height: sh }} {...SHOWN} />
      </Animated.View>
    </View>
  );
}

/** Paranormal: the candle gutters and goes out; a wisp of smoke; the room's own light is what's left. */
function Snuffed({ m, width, height, ms }: MomentProps) {
  const P = MOMENT.paranormal;
  const theme = themeFor("paranormal");
  const q = Math.min(width / 390, height / 844);
  const cw = P.candle.w * q, ch = P.candle.h * q;
  const wick = { x: width / 2, y: height * 0.47 - ch * (0.5 - P.candle.wick.y) };
  const cl = wick.x - cw * P.candle.wick.x, ct = wick.y - ch * P.candle.wick.y;
  const fw = P.flame.w * q, fh = P.flame.h * q;
  // Which frame of the flame: it idles on the first few, then gutters through the rest, then there is none.
  const frame = useDerivedValue(() => {
    const v = m.get();
    if (v < P.gutter[0]) return Math.floor((v * ms * P.flame.fps) / 1000) % P.flame.idle;
    if (v >= P.gutter[1]) return -1;
    return Math.min(P.flame.frames - 1, P.flame.idle + Math.floor(((v - P.gutter[0]) / (P.gutter[1] - P.gutter[0])) * (P.flame.frames - P.flame.idle)));
  });
  const strip = useAnimatedStyle(() => ({ opacity: frame.get() < 0 ? 0 : 1, transform: [{ translateX: -Math.max(0, frame.get()) * fw }] }));
  const burning = useAnimatedStyle(() => ({ opacity: frame.get() < 0 ? 0 : Math.min(1, P.light[frame.get()] * 1.4) }));
  const halo = useAnimatedStyle(() => ({ opacity: frame.get() < 0 ? 0 : P.light[frame.get()] }));
  // The smoke: drawn up off the wick, its foot letting go, thinning as it rises.
  const end = useDerivedValue(() => Easing.out(Easing.quad)(interpolate(m.get(), P.smoke, [0, 1], CLAMP)));
  const start = useDerivedValue(() => interpolate(m.get(), [P.smoke[0] + 0.2, 1], [0, 0.4], CLAMP));
  const fade = useDerivedValue(() => interpolate(m.get(), [P.smoke[0], P.smoke[0] + 0.06, 0.92, 1], [0, 1, 0.8, 0.45], CLAMP));
  const sx = 70 * q, s = q;
  const wisp = (dx: number, k: number) =>
    `M${sx + dx} ${190 * s} C${sx - 7 * k * s + dx} ${166 * s} ${sx + 11 * k * s + dx} ${148 * s} ${sx + 2 * s + dx} ${126 * s} C${sx - 12 * k * s + dx} ${96 * s} ${sx + 18 * k * s + dx} ${80 * s} ${sx + 7 * s + dx} ${52 * s} C${sx - 2 * k * s + dx} ${32 * s} ${sx + 14 * k * s + dx} ${20 * s} ${sx + 9 * s + dx} ${4 * s}`;
  const smoke = alpha(mix(theme.glow, LIGHT.white, 0.6), 0.62);
  const R = 190 * q;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: mix(theme.ground, BLACK, 0.25) }]}>
      <Animated.View style={[styles.part, { left: wick.x - R, top: wick.y - 24 * q - R, width: 2 * R, height: 2 * R }, halo]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="candleHalo" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset={0} stopColor={CANDLE} stopOpacity={0.5} />
              <Stop offset={0.35} stopColor={CANDLE} stopOpacity={0.18} />
              <Stop offset={1} stopColor={CANDLE} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#candleHalo)" />
        </Svg>
      </Animated.View>
      <Image source={ART.candleOut} style={[styles.part, { left: cl, top: ct, width: cw, height: ch }]} {...SHOWN} />
      <Animated.View style={[styles.part, { left: cl, top: ct, width: cw, height: ch }, burning]}>
        <Image source={ART.candleLit} style={{ width: cw, height: ch }} {...SHOWN} />
      </Animated.View>
      <View style={[styles.part, styles.clip, { left: wick.x - fw / 2, top: wick.y - fh * P.flame.foot, width: fw, height: fh }]}>
        <Animated.View style={[{ width: fw * P.flame.frames, height: fh }, strip]}>
          <Image source={ART.flame} style={{ width: fw * P.flame.frames, height: fh }} {...SHOWN} />
        </Animated.View>
      </View>
      {/* (one style object: on the web a canvas takes no list of them) */}
      <Canvas style={{ position: "absolute", left: wick.x - sx, top: wick.y - 192 * s, width: 2 * sx, height: 196 * s }} pointerEvents="none">
        <Path path={wisp(0, 1)} style="stroke" strokeWidth={6.5 * s} strokeCap="round" color={smoke} start={start} end={end} opacity={fade}>
          <BlurMask blur={3.5 * s} style="normal" />
        </Path>
        <Path path={wisp(3 * s, -0.7)} style="stroke" strokeWidth={3 * s} strokeCap="round" color={smoke} start={start} end={end} opacity={fade}>
          <BlurMask blur={1.6 * s} style="normal" />
        </Path>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  part: { position: "absolute" },
  hinge: { transformOrigin: "0% 50%" },
});
