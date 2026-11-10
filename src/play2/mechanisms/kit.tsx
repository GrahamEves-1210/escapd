// Shared parts for the mechanisms: the stage, buttons and lines, accessibility
// helpers, the rattle, and the pull-to-commit drag that drawers, cloths and
// frames share. Mode colours only (useModeTheme); sizes from `ref`.
import { memo, useCallback, useEffect, useState, type ReactNode } from "react";
import { StyleSheet, Text, View, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from "react-native";
import { usePanGesture } from "react-native-gesture-handler";
import Animated, {
  Easing, ReduceMotion, cancelAnimation, useAnimatedReaction, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { RingPressable } from "@/render/parts";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import type { ControlDomain } from "@/engine/v2";
import { BRASS, INK, STEEL, Screw, useGradId } from "./materials";
import type { MechanismTarget } from "./types";

/** The height a mechanism's drawing gets; its readout or button sits under it. */
export const STAGE = 200;
/** How far past its travel a pull must go to commit (0..1). */
export const COMMIT_AT = 0.6;

/** A settle: short ease-out, never skipped by the OS setting (callers pass 0 duration under reduced motion). */
export const settle = (reduced: boolean, duration = 220) =>
  ({ duration: reduced ? 0 : duration, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }) as const;

export const clamp = (v: number, lo: number, hi: number) => {
  "worklet";
  return Math.min(hi, Math.max(lo, v));
};

export const mod = (n: number, m: number) => {
  "worklet";
  return ((n % m) + m) % m;
};

/** One control's domain on the target, if it has it. */
export function domainOf(target: MechanismTarget, control: string): ControlDomain | undefined {
  return target.controls.find((c) => c.id === control)?.domain;
}

/** Props that make a View one adjustable control: increment and decrement step and commit. */
export function adjustable(label: string, valueText: string, step: (delta: 1 | -1) => void) {
  return {
    accessible: true,
    accessibilityRole: "adjustable" as const,
    accessibilityLabel: label,
    accessibilityValue: { text: valueText },
    accessibilityActions: [{ name: "increment" }, { name: "decrement" }],
    onAccessibilityAction: (e: AccessibilityActionEvent) => {
      if (e.nativeEvent.actionName === "increment") step(1);
      if (e.nativeEvent.actionName === "decrement") step(-1);
    },
  };
}

/** Props that make a drawn thing one button for a screen reader: activate does the physical verb. */
export function activatable(label: string, hint: string, act: () => void, disabled = false) {
  return {
    accessible: true,
    accessibilityRole: "button" as const,
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityState: { disabled },
    accessibilityActions: [{ name: "activate" }],
    onAccessibilityAction: (e: AccessibilityActionEvent) => {
      if (e.nativeEvent.actionName === "activate" && !disabled) act();
    },
  };
}

/** The mechanism's frame: its width, centred, about 280 tall with its line or button. */
export function Stage({ width, children, style }: { width: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.stage, { width }, style]}>{children}</View>;
}

/** A quiet line under a mechanism (a hint, the state). `tone="stamp"` for Locked, Open and the cooldown. */
export function Line({ text, tone = "muted", testID }: { text: string; tone?: "muted" | "stamp"; testID?: string }) {
  const theme = useModeTheme();
  return (
    <Text
      style={[tone === "stamp" ? styles.stampLine : styles.line, { color: tone === "stamp" ? theme.stamp : theme.inkMuted }]}
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      {text}
    </Text>
  );
}

/** A readout in the counter face: a time, a frequency, a page. */
export function Readout({ children, testID }: { children: ReactNode; testID?: string }) {
  const theme = useModeTheme();
  return <View style={styles.readoutRow} testID={testID}>{typeof children === "string" ? <Text style={[styles.readout, { color: theme.ink }]}>{children}</Text> : children}</View>;
}

export function readoutText(ink: string) {
  return [styles.readout, { color: ink }];
}

/**
 * A button, as a thing on the mechanism: an engraved brass plaque held by two screws (primary), or a small
 * blued-steel key (secondary, for steppers). It sinks a point when pressed.
 */
export function MechButton({
  label, onPress, disabled = false, tone = "primary", accessibilityLabel, testID, compact = false,
}: {
  label: string; onPress: () => void; disabled?: boolean; tone?: "primary" | "secondary";
  accessibilityLabel?: string; testID?: string; compact?: boolean;
}) {
  const feedback = useFeedback();
  const primary = tone === "primary";
  return (
    <RingPressable
      ring={compact ? "control" : "pill"}
      radius={compact ? ref.radius.square : 10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        feedback.press();
        onPress();
      }}
      testID={testID}
      style={({ pressed }) => [
        compact ? styles.compact : styles.button,
        { opacity: disabled ? 0.5 : 1, transform: [{ translateY: pressed ? 1.5 : 0 }] },
      ]}
    >
      <Plaque primary={primary} compact={compact} />
      <Text style={[styles.buttonLabel, primary ? styles.engraved : styles.struck]}>{label}</Text>
    </RingPressable>
  );
}

