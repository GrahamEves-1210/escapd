// The feel of a thing in hand (the magnifier, a held item): picked up it lifts
// off its spot (a little bigger, a soft shadow under it), follows the finger on
// a spring held just above it, leans into the way it's moving and eases upright
// as the finger slows; let go on nothing it drifts back home on a softer spring,
// let go on something it snaps down into it with a few sparkles. All of it runs
// on the UI thread: one frame callback integrates the springs while something is
// carried and sleeps the rest of the time. Reduced motion: no lift, lean or
// spring; it moves with the finger and fades out and back in at home.
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing, ReduceMotion, useAnimatedStyle, useFrameCallback, useSharedValue, withSequence, withSpring, withTiming, type FrameInfo, type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { ActionResult } from "@/engine/v2";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { Burst } from "./PeekingCat";

/** A spring: stiffness and damping (mass 1). */
type Spring = { k: number; c: number };
const spring = (k: number, zeta: number): Spring => ({ k, c: 2 * Math.sqrt(k) * zeta });

export const CARRY = {
  /** Following the finger: quick, a touch of lag, no wobble. */
  follow: spring(820, 0.82),
  /** Drifting home: softer, settling with the smallest overshoot. */
  home: spring(180, 0.86),
  /** Into a target: quick and firm. */
  snap: spring(600, 0.85),
  /** The lean: a looser spring, so it sways a little as it rights itself. */
  tilt: spring(380, 0.5),
  /** Degrees of lean per point/second of horizontal speed, and the most it leans. */
  tiltPerSpeed: 0.022,
  maxTilt: 16,
  /** The most it ever shows, overshoot included. */
  maxShown: 18,
  /** How much bigger it is in hand. */
  grow: 0.18,
  /** How long the snap takes before it heads home (or vanishes), ms. */
  snapMs: 260,
} as const;

/** The lean for a horizontal speed (points/second): into the motion, clamped. */
export function tiltFor(vx: number): number {
  "worklet";
  return Math.max(-CARRY.maxTilt, Math.min(CARRY.maxTilt, vx * CARRY.tiltPerSpeed));
}

/** What a drop's result means for the thing dropped: it went in and stays held, it was used up, or nothing came of it. */
export function dropOutcome(result: ActionResult | null, itemId: string): "snap" | "vanish" | "home" {
  if (!result || result.outcome !== "ok") return "home";
  return result.effects.some((e) => e.do === "consume" && e.item === itemId) ? "vanish" : "snap";
}

const IDLE = 0, HELD = 1, HOVER = 2, HOME = 3, SNAP = 4, GONE = 5;

export interface Carry {
  /** The body's centre (window points), velocity and lean; its home; where it's headed. */
  x: SharedValue<number>; y: SharedValue<number>;
  hx: SharedValue<number>; hy: SharedValue<number>;
  tx: SharedValue<number>; ty: SharedValue<number>;
  tilt: SharedValue<number>;
  /** 0 at rest, 1 in hand. */
  lift: SharedValue<number>;
  /** The snap's squeeze (1 normally). */
  shrink: SharedValue<number>;
  fade: SharedValue<number>;
  /** What's carried (an item id; "" when nothing is). */
  id: SharedValue<string>;
  phase: SharedValue<number>;
  /** Picked up (worklet): its home centre, the finger, where it rides relative to the finger. */
  grab: (id: string, homeX: number, homeY: number, fingerX: number, fingerY: number, offX: number, offY: number) => void;
  /** The finger moved (worklet). */
  move: (fingerX: number, fingerY: number) => void;
  /** Let go (worklet): it hovers where it is until told where to go. */
  release: () => void;
  /** Back to its home (or a new home, measured since). */
  home: (x?: number, y?: number) => void;
  /** Down into a target (window points), then home (or a new home), or gone. */
  snap: (x: number, y: number, then: "home" | "vanish", homeAt?: () => Promise<{ x: number; y: number } | null>) => void;
  /** Straight home, no flight (the view it was over has gone). */
  reset: () => void;
}

