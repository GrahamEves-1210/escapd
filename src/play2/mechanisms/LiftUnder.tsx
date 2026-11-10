// LiftUnder: lift the thing to see beneath it, drawn as what it is. A rug, a
// blanket or a cloth rolls back from its near edge: the roll follows the
// finger, pale woven underside out, fatter the more of it is rolled up, the
// boards it covered coming into view. A cushion, a book, a box or a pot lifts off the
// place it sat, its shadow thinning under it, a ring of dust where it was.
//
// The moment it gives (GIVE_AT) it's lifted: onSet("lifted", true), the finger
// still on it, so what was under it is there, uncovered from its near edge as
// it rises.
import { memo, useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, { interpolate, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useFeedback } from "@/game/feedback";
import { mix } from "@/theme/payoff";
import { ref } from "@/theme/tokens";
import { GIVE_AT, Line, STAGE, Stage, activatable, tryKey, usePull } from "./kit";
import { BRASS, Boards, CastShadow, INK, Ink, SoftShadow, Fade, inkRect, rng, useGradId, useMaterials, type Materials } from "./materials";
import type { MechanismProps } from "./types";

const RISE = 84;
/** The thing's height on the floor (a rug's depth, a cushion's). */
const H = 104;
/** How far a rug's roll travels over the pull (less than the finger: some of the rug stays lying beyond it). */
const PEEL = 64;
/** The roll at its fattest (it starts a third of that). */
const FLAP = 22;

type Kind = "rug" | "cushion" | "book" | "box" | "pot";
/** What it is, from what it's called: how it lifts and how it's drawn. */
export function liftKind(label: string): Kind {
  const l = label.toLowerCase();
  if (/rug|carpet|\bmat\b|blanket|throw|quilt|duvet|towel|cloth|curtain|sheet|drape/.test(l)) return "rug";
  if (/cushion|pillow/.test(l)) return "cushion";
  if (/book|magazine|journal|diary|album|ledger/.test(l)) return "book";
  if (/box|basket|crate|bag|bin|case|chest|trunk/.test(l)) return "box";
  return "pot";
}

export function LiftUnder({ target, state, onSet, busy, width, inside }: MechanismProps) {
  const mat = useMaterials();
  const feedback = useFeedback();
  const lifted = state.lifted === true;
  const kind = liftKind(target.label);
  const onCommit = useCallback(() => {
    feedback.cloth();
    onSet("lifted", true);
  }, [feedback, onSet]);
  // Put back: shut, laid down, straightened. The room keeps what was found.
  const onUncommit = useCallback(() => {
    feedback.tick();
    onSet("lifted", false);
  }, [feedback, onSet]);
  const { progress, gesture, commitNow, reach } = usePull({ axis: "up", range: RISE, done: lifted, busy, onCommit, onUncommit, land: tryKey(target), giveAt: GIVE_AT });

  const w = Math.min(width - 2 * ref.space.xl, 240);
  const peel = kind === "rug";
  // A rug: the part still lying flat is cut off at the fold (the window moves up, the rug in it stays put).
  const flatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -progress.get() * PEEL }] }));
  const stayStyle = useAnimatedStyle(() => ({ transform: [{ translateY: progress.get() * PEEL }] }));
  // The rolled part, underside out, sitting on the fold: it fattens as more is rolled into it.
  const flapStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return { opacity: interpolate(p, [0, 0.04], [0, 1], "clamp"), transform: [{ translateY: -p * PEEL }, { scaleY: 0.34 + 0.66 * Math.min(1, p * 1.2) }] };
  });
  // Anything else: up off the place it sat, tipping toward you a little; its shadow thins and spreads.
  const liftStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return { transform: [{ translateY: -p * RISE }, { rotate: `${p * -5}deg` }, { scale: 1 + p * 0.05 }] };
  });
  const shadowStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return { opacity: interpolate(p, [0, 1], [0.95, 0.35]), transform: [{ scaleX: 1 - p * 0.18 }, { scaleY: 1 - p * 0.3 }] };
  });
  // The place it was: the dust line and the cleaner patch show as it comes off.
  const placeStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [0, 0.3], [0, 1], "clamp") }));

  const floorW = Math.min(width, w + 96);
  const thingW = peel ? w : kind === "cushion" ? 168 : kind === "book" ? 150 : 124;
  const label = lifted ? `${target.label}, lifted` : `Lift the ${target.label}`;
  return (
    <Stage width={width}>
      <View style={[styles.room, { height: STAGE }]}>
        {/* What it lies on: the boards (a seat, for a cushion), fading into the dark round it. */}
        <View style={[styles.floor, { width: floorW }]} pointerEvents="none">
          {kind === "cushion" ? (
            <Seat w={floorW} h={FLOOR_H} tone={mat.cloth} />
          ) : (
            <Boards w={floorW} h={FLOOR_H} seed={71} tone={mat.floor} board={peel ? 30 : 46} fade={0.42} />
          )}
        </View>
        {/* Where it was: a paler patch the dust never reached, its edge a line of it. */}
        <Animated.View style={[styles.place, { width: thingW - (peel ? 12 : 30), height: peel ? H - 8 : 48, bottom: ref.space.lg + (peel ? 4 : 2) }, placeStyle]} pointerEvents="none">
          <Place w={thingW - (peel ? 12 : 30)} h={peel ? H - 8 : 48} round={!peel} light={mat.floor.sheen} />
        </Animated.View>
        {/* What was under it, there all along, uncovered as it rises; picked up once most of it shows. */}
        {inside ? <View style={[styles.lying, { width: w * 0.8 }]} pointerEvents={reach ? "box-none" : "none"} testID="mech-inside">{inside}</View> : null}
        {peel ? null : (
          <Animated.View style={[styles.shadow, { width: thingW, bottom: ref.space.lg - 12 }, shadowStyle]} pointerEvents="none">
            <SoftShadow w={thingW} h={46} color={mat.shadow} strength={0.9} />
          </Animated.View>
        )}
        <GestureDetector gesture={gesture}>
          {peel ? (
            <Animated.View {...activatable(label, "Looks underneath", lifted ? onUncommit : commitNow, busy)} testID="mech-lift" style={{ width: w, height: H }} pointerEvents="box-none">
              <Animated.View style={[styles.window, { width: w, height: H }, flatStyle]}>
                <Animated.View style={stayStyle}>
                  <Rug w={w} h={H} tone={mat.cloth} />
                </Animated.View>
              </Animated.View>
              <Animated.View style={[styles.flap, { width: w, height: FLAP, top: H - FLAP }, flapStyle]}>
                {/* The roll's shadow on the rug beyond it. */}
                <View style={styles.flapShadow} pointerEvents="none"><CastShadow w={w - 12} h={12} color={mat.shadow} strength={0.6} /></View>
                <RugUnder w={w} h={FLAP} tone={mat.cloth} />
              </Animated.View>
            </Animated.View>
          ) : (
            <Animated.View {...activatable(label, "Looks underneath", lifted ? onUncommit : commitNow, busy)} testID="mech-lift" style={[{ width: thingW, height: H }, liftStyle]}>
              {kind === "cushion" ? <Cushion w={thingW} h={H} tone={mat.cloth} /> : kind === "book" ? <Book w={thingW} h={H} mat={mat} /> : kind === "box" ? <Box w={thingW} h={H} mat={mat} /> : <Pot w={thingW} h={H} mat={mat} />}
            </Animated.View>
          )}
        </GestureDetector>
      </View>
      <Line text={lifted ? "Lifted" : peel ? "Peel it back" : "Lift it up"} />
    </Stage>
  );
}