/** The plaque under a button's label: brass (or blued steel), lit from above, inked round, a screw at each end. */
const Plaque = memo(function Plaque({ primary, compact }: { primary: boolean; compact: boolean }) {
  const g = useGradId()("pl");
  const metal = primary ? BRASS : STEEL;
  return (
    <View style={[StyleSheet.absoluteFill, styles.plaque, { borderRadius: compact ? ref.radius.square : 10, borderColor: INK, backgroundColor: metal.mid }]} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={g.id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={metal.sheen} />
            <Stop offset="0.12" stopColor={metal.light} />
            <Stop offset="0.55" stopColor={metal.mid} />
            <Stop offset="1" stopColor={primary ? BRASS.shade : STEEL.deep} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={g.url} />
      </Svg>
      {/* A line cut round its face, a screw at each end. */}
      <View style={[styles.plaqueLine, { borderColor: metal.deep, borderRadius: compact ? 6 : 6 }]} />
      {compact ? null : (
        <View style={styles.screws}>
          <ScrewHead />
          <ScrewHead />
        </View>
      )}
    </View>
  );
});

function ScrewHead() {
  return (
    <Svg width={9} height={9} viewBox="0 0 9 9">
      <Screw cx={4.5} cy={4.5} r={3.2} turn={-28} />
    </Svg>
  );
}

/** The submit line: the cooldown's seconds when one runs, else nothing. */
export function cooldownText(cooldown: number): string | null {
  return cooldown > 0 ? `Try again in ${Math.ceil(cooldown)}s` : null;
}

/** A small horizontal rattle: a locked thing tried. Nothing moves under reduced motion. */
export function useRattle() {
  const { reducedMotion } = useTheme();
  const x = useSharedValue(0);
  const rattle = useCallback(() => {
    if (reducedMotion) return;
    const d = motion.wrongShake.distance;
    const t = motion.wrongShake.duration / 5;
    x.set(withSequence(
      withTiming(-d, { duration: t }), withTiming(d, { duration: t }), withTiming(-d / 2, { duration: t }),
      withTiming(d / 2, { duration: t }), withTiming(0, { duration: t }),
    ));
  }, [reducedMotion, x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return { rattle, style };
}

export type PullAxis = "down" | "up" | "x";

// The moment a thing gives (a drawer pulled past its catch, a lock's code tried), kept across the close-up's
// remount (it mounts its mechanism afresh after every action): mounted again open just after, the
// mechanism plays its final click, once.
const tried = new Map<string, number>();
/** How long after the try a mount still counts as the moment it gave (ms). */
export const JUST_GAVE_MS = 1500;
/** Marks a try on the thing keyed `key` (its kind and id). */
export function markTry(key: string | undefined) {
  if (key) tried.set(key, Date.now());
}
/** Whether the thing keyed `key` was tried just now; asking forgets it, so the click plays once. */
export function justGave(key: string | undefined, now = Date.now()): boolean {
  if (!key) return false;
  const at = tried.get(key);
  tried.delete(key);
  return at !== undefined && now - at < JUST_GAVE_MS;
}
/** Whether the thing keyed `key` was tried just now, without forgetting it (for a part drawn round the one that asks with justGave). */
export function gaveNow(key: string | undefined, now = Date.now()): boolean {
  const at = key ? tried.get(key) : undefined;
  return at !== undefined && now - at < JUST_GAVE_MS;
}
/** The key a target's tries are kept under. */
export const tryKey = (target: MechanismTarget | undefined) => (target ? `${target.kind}:${target.id}` : undefined);

/**
 * A glint: light catching varnish or brass once, a soft bright streak sweeping across whatever it fills
 * (its parent clips it). For a final click. Nothing under reduced motion.
 */
export function Glint({ delay = 0, duration = 560, radius = 0 }: { delay?: number; duration?: number; radius?: number }) {
  const { reducedMotion } = useTheme();
  const [w, setW] = useState(0);
  const t = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion || w <= 0) return;
    t.set(withDelay(delay, withTiming(1, { duration, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.Never })));
  }, [reducedMotion, w, delay, duration, t]);
  const style = useAnimatedStyle(() => {
    const p = t.get();
    return { opacity: p <= 0 || p >= 1 ? 0 : Math.sin(Math.PI * p), transform: [{ translateX: -40 + p * (w + 80) }, { rotate: "22deg" }] };
  });
  if (reducedMotion) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glintClip, { borderRadius: radius }]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.glint, style]}>
        <View style={styles.glintWide} />
        <View style={styles.glintThin} />
      </Animated.View>
    </View>
  );
}