export function useCarry(onSettled: () => void): Carry {
  const { reducedMotion: reduced } = useTheme();
  const x = useSharedValue(0), y = useSharedValue(0), vx = useSharedValue(0), vy = useSharedValue(0);
  const hx = useSharedValue(0), hy = useSharedValue(0), tx = useSharedValue(0), ty = useSharedValue(0);
  const ox = useSharedValue(0), oy = useSharedValue(0);
  const tilt = useSharedValue(0), vt = useSharedValue(0);
  const k = useSharedValue<number>(CARRY.follow.k), c = useSharedValue<number>(CARRY.follow.c);
  const lift = useSharedValue(0), shrink = useSharedValue(1), fade = useSharedValue(1);
  const id = useSharedValue("");
  const phase = useSharedValue(IDLE);

  const settledRef = useRef(onSettled);
  useEffect(() => {
    settledRef.current = onSettled;
  }, [onSettled]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  // The frame callback, woken for a carry and put back to sleep once it's home.
  const loop = useRef<{ setActive: (on: boolean) => void } | null>(null);
  const wake = useCallback(() => loop.current?.setActive(true), []);
  const settled = useCallback(() => {
    loop.current?.setActive(false);
    settledRef.current();
  }, []);

  const step = useCallback((f: FrameInfo) => {
    "worklet";
    const p = phase.get();
    if (p === IDLE || p === GONE) return;
    const dt = Math.min(f.timeSincePreviousFrame ?? 16, 48) / 1000;
    let px = x.get(), py = y.get(), pvx = vx.get(), pvy = vy.get(), t = tilt.get(), pvt = vt.get();
    const gx = tx.get(), gy = ty.get();
    if (reduced) {
      // No springs: it sits where it's headed.
      if (p !== HOME) {
        px = gx; py = gy;
      }
      pvx = 0; pvy = 0; t = 0; pvt = 0;
    } else {
      const sk = k.get(), sc = c.get();
      const n = Math.max(1, Math.ceil(dt / 0.004));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        pvx += (sk * (gx - px) - sc * pvx) * h;
        pvy += (sk * (gy - py) - sc * pvy) * h;
        px += pvx * h;
        py += pvy * h;
        // The lean follows the body's own speed across: into the motion, upright again as it slows.
        pvt += (CARRY.tilt.k * (tiltFor(pvx) - t) - CARRY.tilt.c * pvt) * h;
        t += pvt * h;
      }
      t = Math.max(-CARRY.maxShown, Math.min(CARRY.maxShown, t));
    }
    if (p === HOME && !reduced && Math.hypot(gx - px, gy - py) < 0.6 && Math.hypot(pvx, pvy) < 12 && Math.abs(t) < 0.4 && Math.abs(lift.get()) < 0.02 && Math.abs(shrink.get() - 1) < 0.02) {
      x.set(gx); y.set(gy); vx.set(0); vy.set(0); tilt.set(0); vt.set(0);
      phase.set(IDLE);
      id.set("");
      scheduleOnRN(settled);
      return;
    }
    x.set(px); y.set(py); vx.set(pvx); vy.set(pvy); tilt.set(t); vt.set(pvt);
  }, [phase, x, y, vx, vy, tilt, vt, tx, ty, k, c, lift, shrink, id, reduced, settled]);
  const frames = useFrameCallback(step, false);
  useEffect(() => {
    loop.current = frames;
  }, [frames]);

  return useMemo<Carry>(() => {
    const aim = (s: Spring) => {
      "worklet";
      k.set(s.k);
      c.set(s.c);
    };
    const grab = (what: string, homeX: number, homeY: number, fingerX: number, fingerY: number, offX: number, offY: number) => {
      "worklet";
      if (phase.get() === IDLE) {
        x.set(homeX); y.set(homeY); vx.set(0); vy.set(0); tilt.set(0); vt.set(0);
        hx.set(homeX); hy.set(homeY);
      }
      id.set(what);
      ox.set(offX); oy.set(offY);
      tx.set(fingerX + offX); ty.set(fingerY + offY);
      aim(CARRY.follow);
      phase.set(HELD);
      lift.set(reduced ? 0 : withSpring(1, { mass: 1, damping: 26, stiffness: 260 }));
      shrink.set(1);
      fade.set(1);
      scheduleOnRN(wake);
    };
    const move = (fingerX: number, fingerY: number) => {
      "worklet";
      if (phase.get() !== HELD) return;
      tx.set(fingerX + ox.get());
      ty.set(fingerY + oy.get());
    };
    const release = () => {
      "worklet";
      if (phase.get() === HELD) phase.set(HOVER);
    };
    const finish = () => {
      "worklet";
      phase.set(IDLE);
      id.set("");
      scheduleOnRN(settled);
    };
    const home = (atX?: number, atY?: number) => {
      if (timer.current) clearTimeout(timer.current);
      if (atX !== undefined && atY !== undefined) {
        hx.set(atX);
        hy.set(atY);
      }
      tx.set(hx.get());
      ty.set(hy.get());
      if (reduced) {
        // Out where it was let go, back in at home.
        phase.set(HOME);
        // A fade isn't motion: it plays even with reduced motion on.
        fade.set(withTiming(0, { duration: 140, reduceMotion: ReduceMotion.Never }, () => {
          "worklet";
          // Picked up again meanwhile: it's in hand, not going home.
          if (phase.get() !== HOME) return;
          x.set(hx.get()); y.set(hy.get());
          fade.set(withTiming(1, { duration: 140, reduceMotion: ReduceMotion.Never }));
          finish();
        }));
        return;
      }
      aim(CARRY.home);
      phase.set(HOME);
      lift.set(withSpring(0, { mass: 1, damping: 26, stiffness: 190 }));
      shrink.set(withSpring(1, { mass: 1, damping: 22, stiffness: 240 }));
      wake();
    };
    const vanish = () => {
      phase.set(GONE);
      shrink.set(withTiming(reduced ? 1 : 0.3, { duration: 200, easing: Easing.in(Easing.quad) }));
      fade.set(withTiming(0, { duration: 200, reduceMotion: ReduceMotion.Never }, () => {
        "worklet";
        if (phase.get() === GONE) finish();
      }));
    };
    const snap = (atX: number, atY: number, then: "home" | "vanish", homeAt?: () => Promise<{ x: number; y: number } | null>) => {
      if (timer.current) clearTimeout(timer.current);
      tx.set(atX);
      ty.set(atY);
      if (reduced) {
        if (then === "vanish") vanish();
        else if (homeAt) homeAt().then((r) => home(r?.x, r?.y));
        else home();
        return;
      }
      aim(CARRY.snap);
      phase.set(SNAP);
      wake();
      // Down into it, a quick settle.
      lift.set(withTiming(0, { duration: 160 }));
      shrink.set(withSequence(withTiming(0.62, { duration: 150, easing: Easing.out(Easing.cubic) }), withSpring(0.74, { mass: 1, damping: 9, stiffness: 320 })));
      timer.current = setTimeout(() => {
        timer.current = null;
        if (then === "vanish") vanish();
        else if (homeAt) homeAt().then((r) => home(r?.x, r?.y));
        else home();
      }, CARRY.snapMs);
    };
    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      x.set(hx.get()); y.set(hy.get()); vx.set(0); vy.set(0); tilt.set(0); vt.set(0);
      lift.set(0); shrink.set(1); fade.set(1);
      phase.set(IDLE);
      id.set("");
      settled();
    };
    return { x, y, hx, hy, tx, ty, tilt, lift, shrink, fade, id, phase, grab, move, release, home, snap, reset };
  }, [x, y, vx, vy, hx, hy, tx, ty, ox, oy, tilt, vt, k, c, lift, shrink, fade, id, phase, reduced, wake, settled]);
}