const FLOOR_H = 156;

/** A sofa's seat from above: the same cloth a shade down, its weave, the seam where the seat meets the back. */
const Seat = memo(function Seat({ w, h, tone }: { w: number; h: number; tone: Materials["cloth"] }) {
  const weave = useMemo(() => {
    let d = "";
    for (let x = -h; x < w; x += 6) d += `M${x} ${h}L${x + h} 0`;
    return d;
  }, [w, h]);
  const seam = Math.round(h * 0.36);
  return (
    <Svg width={w} height={h}>
      <Fade w={w} h={h} top={0.3}>
        <Rect width={w} height={h} fill={mix(tone.deep, tone.mid, 0.3)} />
        <Path d={weave} stroke={tone.light} strokeOpacity={0.07} strokeWidth={1} />
        <Rect width={w} height={seam} fill="#000000" fillOpacity={0.28} />
        <Path d={`M0 ${seam}H${w}`} stroke={tone.deep} strokeWidth={3} />
        <Path d={`M0 ${seam + 2.5}H${w}`} stroke={tone.light} strokeOpacity={0.25} strokeWidth={1.2} />
      </Fade>
    </Svg>
  );
});

/** The place a thing sat: a paler patch, a line of dust round it. */
const Place = memo(function Place({ w, h, round, light }: { w: number; h: number; round: boolean; light: string }) {
  const d = useMemo(() => inkRect(2, 2, w - 4, h - 4, round ? h / 2 : 5, 97, 1.2), [w, h, round]);
  return (
    <Svg width={w} height={h}>
      <Path d={d} fill={light} fillOpacity={0.16} />
      <Path d={d} fill="none" stroke={light} strokeOpacity={0.5} strokeWidth={1.2} strokeDasharray="1 4" strokeLinecap="round" />
    </Svg>
  );
});