/** A pull's landing at its stop: past it a hair, back on a stiff little spring. Beats with the drawer's thud. */
export const LANDING = { over: 0.05, inMs: 110, delayMs: 0, spring: { mass: 0.6, damping: 9, stiffness: 420 } } as const;

/**
 * Where a drawer, a cushion or a frame gives (0..1 of its travel): the moment it starts to move it's open
 * to the game, so what's inside is there under it, uncovered as it comes, never popping in at the end.
 */
export const GIVE_AT = 0.12;
/** How much of what's inside must show before it can be picked up (0..1 of the travel). */
export const REACH_AT = 0.5;

/**
 * The pull-to-commit drag: `progress` follows the finger from 0 to 1 along
 * `axis` over `range` pt (signed -1..1 for "x"). Past `giveAt` (COMMIT_AT
 * unless given) it commits, while the finger is still down, and keeps
 * following it; let go, it runs home to the end with a little landing. Let
 * go short of it, it falls back. Locked, it gives a few points and rattles
 * (`onLocked`). A tick when the pull crosses COMMIT_AT. `done` holds it at
 * the end. A drag that starts while `busy` holds still; one under way
 * carries on through its own commit. The mechanism stays mounted through
 * its commit (the close-up never remounts it): a refused commit falls back.
 */
