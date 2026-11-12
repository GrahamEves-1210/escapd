// KeyRing: a padlock, and a ring of five brass keys that look alike until
// their cuts are compared (the right one's are pressed into something found
// elsewhere: gadgets/KeyArt KeyImpression). The ring hangs bunched on its
// nail; touched, it fans. Take a key and draw it toward the lock: the whole
// ring comes with it, the key turning to point at the keyway, the others
// swinging down under it. At the keyway it goes in: onSubmit([its bitting]).
// Right, it turns and the shackle springs. Wrong (the engine's wrong-answer
// path), it sticks: a rattle, and it comes back out onto its nail.
//
// The keys are put together from four renders (gadgets/keys.ts), the lock
// from the padlock's own rendered parts (sprites.tsx), its keyway a brass
// collar on its side.
//
// Without gestures: each key is a button (a screen reader hears its cuts,
// which it cannot compare by eye); activating one tries it.
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  Easing, ReduceMotion, interpolate, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming, type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useFeedback } from "@/game/feedback";
import { useTheme } from "@/theme/ThemeProvider";
import { useHeld } from "./gadgets/held";
import { KeyArt, KeyImpression } from "./gadgets/KeyArt";
import { KEY, KEY_REACH, isBitting, sayBitting } from "./gadgets/keys";
import { GADGET } from "./gadgets/sprites";
import { Line, Stage, cooldownText, gaveNow, justGave, markTry, tryKey, useKept } from "./kit";
import { hidden } from "./materials";
import { ART, NineSlice, Sprite } from "./sprites";
import { gadgetDomain, type MechanismProps } from "./types";

/** The bench, in points: the lock's body, its keyway's mouth, the nail the ring hangs on. */
const BOX = { w: 340, h: 272 };
const BODY = { x: 14, y: 92, w: 116, h: 100 };
const WAY = { x: BODY.x + BODY.w - 2, y: 143, w: 16, h: 30 };
const MOUTH = { x: WAY.x + WAY.w, y: WAY.y + WAY.h / 2 };
const NAIL = { x: 250, y: 64 };
/** How much of the blade goes in. */
const IN = 62;
/** Where the ring's keys meet (their holes) with a key home in the lock. */
const HOME = { x: MOUTH.x - IN + KEY_REACH, y: MOUTH.y };
/** The ring's box round the point its keys hang from: the fan and a held key stay inside it (so they take touches). */
const RING = { w: 250, h: 170, px: 124, py: 44 };
/** Degrees between neighbours, bunched and fanned; a key hangs at 90 (blade down), points at the lock at 180. */
const SPREAD = { bunch: 3.5, fan: 19 };
const SHACKLE = { w: 106, h: 54.6 };
/** Where a held pressing lies: under the lock, clear of the keys. */
const SOAP_AT = { x: 8, y: 196, w: 122 };

const ACTIVATE = [{ name: "activate" }];

const restAngle = (i: number, n: number, fan: number) => {
  "worklet";
  return 90 - (i - (n - 1) / 2) * (SPREAD.bunch + (SPREAD.fan - SPREAD.bunch) * fan);
};

/** The fanned key at a point (relative to where they hang from): the nearest by angle; -1 for none. */
function keyAt(dx: number, dy: number, n: number) {
  "worklet";
  const r = Math.hypot(dx, dy);
  if (r < 6 || r > KEY_REACH + 14) return -1;
  const a = (Math.atan2(dy, dx) * 180) / Math.PI;
  let best = -1, off = 14;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(a - restAngle(i, n, 1));
    if (d < off) {
      off = d;
      best = i;
    }
  }
  return best;
}

