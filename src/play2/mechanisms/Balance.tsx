// Balance: a small brass balance on a walnut base, worked in the hand's own
// close-up, with the brass weights the player has found standing in front of
// it: alike but for the symbol stamped on each. Put a weight on a pan (drag
// it there, or tap it: it goes to the first empty pan; tap it again to take
// it off). One pan loaded, that side sinks by itself. Both loaded:
// onSet("pans", "<left id>|<right id>"), and the engine answers only with
// what is seen: `tilt`, the heavier side, which the beam swings down to and
// settles on. No weight is ever a number here.
//
// Rendered in layers (gadget_balance.py): the stand; the beam, turned about
// its knife edge; a pan on its chains at each end, kept plumb; a weight, its
// symbol set on it live.
//
// A screen reader: each weight is a button that says where it is; the
// balance says which side is lower.
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useFeedback } from "@/game/feedback";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { leanOf, pansValue, stampOf, useHeld } from "./gadgets/held";
import { GADGET } from "./gadgets/sprites";
import { Stage, domainOf, useKept } from "./kit";
import { hidden } from "./materials";
import { Sprite } from "./sprites";
import { gadgetDomain, type MechanismProps } from "./types";

/** The balance as rendered (gadget_balance.py), in points. */
const BOX = { w: 340, h: 276 };
const PIVOT = { x: 170, y: 62 };
const ARM = 118;
const BEAM = { w: 260, h: 36 };
const PAN = { w: 92, h: 118, hook: 2, dish: 97 };
const WEIGHT = { w: 34, h: 42 };
/** How far the beam leans (degrees). */
const LEAN = 7;
/** Where a weight stands when it is on neither pan: in a row in front of the base. */
const HOME = { y: BOX.h - WEIGHT.h - 2, gap: 44 };
const ACTIVATE = [{ name: "activate" }];
type Where = "home" | "left" | "right";
const FALLBACK = ["▲", "●", "◆", "■", "★", "✚"];

