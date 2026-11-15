// LiftUnder: lift the thing to see beneath it. The thing is the player's own:
// cut out of her photo of the room along its outline (cutout.ts, baked while
// she looks round the room), so her brown backpack is her brown backpack. A
// rug, a blanket or a cloth rolls back from its near edge: the roll follows
// the finger, pale woven underside out, fatter the more of it is rolled up,
// the boards it covered coming into view. Anything else lifts off the place it
// sat, its shadow thinning under it, a ring of dust where it was. With no
// photo (a room planned with none, no Skia) it is drawn: a rug, or a cushion,
// a book, a box or a pot (rendered: sprites.tsx). A bag (the core's variant
// "inside": a backpack, a satchel, a handbag) is opened instead: its flap,
// cut from the same picture, folds back and up and its mouth gapes, what's in
// it lying there in the dark from the first movement.
//
// What was under it lies there from the moment the close-up opens (the room
// says what a container holds: InspectView's `inside`), so the first millimetre
// of the lift already shows it. The moment it gives (GIVE_AT) it's lifted:
// onSet("lifted", true), the finger still on it.
import { memo, useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, { interpolate, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { Image } from "expo-image";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { mix } from "@/theme/payoff";
import { ref } from "@/theme/tokens";
import { GIVE_AT, STAGE, Stage, activatable, tryKey, usePull } from "./kit";
import { Boards, CastShadow, Ink, SoftShadow, Fade, inkRect, rng, useGradId, useMaterials, type Materials } from "./materials";
import { ART, Sprite } from "./sprites";
import type { MechanismProps } from "./types";
import { useBaked } from "../cutout";
import { cropOf, useShown } from "../shown";

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
  if (/box|basket|crate|bag|pack|satchel|purse|bin|case|chest|trunk/.test(l)) return "box";
  return "pot";
}

export function LiftUnder({ target, state, onSet, busy, width, inside }: MechanismProps) {
  const mat = useMaterials();
  const genre = useModeTheme().genre ?? "noir";
  const feedback = useFeedback();
  const lifted = state.lifted === true;
  const kind = liftKind(target.label);
  // A bag (the core's LiftUnder "inside"): opened, not lifted.
  const bag = target.variant === "inside" || BAG_WORDS.test(target.label);
  // The thing itself, cut out of her photo (null: drawn instead).
  const shown = useShown();
  const crop = target.kind === "object" ? cropOf(shown, target.id) : null;
  const baked = useBaked("cutout", shown.genre, crop);
  const real = baked ?? null;
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
  // A bag: the mouth opens from the first movement (never shut tight, so what's in it shows at once), the flap
  // folding back and up, darker as it turns away from the lamp.
  const mouthStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.12 + 0.88 * Math.min(1, progress.get() * 1.4) }] }));
  const bagFlapStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return { transform: [{ translateY: -p * 46 }, { rotate: `${p * -7}deg` }, { scaleY: 1 - p * 0.45 }] };
  });
  const flapShadeStyle = useAnimatedStyle(() => ({ opacity: progress.get() * 0.45 }));
  // The place it was: the dust line and the cleaner patch show as it comes off.
  const placeStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [0, 0.3], [0, 1], "clamp") }));

  const floorW = Math.min(width, w + 96);
  // Her own thing keeps its own shape: fitted into the space the drawn one would take, a little roomier.
  const fit = real && !peel ? (() => {
    const maxW = kind === "cushion" ? 196 : 176, maxH = 128;
    const tw = Math.min(maxW, maxH * real.aspect);
    return { w: Math.round(tw), h: Math.round(tw / real.aspect) };
  })() : null;
  const thingW = peel ? w : fit ? fit.w : kind === "cushion" ? 168 : kind === "book" ? 150 : 124;
  const thingH = fit ? fit.h : H;
  const label = lifted ? `${target.label}, lifted` : `Lift the ${target.label}`;
  if (bag) {
    // A bag is opened, not lifted: its flap folds back and its mouth gapes, what's in it lying there.
    const bw = real ? Math.round(Math.min(184, 156 * real.aspect)) : 150;
    const bh = real ? Math.round(bw / real.aspect) : 140;
    const flapH = Math.round(bh * BAG.flap);
    const mouthW = Math.round(bw * 0.7);
    return (
      <Stage width={width}>
        <View style={[styles.room, { height: STAGE }]}>
          <View style={[styles.floor, { width: floorW }]} pointerEvents="none">
            <Boards w={floorW} h={FLOOR_H} seed={71} tone={mat.floor} board={46} fade={0.42} />
          </View>
          <View style={[styles.shadow, { width: bw, bottom: ref.space.lg - 12 }]} pointerEvents="none">
            <SoftShadow w={bw} h={46} color={mat.shadow} strength={0.9} />
          </View>
          <View style={{ width: bw, height: bh }}>
            <GestureDetector gesture={gesture}>
              <Animated.View
                {...activatable(lifted ? `${target.label}, open` : `Open the ${target.label}`, "Looks inside", lifted ? onUncommit : commitNow, busy)}
                testID="mech-lift"
                style={{ width: bw, height: bh }}
              >
                {/* The bag itself: hers, cut out of the photo (or drawn), standing still. */}
                {real ? (
                  <Image source={{ uri: real.uri }} style={{ width: bw, height: bh }} contentFit="contain" transition={0} accessible={false} pointerEvents="none" testID="mech-lift-photo" />
                ) : (
                  <Sprite source={ART.box} w={bw} h={bh} />
                )}
              </Animated.View>
            </GestureDetector>
            {/* Its mouth, gaping as the flap goes back: dark inside, what it holds lying there from the first movement. */}
            <Animated.View style={[styles.mouth, { width: mouthW, left: (bw - mouthW) / 2, top: flapH - 4, height: Math.round(bh * BAG.mouth) }, mouthStyle]} pointerEvents="box-none">
              <View style={[StyleSheet.absoluteFill, styles.mouthDark]} pointerEvents="none" />
              {inside ? <View style={styles.inBag} pointerEvents={reach ? "box-none" : "none"} testID="mech-inside">{inside}</View> : null}
            </Animated.View>
            {/* The flap: the bag's own top, cut from the same picture, folding back and up off the mouth. */}
            <Animated.View style={[styles.bagFlap, { width: bw, height: flapH }, bagFlapStyle]} pointerEvents="none">
              {real ? (
                <Image source={{ uri: real.uri }} style={{ width: bw, height: bh }} contentFit="contain" transition={0} accessible={false} pointerEvents="none" />
              ) : (
                <Sprite source={ART.box} w={bw} h={bh} />
              )}
              <Animated.View style={[StyleSheet.absoluteFill, styles.flapShade, flapShadeStyle]} pointerEvents="none" />
            </Animated.View>
          </View>
        </View>
      </Stage>
    );
  }
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
        {inside ? <View style={[styles.lying, { width: w * 0.8, bottom: ref.space.lg + 3 + (fit ? Math.max(6, (thingH - 56) / 2) : UNDER[kind]) }]} pointerEvents={reach ? "box-none" : "none"} testID="mech-inside">{inside}</View> : null}
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
                  {real ? <Image source={{ uri: real.uri }} style={{ width: w, height: H }} contentFit="fill" transition={0} accessible={false} pointerEvents="none" /> : <Rug w={w} h={H} tone={mat.cloth} />}
                </Animated.View>
              </Animated.View>
              <Animated.View style={[styles.flap, { width: w, height: FLAP, top: H - FLAP }, flapStyle]}>
                {/* The roll's shadow on the rug beyond it. */}
                <View style={styles.flapShadow} pointerEvents="none"><CastShadow w={w - 12} h={12} color={mat.shadow} strength={0.6} /></View>
                <RugUnder w={w} h={FLAP} tone={mat.cloth} />
              </Animated.View>
            </Animated.View>
          ) : (
            <Animated.View {...activatable(label, "Looks underneath", lifted ? onUncommit : commitNow, busy)} testID="mech-lift" style={[{ width: thingW, height: thingH }, liftStyle]}>
              {real ? (
                // Hers, cut out of the photo.
                <Image source={{ uri: real.uri }} style={{ width: thingW, height: thingH }} contentFit="contain" transition={0} accessible={false} pointerEvents="none" testID="mech-lift-photo" />
              ) : (
                // Drawn (the cushion, the book and the pot in the mode's dye).
                <Sprite source={kind === "box" ? ART.box : ART[kind][genre]} w={thingW} h={H} />
              )}
            </Animated.View>
          )}
        </GestureDetector>
      </View>
    </Stage>
  );
}

