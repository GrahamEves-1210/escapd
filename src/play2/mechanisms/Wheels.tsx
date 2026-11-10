// Combination wheels for any alphabet (digits, letters, the six symbols): a
// row of vertical tumblers and a submit, drawn as the lock they are: brass
// drums engraved with their symbols, round under the light (bright across the
// middle, falling away dark above and below), in an iron housing held by four
// screws, an index mark either side of the row that counts; the submit an
// engraved brass plaque, and once it gives an inked stamp. Each wheel rolls with the finger and
// seats on a symbol with a tick per symbol passed; tapping above or below
// steps one. CodeWheel (src/render) is digits-only and sized for the v1 pad,
// so this is its general sibling.
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  Easing, ReduceMotion, cancelAnimation, useAnimatedReaction, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { CheckIcon } from "@/components/icons";
import { SYMBOLS, type WheelAlphabet } from "@/engine/v2";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { Glint, Line, MechButton, adjustable, cooldownText, justGave, markTry, mod, settle, tryKey, useKept } from "./kit";
import { BRASS, INK, Ink, Screw, inkRect, useGradId } from "./materials";
import type { MechanismTarget } from "./types";

export const ALPHABET: Record<WheelAlphabet, readonly string[]> = {
  digits: "0123456789".split(""),
  letters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
  symbols: SYMBOLS,
};

const ROW = 44;
const LEAD = 2;
const GAP = ref.space.sm;