export function usePull({ axis, range, done, locked = false, busy, onCommit, onLocked, onUncommit, land, giveAt = COMMIT_AT }: {
  axis: PullAxis; range: number; done: boolean; locked?: boolean; busy: boolean;
  onCommit: () => void; onLocked?: () => void;
  /** The target's tryKey (its tries are marked, for the close-up's other mechanisms). */
  land?: string;
  /** Given: once done it can be pushed back (a drawer shut, a cushion put back), committing this on release. */
  onUncommit?: () => void;
  /** Where it commits (0..1): GIVE_AT for things with an inside, which must be there as it opens. */
  giveAt?: number;
}): {
  progress: SharedValue<number>; gesture: ReturnType<typeof usePanGesture>; commitNow: () => void;
  /** Just pulled open: it is landing at its stop now (a new number each time, for a glint). */
  landed: number;
  /** Open far enough that what's inside can be picked up (REACH_AT). */
  reach: boolean;
} {
  const { reducedMotion } = useTheme();
  const feedback = useFeedback();
  const progress = useSharedValue(done ? 1 : 0);
  // Where it was last sent (0, 1 or -1): the state's settle leaves alone a move already headed there.
  const aim = useSharedValue(done ? 1 : 0);
  const start = useSharedValue(0);
  const live = useSharedValue(false);
  const lockedSV = useSharedValue(locked);
  const reversible = !!onUncommit;
  const enabled = useSharedValue(!done || reversible);
  const doneSV = useSharedValue(done);
  const busySV = useSharedValue(busy);
  // This drag began while something was in flight: it holds still. This drag began shut: it's opening it.
  const inert = useSharedValue(false);
  const opening = useSharedValue(false);
  // Set once this drag has committed: it counts the moment it passes the point, not on release.
  const fired = useSharedValue(false);
  const reduced = useSharedValue(reducedMotion);
  // Bumped as a drag ends: the state is settled again then (a commit answered mid-drag waits for the finger).
  const [released, setReleased] = useState(0);
  const [landed, setLanded] = useState(0);
  const [reach, setReach] = useState(done);

  useEffect(() => {
    lockedSV.set(locked);
    enabled.set(!done || reversible);
    doneSV.set(done);
    busySV.set(busy);
    reduced.set(reducedMotion);
  }, [locked, done, busy, reducedMotion, lockedSV, enabled, reduced, reversible, doneSV, busySV]);

  // Settle to the state once nothing is in flight and no finger is on it (a refused commit falls back; a key
  // used on it opens it, what's inside uncovered as it goes).
  useEffect(() => {
    if (busy || live.get()) return;
    const here = progress.get();
    const to = done ? (here < 0 || aim.get() < 0 ? -1 : 1) : 0;
    if (aim.get() === to) return;
    aim.set(to);
    progress.set(withTiming(to, settle(reducedMotion, 320)));
  }, [done, busy, reducedMotion, progress, aim, live, released]);

  const tick = useCallback(() => feedback.tick(), [feedback]);
  useAnimatedReaction(
    () => Math.abs(progress.get()) >= COMMIT_AT,
    (now, before) => {
      if (before !== null && now !== before && live.get() && !lockedSV.get()) scheduleOnRN(tick);
    },
  );
  useAnimatedReaction(
    () => Math.abs(progress.get()) >= REACH_AT,
    (now, before) => {
      if (now !== before) scheduleOnRN(setReach, now);
    },
  );

  const commit = useCallback(() => {
    markTry(land);
    onCommit();
  }, [onCommit, land]);
  const refuse = useCallback(() => onLocked?.(), [onLocked]);
  const uncommit = useCallback(() => onUncommit?.(), [onUncommit]);
  const release = useCallback(() => setReleased((n) => n + 1), []);
  const thud = useCallback(() => setLanded(Date.now()), []);

  const gesture = usePanGesture({
    enabled,
    maxPointers: 1,
    minDistance: 4,
    onActivate: () => {
      "worklet";
      inert.set(busySV.get());
      if (inert.get()) return;
      cancelAnimation(progress);
      start.set(progress.get());
      live.set(true);
      fired.set(false);
      opening.set(!doneSV.get());
    },
    onUpdate: (e) => {
      "worklet";
      if (inert.get()) return;
      const d = axis === "x" ? e.translationX : axis === "down" ? e.translationY : -e.translationY;
      const lo = axis === "x" ? -1 : 0;
      let v = clamp(start.get() + d / range, lo, 1);
      // Locked: the front gives a few points and stops.
      if (lockedSV.get()) v = clamp(v, axis === "x" ? -0.05 : 0, 0.05);
      progress.set(v);
      // Pulled far enough: it opens now, while the finger is still down (and goes on following it).
      if (opening.get() && !doneSV.get() && !lockedSV.get() && !fired.get() && Math.abs(v) >= giveAt) {
        fired.set(true);
        scheduleOnRN(commit);
      }
    },
    onDeactivate: () => {
      "worklet";
      if (inert.get()) return;
      live.set(false);
      const v = progress.get();
      const end = v < 0 ? -1 : 1;
      const back = { duration: reduced.get() ? 0 : 220, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never };
      const to = (target: number) => {
        aim.set(target);
        progress.set(withTiming(target, back));
      };
      // Home to its stop: past it a hair and back, the thud of it.
      const home = () => {
        aim.set(end);
        if (reduced.get()) {
          progress.set(withTiming(end, back));
          return;
        }
        progress.set(withSequence(
          withTiming(end * (1 + LANDING.over), { duration: LANDING.inMs + Math.round((1 - Math.abs(v)) * 160), easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }),
          withSpring(end, { ...LANDING.spring, reduceMotion: ReduceMotion.Never }),
        ));
        scheduleOnRN(thud);
      };
      if (lockedSV.get()) {
        to(0);
        scheduleOnRN(refuse);
      } else if (opening.get()) {
        if (!fired.get()) to(0);
        // Refused while the finger was down: back it goes.
        else if (!doneSV.get() && !busySV.get()) to(0);
        // Opened, then pushed shut again before letting go.
        else if (doneSV.get() && Math.abs(v) < giveAt) {
          to(0);
          scheduleOnRN(uncommit);
        } else home();
      } else if (Math.abs(v) <= 1 - COMMIT_AT) {
        // Open already: pushed most of the way back closes it again; otherwise it springs back open.
        to(0);
        scheduleOnRN(uncommit);
      } else {
        to(end);
      }
      scheduleOnRN(release);
    },
  });

  const commitNow = useCallback(() => {
    if (busy || done) return;
    if (locked) {
      onLocked?.();
      return;
    }
    aim.set(1);
    progress.set(withTiming(1, settle(reducedMotion, 320)));
    markTry(land);
    onCommit();
  }, [busy, done, locked, onLocked, onCommit, progress, aim, reducedMotion, land]);

  return { progress, gesture, commitNow, landed, reach };
}

