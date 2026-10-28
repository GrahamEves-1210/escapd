// The payoff's made-by-hand pieces (docs/ART_DIRECTION.md, "velvet & ink"
// and its mystery-book core): case closed's last page, the way out and the
// build wait share them. A polaroid (warm cream paper, the photo, a
// handwritten caption, washi tape or scrapbook photo corners), a gold-foil
// seal pressed on (the stamp's word in dark ink on foil), a fleuron rule, a
// library's date stamp, a little burst of confetti and sparkles on arrival,
// twinkles that breathe, and a few drawn marks (a clock, a whisper, a cross,
// a moon) in the same pen.
//
// Colours are the mode's theme (glow, sweet, foil, the hand face) and the
// payoff's paper things (src/theme/payoff.ts): warm cream book paper with
// its own inks (PAGE), each mode's stamp ink deepened to read on it
// (PAGE_INK), the seal's gold (SEAL).
//
// Everything that moves runs on the UI thread (opacity and transforms) and is
// still under reduced motion.
import { useEffect, type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import type { Genre } from "@/lib/puzzle-types";
import { TreatedImage } from "@/components/noir";
import { ModeCover } from "@/screens/hub/art/ModeCover";
import { LIGHT, PAGE, PAGE_INK, PAYOFF_TYPE, SEAL, handType } from "@/theme/payoff";
import type { ModeTheme } from "@/theme/tokens";
import { ref } from "@/theme/tokens";
import type { SceneSource } from "./SceneView";
import { useSlam } from "./slam";

export { PAGE, PAGE_INK, SEAL, alpha, handType, mix } from "@/theme/payoff";

// ---------------------------------------------------------------------------
// The look
// ---------------------------------------------------------------------------

export interface PayoffLook {
  glow: string;
  sweet: string;
  foil: string;
  /** The polaroid's paper, its ink and its quieter ink. */
  paper: string;
  paperInk: string;
  paperMuted: string;
  /** The mode's stamp ink on the page. */
  pageInk: string;
}

export function look(theme: ModeTheme, genre: Genre): PayoffLook {
  return {
    glow: theme.glow,
    sweet: theme.sweet,
    foil: theme.foil,
    paper: PAGE.paper,
    paperInk: PAGE.ink,
    paperMuted: PAGE.muted,
    pageInk: PAGE_INK[genre],
  };
}

// ---------------------------------------------------------------------------
// Polaroid and washi tape
// ---------------------------------------------------------------------------

export const POLAROID = {
  /** The paper round the photo, and its deeper foot for the caption. */
  frame: 8,
  foot: 46,
  radius: 4,
} as const;

/** A strip of washi tape: a translucent band with torn (zigzag) ends. */
export function Washi({ color, width, height = 20, tilt = -4, style }: {
  color: string;
  width: number;
  height?: number;
  tilt?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const z = 3;
  const steps = Math.max(3, Math.round(height / 5));
  const tooth = height / steps;
  let d = `M${z} 0 H${width - z}`;
  for (let i = 0; i < steps; i++) d += ` L${width - (i % 2 ? z : 0)} ${tooth * (i + 0.5)} L${width - z} ${tooth * (i + 1)}`;
  d += ` H${z}`;
  for (let i = steps; i > 0; i--) d += ` L${i % 2 ? 0 : z} ${tooth * (i - 0.5)} L${z} ${tooth * (i - 1)}`;
  d += " Z";
  return (
    <View pointerEvents="none" style={[{ width, height, transform: [{ rotate: `${tilt}deg` }] }, style]}>
      <Svg width={width} height={height}>
        <Path d={d} fill={color} fillOpacity={0.78} />
        <Path d={`M${z + 2} ${height * 0.3} H${width - z - 2}`} stroke={LIGHT.white} strokeOpacity={0.22} strokeWidth={1.5} strokeDasharray="2 5" />
      </Svg>
    </View>
  );
}

/**
 * A polaroid: the photo (the mode's look, or the room back in its own
 * colours with `original`), or the mode's drawn cover when there is no photo,
 * in cream paper with a handwritten caption in its foot. Tilted `tilt`
 * degrees, a soft shadow coloured by `shade`.
 */
export function Polaroid({ width, photoHeight = width - POLAROID.frame * 2, source, cacheKey, genre, original, caption, captionSize = 24, lookOf, tilt = 0, shade, tape, corners, children, photoLabel, testID, photoTestID, captionTestID, style }: {
  width: number;
  photoHeight?: number;
  source?: SceneSource | null;
  cacheKey?: string;
  genre: Genre | null;
  original?: boolean;
  caption?: string;
  captionSize?: number;
  lookOf: Pick<PayoffLook, "paper" | "paperInk">;
  tilt?: number;
  shade?: string;
  /** Washi tape across the top, in this colour. */
  tape?: string;
  /** Scrapbook photo corners holding it to the page, in this colour. */
  corners?: string;
  /** Laid over the polaroid (stickers, a note). */
  children?: ReactNode;
  photoLabel?: string;
  testID?: string;
  photoTestID?: string;
  captionTestID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const photoW = width - POLAROID.frame * 2;
  const height = POLAROID.frame + photoHeight + (caption === undefined ? POLAROID.frame : POLAROID.foot);
  return (
    <View style={[{ width, height, transform: [{ rotate: `${tilt}deg` }] }, style]} testID={testID}>
      <View
        style={[
          styles.paper,
          { backgroundColor: lookOf.paper },
          shade ? { boxShadow: `0px 10px 24px ${shade}` } : null,
        ]}
      >
        <View
          style={[styles.photo, { width: photoW, height: photoHeight }]}
          accessible={!!photoLabel}
          accessibilityRole={photoLabel ? "image" : undefined}
          accessibilityLabel={photoLabel}
        >
          {source !== undefined && source !== null ? (
            <TreatedImage
              source={source}
              cacheKey={cacheKey}
              genre={genre}
              original={original}
              style={StyleSheet.absoluteFill}
              testID={photoTestID}
            />
          ) : genre ? (
            <ModeCover genre={genre} style={StyleSheet.absoluteFill} testID={photoTestID ? `${photoTestID}-cover` : undefined} />
          ) : null}
          {/* The print's faint sheen. */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.sheen]} />
        </View>
        {caption !== undefined ? (
          <View style={styles.foot}>
            <Text
              style={[handType(captionSize, Math.round(captionSize * 1.08)), styles.caption, { color: lookOf.paperInk }]}
              numberOfLines={2}
              accessibilityRole="header"
              testID={captionTestID ?? (testID ? `${testID}-caption` : undefined)}
            >
              {caption}
            </Text>
          </View>
        ) : null}
      </View>
      {corners ? <PhotoCorners color={corners} /> : null}
      {tape ? <Washi color={tape} width={Math.round(width * 0.36)} style={styles.tape} /> : null}
      {children}
    </View>
  );
}

/**
 * A caption's size so the case's name fits the polaroid's foot: one line
 * when it can be at least `two` pt, else two lines (handwriting runs a little
 * under half an em a letter).
 */
export function captionSize(text: string, width: number, max = 26, min = ref.type.handSmall.fontSize, two = 19): number {
  const fit = (chars: number) => Math.floor((width - 16) / Math.max(1, chars * 0.46));
  const one = fit(text.length);
  if (one >= two) return Math.min(max, one);
  return Math.max(min, Math.min(two, fit(Math.ceil(text.length / 2) + 2)));
}

// ---------------------------------------------------------------------------
// The foil seal, the fleuron rule, the library stamp
// ---------------------------------------------------------------------------


/** A scalloped rosette's outline: `bumps` round a circle of radius `r` about (c, c). */
export function scallop(c: number, r: number, bumps: number, depth: number): string {
  const steps = bumps * 2;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r - depth : r;
    const x = c + Math.cos(a) * rr;
    const y = c + Math.sin(a) * rr;
    if (i === 0) d += `M${x.toFixed(2)} ${y.toFixed(2)}`;
    else {
      const am = ((i - 0.5) / steps) * Math.PI * 2 - Math.PI / 2;
      const rm = (i % 2 ? r : r - depth) + depth * 0.15;
      d += ` Q${(c + Math.cos(am) * rm).toFixed(2)} ${(c + Math.sin(am) * rm).toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
  }
  return `${d} Z`;
}

/**
 * A gold-foil seal pressed on (a book's award seal, a library's SOLVED): a
 * scalloped rosette in foil with a struck inner ring, the word in dark ink
 * pressed into it. With `slam` it comes down from above (slam.ts: falls,
 * overshoots, settles) after `delay` ms and `onLanded` runs on impact; under
 * reduced motion it fades in. The word is text (screen readers read it).
 */
export function FoilSeal({ text, foil, size = 96, fontSize = 15, tilt = 8, slam = true, delay = 0, reduced, onLanded, style, testID }: {
  text: string;
  foil: string;
  size?: number;
  fontSize?: number;
  tilt?: number;
  slam?: boolean;
  delay?: number;
  reduced: boolean;
  onLanded?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { body } = useSlam({ enabled: slam, delay, reducedMotion: reduced, onLanded });
  const c = size / 2;
  const id = `seal${size}`;
  return (
    <Animated.View style={[style, body]} testID={testID} pointerEvents="none">
      <View style={{ width: size, height: size, borderRadius: size / 2, transform: [{ rotate: `${tilt}deg` }], boxShadow: SEAL.shadow }} testID={testID ? `${testID}-face` : undefined}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset={0} stopColor={SEAL.light} />
              <Stop offset={0.45} stopColor={foil} />
              <Stop offset={0.7} stopColor={SEAL.light} stopOpacity={0.9} />
              <Stop offset={1} stopColor={SEAL.shade} />
            </LinearGradient>
          </Defs>
          <Path d={scallop(c, c - 1, 18, size * 0.045)} fill={`url(#${id}g)`} stroke={SEAL.shade} strokeWidth={1} />
          <Circle cx={c} cy={c} r={c * 0.74} fill="none" stroke={SEAL.ink} strokeOpacity={0.55} strokeWidth={1.2} />
          <Circle cx={c} cy={c} r={c * 0.68} fill="none" stroke={SEAL.ink} strokeOpacity={0.4} strokeWidth={0.8} strokeDasharray="1.5 2.5" />
          <SparkleAt x={c} y={c * 0.42} r={size * 0.045} color={SEAL.ink} />
          <SparkleAt x={c} y={c * 1.58} r={size * 0.045} color={SEAL.ink} />
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.sealWords, { padding: size * 0.2 }]}>
          <Text style={[styles.sealText, { fontSize, lineHeight: Math.round(fontSize * 1.08), color: SEAL.ink }]}>{text}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

/** An ornamental rule: a hairline, a fleuron, a hairline, in foil. */
export function FleuronRule({ color, width = 180, glyph = "❦", style }: { color: string; width?: number; glyph?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.rule, { width }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.ruleLine, { backgroundColor: color }]} />
      <Text style={[styles.fleuron, { color }]}>{glyph}</Text>
      <View style={[styles.ruleLine, { backgroundColor: color }]} />
    </View>
  );
}

/**
 * A library's date stamp, inked on the card: a rounded frame in the mode's
 * page ink, the word and the day in the typewriter face, a touch faded and
 * tilted as a real one lands.
 */
export function LibraryStamp({ text, ink, tilt = -4, style, testID }: { text: string; ink: string; tilt?: number; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View style={[styles.libStamp, { borderColor: ink, transform: [{ rotate: `${tilt}deg` }] }, style]} testID={testID}>
      <Text style={[styles.libText, { color: ink }]}>{text}</Text>
    </View>
  );
}

/** Scrapbook photo corners: four little dark paper triangles holding a photo's corners. */
export function PhotoCorners({ color, size = 18 }: { color: string; size?: number }) {
  const at = [
    { top: -3, left: -3, rotate: "0deg" },
    { top: -3, right: -3, rotate: "90deg" },
    { bottom: -3, right: -3, rotate: "180deg" },
    { bottom: -3, left: -3, rotate: "270deg" },
  ] as const;
  return (
    <>
      {at.map(({ rotate, ...pos }, i) => (
        <View key={i} pointerEvents="none" style={[styles.corner, pos, { width: size, height: size, transform: [{ rotate }] }]}>
          <Svg width={size} height={size}>
            <Path d={`M0 0 H${size} L0 ${size} Z`} fill={color} />
          </Svg>
        </View>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sparkles and confetti
// ---------------------------------------------------------------------------

/** A four-point sparkle, drawn. */
export function SparkleGlyph({ size, color }: { size: number; color: string }) {
  const c = size / 2;
  const w = size * 0.13;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Path d={`M${c} 0 Q${c + w} ${c - w} ${size} ${c} Q${c + w} ${c + w} ${c} ${size} Q${c - w} ${c + w} 0 ${c} Q${c - w} ${c - w} ${c} 0 Z`} fill={color} />
    </Svg>
  );
}

/** A little heart, drawn. */
export function HeartGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 21 C5 15.5 2 12.2 2 8.4 C2 5.4 4.3 3.2 7.1 3.2 C9.1 3.2 10.8 4.3 12 6 C13.2 4.3 14.9 3.2 16.9 3.2 C19.7 3.2 22 5.4 22 8.4 C22 12.2 19 15.5 12 21 Z" fill={color} />
    </Svg>
  );
}

/** A sparkle that breathes in and out (still under reduced motion). */
export function Twinkle({ size, color, delay = 0, reduced, style }: { size: number; color: string; delay?: number; reduced: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useSharedValue(reduced ? 0.75 : 0);
  useEffect(() => {
    if (reduced) return;
    t.set(withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), withTiming(0.25, { duration: 1300, easing: Easing.inOut(Easing.sin) })), -1, false)));
  }, [delay, reduced, t]);
  const s = useAnimatedStyle(() => ({ opacity: t.get(), transform: [{ scale: 0.7 + t.get() * 0.3 }, { rotate: `${t.get() * 20}deg` }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.twinkle, style, s]}>
      <SparkleGlyph size={size} color={color} />
    </Animated.View>
  );
}

type Bit = { angle: number; reach: number; size: number; spin: number; fall: number; kind: "spark" | "heart" | "dot" | "strip"; color: string };

/** The burst's pieces, laid out once from a seed so a burst is always the same pretty shape. */
export function confettiBits(colors: readonly string[], count = 18): Bit[] {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const kinds: Bit["kind"][] = ["spark", "heart", "dot", "strip", "spark", "dot"];
  return Array.from({ length: count }, (_, i) => ({
    angle: (i / count) * Math.PI * 2 + rnd() * 0.5,
    reach: 70 + rnd() * 80,
    size: 7 + rnd() * 7,
    spin: (rnd() - 0.5) * 540,
    fall: 30 + rnd() * 50,
    kind: kinds[i % kinds.length],
    color: colors[i % colors.length],
  }));
}

/**
 * Confetti and sparkles bursting out from a point (its parent's centre, or
 * `x`, `y` in it), falling a little as they fade: when `fire` changes from
 * 0. Nothing under reduced motion. Decorative.
 */
export function Confetti({ fire, colors, x, y, reduced, testID }: { fire: number; colors: readonly string[]; x?: number; y?: number; reduced: boolean; testID?: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!fire || reduced) return;
    t.set(0);
    t.set(withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) }));
  }, [fire, reduced, t]);
  if (!fire || reduced) return null;
  const bits = confettiBits(colors);
  return (
    <View
      pointerEvents="none"
      style={[styles.burst, x !== undefined && y !== undefined ? { left: x, top: y } : styles.burstCentre]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      {bits.map((b, i) => <Piece key={`${fire}-${i}`} t={t} bit={b} />)}
    </View>
  );
}