function SymbolWheel({ index, symbols, value, onChange, width, disabled, done }: {
  index: number; symbols: readonly string[]; value: number; onChange: (i: number) => void; width: number; disabled: boolean;
  /** Solved: held on its symbol, its window in the stamp's colour. */
  done: boolean;
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
    feedback.detent();
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
    feedback.detent();
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
        accessibilityState={{ disabled }}
        testID={`mech-wheel-${index}`}
        style={[styles.wheel, { width }]}
      >
        <Animated.View style={[styles.column, columnStyle]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {column.map((s, k) => (
            <View key={k} style={styles.cell}>
              <Text style={styles.symbol}>{s}</Text>
            </View>
          ))}
        </Animated.View>
        {/* The drum's roundness over its symbols: the middle row in the light, its neighbours turning away. */}
        <Drum w={width} mark={done ? theme.stamp : INK} />
        <Pressable accessible={false} style={[styles.tap, styles.top]} onPress={() => step(-1)} testID={`mech-wheel-${index}-prev`} />
        <Pressable accessible={false} style={[styles.tap, styles.bottom]} onPress={() => step(1)} testID={`mech-wheel-${index}-next`} />
      </View>
    </GestureDetector>
  );
}

/**
 * N wheels and a submit. Submit sends one symbol per wheel. The wheels stay
 * where the player left them after a try: a wrong one keeps them to adjust, a
 * right one (`done`) leaves them on the answer, held, with the submit swapped
 * for a solved stamp.
 */
export function WheelBank({ alphabet, count, width, busy, cooldown, done, submitLabel, doneLabel = "Open", onSubmit, onChange, marks, keep, start, status = true }: {
  alphabet: WheelAlphabet; count: number; width: number; busy: boolean; cooldown: number; done: boolean;
  submitLabel: string; onSubmit: (symbols: string[]) => void;
  /** What the solved stamp says. */
  doneLabel?: string;
  /** A wheel was turned: the last try's note is stale. */
  onChange?: () => void;
  /** A symbol engraved above each wheel (the door's: its clues carry the same symbols). */
  marks?: readonly string[];
  /** Whose wheels these are: what's dialled is kept for it while the room is open. */
  keep?: MechanismTarget;
  /** Where the wheels stand to begin with, and go when it changes (a book's page): over what was kept. */
  start?: readonly string[];
  /** The line under the submit (a cooldown's seconds): off where there's never one (a book's pages). */
  status?: boolean;
}) {
  const symbols = ALPHABET[alphabet];
  const indexOf = (s: string | undefined) => Math.max(0, s === undefined ? 0 : symbols.indexOf(s));
  const fromStart = () => Array.from({ length: count }, (_, i) => indexOf(start?.[i]));
  const [values, setValues] = useKept<number[]>(keep, `wheels:${alphabet}`, fromStart);
  const startKey = start?.join("|");
  useEffect(() => {
    if (startKey !== undefined) setValues(fromStart());
    // A new start (the page turned): only that moves the wheels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startKey]);
  useEffect(() => {
    setValues((v) => (v.length === count ? v : Array.from({ length: count }, (_, i) => v[i] ?? 0)));
  }, [count, setValues]);
  const setAt = useCallback((i: number, s: number) => {
    setValues((v) => v.map((x, k) => (k === i ? s : x)));
    onChange?.();
  }, [setValues, onChange]);
  // Just opened (the close-up mounts it afresh with the answer): the final click. The wheels seat one after
  // another, left to right, each with a detent, and the Open stamp comes down on the last.
  const [gave] = useState(() => done && justGave(tryKey(keep)));
  const feedback = useFeedback();
  const { reducedMotion } = useTheme();
  useEffect(() => {
    if (!gave) return;
    const timers = Array.from({ length: count }, (_, i) => setTimeout(feedback.detent, CLICK.firstMs + i * CLICK.staggerMs));
    return () => timers.forEach(clearTimeout);
    // Once, on the mount just after the code was tried.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const wheelW = Math.min(58, Math.floor((width - (count - 1) * GAP - 2 * ref.space.lg - 2 * PAD) / count));
  const waiting = cooldownText(cooldown);
  const blocked = busy || cooldown > 0;
  return (
    <View style={styles.bank}>
      <View style={styles.housing}>
        <Housing />
        {values.map((v, i) => (
          <View key={i} style={styles.marked}>
            {marks ? <Text style={styles.mark} accessibilityLabel={`Wheel marked ${marks[i]}`}>{marks[i]}</Text> : null}
            <Seat at={gave && !reducedMotion ? CLICK.firstMs + i * CLICK.staggerMs : null}>
              <SymbolWheel index={i} symbols={symbols} value={v} onChange={(s) => setAt(i, s)} width={wheelW} disabled={busy || done} done={done} />
            </Seat>
          </View>
        ))}
      </View>
      {done ? (
        <Solved label={doneLabel} stampAt={gave && !reducedMotion ? CLICK.firstMs + count * CLICK.staggerMs : null} />
      ) : (
        <MechButton
          label={submitLabel}
          disabled={blocked}
          onPress={() => {
            markTry(tryKey(keep));
            onSubmit(values.map((v) => symbols[v]));
          }}
          testID="mech-submit"
        />
      )}
      {status ? <Line text={waiting && !done ? waiting : " "} tone={waiting ? "stamp" : "muted"} testID="mech-status" /> : null}
    </View>
  );
}

/** A drum's shading and furniture, over its symbols: round under the light, a flange each side, an index mark either side of the row in play. */
const Drum = memo(function Drum({ w, mark }: { w: number; mark: string }) {
  const g = useGradId()("dr");
  const h = ROW * 3;
  const edge = useMemo(() => inkRect(1, 1, w - 2, h - 2, 8, 401 + w, 0.4), [w, h]);
  const mid = h / 2;
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id={g.id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#120A04" stopOpacity={0.92} />
          <Stop offset="0.2" stopColor="#120A04" stopOpacity={0.5} />
          <Stop offset="0.35" stopColor="#120A04" stopOpacity={0} />
          <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0.3} />
          <Stop offset="0.56" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="0.66" stopColor="#120A04" stopOpacity={0} />
          <Stop offset="0.82" stopColor="#120A04" stopOpacity={0.55} />
          <Stop offset="1" stopColor="#120A04" stopOpacity={0.94} />
        </LinearGradient>
      </Defs>
      <Rect width={w} height={h} rx={8} fill={g.url} />
      {/* Flanges. */}
      <Rect x={0} y={0} width={3.5} height={h} fill={BRASS.deep} fillOpacity={0.7} />
      <Rect x={w - 3.5} y={0} width={3.5} height={h} fill={BRASS.deep} fillOpacity={0.7} />
      <Path d={`M4.2 ${ROW * 0.6}V${h - ROW * 0.6}`} stroke={BRASS.sheen} strokeOpacity={0.35} strokeWidth={1} />
      {/* The index: a notch either side of the row that counts. */}
      <Path d={`M3.5 ${mid - 5}L9 ${mid}L3.5 ${mid + 5}ZM${w - 3.5} ${mid - 5}L${w - 9} ${mid}L${w - 3.5} ${mid + 5}Z`} fill={mark} />
      <Ink d={edge} w={1.8} />
    </Svg>
  );
});

/** The iron the drums sit in: dark, a line of light along its top, a brass screw in each corner. */
const Housing = memo(function Housing() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.iron]} pointerEvents="none">
      <View style={styles.ironLight} />
      {[styles.tl, styles.tr, styles.bl, styles.br].map((at, i) => (
        <Svg key={i} width={8} height={8} viewBox="0 0 8 8" style={[styles.corner, at]}>
          <Screw cx={4} cy={4} r={2.8} turn={[20, -40, 70, -15][i]} />
        </Svg>
      ))}
    </View>
  );
});

