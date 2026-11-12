// Telephone: a bakelite desk telephone seen from above, its handset across the
// cradle. Lift the handset (tap it), then dial: put a finger in a hole and
// draw it round to the stop; let go and the wheel runs back at a dial's own
// pace, a click a pulse (one for 1, ten for 0). Short of the stop it slips
// back quietly and nothing is dialled. With the last digit of the number the
// line is tried: onSet("number", "2046") (or onSubmit(["2","0","4","6"]) if the
// room made it a submit); what answers is the engine's. Nothing is written
// anywhere. Hang up (tap the handset, or the cradle) to start again. Dialled
// with the handset down, the wheel turns and clicks and the bell gives a
// tinkle: the handset stirs on its cradle, and nothing else happens.
//
// Rendered in layers (gadget_phone.py): the body with its enamel number
// plate; the brass finger wheel (lit square on, so its light doesn't swing as
// it turns) under the studio's light as a still layer; the finger stop over
// it; the handset on its cradle and lifted off, each with its cord.
//
// Without gestures: a tap on a hole dials it (the wheel goes round by
// itself); to a screen reader each hole is a button and the handset another.
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useFeedback } from "@/game/feedback";
import { useTheme } from "@/theme/ThemeProvider";
import { GADGET } from "./gadgets/sprites";
import { PHONE, digitsToSend, holeAngle, pulsesOf, travelOf } from "./gadgets/phone";
import { Stage, domainOf, useKept } from "./kit";
import { hidden } from "./materials";
import { Sprite } from "./sprites";
import { gadgetDomain, type MechanismProps } from "./types";

/** The telephone as rendered (gadget_phone.py), in points. */
const BOX = { w: 340, h: 276 };
const DIAL = { x: 112, y: 176, box: 140 };
const STOP = { x: 134, y: 196, w: 52, h: 44 };
const ON = { x: 0, y: 54, w: 250, h: 204 };
const OFF = { x: 196, y: 14, w: 144, h: 262 };
/** Where each handset is touched: across the cradle; lying by the telephone. */
const ON_HIT = { x: 6, y: 58, w: 214, h: 60 };
const OFF_HIT = { x: 264, y: 20, w: 66, h: 222 };

const ACTIVATE = [{ name: "activate" }];

