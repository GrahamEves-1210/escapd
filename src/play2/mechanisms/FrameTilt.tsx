// FrameTilt: push the frame askew on its nail, either way. The moment it gives
// (GIVE_AT) it's tilted: onSet("tilted", true), the finger still on it. The
// unfaded patch of wall shows behind it, and whatever was tucked behind it is
// there all along, slipping out from under its bottom edge as it swings, never
// popping in at the end.
//
// Drawn as the picture on the wall: a gilt moulded frame round a small dark
// landscape, hung by its wire from a brass nail on papered wall; where it has
// hung the paper is fresher, a line of dust along where its edges were.
import { memo, useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, { interpolate, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { mix } from "@/theme/payoff";
import { ref } from "@/theme/tokens";
import { GIVE_AT, Line, STAGE, Stage, activatable, tryKey, usePull } from "./kit";
import { BRASS, ENAMEL, INK, Ink, Fade, inkRect, rng, useGradId, useMaterials, type Materials } from "./materials";
import type { MechanismProps } from "./types";

const MAX_DEG = 17;
const FRAME_H = 116;
/** The nail's height in the stage, and the wire's drop from it to the frame's top. */
const NAIL_Y = 12;
const WIRE = 16;
const FRAME_TOP = NAIL_Y + WIRE;
/** What's tucked behind it: its height, and how far it slips down as the frame swings. */
const TUCKED_H = 56;
const SLIP = 56;
/** The moulding's width. */
const MOULD = 13;

export function FrameTilt({ target, state, onSet, busy, width, inside }: MechanismProps) {
  const theme = useModeTheme();
  const mat = useMaterials();
  const feedback = useFeedback();
  const tilted = state.tilted === true;
  const onCommit = useCallback(() => {
    feedback.thud();
    onSet("tilted", true);
  }, [feedback, onSet]);
  // Put back: shut, laid down, straightened. The room keeps what was found.
  const onUncommit = useCallback(() => {
    feedback.tick();
    onSet("tilted", false);
  }, [feedback, onSet]);
  const { progress, gesture, commitNow, reach } = usePull({ axis: "x", range: 110, done: tilted, busy, onCommit, onUncommit, land: tryKey(target), giveAt: GIVE_AT });

  const w = Math.min(width - 2 * ref.space.xxl, 180);
  // Turn about the nail: the frame hangs from it by its wire.
  const pivot = FRAME_H / 2 + WIRE;
  const frameStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -pivot }, { rotate: `${-progress.get() * MAX_DEG}deg` }, { translateY: pivot }],
  }));
  const patchStyle = useAnimatedStyle(() => ({ opacity: interpolate(Math.abs(progress.get()), [0, 0.6], [0, 1], "clamp") }));
  // Tucked behind its bottom edge, it slips down as the frame swings (a little askew the way the frame went).
  const tuckedStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return { transform: [{ translateY: Math.abs(p) * SLIP }, { rotate: `${-p * 6}deg` }] };
  });

  const left = (width - w) / 2;
  return (
    <Stage width={width}>
      <View style={[styles.wall, { height: STAGE }]}>
        {/* The papered wall, lost in the dark at its edges. */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Wallpaper w={width} h={STAGE} mat={mat} />
        </View>
        {/* Where it hung: fresher paper, a line of dust where its edges were. */}
        <Animated.View style={[styles.patch, { left, width: w, height: FRAME_H }, patchStyle]} pointerEvents="none">
          <Hung w={w} h={FRAME_H} fresh={mat.wall.faded} dust={theme.inkMuted} />
        </Animated.View>
        {inside ? (
          <Animated.View
            style={[styles.tucked, { top: FRAME_TOP + FRAME_H - TUCKED_H - ref.space.sm }, tuckedStyle]}
            pointerEvents={reach ? "box-none" : "none"}
            testID="mech-inside"
          >
            {inside}
          </Animated.View>
        ) : null}
        <GestureDetector gesture={gesture}>
          <Animated.View
            {...activatable(tilted ? `${target.label}, askew` : `Tilt the ${target.label}`, "Looks behind it", tilted ? onUncommit : commitNow, busy)}
            testID="mech-frame"
            style={[styles.frame, { left, width: w, height: FRAME_H }, frameStyle]}
          >
            {/* Its wire, up to the nail. */}
            <View style={[styles.wire, { width: w }]} pointerEvents="none"><Wire w={w} /></View>
            <Picture w={w} h={FRAME_H} mat={mat} />
          </Animated.View>
        </GestureDetector>
        <View style={[styles.nail, { left: width / 2 - 5 }]} pointerEvents="none"><Nail /></View>
      </View>
      <Line text={tilted ? "Askew" : "Push it to one side"} />
    </Stage>
  );
}