export function Balance({ target, state, onSet, onChange, busy, width }: MechanismProps) {
  const feedback = useFeedback();
  const { reducedMotion } = useTheme();
  const domain = gadgetDomain(domainOf(target, "pans"));
  const held = useHeld();
  // The weights it takes that the player holds, in the room's order.
  const ids = domain?.kind === "pans" ? domain.of : [];
  const weights = ids.filter((id) => !held || held.some((h) => h.id === id))
    .map((id) => ({ id, name: held?.find((h) => h.id === id)?.name ?? id, stamp: stampOf(held?.find((h) => h.id === id)?.name ?? "", FALLBACK[ids.indexOf(id) % FALLBACK.length]) }));

  const [pans, setPans] = useKept<{ left: string | null; right: string | null }>(target, "pans", () => {
    const [l, r] = typeof state.pans === "string" && state.pans.includes("|") ? state.pans.split("|") : [null, null];
    return { left: l, right: r };
  });
  // The beam's lean as last drawn, kept across the close-up's remounts: it swings on from there.
  const [leanKept, setLeanKept] = useKept<number>(target, "lean", () => 0);
  const lean = useSharedValue(leanKept);
  const want = leanOf(pans.left, pans.right, state);
  useEffect(() => {
    if (want === null) return;
    const from = lean.get();
    setLeanKept(want);
    if (reducedMotion) {
      lean.set(want);
      return;
    }
    const t = (ms: number) => ({ duration: ms, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.Never }) as const;
    // It swings past where it will rest, back, and settles; already there (the same side still heavier), it bobs.
    lean.set(Math.abs(from - want) < 0.05 && want !== 0
      ? withSequence(withTiming(want * 0.55, t(200)), withTiming(want * 1.12, t(220)), withTiming(want, t(180)))
      : withSequence(withTiming(want + (want - from) * 0.22, t(300)), withTiming(want - (want - from) * 0.1, t(220)), withTiming(want, t(180))));
    // The lean follows what is on the pans and what the engine saw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want, reducedMotion]);

  const whereOf = (id: string): Where => (pans.left === id ? "left" : pans.right === id ? "right" : "home");

  const put = useCallback((id: string, to: Where) => {
    if (busy) return;
    const next = { left: pans.left === id ? null : pans.left, right: pans.right === id ? null : pans.right };
    // Onto a pan (what was on it goes back to the table); or off.
    if (to !== "home") next[to] = id;
    if (next.left === pans.left && next.right === pans.right) return;
    if (to === "home") feedback.tick();
    else feedback.snap();
    setPans(next);
    onChange?.();
    const value = pansValue(next.left, next.right);
    if (value && value !== state.pans) onSet("pans", value);
  }, [busy, pans, feedback, setPans, onChange, state.pans, onSet]);

  /** A tap: onto the first empty pan; or, on a pan, off it. */
  const toggle = (id: string) => {
    const at = whereOf(id);
    if (at !== "home") put(id, "home");
    else put(id, !pans.left ? "left" : "right");
  };

  const beamStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${lean.get() * LEAN}deg` }] }));
  const k = Math.min(width, BOX.w) / BOX.w;
  const side = want === -1 ? "The left pan is lower" : want === 1 ? "The right pan is lower" : "The pans are level";
  return (
    <Stage width={width}>
      <View style={{ width: BOX.w * k, height: BOX.h * k }}>
        <View style={[styles.box, { transform: [{ scale: k }] }]} testID="mech-balance">
          <View accessible accessibilityRole="text" accessibilityLabel={`Balance. ${side}`} accessibilityLiveRegion="polite" style={styles.at} testID={`mech-balance-${want === -1 ? "left" : want === 1 ? "right" : "level"}`}>
            <Sprite source={GADGET.balanceStand} w={BOX.w} h={BOX.h} />
          </View>
          <Hung side={-1} lean={lean} />
          <Hung side={1} lean={lean} />
          <Animated.View style={[styles.beam, beamStyle]} pointerEvents="none" {...hidden}>
            <Sprite source={GADGET.balanceBeam} w={BEAM.w} h={BEAM.h} />
          </Animated.View>
          {weights.map((w, i) => (
            <Weight
              key={w.id} name={w.name} stamp={w.stamp} where={whereOf(w.id)} slot={i} of={weights.length} lean={lean}
              disabled={busy} reduced={reducedMotion} onPut={(to) => put(w.id, to)} onTap={() => toggle(w.id)}
            />
          ))}
        </View>
      </View>
    </Stage>
  );
}

/** How far an end of the beam is below level (points), `side` -1 its left. */
const drop = (lean: number, side: number) => {
  "worklet";
  return ARM * Math.sin((lean * LEAN * Math.PI) / 180) * side;
};

/** A pan on its chains, hung from an end of the beam: it rides up and down with it, plumb. */
function Hung({ side, lean }: { side: -1 | 1; lean: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: drop(lean.get(), side) }] }));
  return (
    <Animated.View style={[styles.pan, { left: PIVOT.x + side * ARM - PAN.w / 2 }, style]} pointerEvents="none" {...hidden}>
      <Sprite source={GADGET.balancePan} w={PAN.w} h={PAN.h} />
    </Animated.View>
  );
}

const panX = (side: number) => PIVOT.x + side * ARM - WEIGHT.w / 2;
const PAN_Y = PIVOT.y + 1 - PAN.hook + PAN.dish + 1.5 - WEIGHT.h;

/** A weight: in its place in front of the base, or on a pan (riding with it), or under the finger. */
function Weight({ name, stamp, where, slot, of, lean, disabled, reduced, onPut, onTap }: {
  name: string; stamp: string; where: Where; slot: number; of: number; lean: SharedValue<number>; disabled: boolean; reduced: boolean;
  onPut: (to: Where) => void; onTap: () => void;
}) {
  const homeX = PIVOT.x + (slot - (of - 1) / 2) * HOME.gap - WEIGHT.w / 2;
  const restX = where === "home" ? homeX : panX(where === "left" ? -1 : 1);
  const restY = where === "home" ? HOME.y : PAN_Y;
  const x = useSharedValue(restX);
  const y = useSharedValue(restY);
  const on = useSharedValue(where === "left" ? -1 : where === "right" ? 1 : 0);
  const live = useSharedValue(false);
  const enabled = useSharedValue(!disabled);
  const [moved, setMoved] = useState(0);
  useEffect(() => {
    enabled.set(!disabled);
  }, [disabled, enabled]);
  // It goes to where it now belongs (and after a drop that changed nothing, back).
  useEffect(() => {
    on.set(where === "left" ? -1 : where === "right" ? 1 : 0);
    if (reduced) {
      x.set(restX);
      y.set(restY);
      return;
    }
    const spring = { mass: 0.6, damping: 14, stiffness: 240, reduceMotion: ReduceMotion.Never } as const;
    x.set(withSpring(restX, spring));
    y.set(withSpring(restY, spring));
  }, [where, restX, restY, reduced, moved, on, x, y]);

  // When a drag last began or ended: a press that is only the end of one is not a tap.
  const draggedAt = useRef(0);
  const touched = useCallback(() => {
    draggedAt.current = Date.now();
  }, []);
  const dropped = useCallback((to: Where) => {
    draggedAt.current = Date.now();
    onPut(to);
    setMoved((n) => n + 1);
  }, [onPut]);

  const pan = usePanGesture({
    enabled,
    maxPointers: 1,
    minDistance: 4,
    onActivate: () => {
      "worklet";
      live.set(true);
      scheduleOnRN(touched);
    },
    onUpdate: (e) => {
      "worklet";
      x.set(Math.min(BOX.w - WEIGHT.w, Math.max(0, restX + e.translationX)));
      y.set(Math.min(BOX.h - WEIGHT.h, Math.max(0, restY + e.translationY + (on.get() !== 0 ? drop(lean.get(), on.get()) : 0))));
    },
    onFinalize: () => {
      "worklet";
      if (!live.get()) return;
      live.set(false);
      // Let go over a pan (above the table's row): onto it. Anywhere else: back to the table.
      const cx = x.get() + WEIGHT.w / 2;
      const high = y.get() < HOME.y - 24;
      const to: Where = high && Math.abs(cx - (PIVOT.x - ARM)) < 50 ? "left" : high && Math.abs(cx - (PIVOT.x + ARM)) < 50 ? "right" : "home";
      scheduleOnRN(dropped, to);
    },
  });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() + (on.get() !== 0 && !live.get() ? drop(lean.get(), on.get()) : 0) }],
    zIndex: live.get() ? 3 : 1,
  }));
  const said = where === "home" ? "on the table" : `on the ${where} pan`;
  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={name}
        accessibilityHint={where === "home" ? "Puts it on a pan" : "Takes it off the pan"}
        accessibilityState={{ disabled }}
        accessibilityActions={ACTIVATE}
        onAccessibilityAction={() => (disabled ? undefined : onTap())}
        accessibilityValue={{ text: said }}
        style={[styles.weight, style]}
        testID={`mech-weight-${slot}-${where}`}
      >
        <Sprite source={GADGET.balanceWeight} w={WEIGHT.w} h={WEIGHT.h} />
        <Text style={styles.stamp} allowFontScaling={false} {...hidden}>{stamp}</Text>
        <Pressable style={styles.tap} onPress={() => (!disabled && Date.now() - draggedAt.current > 350 ? onTap() : undefined)} accessible={false} testID={`mech-weight-${slot}-tap`} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  box: { width: BOX.w, height: BOX.h, transformOrigin: "left top" },
  at: { position: "absolute", left: 0, top: 0 },
  beam: { position: "absolute", left: PIVOT.x - BEAM.w / 2, top: PIVOT.y - BEAM.h / 2 },
  pan: { position: "absolute", top: PIVOT.y + 1 - PAN.hook },
  weight: { position: "absolute", left: 0, top: 0, width: WEIGHT.w, height: WEIGHT.h },
  // Stamped into the drum: dark in the cut, a line of light on its lower lip.
  stamp: {
    position: "absolute", left: 0, right: 0, top: 21, fontSize: 12, lineHeight: 16, textAlign: "center", color: "#2A1A0C",
    textShadowColor: "rgba(255, 244, 214, 0.55)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0,
  },
  tap: { position: "absolute", left: -ref.space.xs, right: -ref.space.xs, top: -ref.space.xs, bottom: -ref.space.xs },
});
