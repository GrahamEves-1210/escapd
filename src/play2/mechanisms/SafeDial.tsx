// SafeDial: a combination dial on a small safe door. The dial turns with the
// finger, 1:1, no momentum, its numbers passing under a fixed index at twelve
// with a detent a tick. Turning it back the other way registers the number it
// was turned back from (right to the first, left to the second: gadgets/dial.ts);
// the last number is where it's left. Nothing is written anywhere: three brass
// tell-tales drop into their windows as the numbers go in. Pull the lever to
// try it: onSubmit(["30", "10", "20"]). Tried short of three numbers, or while
// a cooldown runs, the lever gives a few degrees and rattles; either way the
// lock lets go of what was dialled. A whole turn one way clears it too.
//
// Rendered in layers (gadget_safe.py): the blackened-steel door with the
// dial's collar, index and tell-tale windows; the dial (lit square on, so its
// light doesn't swing as it turns) under the studio's light as a still layer;
// the lever; a tell-tale.
//
// Without gestures: a tap on the dial's right or left half turns it a tick that
// way; each tell-tale is an adjustable for a screen reader (first, second,
// third number); the lever is a button.
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useFeedback } from "@/game/feedback";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { DIAL_REST, dialled, numberAt, stepNumber, turnDial, type DialWorks } from "./gadgets/dial";
import { GADGET } from "./gadgets/sprites";
import { Glint, Line, Stage, clamp, cooldownText, gaveNow, justGave, markTry, settle, tryKey, useKept } from "./kit";
import { hidden } from "./materials";
import { Sprite } from "./sprites";
import { gadgetDomain, type MechanismProps } from "./types";

/** The door as rendered (gadget_safe.py), in points: the dial's centre and half its box, the lever's hub and box, the tell-tales' windows. */
const DOOR = { w: 330, h: 250 };
const DIAL = { x: 128, y: 130, r: 88 };
const HUB = { x: 260, y: 158, box: 136 };
const FLAGS = [240, 260, 280].map((x) => ({ x, y: 62 }));
const FLAG = { w: 12, h: 18 };
/** The lever: how far it swings open, where a pull tries the lock, and how far a refused one gives (degrees). */
const LEVER = { open: 58, tryAt: 30, stiff: 9, perPoint: 0.85 };
/** How far back the dial must come from as far as it went before it counts as turned the other way (ticks). */
const BACK = 0.75;
const STEPS = [{ name: "increment" }, { name: "decrement" }];
const ACTIVATE = [{ name: "activate" }];
const ORDINAL = ["First", "Second", "Third", "Fourth", "Fifth"];

