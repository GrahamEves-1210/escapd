// ClockHands: a face with an hour and a minute hand. Grab near a hand and turn
// it about the centre: the minute hand clicks through 5-minute detents, the
// hour hand through the hours, a tick at each. onSet("time", "H:MM") on
// release. Screen readers adjust the hour and the minutes in the readout.
//
// Drawn as the clock: an enamel dial in a brass bezel, its numerals in the
// mode's book face, a minute track, blued-steel hands (a spade for the hours)
// on a brass boss, the glass over it catching the light. Under the centre a
// little hatch: shut, a fine line and a pin; once the clock gives up what's
// behind it (`panel`), swung open on the dark inside.
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { Line, Stage, adjustable, mod, readoutText, settle } from "./kit";
import { BRASS, ENAMEL, INK, STEEL, useGradId } from "./materials";
import type { MechanismProps } from "./types";

const DETENT = 30; // degrees: one hour, or five minutes

/** "3:15" → [3, 3] as detent indices (hour 0..11 with 12 at 0, minute 0..11 in fives). */
function parseTime(v: unknown): [number, number] {
  const m = typeof v === "string" ? /^(\d{1,2}):(\d{2})$/.exec(v) : null;
  if (!m) return [0, 0];
  return [mod(Number(m[1]), 12), mod(Math.round(Number(m[2]) / 5), 12)];
}
export const timeOf = (hour: number, minute: number) => `${mod(hour, 12) || 12}:${String(mod(minute, 12) * 5).padStart(2, "0")}`;

type Hand = 0 | 1 | 2; // none, hour, minute

