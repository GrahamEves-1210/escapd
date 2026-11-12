// Show, never tell: a close-up has no line under it saying "Pull it toward
// you". If the player has done nothing in a close-up for a few seconds, and
// only the first time they meet that kind of mechanism in a game, a ghost of
// a fingertip does the gesture once or twice over the thing (down a drawer's
// front, up off a rug, round a clock's face) and is gone. No words. A touch
// anywhere puts it away; working a mechanism unprompted means its kind is
// never nudged. Screen readers don't get it (each mechanism's own label and
// hint say the verb). Reduced motion: the fingertip and an inked arrow, still.
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useTheme } from "@/theme/ThemeProvider";
import { InkMark, type InkName } from "./Ink";
import { hidden } from "./materials";

export const NUDGE = {
  /** The player does nothing in the close-up this long before the ghost shows (ms). */
  idleMs: 5000,
  /** One pass of the gesture, and how many passes. */
  passMs: 1300,
  passes: 2,
  /** The fingertip's size (points). */
  tip: 38,
  /** Reduced motion: how long the still mark stays. */
  stillMs: 2400,
} as const;

/** A gesture to show, in the mechanism's band: where the finger lands (fractions of the band) and how it moves (points), or round what. */
export interface NudgeMove {
  at: { x: number; y: number };
  /** A straight pull. */
  by?: { x: number; y: number };
  /** A turn: round a centre `r` points away (the finger starts straight above it), through `deg` degrees clockwise. */
  turn?: { r: number; deg: number };
}

/** What's worked by a gesture that isn't a tap: its kind (one nudge per kind per game) and the gesture. Null: nothing to show. */
export function nudgeFor(target: { archetype: string | null; variant?: string; label: string }): { kind: string; move: NudgeMove } | null {
  switch (target.archetype) {
    case "Drawer":
      return target.variant === "compartment"
        ? { kind: "Drawer:compartment", move: { at: { x: 0.74, y: 0.5 }, by: { x: -84, y: 0 } } }
        : { kind: "Drawer:drawer", move: { at: { x: 0.5, y: 0.36 }, by: { x: 0, y: 62 } } };
    case "LiftUnder":
      return { kind: "LiftUnder", move: { at: { x: 0.5, y: 0.66 }, by: { x: 0, y: -64 } } };
    case "FrameTilt":
      return { kind: "FrameTilt", move: { at: { x: 0.5, y: 0.42 }, by: { x: 66, y: 0 } } };
    case "ClockHands":
      return { kind: "ClockHands", move: { at: { x: 0.5, y: 0.22 }, turn: { r: 62, deg: 80 } } };
    case "TuningDial":
      return { kind: "TuningDial", move: { at: { x: 0.42, y: 0.34 }, by: { x: 70, y: 0 } } };
    case "CombinationLock":
      return { kind: "Wheels", move: { at: { x: 0.5, y: 0.5 }, by: { x: 0, y: -44 } } };
    case "Readable":
      // Only a book with page wheels under it (a card on a shelf is just read).
      return target.variant === "pages" ? { kind: "Wheels", move: { at: { x: 0.5, y: 0.62 }, by: { x: 0, y: -44 } } } : null;
    case "Door":
      // Only a door with wheels on it (an accusation's or a ritual's choices are tapped).
      return target.variant === "combination" ? { kind: "Wheels", move: { at: { x: 0.5, y: 0.45 }, by: { x: 0, y: -44 } } } : null;
    default:
      return null;
  }
}

/** The kinds already shown (or worked unprompted), per game: in memory, for as long as the app is open. */
const known = new Map<string, Set<string>>();
const kindsOf = (game: string) => known.get(game) ?? known.set(game, new Set()).get(game)!;
/** A game started over: its mechanisms are new again. */
export function forgetNudges(game?: string) {
  if (game === undefined) known.clear();
  else known.delete(game);
}

/**
 * When to nudge, for one close-up. `show` goes true once the player has been idle `NUDGE.idleMs` in a close-up
 * whose mechanism they haven't met (and that isn't already worked: `done`). `touch` (any touch in the close-up)
 * puts it away and starts the wait again; `worked` (they did it themselves) retires the kind.
 */
