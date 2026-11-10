// Light: a lamp with a pull chain. Pull the bead down past the catch, or tap
// the shade: onSet("on", !on). The uv variant throws a violet light. The UV
// torch (an item) has nothing to work here: it is used on things.
//
// Drawn as the lamp: a pleated cloth shade trimmed in brass on a turned brass
// stem and foot, standing on the table, a beaded pull chain with its fob
// hanging under the shade. Lit, the shade glows from inside, the bulb's tip
// burns under it, and its light pools on the table and blooms into the dark.
import { memo, useCallback, useEffect, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { mix } from "@/theme/payoff";
import { Line, STAGE, Stage, clamp, settle } from "./kit";
import { BRASS, BrassGradient, Boards, INK, Ink, SoftShadow, useGradId, useMaterials, type Materials } from "./materials";
import type { MechanismProps } from "./types";

/** Ultraviolet: no mode colour is violet, so the UV lamp carries its own. */
const UV = "#8B6CFF";
const CHAIN = 54;
const PULL = 34;
const CATCH = 22;

export function Light(props: MechanismProps) {
  if (props.target.variant === "torch") return null;
  return <Lamp {...props} />;
}

function Lamp({ target, state, onSet, busy, width }: MechanismProps) {
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  const feedback = useFeedback();
  const on = state.on === true;
  const uv = target.variant === "uv";
  const light = uv ? UV : theme.glow ?? theme.accent;

  const glow = useSharedValue(on ? 1 : 0);
  const pull = useSharedValue(0);
  const enabled = useSharedValue(!busy);
  const reduced = useSharedValue(reducedMotion);
  useEffect(() => {
    enabled.set(!busy);
    reduced.set(reducedMotion);
  }, [busy, reducedMotion, enabled, reduced]);
  useEffect(() => {
    glow.set(withTiming(on ? 1 : 0, settle(reducedMotion, 260)));
  }, [on, reducedMotion, glow]);

  const toggle = useCallback(() => {
    if (busy) return;
    // Switching on: the rocker's click and hum; off, a plain press.
    if (on) feedback.press();
    else feedback.uvSwitch();
    onSet("on", !on);
  }, [busy, feedback, onSet, on]);
  const caught = useCallback(() => feedback.tick(), [feedback]);

  const pan = usePanGesture({
    enabled,
    maxPointers: 1,
    activeOffsetY: 4,
    onUpdate: (e) => {
      "worklet";
      const before = pull.get();
      const next = clamp(e.translationY, 0, PULL);
      if (before < CATCH && next >= CATCH) scheduleOnRN(caught);
      pull.set(next);
    },
    onDeactivate: () => {
      "worklet";
      const pulled = pull.get() >= CATCH;
      pull.set(withTiming(0, { duration: reduced.get() ? 0 : 180 }));
      if (pulled) scheduleOnRN(toggle);
    },
  });

  // The chain runs down out of the shade and the fob rides its end: both moved by the same pull (the chain is
  // drawn whole and slides in a window under the shade), so its beads never stretch.
  const beadStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pull.get() }] }));
  const chainStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pull.get() - PULL }] }));
  const litStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));
  const poolStyle = useAnimatedStyle(() => ({ opacity: glow.get() * (uv ? 0.75 : 0.6) }));
  const bloomStyle = useAnimatedStyle(() => ({ opacity: glow.get() * (uv ? 0.6 : 0.42) }));

  const mat = useMaterials();
  const w = Math.min(width, 300);
  const lampLeft = (w - LAMP.w) / 2;
  return (
    <Stage width={width}>
      <View style={[styles.room, { width: w, height: STAGE }]}>
        {/* The table it stands on, lost in the dark at its edges. */}
        <View style={[styles.table, { width: w }]} pointerEvents="none">
          <Boards w={w} h={TABLE_H} seed={173} tone={mat.floor} board={TABLE_H} fade={0.3} />
        </View>
        {/* Its light: a bloom into the dark round the shade, a pool on the table. */}
        <Animated.View pointerEvents="none" style={[styles.bloom, { left: w / 2 - 130 }, bloomStyle]}>
          <SoftShadow w={260} h={200} color={light} strength={0.9} />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.pool, { left: w / 2 - 120 }, poolStyle]}>
          <SoftShadow w={240} h={50} color={light} strength={1} />
        </Animated.View>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={uv ? `${target.label}, ultraviolet` : target.label}
          accessibilityState={{ checked: on, disabled: busy }}
          accessibilityHint={on ? "Switches it off" : "Switches it on"}
          onPress={toggle}
          disabled={busy}
          testID="mech-light"
          style={[styles.lamp, { left: lampLeft }]}
        >
          <LampArt mat={mat} />
          <Animated.View style={[StyleSheet.absoluteFill, litStyle]} pointerEvents="none">
            <LampLit light={light} />
          </Animated.View>
        </Pressable>
        <View style={[styles.chainAnchor, { left: lampLeft + LAMP.chainX - ref.hit.min / 2 }]}>
          <View style={styles.chainWindow} pointerEvents="none">
            <Animated.View style={chainStyle}><Chain /></Animated.View>
          </View>
          <GestureDetector gesture={pan}>
            <Animated.View style={[styles.beadHit, beadStyle]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Fob />
            </Animated.View>
          </GestureDetector>
        </View>
      </View>
      <Line text={on ? (uv ? "Ultraviolet on" : "On") : "Pull the chain"} />
    </Stage>
  );
}