function Piece({ t, bit }: { t: SharedValue<number>; bit: Bit }) {
  const s = useAnimatedStyle(() => {
    const p = t.get();
    return {
      opacity: p < 0.08 ? p / 0.08 : p > 0.6 ? Math.max(0, (1 - p) / 0.4) : 1,
      transform: [
        { translateX: Math.cos(bit.angle) * bit.reach * p },
        { translateY: Math.sin(bit.angle) * bit.reach * p + bit.fall * p * p },
        { rotate: `${bit.spin * p}deg` },
        { scale: p < 0.15 ? 0.4 + (p / 0.15) * 0.6 : 1 },
      ],
    };
  });
  const sz = bit.size;
  return (
    <Animated.View style={[styles.piece, { marginLeft: -sz / 2, marginTop: -sz / 2 }, s]}>
      {bit.kind === "spark" ? (
        <SparkleGlyph size={sz * 1.4} color={bit.color} />
      ) : bit.kind === "heart" ? (
        <HeartGlyph size={sz * 1.2} color={bit.color} />
      ) : bit.kind === "dot" ? (
        <View style={{ width: sz * 0.7, height: sz * 0.7, borderRadius: sz, backgroundColor: bit.color }} />
      ) : (
        <View style={{ width: sz * 0.45, height: sz * 1.3, borderRadius: 2, backgroundColor: bit.color }} />
      )}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Drawn marks (the cat's pen: round caps, a little wobble)
// ---------------------------------------------------------------------------

/** A clock face, drawn. */
export function ClockMark({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3.2 C17 3 20.9 6.9 20.8 12.1 C20.7 17 16.9 20.8 12 20.8 C7 20.9 3.1 17 3.2 11.9 C3.3 7.1 7.1 3.3 12 3.2 Z" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 7.4 L12.1 12.2 L15.3 14.1" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** A whisper (a tip): a speech bubble with three little dots. */
export function TipMark({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4.2 5.6 C4.3 4.4 5.2 3.8 6.3 3.8 L17.8 3.7 C19 3.8 19.8 4.6 19.8 5.8 L19.9 13.6 C19.8 14.8 19 15.6 17.7 15.6 L11 15.7 L6.6 19.6 L7.1 15.6 L6.2 15.6 C5 15.5 4.2 14.7 4.2 13.5 Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Circle cx={8.6} cy={9.8} r={1.3} fill={color} />
      <Circle cx={12} cy={9.7} r={1.3} fill={color} />
      <Circle cx={15.4} cy={9.8} r={1.3} fill={color} />
    </Svg>
  );
}

/** A wrong call: a scribbled cross. */
export function CrossMark({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6.4 C9.5 9.6 13.6 13.9 18.2 18" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M17.8 5.8 C14.4 9.4 10.2 13.6 5.8 18.1" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

/** A crescent moon, drawn: filled when earned. */
export function MoonMark({ size, color, filled }: { size: number; color: string; filled: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M20.5 4.6 C14.2 5.2 9.4 10.5 9.6 16.9 C9.8 23.1 14.9 28 21.1 27.9 C23.4 27.9 25.5 27.2 27.3 26 C25.9 26.5 24.4 26.7 22.9 26.6 C16.9 26.1 12.6 21 13 15.1 C13.3 10.1 16.5 6.1 20.5 4.6 Z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        fill={filled ? color : "none"}
      />
      {filled ? <SparkleAt x={24} y={9} r={3.2} color={color} /> : null}
    </Svg>
  );
}

function SparkleAt({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  const w = r * 0.26;
  return <Path d={`M${x} ${y - r} Q${x + w} ${y - w} ${x + r} ${y} Q${x + w} ${y + w} ${x} ${y + r} Q${x - w} ${y + w} ${x - r} ${y} Q${x - w} ${y - w} ${x} ${y - r} Z`} fill={color} />;
}

const styles = StyleSheet.create({
  paper: { flex: 1, borderRadius: POLAROID.radius, padding: POLAROID.frame, paddingBottom: 0 },
  photo: { overflow: "hidden", borderRadius: 2, backgroundColor: PAGE.photoBack },
  sheen: { backgroundColor: LIGHT.sheen },
  foot: { flex: 1, justifyContent: "center", paddingHorizontal: 4 },
  caption: { textAlign: "center" },
  tape: { position: "absolute", top: -9, alignSelf: "center" },
  sealWords: { alignItems: "center", justifyContent: "center" },
  sealText: { ...PAYOFF_TYPE.seal, textAlign: "center" },
  rule: { flexDirection: "row", alignItems: "center", alignSelf: "center", gap: 8 },
  ruleLine: { flex: 1, height: 1, opacity: 0.7 },
  fleuron: { fontSize: 16, lineHeight: 18 },
  libStamp: { borderWidth: 2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, opacity: 0.88, ...ref.curve },
  libText: PAYOFF_TYPE.library,
  corner: { position: "absolute" },
  twinkle: { position: "absolute" },
  burst: { position: "absolute", width: 0, height: 0 },
  burstCentre: { left: "50%", top: "50%" },
  piece: { position: "absolute", left: 0, top: 0 },
});