export function SafeDial({ target, state, onSubmit, onChange, busy, cooldown, width }: MechanismProps) {
  const feedback = useFeedback();
  const { reducedMotion } = useTheme();
  const domain = gadgetDomain(target.submit);
  const size = domain?.kind === "dial" ? domain.size : 40;
  const count = domain?.kind === "dial" ? domain.count : 3;
  const step = 360 / size;
  const open = state.open === true || state.locked === false;

  // What's dialled outlives the close-up's remounts (it mounts its mechanism afresh after every try).
  const [works, setWorks] = useKept<DialWorks>(target, "dial", () => DIAL_REST);
  const live = useRef(works);
  const [held, setHeld] = useState(false);
  // When a drag (the dial's or the lever's) last began or ended: a press that is only the end of one is not a tap.
  const dragged = useRef(0);
  const tapped = useCallback(() => Date.now() - dragged.current > 350, []);
  const hold = useCallback((on: boolean) => {
    dragged.current = Date.now();
    setHeld(on);
  }, []);
  const leverDragged = useCallback(() => {
    dragged.current = Date.now();
  }, []);
  // Mounted just after a try: it gave (the lever swings home), or it didn't (the lever springs back, the tell-tales lift).
  const [gave] = useState(() => gaveNow(tryKey(target)));
  const [refused] = useState(() => !open && justGave(tryKey(target)));

  const set = useCallback((next: DialWorks) => {
    live.current = next;
    setWorks(next);
  }, [setWorks]);

  // -- the dial
  const theta = useSharedValue(works.pos * step);
  const tick = useSharedValue(works.pos);
  const last = useSharedValue(0);
  // This drag: the way the dial is being turned (0: not yet), and as far as it has gone that way (degrees).
  const way = useSharedValue(0);
  const far = useSharedValue(0);
  const turning = useSharedValue(false);
  const enabled = useSharedValue(!busy && !open);
  const reduced = useSharedValue(reducedMotion);
  useEffect(() => {
    enabled.set(!busy && !open);
    reduced.set(reducedMotion);
  }, [busy, open, reducedMotion, enabled, reduced]);

  const turned = useCallback((to: number) => {
    const { works: next, registered, cleared } = turnDial(live.current, to, size, count);
    // A detent a tick; a heavier one when a number goes in.
    if (registered.length) feedback.snap();
    else feedback.detent();
    if (cleared) feedback.tick();
    set(next);
    onChange?.();
  }, [size, count, feedback, set, onChange]);

  const dialPan = usePanGesture({
    enabled,
    maxPointers: 1,
    minDistance: 3,
    onActivate: (e) => {
      "worklet";
      last.set(angleAt(e.x - DIAL.r, e.y - DIAL.r));
      turning.set(true);
      way.set(0);
      far.set(theta.get());
      scheduleOnRN(hold, true);
    },
    onUpdate: (e) => {
      "worklet";
      const dx = e.x - DIAL.r, dy = e.y - DIAL.r;
      // Too near the spindle an angle means nothing.
      if (dx * dx + dy * dy < 14 * 14) return;
      const a = angleAt(dx, dy);
      let d = a - last.get();
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      last.set(a);
      const t = theta.get() + d;
      theta.set(t);
      // The way it is being turned: it changes only once the dial has come back BACK of a tick from as far
      // as it went, so a finger easing off or wavering on a number never counts as turning back.
      let w = way.get();
      if (w !== 0 && (t - far.get()) * w > 0) far.set(t);
      else if (w !== 0 && (far.get() - t) * w > BACK * step) {
        w = -w;
        way.set(w);
        far.set(t);
      }
      // A tick counts as it is passed going that way, never coming back short of a turn: the number it
      // was turned back from is the one that was nearest the index, to the eye.
      const to = Math.round(t / step);
      const at = tick.get();
      if (to !== at && (w === 0 || (to - at) * w > 0)) {
        if (w === 0) {
          way.set(to > at ? 1 : -1);
          far.set(t);
        }
        tick.set(to);
        scheduleOnRN(turned, to);
      }
    },
    onFinalize: () => {
      "worklet";
      // (A touch that never became a drag is a tap: the halves' own.)
      if (!turning.get()) return;
      turning.set(false);
      // Let go: it seats on its tick.
      theta.set(withTiming(tick.get() * step, { duration: reduced.get() ? 0 : 90, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }));
      scheduleOnRN(hold, false);
    },
  });

  const nudge = (delta: 1 | -1) => {
    if (busy || open || !tapped()) return;
    const to = live.current.pos + delta;
    tick.set(to);
    theta.set(withTiming(to * step, settle(reducedMotion, 110)));
    turned(to);
  };

  // A screen reader's way in: each number set directly.
  const adjust = (i: number, delta: 1 | -1) => {
    if (busy || open) return;
    const next = stepNumber(live.current, i, delta, size, count);
    feedback.detent();
    tick.set(next.pos);
    theta.set(withTiming(next.pos * step, settle(reducedMotion, 110)));
    set(next);
    onChange?.();
  };

  // -- the lever
  const ready = dialled(works, size, count);
  const lever = useSharedValue(open ? (gave && !reducedMotion ? LEVER.tryAt : LEVER.open) : refused && !reducedMotion ? LEVER.stiff : 0);
  const stiff = useSharedValue(true);
  const fired = useSharedValue(false);
  const pulling = useSharedValue(false);
  const leverOn = useSharedValue(!busy && !open);
  useEffect(() => {
    leverOn.set(!busy && !open);
    stiff.set(!ready || cooldown > 0);
  }, [busy, open, ready, cooldown, leverOn, stiff]);
  useEffect(() => {
    if (open) {
      lever.set(gave && !reducedMotion
        ? withSequence(
          withTiming(LEVER.open + 4, { duration: 150, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }),
          withSpring(LEVER.open, { mass: 0.6, damping: 9, stiffness: 420, reduceMotion: ReduceMotion.Never }),
        )
        : LEVER.open);
    } else if (refused && !reducedMotion) {
      // It didn't give: the lever shudders back up.
      lever.set(withSequence(
        withTiming(LEVER.stiff + 3, { duration: 50 }), withTiming(2, { duration: 70 }), withTiming(5, { duration: 60 }), withTiming(0, { duration: 90 }),
      ));
    }
    // Once, as it mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tryIt = useCallback(() => {
    const value = dialled(live.current, size, count);
    if (!value || cooldown > 0 || busy || open) return;
    markTry(tryKey(target));
    // Tried: right or wrong, the lock lets go of what was dialled (the dial stays where it is).
    set({ ...live.current, entered: [], dir: 0, run: 0 });
    onSubmit(value);
  }, [size, count, cooldown, busy, open, target, set, onSubmit]);

  const balk = useCallback(() => {
    feedback.warning();
    // Short of its numbers, the lock lets go of the ones it had; cooling down, it keeps them.
    if (cooldown <= 0 && live.current.entered.length) set({ ...live.current, entered: [], dir: 0, run: 0 });
  }, [feedback, cooldown, set]);

  const pull = () => {
    if (busy || open) return;
    if (!ready || cooldown > 0) {
      if (!reducedMotion) lever.set(withSequence(withTiming(LEVER.stiff, { duration: 70 }), withTiming(1, { duration: 70 }), withTiming(4, { duration: 60 }), withTiming(0, { duration: 80 })));
      balk();
      return;
    }
    if (!reducedMotion) lever.set(withTiming(LEVER.tryAt, { duration: 140 }));
    tryIt();
  };

  const leverPan = usePanGesture({
    enabled: leverOn,
    maxPointers: 1,
    minDistance: 3,
    onActivate: () => {
      "worklet";
      fired.set(false);
      pulling.set(true);
      scheduleOnRN(leverDragged);
    },
    onUpdate: (e) => {
      "worklet";
      const max = stiff.get() ? LEVER.stiff : LEVER.open * 0.8;
      const a = clamp(e.translationY * LEVER.perPoint, 0, max);
      lever.set(a);
      if (!stiff.get() && !fired.get() && a >= LEVER.tryAt) {
        fired.set(true);
        scheduleOnRN(tryIt);
      }
    },
    onFinalize: () => {
      "worklet";
      if (!pulling.get()) return;
      pulling.set(false);
      scheduleOnRN(leverDragged);
      if (fired.get()) return;
      const balked = stiff.get() && lever.get() > LEVER.stiff * 0.6;
      lever.set(withTiming(0, { duration: reduced.get() ? 0 : 140 }));
      if (balked) scheduleOnRN(balk);
    },
  });

  const dialStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${theta.get()}deg` }] }));
  const leverStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${lever.get()}deg` }] }));

  // The door is laid out at the size it was rendered and, on a narrower screen, shrunk whole.
  const k = Math.min(width, DOOR.w) / DOOR.w;
  const waiting = cooldownText(cooldown);
  // Which tell-tales are down: one a registered number, the last once the dial is let go on it.
  const down = (i: number) => open || (i < count - 1 ? i < works.entered.length : !!ready && !held);
  const valueText = (i: number) => (i < count - 1
    ? (works.entered[i] !== undefined ? String(works.entered[i]) : "not set")
    : ready ? String(numberAt(works.pos, size)) : "not set");

  return (
    <Stage width={width}>
      <View style={{ width: DOOR.w * k, height: DOOR.h * k }}>
        <View style={[styles.door, { transform: [{ scale: k }] }]} testID={open ? "mech-safe-open" : "mech-safe"}>
          <Sprite source={GADGET.safeDoor} w={DOOR.w} h={DOOR.h} style={styles.at} />
          {/* The tell-tales: each drops into its window as its number goes in. */}
          {FLAGS.slice(0, count).map((f, i) => (
            <View
              key={i}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={`${ORDINAL[i]} number`}
              accessibilityValue={{ text: valueText(i) }}
              accessibilityActions={STEPS}
              onAccessibilityAction={(e) => adjust(i, e.nativeEvent.actionName === "increment" ? 1 : -1)}
              accessibilityState={{ disabled: busy || open }}
              style={[styles.window, { left: f.x - FLAG.w / 2, top: f.y - FLAG.h / 2 }]}
              testID={down(i) ? `mech-telltale-${i}-down` : `mech-telltale-${i}`}
            >
              <Telltale down={down(i)} from={refused} />
            </View>
          ))}
          <GestureDetector gesture={dialPan}>
            <View style={styles.dial} testID="mech-safe-dial" {...hidden}>
              <Animated.View style={[styles.at, dialStyle]} pointerEvents="none">
                <Sprite source={GADGET.safeDial} w={DIAL.r * 2} h={DIAL.r * 2} />
              </Animated.View>
              {/* The lamp's light on the brass, still while the brass turns under it. */}
              <Sprite source={GADGET.safeDialLight} w={DIAL.r * 2} h={DIAL.r * 2} style={styles.at} />
              <Pressable accessible={false} style={[styles.half, styles.leftHalf]} onPress={() => nudge(-1)} testID="mech-safe-left" />
              <Pressable accessible={false} style={[styles.half, styles.rightHalf]} onPress={() => nudge(1)} testID="mech-safe-right" />
            </View>
          </GestureDetector>
          <GestureDetector gesture={leverPan}>
            <Pressable
              accessible
              accessibilityRole="button"
              accessibilityLabel="Pull the handle"
              accessibilityHint={open ? "The safe is open" : "Tries the combination"}
              accessibilityState={{ disabled: busy || open }}
              accessibilityActions={ACTIVATE}
              onAccessibilityAction={() => pull()}
              onPress={() => (tapped() ? pull() : undefined)}
              style={styles.lever}
              testID="mech-safe-handle"
            >
              <Animated.View style={[styles.leverArt, leverStyle]} pointerEvents="none">
                <Sprite source={GADGET.safeHandle} w={HUB.box} h={HUB.box} />
              </Animated.View>
            </Pressable>
          </GestureDetector>
          {open && gave ? <Glint delay={160} radius={16} /> : null}
        </View>
      </View>
      <Line text={waiting && !open ? waiting : " "} tone="stamp" testID="mech-status" />
    </Stage>
  );
}

