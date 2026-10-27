// Decoder: a Caesar wheel. The outer ring is the plain alphabet; the inner
// disc turns under it in detents, so under A sits the letter A becomes.
// Offset 1..max; onSet("offset", "3") on release.
import { memo, useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { cancelAnimation, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { Line, Readout, Stage, adjustable, domainOf, mod, readoutText, settle } from "./kit";
import type { MechanismProps } from "./types";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const N = LETTERS.length;
const STEP = 360 / N;

/** A step's offset kept in 1..max: 0 (no shift) and anything past max land on the nearest end. */
function valid(k: number, max: number) {
  const m = mod(k, N);
  if (m === 0) return 1;
  return Math.min(m, max);
}

export function Decoder({ target, state, onSet, busy, width }: MechanismProps) {
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  const feedback = useFeedback();
  const domain = domainOf(target, "offset");
  const max = Math.min(domain?.kind === "offset" ? domain.max : N - 1, N - 1);
  const committed = valid(Number(state.offset) || 1, max);
  const [shown, setShown] = useState(committed);

  const D = Math.min(width - 2 * ref.space.lg, 220);
  const R = D / 2;
  const pos = useSharedValue(committed);
  const start = useSharedValue(0);
  const acc = useSharedValue(0);
  const last = useSharedValue(0);
  const live = useSharedValue(false);
  const enabled = useSharedValue(!busy);
  const reduced = useSharedValue(reducedMotion);
  useEffect(() => {
    enabled.set(!busy);
    reduced.set(reducedMotion);
  }, [busy, reducedMotion, enabled, reduced]);

  useEffect(() => {
    if (live.get()) return;
    setShown(committed);
    const here = pos.get();
    const target = here + (((committed - here) % N) + N + N / 2) % N - N / 2;
    pos.set(withTiming(target, settle(reducedMotion)));
  }, [committed, reducedMotion, pos, live]);

  const passed = useCallback((k: number) => {
    feedback.tick();
    setShown(mod(k, N));
  }, [feedback]);
  const commit = useCallback((k: number) => {
    setShown(k);
    onSet("offset", String(k));
  }, [onSet]);

  useAnimatedReaction(
    () => Math.round(pos.get()),
    (now, before) => {
      if (before !== null && now !== before && live.get()) scheduleOnRN(passed, now);
    },
  );

  const pan = usePanGesture({
    enabled,
    maxPointers: 1,
    minDistance: 3,
    onActivate: (e) => {
      "worklet";
      cancelAnimation(pos);
      start.set(pos.get());
      acc.set(0);
      last.set((Math.atan2(e.x - R, -(e.y - R)) * 180) / Math.PI);
      live.set(true);
    },
    onUpdate: (e) => {
      "worklet";
      const a = (Math.atan2(e.x - R, -(e.y - R)) * 180) / Math.PI;
      let d = a - last.get();
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      last.set(a);
      acc.set(acc.get() + d);
      // Turning the disc clockwise brings earlier letters under A.
      pos.set(start.get() - acc.get() / STEP);
    },
    onDeactivate: () => {
      "worklet";
      const r = Math.round(pos.get());
      const m = ((r % N) + N) % N;
      const k = m === 0 ? 1 : Math.min(m, max);
      const dest = r + (k - m);
      pos.set(withTiming(dest, { duration: reduced.get() ? 0 : 160 }, (finished) => {
        if (finished) live.set(false);
      }));
      scheduleOnRN(commit, k);
    },
  });

  const discStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-pos.get() * STEP}deg` }] }));

  const step = (delta: 1 | -1) => {
    if (busy) return;
    let next = valid(shown, max) + delta;
    if (next > max) next = 1;
    if (next < 1) next = max;
    feedback.tick();
    commit(next);
  };

  const inner = D - 2 * 30;
  return (
    <Stage width={width}>
      <GestureDetector gesture={pan}>
        <View
          {...adjustable("Cipher ring", `Shift ${shown}, A becomes ${LETTERS[mod(shown, N)]}`, step)}
          testID="mech-decoder"
          style={[styles.ring, { width: D, height: D, borderRadius: R, backgroundColor: theme.surface, borderColor: theme.rim }]}
        >
          <Ring size={D} radiusInset={6} color={theme.ink} />
          <Animated.View style={[styles.disc, { width: inner, height: inner, borderRadius: inner / 2, backgroundColor: theme.raised, borderColor: theme.rim }, discStyle]}>
            <Ring size={inner} radiusInset={6} color={theme.stamp} />
          </Animated.View>
          {/* The reading window at twelve, over both rings. */}
          <View pointerEvents="none" style={[styles.window, { borderColor: theme.accent, height: 30 + 22 }]} />
          <View pointerEvents="none" style={[styles.hub, { backgroundColor: theme.accent, borderColor: theme.ground }]} />
        </View>
      </GestureDetector>
      <Readout>
        <Text style={readoutText(theme.ink)}>A</Text>
        <Text style={[styles.arrow, { color: theme.inkMuted }]}>→</Text>
        <Text style={readoutText(theme.stamp)} testID="mech-decoder-letter">{LETTERS[mod(shown, N)]}</Text>
      </Readout>
      <Line text={`Shift ${mod(shown, N)} · turn the ring`} />
    </Stage>
  );
}

/** 26 letters around a circle, each upright at its own angle (as a printed wheel). */
const Ring = memo(function Ring({ size, radiusInset, color }: { size: number; radiusInset: number; color: string }) {
  return (
    <>
      {LETTERS.map((l, i) => (
        <View key={l} pointerEvents="none" style={[styles.spoke, { width: size, height: size, transform: [{ rotate: `${i * STEP}deg` }] }]}>
          <Text style={[styles.letter, { color, marginTop: radiusInset }]}>{l}</Text>
        </View>
      ))}
    </>
  );
});

const styles = StyleSheet.create({
  ring: { borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  disc: { position: "absolute", borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  spoke: { position: "absolute", alignItems: "center" },
  letter: { ...ref.type.label, fontVariant: ["tabular-nums"] },
  window: { position: "absolute", top: 2, width: 24, borderWidth: 1.5, borderRadius: ref.radius.tag },
  hub: { position: "absolute", width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  arrow: { ...ref.type.headline },
});