export function KeyRing({ target, state, onSubmit, onChange, busy, cooldown, width }: MechanismProps) {
  const feedback = useFeedback();
  const { reducedMotion } = useTheme();
  const domain = gadgetDomain(target.submit);
  const bittings = domain?.kind === "keys" ? domain.bittings : [];
  const n = bittings.length;
  const open = state.open === true || state.locked === false;
  // The ring is there unless the room says it isn't yet (found elsewhere, then hung up here).
  const present = state.ring !== false;

  // The pressing of a key, if the player holds one: laid on the table under the lock, to hold the keys against.
  const pressing = useHeld()?.find((h) => h.text && isBitting(h.text))?.text?.trim();

  const [fanned, setFanned] = useKept<boolean>(target, "fanned", () => false);
  // The key last tried: in the lock still when this mounts just after a try.
  const [tried, setTried] = useKept<number>(target, "tried", () => -1);
  const [gave] = useState(() => gaveNow(tryKey(target)));
  const [refused] = useState(() => !open && tried >= 0 && justGave(tryKey(target)));
  const inLock = tried >= 0 && (open || refused);

  const fan = useSharedValue(fanned || inLock ? 1 : 0);
  const gx = useSharedValue(inLock ? HOME.x - NAIL.x : 0);
  const gy = useSharedValue(inLock ? HOME.y - NAIL.y : 0);
  const lift = useSharedValue(inLock ? 1 : 0);
  const pick = useSharedValue(inLock ? tried : -1);
  const turn = useSharedValue(open && inLock && !(gave && !reducedMotion) ? 1 : 0);
  const shake = useSharedValue(0);
  const going = useSharedValue(false);
  const live = useSharedValue(false);
  const enabled = useSharedValue(!busy && !open);
  const reduced = useSharedValue(reducedMotion);
  const count = useSharedValue(n);
  const dragged = useRef(0);
  useEffect(() => {
    enabled.set(!busy && !open && present);
    reduced.set(reducedMotion);
    count.set(n);
  }, [busy, open, present, reducedMotion, n, enabled, reduced, count]);

  const spring = { mass: 0.7, damping: 14, stiffness: 190, reduceMotion: ReduceMotion.Never } as const;
  const ease = (ms: number) => ({ duration: reducedMotion ? 0 : ms, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }) as const;

  /** Back onto its nail. */
  const hangUp = useCallback((after = 0) => {
    gx.set(withDelay(after, withSpring(0, spring)));
    gy.set(withDelay(after, withSpring(0, spring)));
    lift.set(withDelay(after, withTiming(0, ease(260))));
    going.set(false);
    setTimeout(() => {
      pick.set(-1);
      setTried(-1);
    }, after + 260);
    // (spring and ease are constants of this render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gx, gy, lift, pick, going, setTried, reducedMotion]);

  // Mounted just after a try: the key is in the lock. It turns and the shackle springs, or it sticks and comes back out.
  useEffect(() => {
    if (!inLock) return;
    if (open) {
      if (gave && !reducedMotion) turn.set(withDelay(60, withTiming(1, { duration: 260, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.Never })));
      return;
    }
    if (reducedMotion) {
      hangUp();
      return;
    }
    turn.set(withSequence(withTiming(0.22, { duration: 90 }), withTiming(0.04, { duration: 70 }), withTiming(0.18, { duration: 80 }), withTiming(0, { duration: 90 })));
    shake.set(withSequence(withTiming(-2.5, { duration: 60 }), withTiming(2.5, { duration: 70 }), withTiming(-1.5, { duration: 70 }), withTiming(1.5, { duration: 70 }), withTiming(0, { duration: 60 })));
    hangUp(420);
    // Once, as it mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spread = useCallback(() => {
    if (fanned) return;
    feedback.detent();
    setFanned(true);
    fan.set(reducedMotion ? 1 : withSpring(1, { mass: 0.6, damping: 9, stiffness: 160, reduceMotion: ReduceMotion.Never }));
  }, [fanned, feedback, setFanned, fan, reducedMotion]);

  /** Key `i` is at the keyway: in it goes, and the lock is tried with it. */
  const tryKeyAt = useCallback((i: number) => {
    if (busy || open || i < 0 || i >= n) return;
    dragged.current = Date.now();
    going.set(true);
    pick.set(i);
    fan.set(1);
    setFanned(true);
    lift.set(withTiming(1, ease(160)));
    gx.set(withTiming(HOME.x - NAIL.x, ease(170)));
    gy.set(withTiming(HOME.y - NAIL.y, ease(170)));
    onChange?.();
    setTimeout(() => {
      feedback.snap();
      if (cooldown > 0) {
        // Too soon after a wrong one: it won't take it.
        feedback.warning();
        if (!reducedMotion) shake.set(withSequence(withTiming(-2.5, { duration: 60 }), withTiming(2.5, { duration: 70 }), withTiming(0, { duration: 60 })));
        hangUp(260);
        return;
      }
      setTried(i);
      markTry(tryKey(target));
      onSubmit([bittings[i]]);
    }, reducedMotion ? 0 : 190);
    // (ease is a constant of this render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, open, n, going, pick, fan, setFanned, lift, gx, gy, onChange, feedback, cooldown, reducedMotion, shake, hangUp, setTried, target, onSubmit, bittings]);

  const touched = useCallback(() => {
    dragged.current = Date.now();
  }, []);

  const tap = (x: number, y: number) => {
    if (busy || open || going.get() || Date.now() - dragged.current < 350) return;
    if (!fanned) {
      spread();
      return;
    }
    const i = keyAt(x - RING.px, y - RING.py, n);
    if (i >= 0) tryKeyAt(i);
  };

  const pan = usePanGesture({
    enabled,
    maxPointers: 1,
    minDistance: 4,
    onActivate: (e) => {
      "worklet";
      scheduleOnRN(touched);
      live.set(true);
      if (going.get()) return;
      if (fan.get() < 0.5) {
        // Bunched: the first touch fans them.
        pick.set(-1);
        scheduleOnRN(spread);
        return;
      }
      pick.set(keyAt(e.x - RING.px, e.y - RING.py, count.get()));
    },
    onUpdate: (e) => {
      "worklet";
      const i = pick.get();
      if (i < 0 || going.get()) return;
      let x = Math.min(60, Math.max(HOME.x - NAIL.x - 6, e.translationX));
      const y = Math.min(BOX.h - NAIL.y - KEY_REACH - 4, Math.max(-30, e.translationY));
      const l = Math.min(1, Math.hypot(x, y) / 56);
      // Where its tip is: at the keyway's mouth it goes in; anywhere else along the lock's side it stops against it.
      const rest = restAngle(i, count.get(), 1);
      const a = ((rest + (180 - rest) * l) * Math.PI) / 180;
      const ty = NAIL.y + y + KEY_REACH * Math.sin(a);
      const tx = NAIL.x + x + KEY_REACH * Math.cos(a);
      const beside = ty > BODY.y - 6 && ty < BODY.y + BODY.h + 6;
      if (beside && tx < MOUTH.x + 3) {
        if (l >= 0.9 && Math.abs(ty - MOUTH.y) < 15) {
          going.set(true);
          scheduleOnRN(tryKeyAt, i);
          return;
        }
        x += MOUTH.x + 3 - tx;
      }
      gx.set(x);
      gy.set(y);
      lift.set(l);
    },
    onFinalize: () => {
      "worklet";
      // (A touch that never became a drag is a tap.)
      if (!live.get()) return;
      live.set(false);
      scheduleOnRN(touched);
      if (going.get() || pick.get() < 0) return;
      // Let go short of the lock: back onto the nail.
      const back = { mass: 0.7, damping: 14, stiffness: 190, reduceMotion: ReduceMotion.Never };
      gx.set(reduced.get() ? 0 : withSpring(0, back));
      gy.set(reduced.get() ? 0 : withSpring(0, back));
      lift.set(withTiming(0, { duration: reduced.get() ? 0 : 220 }));
      pick.set(-1);
    },
  });

  const groupStyle = useAnimatedStyle(() => ({ transform: [{ translateX: gx.get() }, { translateY: gy.get() }, { rotate: `${shake.get()}deg` }] }));
  // The ring: over the point its keys hang from on the nail; under it, hanging from a key that is held.
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(lift.get(), [0, 1], [-15, 15]) }] }));

  const k = Math.min(width, BOX.w) / BOX.w;
  const waiting = cooldownText(cooldown);
  return (
    <Stage width={width}>
      <View style={{ width: BOX.w * k, height: BOX.h * k }}>
        <View style={[styles.box, { transform: [{ scale: k }] }]} testID={open ? "mech-keys-open" : "mech-keys"}>
          {present ? (
            <>
              <View style={styles.nail} pointerEvents="none"><Sprite source={ART.frameNail} w={14} h={14} /></View>
              {/* The ring and its keys: under the lock, so a blade slides out of sight into it. */}
              <GestureDetector gesture={pan}>
                <Animated.View style={[styles.ring, groupStyle]} testID="mech-keyring">
                  {bittings.map((b, i) => (
                    <Key
                      key={i} index={i} n={n} bitting={b} fan={fan} lift={lift} pick={pick} turn={turn}
                      disabled={busy || open} onTry={() => tryKeyAt(i)}
                    />
                  ))}
                  <Animated.View style={[styles.hoop, ringStyle]} pointerEvents="none">
                    <Sprite source={GADGET.keyRing} w={44} h={44} />
                  </Animated.View>
                  {/* A tap: bunched, it fans them; fanned, the key tapped is tried. */}
                  <Pressable accessible={false} style={styles.tap} onPress={(e) => tap(e.nativeEvent.locationX, e.nativeEvent.locationY)} testID="mech-keyring-tap" />
                </Animated.View>
              </GestureDetector>
            </>
          ) : null}
          {pressing ? <KeyImpression bitting={pressing} width={SOAP_AT.w} style={styles.soap} /> : null}
          <Shackle open={open} springAt={gave && !reducedMotion ? 340 : null} />
          <View style={styles.body} pointerEvents="none" {...hidden}>
            <NineSlice source={ART.lockBody} size={120} cap={40} />
          </View>
          <View style={styles.way} pointerEvents="none"><Sprite source={GADGET.keyWay} w={WAY.w} h={WAY.h} /></View>
        </View>
      </View>
      <Line text={waiting && !open ? waiting : " "} tone="stamp" testID="mech-status" />
    </Stage>
  );
}

