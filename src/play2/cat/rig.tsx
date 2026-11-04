// The peeking cat's puppet parts, over its art (assets/characters/cat_peek.png):
//   - its paws cut out of the art, each on a forearm of fur that reaches down
//     behind the ledge, so it can lift one to swat, lick it, or wash behind an
//     ear (only while it does: at rest the art is drawn whole),
//   - a mouth that opens for a yawn, a tongue for a lick, a blush,
//   - and a tail that rises behind the ledge for the butt wiggle.
// All of it reads the cat's stop-motion frame (cat/frame.ts), so it moves at
// 12 fps with the rest of it, inside the body's own transform (it follows the
// head as it turns and bobs).
import { Image, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import Svg, { Ellipse, Path } from "react-native-svg";
import { F } from "./frame";

/** The art's size (px). */
export const ART_W = 560;
export const ART_H = 585;
/** The fur (the art's, measured). */
const FUR = "#0B0806";

/**
 * The paws as cut out of the art (art px): the box, and the wrist (where it
 * turns, on the ledge). The body is the art less them, in two pieces (above
 * the paws, and between them); `seam` is where those meet. The forearm is
 * `arm` px across. `chest`: fur behind the paws, so a paw lifted never leaves
 * a notch in its chest.
 */
export const PAWS_CUT = {
  seam: 528,
  left: { x0: 0, x1: 206, wrist: { x: 140, y: 585 } },
  right: { x0: 436, x1: 560, wrist: { x: 497, y: 585 } },
  arm: 78,
  chest: { x0: 188, x1: 454, y0: 532 },
} as const;
/** Its mouth (under its nose) and its cheeks (under its eyes), art px. */
const MOUTH = { x: 289, y: 396, w: 84, h: 72 };
const CHEEKS = [{ x: 176, y: 394 }, { x: 404, y: 392 }] as const;

/** A piece of the art: its box (art px) cut out, in place. */
function Piece({ art, k, x0, y0, x1, y1, width, height }: { art: number; k: number; x0: number; y0: number; x1: number; y1: number; width: number; height: number }) {
  return (
    <View style={[styles.piece, { left: x0 * k, top: y0 * k, width: (x1 - x0) * k, height: (y1 - y0) * k }]}>
      <Image source={art} style={{ position: "absolute", left: -x0 * k, top: -y0 * k, width, height }} resizeMode="contain" />
    </View>
  );
}

/** A paw on its forearm, lifted, moved and turned (at its wrist) by the frame. */
function Paw({ art, side, width, height, f }: { art: number; side: "left" | "right"; width: number; height: number; f: SharedValue<number[]> }) {
  const k = width / ART_W;
  const cut = PAWS_CUT[side];
  const [iy, ix, ir] = side === "left" ? [F.pawLY, F.pawLX, F.pawLR] : [F.pawRY, F.pawRX, F.pawRR];
  const y0 = PAWS_CUT.seam;
  const w = (cut.x1 - cut.x0) * k, h = (ART_H - y0) * k;
  const ox = ((cut.wrist.x - cut.x0) / (cut.x1 - cut.x0)) * 100, oy = ((cut.wrist.y - y0) / (ART_H - y0)) * 100;
  const style = useAnimatedStyle(() => {
    const v = f.get();
    return { transform: [{ translateX: v[ix] * k }, { translateY: -v[iy] * k }, { rotate: `${v[ir]}deg` }] };
  });
  const arm = PAWS_CUT.arm * k;
  return (
    <Animated.View style={[styles.piece, { left: cut.x0 * k, top: y0 * k, width: w, height: h, overflow: "visible", transformOrigin: `${ox}% ${oy}%` }, style]}>
      {/* The forearm, down from under the paw to behind the ledge. */}
      <View style={[styles.arm, { left: (cut.wrist.x - cut.x0) * k - arm / 2, top: h * 0.45, width: arm, height: height * 1.2, borderRadius: arm / 2 }]} />
      <Piece art={art} k={k} x0={cut.x0} y0={y0} x1={cut.x1} y1={ART_H} width={width} height={height} />
    </Animated.View>
  );
}

/**
 * The cat's art: whole, or (`rigged`, while it uses a paw) cut into its body
 * and its two paws, each paw on a forearm the frame moves. Rigged at rest it
 * looks the same as whole.
 */
export function PeekArt({ art, width, height, f, rigged }: { art: number; width: number; height: number; f: SharedValue<number[]>; rigged: boolean }) {
  if (!rigged) return <Image source={art} style={{ position: "absolute", left: 0, top: 0, width, height }} resizeMode="contain" />;
  const k = width / ART_W;
  const c = PAWS_CUT.chest;
  return (
    <>
      <View style={[styles.arm, { left: c.x0 * k, top: c.y0 * k, width: (c.x1 - c.x0) * k, height: (ART_H - c.y0) * k + height * 0.3, borderRadius: 6 * k }]} />
      <Piece art={art} k={k} x0={0} y0={0} x1={ART_W} y1={PAWS_CUT.seam + 2} width={width} height={height} />
      <Piece art={art} k={k} x0={PAWS_CUT.left.x1} y0={PAWS_CUT.seam} x1={PAWS_CUT.right.x0} y1={ART_H} width={width} height={height} />
    </>
  );
}

/** Its paws (rigged only), drawn over its face: a paw lifted to its mouth or its ear is in front. */
export function PeekPaws({ art, width, height, f }: { art: number; width: number; height: number; f: SharedValue<number[]> }) {
  return (
    <>
      <Paw art={art} side="left" width={width} height={height} f={f} />
      <Paw art={art} side="right" width={width} height={height} f={f} />
    </>
  );
}

/**
 * Its mouth: under its nose, opening for a yawn (a dark mouth, a pink tongue
 * curled in it), and the tip of its tongue out for a lick. Its cheeks blush
 * (`sweet`) when it's embarrassed.
 */
export function Face({ width, f, sweet }: { width: number; f: SharedValue<number[]>; sweet: string }) {
  const k = width / ART_W;
  const mw = MOUTH.w * k, mh = MOUTH.h * k;
  const mouth = useAnimatedStyle(() => {
    const m = f.get()[F.mouth];
    return { opacity: m > 0.04 ? 1 : 0, transform: [{ translateY: -mh / 2 }, { scaleY: Math.max(0.05, m) }, { translateY: mh / 2 }] };
  });
  const tw = 34 * k, th = 30 * k;
  const tongue = useAnimatedStyle(() => {
    const t = f.get()[F.tongue];
    return { opacity: t > 0.1 ? 1 : 0, transform: [{ translateY: -th / 2 }, { scaleY: Math.max(0.1, t) }, { translateY: th / 2 }] };
  });
  const blush = useAnimatedStyle(() => ({ opacity: f.get()[F.blush] * 0.8 }));
  const bw = 74 * k, bh = 26 * k;
  return (
    <>
      {CHEEKS.map((c, i) => (
        <Animated.View key={i} pointerEvents="none" style={[styles.piece, { left: c.x * k - bw / 2, top: c.y * k - bh / 2, width: bw, height: bh }, blush]}>
          <Svg width={bw} height={bh} viewBox="0 0 74 26">
            <Ellipse cx={37} cy={13} rx={34} ry={11} fill={sweet} opacity={0.55} />
            {/* Three little strokes of blush, in its ink's hand. */}
            <Path d="M16 19 L24 7 M33 19 L41 7 M50 19 L58 7" stroke={sweet} strokeWidth={5} strokeLinecap="round" />
          </Svg>
        </Animated.View>
      ))}
      <Animated.View pointerEvents="none" style={[styles.piece, { left: MOUTH.x * k - mw / 2, top: MOUTH.y * k - mh * 0.2, width: mw, height: mh }, mouth]} testID="cat-mouth">
        <Svg width={mw} height={mh} viewBox="0 0 84 72">
          <Path d="M8 10 C10 2 74 2 76 10 C80 40 62 70 42 70 C22 70 4 40 8 10 Z" fill="#5E1A2C" stroke={FUR} strokeWidth={5} />
          <Path d="M20 52 C26 38 58 38 64 52 C58 66 26 66 20 52 Z" fill="#E98AA2" />
          {/* Two little fangs. */}
          <Path d="M22 10 L27 22 L31 10 Z M53 10 L57 22 L62 10 Z" fill="#FFF4EE" />
        </Svg>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.piece, { left: MOUTH.x * k - tw / 2, top: MOUTH.y * k - th * 0.1, width: tw, height: th }, tongue]} testID="cat-tongue">
        <Svg width={tw} height={th} viewBox="0 0 34 30">
          <Path d="M3 2 C3 20 9 28 17 28 C25 28 31 20 31 2 Z" fill="#E98AA2" stroke={FUR} strokeWidth={3} />
          <Path d="M17 6 L17 18" stroke="#C2607A" strokeWidth={2.5} strokeLinecap="round" />
        </Svg>
      </Animated.View>
    </>
  );
}