export function ClockHands({ state, onSet, busy, width }: MechanismProps) {
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  const feedback = useFeedback();
  const [h0, m0] = parseTime(state.time);
  const [hour, setHour] = useState(h0);
  const [minute, setMinute] = useState(m0);

  const D = Math.min(width - 2 * ref.space.lg, 196);
  const R = D / 2;
  const hourDeg = useSharedValue(h0 * DETENT);
  const minDeg = useSharedValue(m0 * DETENT);
  const which = useSharedValue<Hand>(0);
  const enabled = useSharedValue(!busy);
  const reduced = useSharedValue(reducedMotion);
  useEffect(() => {
    enabled.set(!busy);
    reduced.set(reducedMotion);
  }, [busy, reducedMotion, enabled, reduced]);

  // The state moved (a commit landed, or a reset): seat both hands there.
  useEffect(() => {
    if (which.get() !== 0) return;
    setHour(h0);
    setMinute(m0);
    hourDeg.set(withTiming(nearest(hourDeg.get(), h0), settle(reducedMotion)));
    minDeg.set(withTiming(nearest(minDeg.get(), m0), settle(reducedMotion)));
  }, [h0, m0, reducedMotion, hourDeg, minDeg, which]);

  const detent = useCallback((hand: Hand, idx: number) => {
    feedback.tick();
    if (hand === 1) setHour(idx);
    else setMinute(idx);
  }, [feedback]);
  const commit = useCallback((h: number, m: number) => {
    setHour(h);
    setMinute(m);
    onSet("time", timeOf(h, m));
  }, [onSet]);

  useAnimatedReaction(
    () => {
      const hand = which.get();
      if (hand === 0) return -1;
      return hand * 100 + mod(Math.round((hand === 1 ? hourDeg.get() : minDeg.get()) / DETENT), 12);
    },
    (now, before) => {
      if (now < 0 || before === null || before < 0 || now === before) return;
      scheduleOnRN(detent, Math.floor(now / 100) as Hand, now % 100);
    },
  );

  const pan = usePanGesture({
    enabled,
    maxPointers: 1,
    minDistance: 2,
    onActivate: (e) => {
      "worklet";
      const a = angleAt(e.x - R, e.y - R);
      const dh = arc(a, hourDeg.get());
      const dm = arc(a, minDeg.get());
      const nearCentre = Math.hypot(e.x - R, e.y - R) < R * 0.42;
      // The nearer hand by angle; the hour hand when both are close and the finger is near the centre.
      which.set(dh + (nearCentre ? 0 : 12) < dm ? 1 : 2);
    },
    onUpdate: (e) => {
      "worklet";
      const a = angleAt(e.x - R, e.y - R);
      if (which.get() === 1) hourDeg.set(a);
      else if (which.get() === 2) minDeg.set(a);
    },
    onDeactivate: () => {
      "worklet";
      const hand = which.get();
      if (hand === 0) return;
      const sv = hand === 1 ? hourDeg : minDeg;
      const snapped = Math.round(sv.get() / DETENT) * DETENT;
      sv.set(withTiming(snapped, { duration: reduced.get() ? 0 : 120 }));
      const h = mod(Math.round(hourDeg.get() / DETENT), 12);
      const m = mod(Math.round(minDeg.get() / DETENT), 12);
      scheduleOnRN(commit, h, m);
    },
    onFinalize: () => {
      "worklet";
      which.set(0);
    },
  });

  const hourStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${hourDeg.get()}deg` }] }));
  const minuteStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${minDeg.get()}deg` }] }));

  const stepHour = (d: 1 | -1) => {
    if (busy) return;
    const next = mod(hour + d, 12);
    feedback.tick();
    hourDeg.set(withTiming(nearest(hourDeg.get(), next), settle(reducedMotion)));
    commit(next, minute);
  };
  const stepMinute = (d: 1 | -1) => {
    if (busy) return;
    const next = mod(minute + d, 12);
    feedback.tick();
    minDeg.set(withTiming(nearest(minDeg.get(), next), settle(reducedMotion)));
    commit(hour, next);
  };

  const shownHour = hour || 12;
  const shownMinute = String(minute * 5).padStart(2, "0");
  const panel = state.panel === true;
  const face = typeof theme.display.fontFamily === "string" ? theme.display.fontFamily : undefined;
  // Numerals round the dial, inside the minute track.
  const numR = R - BEZEL - 21;
  return (
    <Stage width={width}>
      <GestureDetector gesture={pan}>
        <View
          style={[styles.face, { width: D, height: D }]}
          testID="mech-clock"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Dial D={D} panel={panel} />
          {Array.from({ length: 12 }, (_, k) => {
            const a = (k * 30 * Math.PI) / 180;
            return (
              <Text
                key={k}
                allowFontScaling={false}
                style={[styles.numeral, { fontFamily: face, left: R + Math.sin(a) * numR - 14, top: R - Math.cos(a) * numR - 11 }]}
              >
                {k || 12}
              </Text>
            );
          })}
          <Animated.View style={[styles.spoke, { width: D, height: D }, hourStyle]} pointerEvents="none">
            <HandArt length={R * 0.5} at={R} hour />
          </Animated.View>
          <Animated.View style={[styles.spoke, { width: D, height: D }, minuteStyle]} pointerEvents="none">
            <HandArt length={R * 0.74} at={R} />
          </Animated.View>
          <Glass D={D} />
        </View>
      </GestureDetector>
      <View style={styles.readout}>
        <Text
          {...adjustable("Hour hand", `${shownHour} o'clock`, stepHour)}
          style={readoutText(theme.ink)}
          testID="mech-clock-hour"
        >
          {shownHour}
        </Text>
        <Text style={readoutText(theme.inkMuted)}>:</Text>
        <Text
          {...adjustable("Minute hand", `${shownMinute} minutes past`, stepMinute)}
          style={readoutText(theme.ink)}
          testID="mech-clock-minute"
        >
          {shownMinute}
        </Text>
      </View>
      <Line text="Drag the hands" />
    </Stage>
  );
}

/** The bezel's width. */
const BEZEL = 9;
/** A hand's width (its drawing's), and how far its tail runs past the centre. */
const HAND_W = 18;
const TAIL = 13;