/** One key on the ring: hanging in the fan; or, taken, turned to point at the lock; or swinging down under the one that is. */
function Key({ index, n, bitting, fan, lift, pick, turn, disabled, onTry }: {
  index: number; n: number; bitting: string; fan: SharedValue<number>; lift: SharedValue<number>; pick: SharedValue<number>; turn: SharedValue<number>;
  disabled: boolean; onTry: () => void;
}) {
  const style = useAnimatedStyle(() => {
    const rest = restAngle(index, n, fan.get());
    const mine = pick.get() === index;
    const to = mine ? 180 : 90 - (index - (n - 1) / 2) * 4;
    const l = pick.get() < 0 ? 0 : lift.get();
    // Turned in the lock, it is seen edge on.
    return { transform: [{ rotate: `${rest + (to - rest) * l}deg` }, { scaleY: mine ? 1 - 0.86 * turn.get() : 1 }], zIndex: mine ? 2 : 1 };
  });
  return (
    <Animated.View
      accessible
      accessibilityRole="button"
      accessibilityLabel={`Key ${index + 1} of ${n}`}
      accessibilityHint="Tries this key in the lock"
      accessibilityState={{ disabled }}
      accessibilityActions={ACTIVATE}
      onAccessibilityAction={() => (disabled ? undefined : onTry())}
      accessibilityValue={{ text: sayBitting(bitting) }}
      style={[styles.key, style]}
      testID={`mech-key-${index}`}
    >
      <KeyArt bitting={bitting} />
    </Animated.View>
  );
}

