// The turn dial's live tracking (docs/DESIGN.md 02, the turn dial): how far
// the phone has turned since the last photo, from expo-sensors' DeviceMotion
// (CoreMotion's fused, bias-corrected rotation rate on iOS, the gyroscope on
// Android; neither asks for a permission). The rotation rate is taken along
// gravity, so it is the turn about the vertical however the phone is held,
// and integrated between samples (src/capture/turn.ts). It restarts from 0 on
// every `resetKey` (a new photo) and gives `onReached` once per turn.
//
// It degrades to nothing: on the web (where motion needs a tap to allow it
// and the camera is a preview), with no sensor, a sensor that won't start or
// never sends a rotation rate, and whenever `active` is off, `tracking` is
// false and the dial is static.
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { DeviceMotion, type DeviceMotionMeasurement } from "expo-sensors";
import {
  TURN_SAMPLE_MS,
  integrateTurn,
  isTurnReached,
  nowSeconds,
  quantizeProgress,
  rateAxes,
  smoothGravity,
  turnProgress,
  turnRate,
  type Vec3,
} from "@/capture/turn";

// Checked once per app run: the answer doesn't change.
let availability: Promise<boolean> | null = null;

function motionAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(false);
  availability ??= DeviceMotion.isAvailableAsync().then(
    (available) => available === true,
    () => false,
  );
  return availability;
}

/** Tests only: forget the cached availability. */
export function resetTurnSensorForTests() {
  availability = null;
}

export interface TurnTrackingOptions {
  /** Track only while the next photo follows a turn and the camera is live. */
  active: boolean;
  /** Degrees between photos (turnPlan's step). */
  step: number;
  /** Changes with every new photo: the turn restarts from 0. */
  resetKey: string;
  /** Under Reduce Motion the drawn progress steps in quarters. */
  reducedMotion: boolean;
  /** Once per turn, as it reaches TURN_REACHED. */
  onReached: () => void;
}

export interface TurnTracking {
  /** The sensor is running and sending rotation: the dial shows live progress. */
  tracking: boolean;
  /** 0 to 1 toward the next stop, as drawn (quantised). */
  progress: number;
  /** This turn has gone far enough. */
  reached: boolean;
}

interface TurnState {
  /** The photo (resetKey and step) this turn is toward. */
  key: string;
  turned: number;
  gravity: Vec3 | null;
  last: number | null;
  reached: boolean;
}

const fresh = (key: string): TurnState => ({ key, turned: 0, gravity: null, last: null, reached: false });

/** What the dial draws, for the photo it was measured toward. */
interface Shown {
  key: string;
  progress: number;
  reached: boolean;
}

export function useTurnTracking({ active, step, resetKey, reducedMotion, onReached }: TurnTrackingOptions): TurnTracking {
  // A new photo (or a new plan) starts the turn again.
  const key = `${resetKey}|${step}`;
  const [tracking, setTracking] = useState(false);
  const [shown, setShown] = useState<Shown>({ key, progress: 0, reached: false });
  const turn = useRef<TurnState>(fresh(key));
  // The listener reads the latest options without resubscribing.
  const latest = useRef({ key, step, reducedMotion, onReached });
  useEffect(() => {
    latest.current = { key, step, reducedMotion, onReached };
  }, [key, step, reducedMotion, onReached]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let subscription: { remove: () => void } | null = null;
    const onSample = (m: DeviceMotionMeasurement) => {
      const rate = m.rotationRate;
      const g = m.accelerationIncludingGravity;
      if (!rate || !g) return;
      setTracking(true);
      const now = latest.current;
      if (turn.current.key !== now.key) turn.current = fresh(now.key);
      const state = turn.current;
      state.gravity = smoothGravity(state.gravity, g);
      // Sample time from the sensor itself (seconds), so a busy JS thread doesn't stretch it.
      const t = Number.isFinite(rate.timestamp) ? rate.timestamp : nowSeconds();
      const dt = state.last === null ? 0 : t - state.last;
      state.last = t;
      state.turned = integrateTurn(state.turned, turnRate(rateAxes(rate, Platform.OS), state.gravity), dt);
      const raw = turnProgress(state.turned, now.step);
      const drawn = quantizeProgress(raw, now.reducedMotion);
      const reachedNow = !state.reached && isTurnReached(raw);
      if (reachedNow) state.reached = true;
      const next: Shown = { key: state.key, progress: drawn, reached: state.reached };
      setShown((prev) => (prev.key === next.key && prev.progress === next.progress && prev.reached === next.reached ? prev : next));
      if (reachedNow) now.onReached();
    };
    motionAvailable().then((available) => {
      if (cancelled || !available) return;
      try {
        DeviceMotion.setUpdateInterval(TURN_SAMPLE_MS);
        subscription = DeviceMotion.addListener(onSample);
      } catch {
        subscription = null;
      }
    });
    return () => {
      cancelled = true;
      subscription?.remove();
      setTracking(false);
    };
  }, [active]);

  const live = tracking && active;
  // Progress measured toward an earlier photo is not shown for this one.
  const current = live && shown.key === key ? shown : null;
  return { tracking: live, progress: current?.progress ?? 0, reached: current?.reached ?? false };
}