/**
 * A carried thing on screen: the body (leaning, lifted, squeezed by a snap) over its soft shadow. `origin`:
 * where the parent sits in the window, for a body drawn anywhere (an item); or null for one drawn in its own
 * home spot (the magnifier), moved by how far it is from home.
 */
export function CarryBody({ carry, size, origin, grow = CARRY.grow, style, children, testID }: {
  carry: Carry; size: number; origin: { x: number; y: number } | null; grow?: number;
  style?: StyleProp<ViewStyle>; children: ReactNode; testID?: string;
}) {
  const theme = useModeTheme();
  // Only the shared values go to the UI thread (never the carry's JS-side functions).
  const { x, y, hx, hy, fade, tilt, lift, shrink } = carry;
  const ox = origin?.x ?? 0, oy = origin?.y ?? 0, free = origin !== null;
  const place = useAnimatedStyle(() => {
    const dx = free ? x.get() - ox - size / 2 : x.get() - hx.get();
    const dy = free ? y.get() - oy - size / 2 : y.get() - hy.get();
    return { opacity: fade.get(), transform: [{ translateX: dx }, { translateY: dy }] };
  });
  const body = useAnimatedStyle(() => ({
    transform: [{ rotate: `${tilt.get()}deg` }, { scale: (1 + lift.get() * grow) * shrink.get() }],
  }));
  // The shadow drops away as it lifts, softer and wider; it doesn't lean.
  const shadow = useAnimatedStyle(() => {
    const l = lift.get();
    return { opacity: l * 0.85, transform: [{ translateY: l * size * 0.22 }, { scaleX: 0.8 + l * 0.35 }, { scaleY: 0.8 + l * 0.2 }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[style, { width: size, height: size }, place]} testID={testID}>
      <Animated.View
        style={[styles.shadow, {
          left: size * 0.12, width: size * 0.76, top: size * 0.66, height: size * 0.3, borderRadius: size,
          backgroundColor: tintOf(theme.ground, 0.55), boxShadow: `0px 0px ${Math.round(size * 0.22)}px ${Math.round(size * 0.08)}px ${tintOf(theme.ground, 0.75)}`,
        }, shadow]}
      />
      <Animated.View style={[styles.fill, body]}>{children}</Animated.View>
    </Animated.View>
  );
}

/** A few sparkles where something snapped into place (root points); nothing under reduced motion. */
export function Sparkle({ x, y, size = 56 }: { x: number; y: number; size?: number }) {
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  if (reducedMotion) return null;
  return (
    <View pointerEvents="none" style={[styles.sparkle, { left: x - size / 2, top: y - size / 2, width: size, height: size / 2 }]} testID="v2-sparkle">
      <Burst size={size} color={theme.sweet} glyph={{ color: theme.ink }} text="" />
    </View>
  );
}

/** A #RRGGBB darkened toward black, at an opacity (a shadow coloured by the ground, never flat black). */
function tintOf(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return `rgba(0,0,0,${alpha})`;
  const d = (h: string) => Math.round(parseInt(h, 16) * 0.45);
  return `rgba(${d(m[1])}, ${d(m[2])}, ${d(m[3])}, ${alpha})`;
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  shadow: { position: "absolute" },
  sparkle: { position: "absolute", alignItems: "center", justifyContent: "flex-end", zIndex: 210 },
});