export function useNudge(game: string, target: { archetype: string | null; variant?: string; label: string }, done: boolean) {
  const info = nudgeFor(target);
  const kind = info?.kind ?? null;
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!kind || done || kindsOf(game).has(kind)) return;
    timer.current = setTimeout(() => {
      kindsOf(game).add(kind);
      setShow(true);
    }, NUDGE.idleMs);
  }, [game, kind, done]);
  useEffect(() => {
    arm();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [arm]);
  const touch = useCallback(() => {
    setShow(false);
    arm();
  }, [arm]);
  const worked = useCallback(() => {
    if (kind) kindsOf(game).add(kind);
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setShow(false);
  }, [game, kind]);
  const over = useCallback(() => setShow(false), []);
  return { show: show && !done, move: info?.move ?? null, touch, worked, over };
}

const arrowOf = (m: NudgeMove): InkName => (m.turn ? "right" : Math.abs(m.by!.x) > Math.abs(m.by!.y) ? (m.by!.x > 0 ? "right" : "left") : m.by!.y > 0 ? "down" : "up");

/** The ghost: a fingertip that lands, does the gesture, lifts; `passes` times, then `onDone`. Fills the mechanism's band (`width` x `height`). */
export function Nudge({ move, width, height, onDone }: { move: NudgeMove; width: number; height: number; onDone: () => void }) {
  const { reducedMotion } = useTheme();
  const t = useSharedValue(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    if (!reducedMotion) t.set(withRepeat(withTiming(1, { duration: NUDGE.passMs, easing: Easing.linear, reduceMotion: ReduceMotion.Never }), NUDGE.passes, false));
    const end = setTimeout(() => done.current(), reducedMotion ? NUDGE.stillMs : NUDGE.passMs * NUDGE.passes + 60);
    return () => clearTimeout(end);
    // Once, as it mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const x0 = move.at.x * width, y0 = move.at.y * height;
  const bx = move.by?.x ?? 0, by = move.by?.y ?? 0;
  const r = move.turn?.r ?? 0, sweep = ((move.turn?.deg ?? 0) * Math.PI) / 180;
  const tip = useAnimatedStyle(() => {
    const p = t.get();
    // Lands (0 to 0.18), does it (0.22 to 0.72, eased), rests, lifts (0.82 to 1).
    const land = Math.min(1, p / 0.18);
    const go = Math.min(1, Math.max(0, (p - 0.22) / 0.5));
    const eased = go * go * (3 - 2 * go);
    const lift = Math.max(0, (p - 0.82) / 0.18);
    const a = eased * sweep;
    const x = r ? x0 + Math.sin(a) * r : x0 + bx * eased;
    const y = r ? y0 + (1 - Math.cos(a)) * r : y0 + by * eased;
    return { opacity: land * (1 - lift), transform: [{ translateX: x - NUDGE.tip / 2 }, { translateY: y - NUDGE.tip / 2 }, { scale: 1.3 - 0.3 * land + 0.25 * lift }] };
  });
  if (reducedMotion) {
    const a = arrowOf(move);
    const off = a === "down" ? { x: 0, y: 30 } : a === "up" ? { x: 0, y: -30 } : a === "left" ? { x: -30, y: 0 } : { x: 30, y: 0 };
    return (
      <View style={StyleSheet.absoluteFill} {...hidden} testID="v2-nudge">
        <View style={[styles.tip, { left: x0 - NUDGE.tip / 2, top: y0 - NUDGE.tip / 2 }]}><View style={styles.pad} /></View>
        <View style={{ position: "absolute", left: x0 + off.x - 12, top: y0 + off.y - 12 }}><InkMark name={a} size={24} tone="chalk" color="#FFF6E6" weight={2.4} /></View>
      </View>
    );
  }
  return (
    <View style={StyleSheet.absoluteFill} {...hidden} testID="v2-nudge">
      <Animated.View style={[styles.tip, tip]}><View style={styles.pad} /></Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // A fingertip on glass: a pale ring, a soft pad inside it, a shadow so it reads on wood and on felt.
  tip: {
    position: "absolute", left: 0, top: 0, width: NUDGE.tip, height: NUDGE.tip, borderRadius: NUDGE.tip / 2, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "rgba(255, 246, 230, 0.85)", backgroundColor: "rgba(255, 246, 230, 0.16)",
    shadowColor: "#000000", shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  pad: { width: NUDGE.tip * 0.42, height: NUDGE.tip * 0.42, borderRadius: NUDGE.tip * 0.21, backgroundColor: "rgba(255, 246, 230, 0.55)" },
});