/** A tell-tale in its window: up out of sight, or dropped into it on a little spring. `from`: it starts down and lifts (a try refused). */
function Telltale({ down, from }: { down: boolean; from: boolean }) {
  const { reducedMotion } = useTheme();
  const y = useSharedValue(down || (from && !reducedMotion) ? 0 : -FLAG.h);
  useEffect(() => {
    if (reducedMotion) {
      y.set(down ? 0 : -FLAG.h);
      return;
    }
    y.set(down
      ? withSpring(0, { mass: 0.5, damping: 11, stiffness: 520, reduceMotion: ReduceMotion.Never })
      : withTiming(-FLAG.h, { duration: 160, easing: Easing.in(Easing.quad), reduceMotion: ReduceMotion.Never }));
  }, [down, reducedMotion, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return (
    <Animated.View style={style} pointerEvents="none">
      <Sprite source={GADGET.safeTelltale} w={FLAG.w} h={FLAG.h} />
    </Animated.View>
  );
}

/** Degrees clockwise from twelve, 0..360, of a point relative to the centre. */
function angleAt(dx: number, dy: number) {
  "worklet";
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return deg < 0 ? deg + 360 : deg;
}

const styles = StyleSheet.create({
  door: { width: DOOR.w, height: DOOR.h, transformOrigin: "left top" },
  at: { position: "absolute", left: 0, top: 0 },
  window: { position: "absolute", width: FLAG.w, height: FLAG.h, overflow: "hidden", borderRadius: 2.5 },
  dial: { position: "absolute", left: DIAL.x - DIAL.r, top: DIAL.y - DIAL.r, width: DIAL.r * 2, height: DIAL.r * 2, borderRadius: DIAL.r },
  half: { position: "absolute", top: 0, bottom: 0, width: DIAL.r },
  leftHalf: { left: 0 },
  rightHalf: { right: 0 },
  // The lever's reach: its hub and the sweep of its grip (not the dial beside it).
  lever: { position: "absolute", left: HUB.x - 26, top: HUB.y - 30, width: 26 + 62, height: 30 + 62 + ref.space.sm, overflow: "visible" },
  leverArt: { position: "absolute", left: 26 - HUB.box / 2, top: 30 - HUB.box / 2, width: HUB.box, height: HUB.box },
});