/** The lamp's drawing: its size, the shade's rims, where the chain hangs. */
const LAMP = { w: 170, h: 172, cx: 85, top: 8, topR: 30, bot: 78, botR: 64, chainX: 114, chainY: 80 };
const TABLE_H = 44;
const shadePath = () => {
  const { cx, top, topR, bot, botR } = LAMP;
  return `M${cx - topR} ${top}H${cx + topR}L${cx + botR} ${bot}Q${cx} ${bot + 9} ${cx - botR} ${bot}Z`;
};

/** The lamp, unlit: shade, stem and foot. */
const LampArt = memo(function LampArt({ mat }: { mat: Materials }) {
  const g = useGradId();
  const [cloth, brass, foot] = [g("c"), g("b"), g("f")];
  const { cx, top, topR, bot, botR, w, h } = LAMP;
  const pleats = useMemo(() => {
    let d = "";
    for (let i = -5; i <= 5; i++) d += `M${cx + (i / 5.6) * topR} ${top + 2}L${cx + (i / 5.6) * botR} ${bot + (1 - Math.abs(i) / 5.6) * 5}`;
    return d;
  }, [cx, top, topR, bot, botR]);
  const shade = shadePath();
  const baseY = h - 16;
  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id={cloth.id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={mat.cloth.deep} />
          <Stop offset="0.35" stopColor={mat.cloth.mid} />
          <Stop offset="0.5" stopColor={mat.cloth.light} />
          <Stop offset="0.7" stopColor={mat.cloth.mid} />
          <Stop offset="1" stopColor={mat.cloth.deep} />
        </LinearGradient>
        <BrassGradient id={brass.id} />
        <LinearGradient id={foot.id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={BRASS.deep} />
          <Stop offset="0.35" stopColor={BRASS.light} />
          <Stop offset="1" stopColor={BRASS.shade} />
        </LinearGradient>
      </Defs>
      {/* The foot and its shadow on the table, the stem turned in three places, the bulb's holder. */}
      <Ellipse cx={cx + 3} cy={baseY + 7} rx={48} ry={8} fill="#000000" fillOpacity={0.45} />
      <Ellipse cx={cx} cy={baseY} rx={42} ry={9} fill={foot.url} stroke={INK} strokeWidth={1.8} />
      <Ellipse cx={cx} cy={baseY - 4} rx={26} ry={5.5} fill={BRASS.mid} stroke={INK} strokeWidth={1.4} />
      <Rect x={cx - 4.5} y={bot + 12} width={9} height={baseY - bot - 16} fill={brass.url} stroke={INK} strokeWidth={1.5} />
      {[0.3, 0.62].map((f) => (
        <Ellipse key={f} cx={cx} cy={bot + 12 + (baseY - bot - 16) * f} rx={8.5} ry={5} fill={brass.url} stroke={INK} strokeWidth={1.4} />
      ))}
      {/* The bulb's tip under the shade, cold. */}
      <Path d={`M${cx - 9} ${bot}Q${cx - 10} ${bot + 15} ${cx} ${bot + 17}Q${cx + 10} ${bot + 15} ${cx + 9} ${bot}Z`} fill="#8E8A86" stroke={INK} strokeWidth={1.4} />
      <Path d={shade} fill={cloth.url} />
      <Path d={pleats} stroke={mat.cloth.deep} strokeOpacity={0.75} strokeWidth={1.2} />
      <Path d={pleats} stroke={mat.cloth.light} strokeOpacity={0.3} strokeWidth={0.8} transform="translate(1.6 0)" />
      {/* Brass trim, top and bottom. */}
      <Path d={`M${cx - topR} ${top}H${cx + topR}`} stroke={INK} strokeWidth={6.5} strokeLinecap="round" />
      <Path d={`M${cx - topR} ${top}H${cx + topR}`} stroke={BRASS.light} strokeWidth={3.5} strokeLinecap="round" />
      <Path d={`M${cx - botR} ${bot}Q${cx} ${bot + 9} ${cx + botR} ${bot}`} stroke={INK} strokeWidth={6.5} fill="none" strokeLinecap="round" />
      <Path d={`M${cx - botR} ${bot}Q${cx} ${bot + 9} ${cx + botR} ${bot}`} stroke={BRASS.mid} strokeWidth={3.5} fill="none" strokeLinecap="round" />
      <Ink d={shade} w={1.8} />
    </Svg>
  );
});

/** The same lamp alight (faded in over the cold one): the shade glowing from inside, brightest low and in the middle, the bulb's tip white-hot. */
const LampLit = memo(function LampLit({ light }: { light: string }) {
  const g = useGradId();
  const [shade, bulb] = [g("s"), g("u")];
  const { cx, bot, w, h } = LAMP;
  return (
    <Svg width={w} height={h}>
      <Defs>
        <RadialGradient id={shade.id} cx="50%" cy="92%" rx="62%" ry="95%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
          <Stop offset="0.35" stopColor={mix(light, "#FFFFFF", 0.3)} stopOpacity={0.8} />
          <Stop offset="1" stopColor={light} stopOpacity={0.12} />
        </RadialGradient>
        <RadialGradient id={bulb.id} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.4" stopColor={mix(light, "#FFFFFF", 0.4)} stopOpacity={0.9} />
          <Stop offset="1" stopColor={light} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Path d={shadePath()} fill={shade.url} />
      <Circle cx={cx} cy={bot + 9} r={26} fill={bulb.url} />
      <Path d={`M${cx - 8} ${bot + 1}Q${cx - 9} ${bot + 14} ${cx} ${bot + 16}Q${cx + 9} ${bot + 14} ${cx + 8} ${bot + 1}Z`} fill="#FFFFFF" fillOpacity={0.95} />
    </Svg>
  );
});

/** The pull chain, whole: brass beads on a fine link. */
const Chain = memo(function Chain() {
  const n = Math.floor((CHAIN + PULL) / 5);
  return (
    <Svg width={8} height={CHAIN + PULL}>
      <Path d={`M4 0V${CHAIN + PULL}`} stroke={BRASS.deep} strokeWidth={1} />
      {Array.from({ length: n }, (_, i) => (
        <Circle key={i} cx={4} cy={2.5 + i * 5} r={1.9} fill={BRASS.light} stroke={INK} strokeWidth={0.8} />
      ))}
    </Svg>
  );
});

/** The chain's fob: a turned brass drop to pull by. */
const Fob = memo(function Fob() {
  const g = useGradId()("fb");
  return (
    <Svg width={18} height={26} viewBox="0 0 18 26">
      <Defs>
        <RadialGradient id={g.id} cx="36%" cy="34%" rx="70%" ry="70%">
          <Stop offset="0" stopColor={BRASS.sheen} />
          <Stop offset="0.5" stopColor={BRASS.mid} />
          <Stop offset="1" stopColor={BRASS.deep} />
        </RadialGradient>
      </Defs>
      <Path d="M9 1.5C10.6 1.5 11.2 3 11 4.6C14.6 7 16.4 11.4 16.4 15.6C16.4 20.6 13.2 24.5 9 24.5C4.8 24.5 1.6 20.6 1.6 15.6C1.6 11.4 3.4 7 7 4.6C6.8 3 7.4 1.5 9 1.5Z" fill={g.url} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M5 13Q5.4 9 8 7.4" stroke="#FFFFFF" strokeOpacity={0.65} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </Svg>
  );
});

const styles = StyleSheet.create({
  room: {},
  table: { position: "absolute", left: 0, bottom: 0, height: TABLE_H, overflow: "hidden" },
  bloom: { position: "absolute", top: 0, width: 260, height: 200 },
  pool: { position: "absolute", bottom: 2, width: 240, height: 50 },
  lamp: { position: "absolute", top: STAGE - LAMP.h - 6, width: LAMP.w, height: LAMP.h },
  // Under the shade, toward its right: the chain's window (the chain slides in it) and the fob's touch box.
  chainAnchor: { position: "absolute", top: STAGE - LAMP.h - 6 + LAMP.chainY, alignItems: "center", width: ref.hit.min, height: CHAIN + PULL + ref.hit.min / 2 },
  chainWindow: { position: "absolute", top: 0, left: ref.hit.min / 2 - 4, width: 8, height: CHAIN + PULL, overflow: "hidden" },
  // Centred on the chain's end (the fob hangs from it).
  beadHit: { position: "absolute", left: 0, top: CHAIN - ref.hit.min / 2 + 10, width: ref.hit.min, height: ref.hit.min, alignItems: "center", justifyContent: "center" },
});