export function Telephone({ target, state, onSet, onSubmit, onChange, busy, width }: MechanismProps) {
  const feedback = useFeedback();
  const { reducedMotion } = useTheme();
  const control = gadgetDomain(domainOf(target, "number"));
  const asSubmit = gadgetDomain(target.submit);
  const length = control?.kind === "phone" ? control.length : asSubmit?.kind === "phone" ? asSubmit.length : 4;

  const [lifted, setLifted] = useKept<boolean>(target, "lifted", () => false);
  const [digits, setDigits] = useKept<string>(target, "digits", () => "");
  const dialledSoFar = useRef(digits);
  const [turning, setTurning] = useState(false);

  const wheel = useSharedValue(0);
  const last = useSharedValue(0);
  const digit = useSharedValue(-1);
  const live = useSharedValue(false);
  const enabled = useSharedValue(!busy);
  const spinning = useSharedValue(false);
  const reduced = useSharedValue(reducedMotion);
  const off = useSharedValue(lifted ? 1 : 0);
  const stir = useSharedValue(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // When a drag last began or ended: a press that is only the end of one is not a tap.
  const dragged = useRef(0);
  const touched = useCallback(() => {
    dragged.current = Date.now();
  }, []);
  useEffect(() => {
    enabled.set(!busy);
    reduced.set(reducedMotion);
  }, [busy, reducedMotion, enabled, reduced]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const send = useCallback((number: string) => {
    if (control?.kind === "phone") onSet("number", number);
    else onSubmit(number.split(""));
  }, [control, onSet, onSubmit]);

  /** The wheel is home again after digit `d` went round to the stop. */
  const dialled = useCallback((d: number) => {
    setTurning(false);
    spinning.set(false);
    if (!lifted) return;
    const { digits: next, send: number } = digitsToSend(dialledSoFar.current, d, length);
    dialledSoFar.current = next;
    setDigits(next);
    onChange?.();
    if (number) send(number);
  }, [lifted, length, setDigits, onChange, send, spinning]);

  /** The wheel let go at the stop with digit `d`: it runs home, a click a pulse. */
  const runBack = useCallback((d: number, ms: number) => {
    setTurning(true);
    const n = pulsesOf(d);
    for (let i = 0; i < n; i++) timers.current.push(setTimeout(feedback.detent, ms * ((i + 0.6) / (n + 0.3))));
    // On the hook: the bell tinkles as it runs, the handset stirring on its cradle.
    if (!lifted && !reducedMotion) {
      stir.set(withSequence(withTiming(1.6, { duration: 70 }), withTiming(-1.4, { duration: 90 }), withTiming(1, { duration: 90 }), withTiming(-0.6, { duration: 90 }), withTiming(0, { duration: 90 })));
    }
    timers.current.push(setTimeout(() => dialled(d), ms + 20));
  }, [feedback, lifted, reducedMotion, stir, dialled]);

  const pan = usePanGesture({
    enabled,
    maxPointers: 1,
    minDistance: 3,
    onActivate: (e) => {
      "worklet";
      digit.set(-1);
      live.set(true);
      scheduleOnRN(touched);
      if (spinning.get()) return;
      // The hole under the finger.
      const dx = e.x - DIAL.box / 2, dy = e.y - DIAL.box / 2;
      const r = Math.hypot(dx, dy);
      if (Math.abs(r - PHONE.holes) > 17) return;
      const a = angleAt(dx, dy);
      for (let d = 0; d < 10; d++) {
        let off2 = Math.abs(a - holeAngle(d)) % 360;
        if (off2 > 180) off2 = 360 - off2;
        if (off2 < 15) digit.set(d);
      }
      last.set(a);
    },
    onUpdate: (e) => {
      "worklet";
      const d = digit.get();
      if (d < 0) return;
      const dx = e.x - DIAL.box / 2, dy = e.y - DIAL.box / 2;
      if (dx * dx + dy * dy < 12 * 12) return;
      const a = angleAt(dx, dy);
      let by = a - last.get();
      if (by > 180) by -= 360;
      if (by < -180) by += 360;
      last.set(a);
      // Round with the finger, as far as the stop and no further; never back past where it rests.
      wheel.set(Math.min(travelOf(d), Math.max(0, wheel.get() + by)));
    },
    onFinalize: () => {
      "worklet";
      // (A touch that never became a drag is a tap: the hole's own.)
      if (!live.get()) return;
      live.set(false);
      scheduleOnRN(touched);
      const d = digit.get();
      if (d < 0) return;
      digit.set(-1);
      const at = wheel.get();
      const home = at >= travelOf(d) - PHONE.slack;
      // At the stop: home at a dial's pace. Short of it: it slips back, quicker and silent.
      const ms = reduced.get() ? 0 : (at / (home ? PHONE.pace : PHONE.slip)) * 1000;
      spinning.set(true);
      wheel.set(withTiming(0, { duration: ms, easing: Easing.linear, reduceMotion: ReduceMotion.Never }, () => {
        spinning.set(false);
      }));
      if (home) scheduleOnRN(runBack, d, ms);
    },
  });

  /** Dial `d` without the gesture: the wheel goes round to the stop by itself and runs back. */
  const dial = (d: number) => {
    if (busy || turning || spinning.get()) return;
    const travel = travelOf(d);
    const out = reducedMotion ? 0 : (travel / PHONE.wind) * 1000;
    const back = reducedMotion ? 0 : (travel / PHONE.pace) * 1000;
    spinning.set(true);
    setTurning(true);
    wheel.set(withSequence(
      withTiming(travel, { duration: out, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }),
      withTiming(0, { duration: back, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
    ));
    timers.current.push(setTimeout(() => runBack(d, back), out));
  };

  const lift = () => {
    if (busy) return;
    const up = !lifted;
    if (up) feedback.press();
    else feedback.thud();
    // Hung up: the line is let go, and what was dialled with it.
    dialledSoFar.current = "";
    setDigits("");
    setLifted(up);
    onChange?.();
    off.set(withTiming(up ? 1 : 0, { duration: reducedMotion ? 0 : 200, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }));
  };

  const wheelStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wheel.get()}deg` }] }));
  // The handset leaves its cradle toward where it is laid down; the one lying there arrives from the cradle.
  const onStyle = useAnimatedStyle(() => {
    const p = off.get();
    return { opacity: 1 - p, transform: [{ translateX: p * 46 }, { translateY: -p * 14 + stir.get() * 0.6 }, { rotate: `${p * 16 + stir.get()}deg` }] };
  });
  const offStyle = useAnimatedStyle(() => {
    const p = off.get();
    return { opacity: p, transform: [{ translateX: (p - 1) * 46 }, { translateY: (1 - p) * 14 }, { rotate: `${(p - 1) * 16}deg` }] };
  });

  const k = Math.min(width, BOX.w) / BOX.w;
  const said = digits ? `Dialled so far: ${digits.split("").join(" ")}` : "Nothing dialled";
  return (
    <Stage width={width}>
      <View style={{ width: BOX.w * k, height: BOX.h * k }}>
        <View style={[styles.box, { transform: [{ scale: k }] }]} testID={lifted ? "mech-phone-off" : "mech-phone"}>
          <Sprite source={GADGET.phoneBody} w={BOX.w} h={BOX.h} style={styles.at} />
          <GestureDetector gesture={pan}>
            <View style={styles.dial} testID="mech-phone-dial" accessibilityLabel="Dial" accessibilityValue={{ text: said }}>
              <Animated.View style={[styles.at, wheelStyle]} pointerEvents="none" {...hidden}>
                <Sprite source={GADGET.phoneWheel} w={DIAL.box} h={DIAL.box} />
              </Animated.View>
              <Sprite source={GADGET.phoneWheelLight} w={DIAL.box} h={DIAL.box} style={styles.at} />
              {/* Each hole, where it rests: a tap dials it. */}
              {Array.from({ length: 10 }, (_, i) => {
                const d = (i + 1) % 10;
                const a = (holeAngle(d) * Math.PI) / 180;
                return (
                  <Pressable
                    key={d}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={`Dial ${d}`}
                    accessibilityHint={lifted ? "Dials this digit" : "The handset is down"}
                    accessibilityState={{ disabled: busy }}
                    accessibilityActions={ACTIVATE}
                    onAccessibilityAction={() => dial(d)}
                    onPress={() => (Date.now() - dragged.current > 350 ? dial(d) : undefined)}
                    style={[styles.hole, { left: DIAL.box / 2 + Math.sin(a) * PHONE.holes - 12, top: DIAL.box / 2 - Math.cos(a) * PHONE.holes - 12 }]}
                    testID={`mech-phone-hole-${d}`}
                  />
                );
              })}
            </View>
          </GestureDetector>
          <View style={[styles.at, { left: STOP.x, top: STOP.y }]} pointerEvents="none"><Sprite source={GADGET.phoneStop} w={STOP.w} h={STOP.h} /></View>
          <Animated.View style={[styles.at, { left: ON.x, top: ON.y }, onStyle]} pointerEvents="none">
            <Sprite source={GADGET.phoneHandset} w={ON.w} h={ON.h} />
          </Animated.View>
          <Animated.View style={[styles.at, { left: OFF.x, top: OFF.y }, offStyle]} pointerEvents="none">
            <Sprite source={GADGET.phoneHandsetOff} w={OFF.w} h={OFF.h} />
          </Animated.View>
          {/* The handset where it is, and (lifted) the empty cradle: a tap lifts it or hangs up. */}
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel={lifted ? "Hang up" : "Lift the handset"}
            accessibilityHint={lifted ? "Puts the handset back and starts again" : "Opens the line"}
            accessibilityState={{ disabled: busy }}
            accessibilityActions={ACTIVATE}
            onAccessibilityAction={() => lift()}
            onPress={() => lift()}
            style={[styles.at, lifted ? { left: OFF_HIT.x, top: OFF_HIT.y, width: OFF_HIT.w, height: OFF_HIT.h } : { left: ON_HIT.x, top: ON_HIT.y, width: ON_HIT.w, height: ON_HIT.h }]}
            testID="mech-phone-handset"
          />
          {lifted ? <Pressable accessible={false} onPress={lift} style={[styles.at, styles.cradle]} testID="mech-phone-cradle" /> : null}
        </View>
      </View>
    </Stage>
  );
}

/** Degrees clockwise from twelve, 0..360, of a point relative to the centre. */
function angleAt(dx: number, dy: number) {
  "worklet";
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return deg < 0 ? deg + 360 : deg;
}

const styles = StyleSheet.create({
  box: { width: BOX.w, height: BOX.h, transformOrigin: "left top" },
  at: { position: "absolute", left: 0, top: 0 },
  dial: { position: "absolute", left: DIAL.x - DIAL.box / 2, top: DIAL.y - DIAL.box / 2, width: DIAL.box, height: DIAL.box, borderRadius: DIAL.box / 2 },
  hole: { position: "absolute", width: 24, height: 24, borderRadius: 12 },
  cradle: { left: 46, top: 68, width: 132, height: 38 },
});