/** A rug from above: a woven field, a border and a medallion in gold thread, fringe at its ends. */
const Rug = memo(function Rug({ w, h, tone }: { w: number; h: number; tone: Materials["cloth"] }) {
  const g = useGradId()("rug");
  const art = useMemo(() => {
    const rnd = rng(211);
    let weave = "";
    for (let y = 5; y < h - 4; y += 3) weave += `M${F + 2} ${y}H${w - F - 2}`;
    let fringe = "";
    for (let y = 3; y < h - 2; y += 3.4) {
      fringe += `M${F} ${y}L${(rnd() * 2).toFixed(1)} ${(y + (rnd() - 0.5) * 2.4).toFixed(1)}M${w - F} ${y}L${(w - rnd() * 2).toFixed(1)} ${(y + (rnd() - 0.5) * 2.4).toFixed(1)}`;
    }
    const cx = w / 2, cy = h / 2;
    const diamond = (rx: number, ry: number) => `M${cx - rx} ${cy}L${cx} ${cy - ry}L${cx + rx} ${cy}L${cx} ${cy + ry}Z`;
    let zig = "";
    for (let x = F + 16; x < w - F - 16; x += 10) zig += `M${x} 13l5 -4l5 4M${x} ${h - 13}l5 4l5 -4`;
    return { weave, fringe, d1: diamond(w * 0.2, h * 0.3), d2: diamond(w * 0.12, h * 0.17), zig, edge: inkRect(F, 1.5, w - 2 * F, h - 3, 3, 223, 0.8) };
  }, [w, h]);
  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id={g.id} x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0" stopColor={tone.light} />
          <Stop offset="0.45" stopColor={tone.mid} />
          <Stop offset="1" stopColor={mix(tone.mid, tone.deep, 0.6)} />
        </LinearGradient>
      </Defs>
      <Path d={art.fringe} stroke={tone.trim} strokeWidth={1.1} strokeLinecap="round" />
      <Rect x={F} y={1.5} width={w - 2 * F} height={h - 3} rx={3} fill={g.url} />
      <Path d={art.weave} stroke={tone.deep} strokeOpacity={0.28} strokeWidth={0.9} strokeDasharray="3 2.2" />
      {/* The border, the zigzag inside it, the medallion. */}
      <Rect x={F + 6} y={6} width={w - 2 * F - 12} height={h - 12} rx={2} fill="none" stroke={tone.trim} strokeWidth={2} strokeOpacity={0.9} />
      <Rect x={F + 10} y={10} width={w - 2 * F - 20} height={h - 20} rx={1} fill="none" stroke={tone.deep} strokeWidth={1} />
      <Path d={art.zig} stroke={tone.trim} strokeOpacity={0.7} strokeWidth={1.1} fill="none" strokeLinejoin="round" />
      <Path d={art.d1} fill={tone.deep} fillOpacity={0.55} stroke={tone.trim} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d={art.d2} fill={tone.mid} stroke={tone.trim} strokeOpacity={0.8} strokeWidth={1.1} strokeLinejoin="round" />
      <Circle cx={w / 2} cy={h / 2} r={3} fill={tone.trim} />
      <Ink d={art.edge} w={1.8} />
    </Svg>
  );
});
/** A rug's fringe, either end. */
const F = 7;