// What the player has dialled or picked, kept across the close-up's remounts
// (it mounts its mechanism afresh after every action): per object, under the
// room's own definition (the target's controls list is the definition's, so
// another room, or the same one loaded again, starts clean).
const kept = new WeakMap<object, Map<string, unknown>>();
function shelfFor(definition: object) {
  let shelf = kept.get(definition);
  if (!shelf) kept.set(definition, (shelf = new Map()));
  return shelf;
}

/**
 * useState that outlives a remount: a wrong try keeps what was entered, a
 * right one shows it. Keyed by the target and `slot` ("wheels", "pick").
 */
export function useKept<T>(target: MechanismTarget | undefined, slot: string, initial: () => T) {
  const shelf = target ? shelfFor(target.controls) : null;
  const key = target ? `${target.kind}:${target.id}:${slot}` : "";
  const [value, setValue] = useState<T>(() => (shelf?.has(key) ? (shelf.get(key) as T) : initial()));
  useEffect(() => {
    shelf?.set(key, value);
  }, [shelf, key, value]);
  return [value, setValue] as const;
}

/** "Locked" after a try on a locked thing; cleared when it unlocks. */
export function useLockedLine(locked: boolean) {
  const [tried, setTried] = useState(false);
  // Unlocked (it stays mounted now, through a key used on it): the line goes.
  const [was, setWas] = useState(locked);
  if (was !== locked) {
    setWas(locked);
    if (!locked) setTried(false);
  }
  return { showLocked: tried && locked, markTried: () => setTried(true) };
}

const styles = StyleSheet.create({
  glintClip: { overflow: "hidden" },
  glint: { position: "absolute", top: -40, bottom: -40, left: 0, width: 30, flexDirection: "row", gap: 5 },
  glintWide: { width: 16, backgroundColor: "rgba(255,250,236,0.32)" },
  glintThin: { width: 5, backgroundColor: "rgba(255,250,236,0.5)" },
  stage: { alignSelf: "center", alignItems: "center", gap: ref.space.sm, paddingVertical: ref.space.sm },
  line: { ...ref.type.meta, textAlign: "center", minHeight: ref.type.meta.lineHeight },
  stampLine: { ...ref.type.tag, textAlign: "center", minHeight: ref.type.tag.lineHeight },
  readoutRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: ref.space.xs },
  readout: { ...ref.type.counter, fontVariant: ["tabular-nums"], textAlign: "center" },
  button: {
    minHeight: ref.hit.min,
    minWidth: 172,
    paddingHorizontal: ref.space.xl + 6,
    paddingBottom: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  compact: { width: ref.hit.min, height: ref.hit.min, alignItems: "center", justifyContent: "center" },
  buttonLabel: { ...ref.type.headline, textAlign: "center", letterSpacing: 0.4 },
  // Cut into brass: dark in the cut, a line of light on its lower lip.
  engraved: { color: "#2A1A0C", textShadowColor: "rgba(255, 244, 214, 0.55)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0 },
  struck: { color: STEEL.sheen, textShadowColor: "rgba(0, 0, 0, 0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0 },
  plaque: { borderWidth: 1.8, overflow: "hidden" },
  plaqueLine: { position: "absolute", left: 3, right: 3, top: 3, bottom: 3, borderWidth: 1, opacity: 0.5 },
  screws: { ...StyleSheet.absoluteFill, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 },
});