/** The dial: bezel, enamel, the minute track, the maker's two lines, the hatch under the centre. */
const Dial = memo(function Dial({ D, panel }: { D: number; panel: boolean }) {
  const g = useGradId();
  const [enamel, brass, well] = [g("e"), g("b"), g("w")];
  const R = D / 2, r = R - BEZEL;
  const track = useMemo(() => {
    let minor = "", major = "";
    for (let i = 0; i < 60; i++) {
      const a = (i * 6 * Math.PI) / 180, sx = Math.sin(a), cy = -Math.cos(a);
      const five = i % 5 === 0;
      const d = `M${(R + sx * (r - 3)).toFixed(1)} ${(R + cy * (r - 3)).toFixed(1)}L${(R + sx * (r - (five ? 9 : 6))).toFixed(1)} ${(R + cy * (r - (five ? 9 : 6))).toFixed(1)}`;
      if (five) major += d;
      else minor += d;
    }
    return { minor, major };
  }, [R, r]);
  // The hatch: a low arch under the centre.
  const hw = 21, hy = R + r * 0.2, hh = 22;
  const hatch = `M${R - hw} ${hy + hh}V${hy + 8}Q${R - hw} ${hy} ${R - hw + 8} ${hy}H${R + hw - 8}Q${R + hw} ${hy} ${R + hw} ${hy + 8}V${hy + hh}Z`;
  return (
    <Svg width={D} height={D} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id={enamel.id} cx="42%" cy="36%" rx="68%" ry="68%">
          <Stop offset="0" stopColor={ENAMEL.light} />
          <Stop offset="0.7" stopColor={ENAMEL.mid} />
          <Stop offset="1" stopColor={ENAMEL.shade} />
        </RadialGradient>
        <LinearGradient id={brass.id} x1="0.15" y1="0" x2="0.85" y2="1">
          <Stop offset="0" stopColor={BRASS.sheen} />
          <Stop offset="0.3" stopColor={BRASS.mid} />
          <Stop offset="0.55" stopColor={BRASS.light} />
          <Stop offset="0.8" stopColor={BRASS.shade} />
          <Stop offset="1" stopColor={BRASS.deep} />
        </LinearGradient>
        <LinearGradient id={well.id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000000" />
          <Stop offset="1" stopColor="#3A2A22" />
        </LinearGradient>
      </Defs>
      {/* The bezel: turned brass, inked either side, a fine bead inside it. */}
      <Circle cx={R} cy={R} r={R - 1.2} fill={brass.url} stroke={INK} strokeWidth={2} />
      <Circle cx={R} cy={R} r={r} fill={enamel.url} stroke={INK} strokeWidth={1.6} />
      <Circle cx={R} cy={R} r={r - 1.6} fill="none" stroke="#000000" strokeOpacity={0.14} strokeWidth={3} />
      <Path d={track.minor} stroke={ENAMEL.ink} strokeOpacity={0.55} strokeWidth={0.9} />
      <Path d={track.major} stroke={ENAMEL.ink} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={R} cy={R} r={r - 11} fill="none" stroke={ENAMEL.ink} strokeOpacity={0.35} strokeWidth={0.7} />
      {panel ? (
        <>
          {/* Open: the dark inside, its lip, and the little door let down on its hinge. */}
          <Path d={hatch} fill={well.url} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
          <Path d={`M${R - hw + 3} ${hy + 9}Q${R - hw + 3} ${hy + 3} ${R - hw + 9} ${hy + 3}H${R + hw - 9}`} stroke="#000000" strokeOpacity={0.7} strokeWidth={3} fill="none" />
          <Path d={`M${R - hw} ${hy + hh}H${R + hw}L${R + hw - 5} ${hy + hh + 9}H${R - hw + 5}Z`} fill={ENAMEL.shade} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
          <Circle cx={R} cy={hy + hh + 5} r={1.8} fill={BRASS.mid} stroke={INK} strokeWidth={0.8} />
        </>
      ) : (
        <>
          <Path d={hatch} fill="#000000" fillOpacity={0.04} stroke={ENAMEL.ink} strokeOpacity={0.5} strokeWidth={1} strokeLinejoin="round" />
          <Circle cx={R} cy={hy + 7} r={2} fill={BRASS.mid} stroke={INK} strokeWidth={0.9} />
        </>
      )}
    </Svg>
  );
});

/** A hand of blued steel, its shadow under it on the enamel: a spade for the hours, a slim lance for the minutes. Points up; turned by its spoke. */
const HandArt = memo(function HandArt({ length, at, hour = false }: { length: number; at: number; hour?: boolean }) {
  const g = useGradId()("h");
  const w = HAND_W, c = w / 2, h = length + TAIL;
  const d = hour
    ? `M${c} 0C${c + 7.5} ${length * 0.2} ${c + 7} ${length * 0.34} ${c + 1.8} ${length * 0.42}L${c + 2.4} ${length}L${c + 3.2} ${h}H${c - 3.2}L${c - 2.4} ${length}L${c - 1.8} ${length * 0.42}C${c - 7} ${length * 0.34} ${c - 7.5} ${length * 0.2} ${c} 0Z`
    : `M${c} 0L${c + 1.9} ${length * 0.82}L${c + 2.6} ${h}H${c - 2.6}L${c - 1.9} ${length * 0.82}Z`;
  return (
    <Svg width={w + 6} height={h + 6} style={{ position: "absolute", left: at - c, top: at - length }}>
      <Defs>
        <LinearGradient id={g.id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={STEEL.light} />
          <Stop offset="0.45" stopColor={STEEL.mid} />
          <Stop offset="1" stopColor={STEEL.deep} />
        </LinearGradient>
      </Defs>
      <Path d={d} fill="#000000" fillOpacity={0.22} transform="translate(2.4 3.4)" />
      <Path d={d} fill={g.url} stroke={STEEL.deep} strokeWidth={1} strokeLinejoin="round" />
    </Svg>
  );
});

/** Over the hands: the brass boss they turn on, and the glass (a soft bloom and a crescent of light, upper left). */
const Glass = memo(function Glass({ D }: { D: number }) {
  const g = useGradId();
  const [boss, bloom] = [g("k"), g("s")];
  const R = D / 2, r = R - BEZEL - 2;
  return (
    <Svg width={D} height={D} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id={boss.id} cx="38%" cy="32%" rx="70%" ry="70%">
          <Stop offset="0" stopColor={BRASS.sheen} />
          <Stop offset="0.5" stopColor={BRASS.mid} />
          <Stop offset="1" stopColor={BRASS.deep} />
        </RadialGradient>
        <RadialGradient id={bloom.id} cx="30%" cy="24%" rx="60%" ry="60%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.3} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={R + 1} cy={R + 1.6} r={7.4} fill="#000000" fillOpacity={0.25} />
      <Circle cx={R} cy={R} r={6.6} fill={boss.url} stroke={INK} strokeWidth={1.3} />
      <Circle cx={R} cy={R} r={1.6} fill={BRASS.deep} />
      <Circle cx={R} cy={R} r={r} fill={bloom.url} />
      <Path d={`M${R - r * 0.78} ${R - r * 0.3}A${r * 0.84} ${r * 0.84} 0 0 1 ${R - r * 0.18} ${R - r * 0.8}`} stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={3.2} fill="none" strokeLinecap="round" />
      <Path d={`M${R + r * 0.5} ${R + r * 0.66}A${r * 0.84} ${r * 0.84} 0 0 0 ${R + r * 0.7} ${R + r * 0.44}`} stroke="#FFFFFF" strokeOpacity={0.22} strokeWidth={2.2} fill="none" strokeLinecap="round" />
    </Svg>
  );
});

/** Degrees clockwise from twelve, 0..360, of a point relative to the centre. */
function angleAt(dx: number, dy: number) {
  "worklet";
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return deg < 0 ? deg + 360 : deg;
}

/** The angular distance between two angles, 0..180. */
function arc(a: number, b: number) {
  "worklet";
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
}

/** The angle for detent `idx` closest to `from`, so a hand turns the short way. */
function nearest(from: number, idx: number) {
  "worklet";
  const target = idx * DETENT;
  return target + Math.round((from - target) / 360) * 360;
}

const styles = StyleSheet.create({
  face: { alignItems: "center", justifyContent: "center" },
  spoke: { position: "absolute", left: 0, top: 0 },
  numeral: { position: "absolute", width: 28, height: 22, fontSize: 15, lineHeight: 22, textAlign: "center", color: ENAMEL.ink },
  readout: { flexDirection: "row", alignItems: "baseline", gap: ref.space.xs },
});
