// Home's tilt (parallax/tilt.ts has the maths): two shared values, -1..1
// across and down, that the set's layers slide by (ParallaxLayer).
// - On a phone: expo-sensors' DeviceMotion (no permission asked), gravity ->
//   roll and pitch -> aimTilt, every PARALLAX.interval ms; each new aim (past
//   the dead band) retargets a critically damped spring that runs on the UI
//   thread, so the layers move at the display's rate however slow the sensor.
// - On the web there's no tilt: the pointer's place in the window stands in.
// - In development a tilt can be pinned for screenshots: `?tilt=0.5,-1` on the
//   web, or globalThis.__ESCAPD_TILT__(x, y) anywhere (null lets go).
// Only while `enabled` (home in front, not under reduced motion) and the app
// is active: otherwise nothing is subscribed and the layers glide back to rest.
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { useSharedValue, withSpring, type SharedValue } from "react-native-reanimated";
import { DeviceMotion } from "expo-sensors";
import { PARALLAX } from "../art/nook";
import { NO_REST, NO_TILT, aimTilt, movesTilt, parseTilt, pointerTilt, tiltAngles, type Tilt, type TiltRest } from "./tilt";

export interface TiltValues {
  x: SharedValue<number>;
  y: SharedValue<number>;
}

type Pin = (x: number | null, y?: number) => void;
const dev = globalThis as { __ESCAPD_TILT__?: Pin };
const MS = 1000;

export function useTilt(enabled: boolean): TiltValues {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const pinned = useRef<Tilt | null>(null);
  const last = useRef<Tilt>(NO_TILT);

  useEffect(() => {
    const aim = (t: Tilt) => {
      if (!movesTilt(last.current, t)) return;
      last.current = t;
      x.set(withSpring(t.x, PARALLAX.glide));
      y.set(withSpring(t.y, PARALLAX.glide));
    };
    // Pinned by hand: there at once, and it stays whatever the sensor or the pointer says.
    const pin = (t: Tilt | null) => {
      pinned.current = t;
      last.current = t ?? NO_TILT;
      x.set(last.current.x);
      y.set(last.current.y);
    };
    if (__DEV__) {
      dev.__ESCAPD_TILT__ = (px, py = 0) => pin(px === null ? null : { x: px, y: py });
      if (Platform.OS === "web" && typeof location !== "undefined" && !pinned.current) {
        const asked = parseTilt(new URLSearchParams(location.search).get("tilt"));
        if (asked) pin(asked);
      }
    }
    const rest = () => {
      if (!pinned.current) aim(NO_TILT);
    };
    if (!enabled) {
      rest();
      return;
    }

    let stop = () => {};
    const start = () => {
      stop();
      if (Platform.OS === "web") {
        if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
        const move = (e: PointerEvent) => {
          if (!pinned.current) aim(pointerTilt(e.clientX, e.clientY, window.innerWidth, window.innerHeight));
        };
        window.addEventListener("pointermove", move, { passive: true });
        stop = () => window.removeEventListener("pointermove", move);
        return;
      }
      let pose: TiltRest = NO_REST;
      let before = 0;
      let gone = false;
      let subscription: { remove: () => void } | null = null;
      const listen = (available: boolean) => {
        if (gone || !available) return;
        DeviceMotion.setUpdateInterval(PARALLAX.interval);
        subscription = DeviceMotion.addListener((sample) => {
          const angles = sample.accelerationIncludingGravity ? tiltAngles(sample.accelerationIncludingGravity) : null;
          if (!angles || pinned.current) return;
          const now = Date.now();
          const step = aimTilt(pose, angles.roll, angles.pitch, before ? (now - before) / MS : 0);
          before = now;
          pose = step.rest;
          aim(step.aim);
        });
      };
      try {
        // No sensor, or one that won't start: no parallax, nothing else changes.
        Promise.resolve(DeviceMotion.isAvailableAsync()).then((available) => listen(available === true), () => {});
      } catch {
        return;
      }
      stop = () => {
        gone = true;
        subscription?.remove();
        subscription = null;
      };
    };
    // Only while the app is in front.
    if (AppState.currentState !== "background") start();
    const watch = AppState.addEventListener("change", (state) => {
      if (state === "active") start();
      else {
        stop();
        stop = () => {};
        rest();
      }
    });
    return () => {
      watch.remove();
      stop();
      rest();
    };
  }, [enabled, x, y]);

  return { x, y };
}