/** The rug rolled back, underside out: a pale woven cylinder, light along its top, dark where it meets the floor, its fringe at the ends. */
const RugUnder = memo(function RugUnder({ w, h, tone }: { w: number; h: number; tone: Materials["cloth"] }) {
  const g = useGradId()("ru");
  const art = useMemo(() => {
    const rnd = rng(227);
    let weft = "";
    for (let y = 4; y < h - 2; y += 3.2) weft += `M${F + 2} ${y.toFixed(1)}H${w - F - 2}`;
    let ticks = "";
    for (let x = F + 5; x < w - F - 3; x += 5) ticks += `M${x} ${(3 + rnd() * 2).toFixed(1)}v${(h - 8).toFixed(1)}`;
    let fringe = "";
    for (let y = 3; y < h - 2; y += 3.2) fringe += `M${F} ${y}L${(rnd() * 2).toFixed(1)} ${(y + 1).toFixed(1)}M${w - F} ${y}L${(w - rnd() * 2).toFixed(1)} ${(y + 1).toFixed(1)}`;
    return { weft, ticks, fringe, edge: inkRect(F - 1, 1.5, w - 2 * F + 2, h - 3, h / 2.4, 229, 0.6) };
  }, [w, h]);
  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id={g.id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000000" stopOpacity={0.4} />
          <Stop offset="0.22" stopColor="#FFFFFF" stopOpacity={0.3} />
          <Stop offset="0.5" stopColor="#000000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0.62} />
        </LinearGradient>
      </Defs>
      <Path d={art.fringe} stroke={tone.trim} strokeWidth={1.1} strokeLinecap="round" />
      <Path d={art.edge} fill={tone.under} />
      <Path d={art.ticks} stroke={tone.deep} strokeOpacity={0.16} strokeWidth={0.8} />
      <Path d={art.weft} stroke={tone.deep} strokeOpacity={0.34} strokeWidth={0.8} />
      {/* The rug's own colour showing at the roll's ends, where its edge is bound. */}
      <Path d={`M${F + 3} 4V${h - 4}M${w - F - 3} 4V${h - 4}`} stroke={tone.mid} strokeWidth={3} strokeLinecap="round" />
      <Path d={art.edge} fill={g.url} />
      <Ink d={art.edge} w={1.8} />
    </Svg>
  );
});

/** A plump cushion: piped all round, tufted to a button, its cloth in the mode's colour. */
const Cushion = memo(function Cushion({ w, h, tone }: { w: number; h: number; tone: Materials["cloth"] }) {
  const g = useGradId()("cu");
  const c = { x: w / 2, y: h / 2 };
  // Fat in the middle, pinched at the corners.
  const body = `M10 14C${w * 0.3} 4 ${w * 0.7} 4 ${w - 10} 14C${w - 2} ${h * 0.35} ${w - 2} ${h * 0.65} ${w - 10} ${h - 12}C${w * 0.7} ${h - 3} ${w * 0.3} ${h - 3} 10 ${h - 12}C2 ${h * 0.65} 2 ${h * 0.35} 10 14Z`;
  const tufts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => `M${c.x + sx * 7} ${c.y + sy * 5}Q${c.x + sx * w * 0.22} ${c.y + sy * h * 0.16} ${c.x + sx * w * 0.36} ${c.y + sy * h * 0.3}`).join("");
  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id={g.id} x1="0.1" y1="0" x2="0.6" y2="1">
          <Stop offset="0" stopColor={tone.light} />
          <Stop offset="0.5" stopColor={tone.mid} />
          <Stop offset="1" stopColor={tone.deep} />
        </LinearGradient>
      </Defs>
      <Path d={body} fill={g.url} />
      <Path d={tufts} stroke={tone.deep} strokeOpacity={0.6} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <Path d={tufts} stroke={tone.light} strokeOpacity={0.35} strokeWidth={1} fill="none" strokeLinecap="round" transform="translate(0 -1.6)" />
      {/* Piping, a line of light on its shoulder, the button. */}
      <Path d={body} fill="none" stroke={tone.trim} strokeWidth={3} strokeOpacity={0.9} />
      <Path d={`M22 20C${w * 0.32} 12 ${w * 0.6} 11 ${w - 30} 18`} stroke="#FFFFFF" strokeOpacity={0.25} strokeWidth={3} fill="none" strokeLinecap="round" />
      <Circle cx={c.x} cy={c.y} r={5} fill={tone.trim} stroke={INK} strokeWidth={1.4} />
      <Circle cx={c.x - 1.4} cy={c.y - 1.6} r={1.6} fill={BRASS.sheen} fillOpacity={0.8} />
      <Ink d={body} w={1.8} />
    </Svg>
  );
});