/** Wallpaper: a stripe and a small sprig between the stripes, in the wall's own colour a shade up. */
const Wallpaper = memo(function Wallpaper({ w, h, mat }: { w: number; h: number; mat: Materials }) {
  const art = useMemo(() => {
    let stripes = "", sprigs = "";
    for (let x = 14; x < w; x += 34) {
      stripes += `M${x} 0V${h}M${x + 4} 0V${h}`;
      for (let y = 18 + ((x / 34) % 2) * 17; y < h; y += 34) {
        const cx = x + 19;
        sprigs += `M${cx} ${y + 6}V${y - 4}M${cx} ${y}q-5 -2 -5 -6q4 1 5 6q1 -5 5 -6q0 4 -5 6`;
      }
    }
    return { stripes, sprigs };
  }, [w, h]);
  return (
    <Svg width={w} height={h}>
      <Fade w={w} h={h} side={0.22} top={0.16} bottom={0.16}>
        <Rect width={w} height={h} fill={mat.wall.base} />
        <Path d={art.stripes} stroke={mat.wall.pattern} strokeWidth={1.2} strokeOpacity={0.8} />
        <Path d={art.sprigs} stroke={mat.wall.pattern} strokeWidth={1.1} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Fade>
    </Svg>
  );
});

/** The place it hung: paper the light never faded, and the dust that settled along the frame's edges. */
const Hung = memo(function Hung({ w, h, fresh, dust }: { w: number; h: number; fresh: string; dust: string }) {
  const d = useMemo(() => inkRect(2, 2, w - 4, h - 4, 2, 601, 0.9), [w, h]);
  return (
    <Svg width={w} height={h}>
      <Path d={d} fill={fresh} fillOpacity={0.75} />
      <Path d={d} fill="none" stroke={dust} strokeOpacity={0.55} strokeWidth={1.2} strokeDasharray="1 3.5" strokeLinecap="round" />
      <Path d={`M3 3H${w - 3}`} stroke={dust} strokeOpacity={0.5} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
});

/** The picture wire: two strands from the frame's back up to the nail. */
const Wire = memo(function Wire({ w }: { w: number }) {
  const d = `M${w * 0.24} ${WIRE + 1}L${w / 2} 1.5L${w * 0.76} ${WIRE + 1}`;
  return (
    <Svg width={w} height={WIRE + 2}>
      <Path d={d} stroke={INK} strokeWidth={2.4} fill="none" strokeLinejoin="round" />
      <Path d={d} stroke="#B9B2A6" strokeWidth={1} fill="none" strokeLinejoin="round" />
    </Svg>
  );
});

/** A brass nail's head. */
function Nail() {
  return (
    <Svg width={10} height={10} viewBox="0 0 10 10">
      <Circle cx={5.6} cy={6.2} r={3.6} fill="#000000" fillOpacity={0.4} />
      <Circle cx={5} cy={5} r={3.6} fill={BRASS.mid} stroke={INK} strokeWidth={1.2} />
      <Circle cx={4} cy={3.9} r={1.3} fill={BRASS.sheen} />
    </Svg>
  );
}

/** The picture: a gilt frame (a bead, a hollow, a slip, its mitres), and in it a small night landscape under varnish. */
const Picture = memo(function Picture({ w, h, mat }: { w: number; h: number; mat: Materials }) {
  const g = useGradId();
  const [gilt, sky, sheen, moon] = [g("g"), g("s"), g("v"), g("m")];
  const m = MOULD;
  const art = useMemo(() => {
    const rnd = rng(641);
    const iw = w - 2 * m, ih = h - 2 * m;
    const hill = (base: number, amp: number) => {
      let d = `M${m} ${m + ih}V${m + base}`;
      for (let x = 0; x <= iw; x += iw / 6) d += `L${(m + x).toFixed(1)} ${(m + base - Math.sin((x / iw) * Math.PI * (1 + rnd())) * amp - rnd() * 4).toFixed(1)}`;
      return `${d}V${m + ih}Z`;
    };
    let stars = "";
    for (let i = 0; i < 9; i++) stars += `M${(m + 6 + rnd() * (iw - 12)).toFixed(1)} ${(m + 5 + rnd() * ih * 0.4).toFixed(1)}h0.01`;
    return {
      far: hill(ih * 0.62, 10), near: hill(ih * 0.8, 7), stars,
      outer: inkRect(1, 1, w - 2, h - 2, 3, 643, 0.5), inner: inkRect(m, m, iw, ih, 1.5, 647, 0.4),
      mitres: `M2 2L${m} ${m}M${w - 2} 2L${w - m} ${m}M2 ${h - 2}L${m} ${h - m}M${w - 2} ${h - 2}L${w - m} ${h - m}`,
    };
  }, [w, h, m]);
  const night = mix(mat.felt.deep, "#0B1024", 0.4);
  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id={gilt.id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={BRASS.sheen} />
          <Stop offset="0.25" stopColor={BRASS.light} />
          <Stop offset="0.55" stopColor={BRASS.mid} />
          <Stop offset="1" stopColor={BRASS.deep} />
        </LinearGradient>
        <LinearGradient id={sky.id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={night} />
          <Stop offset="1" stopColor={mix(mat.cloth.mid, night, 0.35)} />
        </LinearGradient>
        <LinearGradient id={sheen.id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0.2" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="0.36" stopColor="#FFFFFF" stopOpacity={0.14} />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
        <RadialGradient id={moon.id} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={ENAMEL.light} stopOpacity={0.55} />
          <Stop offset="1" stopColor={ENAMEL.light} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {/* Its shadow on the wall is the stage's; the moulding, then the canvas. */}
      <Rect x={1} y={1} width={w - 2} height={h - 2} rx={3} fill={gilt.url} />
      <Rect x={4.5} y={4.5} width={w - 9} height={h - 9} rx={1.5} fill="none" stroke={BRASS.deep} strokeOpacity={0.75} strokeWidth={2.2} />
      <Rect x={7.4} y={7.4} width={w - 14.8} height={h - 14.8} rx={1} fill="none" stroke={BRASS.sheen} strokeOpacity={0.8} strokeWidth={1.2} />
      <Path d={art.mitres} stroke={BRASS.deep} strokeOpacity={0.8} strokeWidth={1} />
      <Rect x={m} y={m} width={w - 2 * m} height={h - 2 * m} fill={sky.url} />
      <Circle cx={w * 0.68} cy={m + (h - 2 * m) * 0.3} r={15} fill={moon.url} />
      <Circle cx={w * 0.68} cy={m + (h - 2 * m) * 0.3} r={5.5} fill={ENAMEL.light} />
      <Path d={art.stars} stroke={ENAMEL.light} strokeOpacity={0.8} strokeWidth={1.3} strokeLinecap="round" />
      <Path d={art.far} fill={mix(mat.cloth.deep, night, 0.3)} />
      <Path d={art.near} fill={mix(night, "#000000", 0.45)} />
      <Rect x={m} y={m} width={w - 2 * m} height={h - 2 * m} fill={sheen.url} />
      {/* The slip's shadow on the canvas, and the pen. */}
      <Path d={`M${m} ${h - m}V${m}H${w - m}`} stroke="#000000" strokeOpacity={0.5} strokeWidth={2.4} fill="none" />
      <Ink d={art.inner} w={1.4} />
      <Ink d={art.outer} w={2} />
    </Svg>
  );
});

const styles = StyleSheet.create({
  wall: { alignSelf: "stretch" },
  patch: { position: "absolute", top: FRAME_TOP },
  tucked: { position: "absolute", left: 0, right: 0, height: TUCKED_H, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: ref.space.lg },
  frame: { position: "absolute", top: FRAME_TOP },
  wire: { position: "absolute", left: 0, top: -WIRE - 1 },
  nail: { position: "absolute", top: NAIL_Y - 5 },
});