/** A lock's final click: when the first wheel seats, and how far apart the rest follow (ms). */
export const CLICK = { firstMs: 60, staggerMs: 75, drop: 4 } as const;

/** A wheel seating: down a few points into its bed at `at` ms, and back up on a stiff spring. Still: nothing. */
function Seat({ at, children }: { at: number | null; children: ReactNode }) {
  const y = useSharedValue(0);
  useEffect(() => {
    if (at === null) return;
    y.set(withDelay(at, withSequence(
      withTiming(CLICK.drop, { duration: 60, easing: Easing.in(Easing.quad), reduceMotion: ReduceMotion.Never }),
      withSpring(0, { mass: 0.5, damping: 8, stiffness: 520, reduceMotion: ReduceMotion.Never }),
    )));
  }, [at, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** In the submit's place once it's done: a stamp with a tick, the same size, so nothing below moves. Just opened, it stamps down (`stampAt` ms) and catches the light. */
function Solved({ label, stampAt = null }: { label: string; stampAt?: number | null }) {
  const theme = useModeTheme();
  const k = useSharedValue(stampAt === null ? 1 : 0);
  useEffect(() => {
    if (stampAt === null) return;
    k.set(withDelay(stampAt, withTiming(1, { duration: 150, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never })));
  }, [stampAt, k]);
  const style = useAnimatedStyle(() => {
    const p = k.get();
    return { opacity: Math.min(1, p * 2), transform: [{ scale: 1.45 - 0.45 * p }, { rotate: `${-3 + (1 - p) * -6}deg` }] };
  });
  // A rubber stamp's mark: a doubled frame, its capitals in the mode's book face, never quite square on.
  return (
    <Animated.View style={[styles.solved, { borderColor: theme.stamp }, style]} accessible accessibilityRole="text" accessibilityLabel={label} testID="mech-solved">
      <View style={[styles.solvedInner, { borderColor: theme.stamp }]}>
        <CheckIcon size={17} weight="bold" color={theme.stamp} />
        <Text style={[styles.solvedLabel, { color: theme.stamp, fontFamily: theme.display.fontFamily }]}>{label}</Text>
      </View>
      {stampAt === null ? null : <Glint delay={stampAt + 160} radius={6} />}
    </Animated.View>
  );
}

/** The housing's padding round the drums. */
const PAD = 9;

const styles = StyleSheet.create({
  bank: { alignItems: "center", gap: ref.space.plate },
  housing: { flexDirection: "row", gap: GAP, justifyContent: "center", padding: PAD, paddingHorizontal: PAD + 4 },
  iron: { backgroundColor: "#1B161D", borderRadius: 13, borderWidth: 1.8, borderColor: INK },
  ironLight: { position: "absolute", left: 10, right: 10, top: 1.5, height: 1.5, borderRadius: 1, backgroundColor: "rgba(255, 240, 220, 0.16)" },
  corner: { position: "absolute" },
  tl: { left: 2.5, top: 2.5 },
  tr: { right: 2.5, top: 2.5 },
  bl: { left: 2.5, bottom: 2.5 },
  br: { right: 2.5, bottom: 2.5 },
  marked: { alignItems: "center", gap: ref.space.xs },
  // Cut into the iron over its drum, filled with brass.
  mark: { ...ref.type.headline, color: BRASS.light, textAlign: "center" },
  wheel: { height: ROW * 3, borderRadius: 8, overflow: "hidden", backgroundColor: BRASS.mid },
  column: { position: "absolute", left: 0, right: 0, top: 0 },
  // Each symbol on its own facet: a fine groove between them.
  cell: { height: ROW, alignItems: "center", justifyContent: "center", borderBottomWidth: 1, borderBottomColor: "rgba(70, 44, 10, 0.45)" },
  // Engraved: dark in the cut, a line of light on its lower lip.
  symbol: {
    ...ref.type.counter, fontVariant: ["tabular-nums"], textAlign: "center", color: "#2A1A0C",
    textShadowColor: "rgba(255, 244, 214, 0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0,
  },
  top: { top: 0 },
  bottom: { bottom: 0 },
  tap: { position: "absolute", left: 0, right: 0, height: ROW },
  solved: { minHeight: ref.hit.min, minWidth: 150, borderRadius: 7, borderWidth: 2.4, padding: 3, ...ref.curve },
  solvedInner: {
    flex: 1, borderRadius: 4, borderWidth: 1, paddingHorizontal: ref.space.lg,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: ref.space.sm,
  },
  solvedLabel: { fontSize: 17, lineHeight: 22, letterSpacing: 2.4, textTransform: "uppercase", textAlign: "center" },
});
