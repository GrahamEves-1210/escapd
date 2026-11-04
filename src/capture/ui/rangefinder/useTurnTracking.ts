// The turn dial's live tracking (docs/DESIGN.md 02, the turn dial): how far
// the phone has turned since the last photo, from expo-sensors' DeviceMotion
// (CoreMotion's fused, bias-corrected rotation rate on iOS, the gyroscope on
// Android; neither asks for a permission). The rotation rate is taken along
// gravity, so it is the turn about the vertical however the phone is held,
// and integrated between samples (src/capture/turn.ts). It restarts from 0 on
// every `resetKey`, which the camera changes the moment the shutter fires, so
// the turn is measured from where that photo was taken: the sensor keeps
// running while `listening` (through the busy wait after the shutter, when
// most players already start turning), and the dial only shows it while
// `active`. The step is read live, so a lens switch mid-turn rescales the
// turn without losing it. `onReached` fires once per turn, while active.
// The turn is signed, positive to the right (turnRate, src/capture/turn.ts):
// only a turn to the right moves toward the next stop.
//
// It degrades to nothing: on the web (where motion needs a tap to allow it
// and the camera is a preview), with no sensor, a sensor that won't start or
// never sends a rotation rate, and whenever `active` is off, `tracking` is
// false and the dial is static.
import { useCallback, useEffect, useRef, useState } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { Platform } from "react-native";
import { DeviceMotion, type DeviceMotionMeasurement } from "expo-sensors";
import {
  TURN_REACHED,
  TURN_SAMPLE_MS,
  integrateTurn,
  isTurnReached,
  nowSeconds,
  quantizeProgress,
  rateAxes,
  smoothGravity,
  turnProgress,
  turnRate,
  turnCarry,
  turnReach,
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
  /** Keep the sensor running and the turn counted (the camera is live and photos are being taken in turn). */
  listening: boolean;
  /** Show the turn and tick when it is far enough: the next photo follows the one the turn is counted from. */
  active: boolean;
  /** Degrees between photos (turnPlan's step), read live. */
  step: number;
  /** The lens's view across, degrees (LENS_FOV), read live: far enough is tied to the view neighbours share (turnReach). Without it, TURN_REACHED. */
  fov?: number;
  /** Changes the moment a photo is taken: the turn restarts from 0 there. */
  resetKey: string;
  /**
   * The photo `resetKey` marks was taken in turn, so the turn from it makes up
   * what the turn into it fell short (turnCarry). False for a photo placed
   * out of turn. Default true.
   */
  carry?: boolean;
  /** Under Reduce Motion the drawn progress steps in quarters. */
  reducedMotion: boolean;
  /** Once per turn, as it reaches `reach`. */
  onReached: () => void;
}

export interface TurnTracking {
  /** The sensor is running and sending rotation: the dial shows live progress. */
  tracking: boolean;
  /** 0 to 1 toward the next stop, as drawn (quantised). */
  progress: number;
  /** This turn has gone far enough. */
  reached: boolean;
  /**
   * Degrees this turn aims for: the plan's step plus what the last turn shown
   * fell short of it (or less what it went past), so stopping a little early
   * or late at one photo is made up at the next instead of adding up round
   * the room into a gap between the last photo and the first.
   */
  target: number;
  /**
   * Degrees turned since the photo the turn is counted from, signed (positive
   * to the right), live at the sensor's rate: the turn guide's moving edge.
   */
  turned: SharedValue<number>;
}

interface TurnState {
  /** The photo (resetKey) this turn is counted from. */
  key: string;
  turned: number;
  gravity: Vec3 | null;
  last: number | null;
  reached: boolean;
  /** A sample came in while the turn was shown (the player was turning toward a stop). */
  shown: boolean;
  /** The degrees it aimed for at its last sample. */
  target: number;
}

const fresh = (key: string, target = 0): TurnState => ({ key, turned: 0, gravity: null, last: null, reached: false, shown: false, target });


/** What the dial draws, for the photo it was measured from. */
interface Shown {
  key: string;
  progress: number;
  reached: boolean;
}

export function useTurnTracking({ listening, active, step, fov, resetKey, carry: carries = true, reducedMotion, onReached }: TurnTrackingOptions): TurnTracking {
  // Only a new photo starts the turn again: a new step (a lens switch) rescales it.
  const key = resetKey;
  const [tracking, setTracking] = useState(false);
  const [shown, setShown] = useState<Shown>({ key, progress: 0, reached: false });
  const turn = useRef<TurnState>(fresh(key, step));
  // What the turn from this key carries from the one before (turnCarry); set once per key.
  const carry = useRef({ key, degrees: 0 });
  const [carried, setCarried] = useState({ key, degrees: 0 });
  const carryInto = useCallback((next: string, stepNow: number, allowed: boolean) => {
    if (carry.current.key === next) return;
    const old = turn.current;
    const degrees = allowed && old.key !== next ? turnCarry(old, stepNow) : 0;
    carry.current = { key: next, degrees };
    setCarried({ key: next, degrees });
  }, []);
  const turnedLive = useSharedValue(0);
  // The listener reads the latest options without resubscribing.
  const latest = useRef({ key, step, fov, carries, active, reducedMotion, onReached });
  useEffect(() => {
    latest.current = { key, step, fov, carries, active, reducedMotion, onReached };
  }, [key, step, fov, carries, active, reducedMotion, onReached]);
  // A new photo: the live turn starts again from it, carrying the last one's shortfall.
  useEffect(() => {
    turnedLive.set(0);
    carryInto(key, step, carries);
    // The step at the moment of the new photo; a later lens switch rescales the target live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, turnedLive, carryInto]);

  useEffect(() => {
    if (!listening) return;
    let cancelled = false;
    let subscription: { remove: () => void } | null = null;
    const onSample = (m: DeviceMotionMeasurement) => {
      const rate = m.rotationRate;
      const g = m.accelerationIncludingGravity;
      if (!rate || !g) return;
      setTracking(true);
      const now = latest.current;
      if (turn.current.key !== now.key) {
        carryInto(now.key, now.step, now.carries);
        turn.current = fresh(now.key);
      }
      const state = turn.current;
      const target = now.step + (carry.current.key === now.key ? carry.current.degrees : 0);
      state.target = target;
      if (now.active) state.shown = true;
      state.gravity = smoothGravity(state.gravity, g);
      // Sample time from the sensor itself (seconds), so a busy JS thread doesn't stretch it.
      const t = Number.isFinite(rate.timestamp) ? rate.timestamp : nowSeconds();
      const dt = state.last === null ? 0 : t - state.last;
      state.last = t;
      state.turned = integrateTurn(state.turned, turnRate(rateAxes(rate, Platform.OS), state.gravity), dt);
      turnedLive.set(state.turned);
      const raw = turnProgress(state.turned, target);
      const drawn = quantizeProgress(raw, now.reducedMotion);
      // Far enough is only said while the dial shows the turn; a turn made
      // while hidden (the busy wait) ticks as soon as it shows.
      const reach = now.fov === undefined ? TURN_REACHED : turnReach(target, now.fov);
      const reachedNow = now.active && !state.reached && isTurnReached(raw, reach);
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
  }, [listening, turnedLive, carryInto]);

  const live = tracking && listening && active;
  // Progress measured from an earlier photo is not shown for this one.
  const current = live && shown.key === key ? shown : null;
  const target = step + (carried.key === key ? carried.degrees : 0);
  return { tracking: live, progress: current?.progress ?? 0, reached: current?.reached ?? false, turned: turnedLive, target };
}