const FLOOR_H = 156;
/** What a bag is called; a bag is opened, never lifted. */
const BAG_WORDS = /back ?pack|rucksack|satchel|hand ?bag|purse|tote|\bbag\b|knapsack/i;
/** A bag's flap (of its height, from the top) and its mouth's depth when wide open. */
const BAG = { flap: 0.36, mouth: 0.42 } as const;
/** How far up from the near edge what's under a thing lies, so the thing covers all of it while it's down (the rendered ones' feet are rounder than a box). */
const UNDER: Record<Kind, number> = { rug: 0, cushion: 10, book: 10, box: 10, pot: 7 };

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

const styles = StyleSheet.create({
  room: { justifyContent: "flex-end", alignItems: "center", paddingBottom: ref.space.lg },
  floor: { position: "absolute", bottom: 0, height: FLOOR_H, overflow: "hidden" },
  place: { position: "absolute" },
  lying: { position: "absolute", height: 56, alignItems: "center", justifyContent: "center" },
  shadow: { position: "absolute", height: 46 },
  // A rug's flat part shows through a window that rides up with the fold.
  window: { position: "absolute", left: 0, top: 0, overflow: "hidden" },
  flap: { position: "absolute", left: 0, transformOrigin: "50% 100%" },
  flapShadow: { position: "absolute", left: 6, top: -9, transform: [{ scaleY: -1 }] },
  mouth: { position: "absolute", overflow: "hidden", borderRadius: 999, transformOrigin: "50% 0%", alignItems: "center", justifyContent: "center" },
  mouthDark: { backgroundColor: "#120C0E", borderRadius: 999, opacity: 0.92 },
  inBag: { alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  bagFlap: { position: "absolute", left: 0, top: 0, overflow: "hidden", transformOrigin: "50% 0%" },
  flapShade: { backgroundColor: "#000000" },
});