/** A book lying shut: cloth boards, a gilt frame and title bars, its pages' edge, a ribbon. */
const Book = memo(function Book({ w, h, mat }: { w: number; h: number; mat: Materials }) {
  const g = useGradId()("bk");
  const x = 6, y = 16, bw = w - 12, bh = h - 28;
  const cover = inkRect(x, y, bw, bh, 4, 311, 0.6);
  let pages = "";
  for (let i = 0; i < 4; i++) pages += `M${x + 8} ${y + bh + 2 + i * 1.8}H${x + bw - 3}`;
  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id={g.id} x1="0" y1="0" x2="0.4" y2="1">
          <Stop offset="0" stopColor={mat.cloth.light} />
          <Stop offset="0.5" stopColor={mat.cloth.mid} />
          <Stop offset="1" stopColor={mat.cloth.deep} />
        </LinearGradient>
      </Defs>
      {/* The pages under the cover, then the cover. */}
      <Rect x={x + 5} y={y + bh - 2} width={bw - 6} height={11} rx={2} fill="#EFE3C6" stroke={INK} strokeWidth={1.4} />
      <Path d={pages} stroke="#B9A57C" strokeWidth={0.8} />
      <Path d={cover} fill={g.url} />
      <Rect x={x} y={y} width={12} height={bh} rx={3} fill={mat.cloth.deep} fillOpacity={0.6} />
      <Rect x={x + 20} y={y + 9} width={bw - 30} height={bh - 18} rx={2} fill="none" stroke={mat.cloth.trim} strokeWidth={1.4} />
      <Path d={`M${x + 34} ${y + bh * 0.4}H${x + bw - 24}M${x + 46} ${y + bh * 0.4 + 9}H${x + bw - 36}`} stroke={mat.cloth.trim} strokeWidth={2.4} strokeLinecap="round" />
      <Path d={`M${x + 16} ${y + 3}H${x + bw - 6}`} stroke="#FFFFFF" strokeOpacity={0.22} strokeWidth={1.6} strokeLinecap="round" />
      <Path d={`M${x + bw - 26} ${y + bh + 6}l1 12l4 -3l4 3l-1 -12`} fill="#A8323F" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
      <Ink d={cover} w={1.8} />
    </Svg>
  );
});

