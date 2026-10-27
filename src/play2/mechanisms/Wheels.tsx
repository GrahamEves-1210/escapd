// Combination wheels for any alphabet (digits, letters, the six symbols): a
// row of vertical tumblers and a submit. Each wheel rolls with the finger and
// seats on a symbol with a tick per symbol passed; tapping above or below
// steps one. CodeWheel (src/render) is digits-only and sized for the v1 pad,
// so this is its general sibling.
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { cancelAnimation, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { SYMBOLS, type WheelAlphabet } from "@/engine/v2";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { Line, MechButton, adjustable, cooldownText, mod, settle } from "./kit";

export const ALPHABET: Record<WheelAlphabet, readonly string[]> = {
  digits: "0123456789".split(""),
  letters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
  symbols: SYMBOLS,
};

const ROW = 44;
const LEAD = 2;
const GAP = ref.space.sm;

function SymbolWheel({ index, symbols, value, onChange, width, disabled }: {
  index: number; symbols: readonly string[]; value: number; onChange: (i: number) => void; width: number; disabled: boolean;
}) {
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  const feedback = useFeedback();
  const n = symbols.length;
  const pos = useSharedValue(value);
  const start = useSharedValue(0);
  const live = useSharedValue(false);
  const enabled = useSharedValue(!disabled);
  const reduced = useSharedValue(reducedMotion);
  // JS's copy of where the wheel is or is rolling to, unwrapped.
  const aim = useRef(value);
  useEffect(() => {
    enabled.set(!disabled);
    reduced.set(reducedMotion);
  }, [disabled, reducedMotion, enabled, reduced]);

  // A value from outside (a reset): roll there the short way.
  useEffect(() => {
    if (live.get() || mod(aim.current, n) === value) return;
    let d = mod(value - aim.current, n);
    if (d > n / 2) d -= n;
    aim.current += d;
    pos.set(withTiming(aim.current, settle(reducedMotion)));
  }, [value, n, reducedMotion, pos, live]);

  const passed = useCallback((rounded: number) => {
    aim.current = rounded;
    feedback.tick();
    onChange(mod(rounded, n));
  }, [feedback, onChange, n]);

  useAnimatedReaction(
    () => Math.round(pos.get()),
    (now, before) => {
      if (before !== null && now !== before && live.get()) scheduleOnRN(passed, now);
    },
  );

  const step = (delta: 1 | -1) => {
    if (disabled) return;
    aim.current += delta;
    feedback.tick();
    onChange(mod(aim.current, n));
    pos.set(withTiming(aim.current, settle(reducedMotion, 160)));
  };

  const pan = usePanGesture({
    enabled,
    maxPointers: 1,
    activeOffsetY: [-6, 6],
    onActivate: () => {
      "worklet";
      cancelAnimation(pos);
      start.set(pos.get());
      live.set(true);
    },
    onUpdate: (e) => {
      "worklet";
      pos.set(start.get() - e.translationY / ROW);
    },
    onDeactivate: (e) => {
      "worklet";
      const fling = reduced.get() ? 0 : (e.velocityY / ROW) * 0.08;
      const dest = Math.round(pos.get() - fling);
      pos.set(withTiming(dest, { duration: reduced.get() ? 0 : 200 }, (finished) => {
        if (finished) live.set(false);
      }));
    },
  });

  // The column holds the alphabet tiled with LEAD spare rows either side; the
  // row in view, LEAD + pos mod n, sits in the middle.
  const column = Array.from({ length: n + 2 * LEAD + 1 }, (_, k) => symbols[mod(k - LEAD, n)]);
  const columnStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ROW - (LEAD + mod(pos.get(), n)) * ROW }] }));

  return (
    <GestureDetector gesture={pan}>
      <View
        {...adjustable(`Wheel ${index + 1}`, symbols[value], step)}
        testID={`mech-wheel-${index}`}
        style={[styles.wheel, { width, backgroundColor: theme.ground, borderColor: theme.rim }]}
      >
        <Animated.View style={[styles.column, columnStyle]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {column.map((s, k) => (
            <View key={k} style={styles.cell}>
              <Text style={[styles.symbol, { color: theme.ink }]}>{s}</Text>
            </View>
          ))}
        </Animated.View>
        {/* The window: the middle row lit, its neighbours under a shade. */}
        <View pointerEvents="none" style={[styles.shade, styles.top, { backgroundColor: theme.ground }]} />
        <View pointerEvents="none" style={[styles.shade, styles.bottom, { backgroundColor: theme.ground }]} />
        <View pointerEvents="none" style={[styles.window, { borderColor: theme.accent }]} />
        <Pressable accessible={false} style={[styles.tap, styles.top]} onPress={() => step(-1)} testID={`mech-wheel-${index}-prev`} />
        <Pressable accessible={false} style={[styles.tap, styles.bottom]} onPress={() => step(1)} testID={`mech-wheel-${index}-next`} />
      </View>
    </GestureDetector>
  );
}

/** N wheels and a submit. Submit sends one symbol per wheel. */
export function WheelBank({ alphabet, count, width, busy, cooldown, done, submitLabel, onSubmit }: {
  alphabet: WheelAlphabet; count: number; width: number; busy: boolean; cooldown: number; done: boolean;
  submitLabel: string; onSubmit: (symbols: string[]) => void;
}) {
  const symbols = ALPHABET[alphabet];
  const [values, setValues] = useState<number[]>(() => Array.from({ length: count }, () => 0));
  useEffect(() => {
    setValues((v) => (v.length === count ? v : Array.from({ length: count }, (_, i) => v[i] ?? 0)));
  }, [count]);
  const setAt = useCallback((i: number, s: number) => setValues((v) => v.map((x, k) => (k === i ? s : x))), []);
  const wheelW = Math.min(60, Math.floor((width - (count - 1) * GAP - 2 * ref.space.lg) / count));
  const waiting = cooldownText(cooldown);
  const blocked = busy || cooldown > 0 || done;
  return (
    <View style={styles.bank}>
      <View style={styles.row}>
        {values.map((v, i) => (
          <SymbolWheel key={i} index={i} symbols={symbols} value={v} onChange={(s) => setAt(i, s)} width={wheelW} disabled={busy || done} />
        ))}
      </View>
      <MechButton label={submitLabel} disabled={blocked} onPress={() => onSubmit(values.map((v) => symbols[v]))} testID="mech-submit" />
      <Line text={done ? "Open" : waiting ?? " "} tone={done || waiting ? "stamp" : "muted"} testID="mech-status" />
    </View>
  );
}

const styles = StyleSheet.create({
  bank: { alignItems: "center", gap: ref.space.lg },
  row: { flexDirection: "row", gap: GAP, justifyContent: "center" },
  wheel: { height: ROW * 3, borderRadius: ref.radius.tag, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", ...ref.curve },
  column: { position: "absolute", left: 0, right: 0, top: 0 },
  cell: { height: ROW, alignItems: "center", justifyContent: "center" },
  symbol: { ...ref.type.counter, fontVariant: ["tabular-nums"], textAlign: "center" },
  shade: { position: "absolute", left: 0, right: 0, height: ROW, opacity: 0.62 },
  top: { top: 0 },
  bottom: { bottom: 0 },
  window: { position: "absolute", left: 2, right: 2, top: ROW, height: ROW, borderTopWidth: 1, borderBottomWidth: 1 },
  tap: { position: "absolute", left: 0, right: 0, height: ROW },
});