/**
 * Its tail, behind the ledge beside it: it rises for the butt wiggle (the
 * frame's `tail`), its tip swishing with the wiggle, and sinks back after.
 * `left`, `bottom`: its base, in the ledge's clip (points).
 */
export function HuntTail({ width, height, f, left }: { width: number; height: number; f: SharedValue<number[]>; left: number }) {
  const tw = width * 0.42, th = height * 0.95;
  const style = useAnimatedStyle(() => {
    const v = f.get();
    const up = Math.max(0, Math.min(1, v[F.tail]));
    const swish = Math.sin(v[F.wclock] * Math.PI * 2 + 1.2) * v[F.wiggle];
    return {
      opacity: up > 0.02 ? 1 : 0,
      transform: [{ translateY: (1 - up) * th * 1.02 }, { rotate: `${swish * 12 + (1 - up) * 10}deg` }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.tail, { left, width: tw, height: th }, style]} testID="cat-tail">
      <Svg width={tw} height={th} viewBox="0 0 42 100">
        {/* Up from behind the ledge and over into a hook at the tip, gone over twice like its ink. */}
        <Path d="M12 104 C10 76 6 58 13 40 C19 24 30 16 34 9 C37 4 31 1 27 5" stroke={FUR} strokeWidth={10} strokeLinecap="round" fill="none" />
        <Path d="M10 88 C9 70 8 56 14 42 C19 30 27 20 31 12" stroke="#3A2C3C" strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.8} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  piece: { position: "absolute", overflow: "hidden" },
  arm: { position: "absolute", backgroundColor: FUR },
  tail: { position: "absolute", bottom: 0, transformOrigin: "30% 100%" },
});
