// ClockHands: a face with an hour and a minute hand. Grab near a hand and turn
// it about the centre: the minute hand clicks through 5-minute detents, the
// hour hand through the hours, a tick at each. onSet("time", "H:MM") on
// release. Screen readers adjust the hour and the minutes in the readout.
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { Line, Stage, adjustable, mod, readoutText, settle } from "./kit";
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
  return (
    <Stage width={width}>
      <GestureDetector gesture={pan}>
        <View
          style={[styles.face, { width: D, height: D, borderRadius: R, backgroundColor: theme.surface, borderColor: theme.raised }]}
          testID="mech-clock"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {Array.from({ length: 12 }, (_, k) => (
            <View key={k} style={[styles.spoke, { width: D - 12, height: D - 12, transform: [{ rotate: `${k * 30}deg` }] }]} pointerEvents="none">
              <View style={[styles.mark, k % 3 === 0 ? styles.markMajor : null, { backgroundColor: k % 3 === 0 ? theme.ink : theme.inkMuted }]} />
            </View>
          ))}
          <Animated.View style={[styles.spoke, { width: D - 12, height: D - 12 }, hourStyle]} pointerEvents="none">
            <View style={[styles.hand, { height: R * 0.5, width: 6, top: R - 6 - R * 0.5, backgroundColor: theme.ink }]} />
          </Animated.View>
          <Animated.View style={[styles.spoke, { width: D - 12, height: D - 12 }, minuteStyle]} pointerEvents="none">
            <View style={[styles.hand, { height: R * 0.78, width: 3, top: R - 6 - R * 0.78, backgroundColor: theme.ink }]} />
          </Animated.View>
          <View style={[styles.cap, { backgroundColor: theme.accent, borderColor: theme.ground }]} pointerEvents="none" />
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
  face: { borderWidth: 6, alignItems: "center", justifyContent: "center" },
  spoke: { position: "absolute", alignItems: "center" },
  mark: { width: 2, height: 7, marginTop: 4, borderRadius: 1 },
  markMajor: { width: 3, height: 14 },
  hand: { position: "absolute", borderRadius: ref.radius.round },
  cap: { position: "absolute", width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  readout: { flexDirection: "row", alignItems: "baseline", gap: ref.space.xs },
});