/** A wooden box with a lid: boards, brass corners and a little clasp. */
const Box = memo(function Box({ w, h, mat }: { w: number; h: number; mat: Materials }) {
  const g = useGradId();
  const [face, lid] = [g("bf"), g("bl")];
  const x = 8, y = 14, bw = w - 16, bh = h - 22, lidH = 22;
  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id={face.id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={mat.wood.mid} />
          <Stop offset="1" stopColor={mat.wood.deep} />
        </LinearGradient>
        <LinearGradient id={lid.id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={mat.wood.sheen} />
          <Stop offset="1" stopColor={mat.wood.light} />
        </LinearGradient>
      </Defs>
      <Rect x={x} y={y + lidH - 2} width={bw} height={bh - lidH + 2} rx={3} fill={face.url} />
      <Path d={`M${x + 4} ${y + lidH + 14}H${x + bw - 4}M${x + 4} ${y + lidH + 30}H${x + bw - 4}`} stroke={mat.wood.deep} strokeOpacity={0.7} strokeWidth={1} />
      <Rect x={x - 3} y={y} width={bw + 6} height={lidH} rx={4} fill={lid.url} />
      <Path d={`M${x + 4} ${y + 3.5}H${x + bw - 4}`} stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={1.4} strokeLinecap="round" />
      {/* Brass corners and the clasp. */}
      {[x - 3, x + bw - 9].map((cx) => <Rect key={cx} x={cx} y={y} width={12} height={lidH} rx={3} fill={BRASS.mid} stroke={INK} strokeWidth={1.2} />)}
      <Rect x={w / 2 - 8} y={y + lidH - 7} width={16} height={18} rx={3} fill={BRASS.light} stroke={INK} strokeWidth={1.4} />
      <Circle cx={w / 2} cy={y + lidH + 4} r={2} fill={BRASS.deep} />
      <Ink d={inkRect(x, y + lidH - 2, bw, bh - lidH + 2, 3, 331, 0.6)} w={1.8} />
      <Ink d={inkRect(x - 3, y, bw + 6, lidH, 4, 337, 0.6)} w={1.8} />
    </Svg>
  );
});

/** A glazed pot with a fern in it: the thing on a shelf nobody looks under. */
const Pot = memo(function Pot({ w, h, mat }: { w: number; h: number; mat: Materials }) {
  const g = useGradId()("pt");
  const c = w / 2, top = 44, bot = h - 6;
  const body = `M${c - 34} ${top}C${c - 40} ${top + 26} ${c - 30} ${bot - 8} ${c - 22} ${bot}H${c + 22}C${c + 30} ${bot - 8} ${c + 40} ${top + 26} ${c + 34} ${top}Z`;
  const leaf = (dx: number, dy: number, bend: number) => `M${c} ${top - 2}Q${c + dx * 0.4 + bend} ${top - dy * 0.7} ${c + dx} ${top - dy}Q${c + dx * 0.7 - bend} ${top - dy * 0.4} ${c} ${top - 2}Z`;
  const leaves = [leaf(-44, 26, -6), leaf(44, 24, 6), leaf(-24, 40, -3), leaf(26, 38, 3), leaf(0, 42, 5)];
  const green = mix("#4F7A4A", mat.shadow, 0.2), greenLight = mix("#86B36E", mat.shadow, 0.1);
  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id={g.id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={mat.cloth.deep} />
          <Stop offset="0.3" stopColor={mat.cloth.mid} />
          <Stop offset="0.45" stopColor={mat.cloth.light} />
          <Stop offset="0.7" stopColor={mat.cloth.mid} />
          <Stop offset="1" stopColor={mat.cloth.deep} />
        </LinearGradient>
      </Defs>
      {leaves.map((d, i) => <Path key={i} d={d} fill={i % 2 ? greenLight : green} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />)}
      <Path d={body} fill={g.url} />
      <Ellipse cx={c} cy={top} rx={36} ry={7} fill={mat.cloth.deep} stroke={INK} strokeWidth={1.6} />
      <Ellipse cx={c} cy={top + 1} rx={29} ry={4.4} fill="#2A1A14" />
      <Path d={`M${c - 31} ${top + 16}Q${c} ${top + 24} ${c + 31} ${top + 16}`} stroke={mat.cloth.trim} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Path d={`M${c - 18} ${top + 12}Q${c - 22} ${top + 30} ${c - 14} ${bot - 8}`} stroke="#FFFFFF" strokeOpacity={0.28} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <Ink d={body} w={1.8} />
    </Svg>
  );
});

const styles = StyleSheet.create({
  room: { justifyContent: "flex-end", alignItems: "center", paddingBottom: ref.space.lg },
  floor: { position: "absolute", bottom: 0, height: FLOOR_H, overflow: "hidden" },
  place: { position: "absolute" },
  lying: { position: "absolute", bottom: ref.space.lg + 3, height: 56, alignItems: "center", justifyContent: "center" },
  shadow: { position: "absolute", height: 46 },
  // A rug's flat part shows through a window that rides up with the fold.
  window: { position: "absolute", left: 0, top: 0, overflow: "hidden" },
  flap: { position: "absolute", left: 0, transformOrigin: "50% 100%" },
  flapShadow: { position: "absolute", left: 6, top: -9, transform: [{ scaleY: -1 }] },
});