/** The padlock's shackle (the combination lock's, a little smaller): shut, or sprung up and aside. */
function Shackle({ open, springAt }: { open: boolean; springAt: number | null }) {
  const k = useSharedValue(open && springAt === null ? 1 : 0);
  useEffect(() => {
    if (!open || springAt === null) return;
    k.set(withDelay(springAt, withSequence(
      withTiming(1.12, { duration: 110, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }),
      withSpring(1, { mass: 0.6, damping: 8, stiffness: 380, reduceMotion: ReduceMotion.Never }),
    )));
  }, [open, springAt, k]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -k.get() * 9 }, { rotate: `${k.get() * 13}deg` }] }));
  return (
    <Animated.View style={[styles.shackle, style]} pointerEvents="none" testID={open ? "mech-shackle-open" : "mech-shackle"}>
      <Sprite source={ART.lockShackle} w={SHACKLE.w} h={SHACKLE.h} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { width: BOX.w, height: BOX.h, transformOrigin: "left top" },
  nail: { position: "absolute", left: NAIL.x - 7, top: NAIL.y - 36 },
  ring: { position: "absolute", left: NAIL.x - RING.px, top: NAIL.y - RING.py, width: RING.w, height: RING.h },
  // Each key hangs by its hole from the same point, and turns about it.
  key: {
    position: "absolute", left: RING.px - KEY.hole.x, top: RING.py - KEY.hole.y, width: KEY.w, height: KEY.h,
    transformOrigin: `${(KEY.hole.x / KEY.w) * 100}% 50%`,
  },
  // Over the keys (which stack by who is held).
  tap: { ...StyleSheet.absoluteFill, zIndex: 5 },
  hoop: { zIndex: 3, position: "absolute", left: RING.px - 22, top: RING.py - 22 },
  shackle: { position: "absolute", left: BODY.x + (BODY.w - SHACKLE.w) / 2, top: BODY.y - SHACKLE.h + 13, transformOrigin: "88% 100%" },
  body: { position: "absolute", left: BODY.x, top: BODY.y, width: BODY.w, height: BODY.h },
  way: { position: "absolute", left: WAY.x, top: WAY.y },
  soap: { position: "absolute", left: SOAP_AT.x, top: SOAP_AT.y },
});
