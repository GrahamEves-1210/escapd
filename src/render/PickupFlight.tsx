// Picking up an item (GAME_FEEL_PROMPT.md, 1): the item flies from the
// object it came out of into its slot in the evidence tray, on an arc, and
// lands with a small bounce (the tray's tile) and the `pickup` cue. The
// flight is one shared progress value driving transforms only, on the UI
// thread. Positions are measured once, in window coordinates, before it
// starts; when they can't be measured the item simply lands.
//
// Crash-safety (the flight runs on the UI thread, where a bad value or a JS
// call kills the app rather than showing a red screen): every number that
// reaches the transform is finite (a measure can come back empty, NaN or for
// a view that has gone), the landing is reported from the animation's own end
// through scheduleOnRN, once, with a JS fallback timer, and never after the
// flight has unmounted.
import { useEffect, useRef, type ComponentRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { InventoryItem } from "@/game/selectors";
import { useModeTheme } from "@/game/mode";
import { ref, z } from "@/theme/tokens";
import { ItemIcon } from "./ItemIcon";
import { evidenceMaterial } from "./materials";

const PICKUP = ref.layout.play.pickup;
const E = ref.layout.play.evidence;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Measurable = Pick<ComponentRef<typeof View>, "measureInWindow">;

/** A box with every side finite and a real size, or null. */
export function finiteRect(x: unknown, y: unknown, width: unknown, height: unknown): Rect | null {
  const ok = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  if (!ok(x) || !ok(y) || !ok(width) || !ok(height) || width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

/**
 * A node's box in window coordinates, or null if it can't be measured within
 * `timeout` ms, has no size, or answers with a non-finite value (a view that
 * has unmounted or never laid out).
 */
export function measureInWindow(node: Measurable | null | undefined, timeout: number = PICKUP.measureTimeout): Promise<Rect | null> {
  return new Promise((resolve) => {
    if (!node || typeof node.measureInWindow !== "function") {
      resolve(null);
      return;
    }
    let settled = false;
    const done = (rect: Rect | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(rect);
    };
    const timer = setTimeout(() => done(null), timeout);
    try {
      node.measureInWindow((x, y, width, height) => done(finiteRect(x, y, width, height)));
    } catch {
      done(null);
    }
  });
}

/**
 * The flight's start and end relative to the overlay (`root`, both in window
 * coordinates), or null when any of them is missing or not finite: the item
 * then simply lands.
 */
export function flightRects(root: Rect | null, from: Rect | null, to: Rect | null): { from: Rect; to: Rect } | null {
  if (!root || !from || !to) return null;
  const local = (r: Rect) => finiteRect(r.x - root.x, r.y - root.y, r.width, r.height);
  const a = local(from);
  const b = local(to);
  return a && b ? { from: a, to: b } : null;
}

/**
 * A point on the flight at progress `t` (0..1): the straight line from the
 * centre of `from` to the centre of `to`, lifted `arc` pt at its middle (a
 * parabola), so the item is tossed into the tray rather than slid. In the
 * coordinates of the rects.
 */
export function flightPoint(from: Rect, to: Rect, t: number, arc: number = PICKUP.arc) {
  "worklet";
  const x0 = from.x + from.width / 2;
  const y0 = from.y + from.height / 2;
  const x1 = to.x + to.width / 2;
  const y1 = to.y + to.height / 2;
  return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t - arc * 4 * t * (1 - t) };
}

export interface Flight {
  key: number;
  /** Flights launched together (one clue's items): they land with one cue. */
  group?: number;
  item: InventoryItem;
  /** Where it starts and lands, relative to the overlay (the player's root). */
  from: Rect;
  to: Rect;
}

/** The scale the item lands at: the slot's size over the flight's, at most 1; 1 if that isn't a finite number. */
export function landingScale(to: Rect, size: number = PICKUP.size) {
  const s = Math.min(to.width, to.height) / size;
  return Number.isFinite(s) && s > 0 ? Math.min(1, s) : 1;
}

/**
 * The item in the air. Lands (onLanded, exactly once) when its flight ends on
 * the UI thread, or after the fallback (`flight` + `landSlack` ms) if that
 * never reports; never once it has unmounted.
 */
export function PickupFlight({ flight, onLanded }: { flight: Flight; onLanded: (key: number) => void }) {
  const theme = useModeTheme();
  const material = evidenceMaterial(theme.genre);
  const progress = useSharedValue(0);
  // Plain numbers only into the worklet's closure.
  const from = { x: flight.from.x, y: flight.from.y, width: flight.from.width, height: flight.from.height };
  const to = { x: flight.to.x, y: flight.to.y, width: flight.to.width, height: flight.to.height };
  const size = PICKUP.size;
  const endScale = landingScale(to, size);
  const onLandedRef = useRef(onLanded);
  useEffect(() => {
    onLandedRef.current = onLanded;
  }, [onLanded]);
  // Set once it has landed or unmounted: a second report (the animation and the fallback) does nothing.
  const over = useRef(false);

  useEffect(() => {
    over.current = false;
    const key = flight.key;
    const land = () => {
      if (over.current) return;
      over.current = true;
      onLandedRef.current(key);
    };
    progress.set(withTiming(1, { duration: PICKUP.flight, easing: Easing.bezier(0.3, 0, 0.6, 1) }, (finished) => {
      if (finished) scheduleOnRN(land);
    }));
    const timer = setTimeout(land, PICKUP.flight + PICKUP.landSlack);
    return () => {
      over.current = true;
      clearTimeout(timer);
      cancelAnimation(progress);
    };
    // One flight per key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight.key]);

  const style = useAnimatedStyle(() => {
    const raw = progress.get();
    const t = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 1;
    const p = flightPoint(from, to, t);
    const scale = PICKUP.from + (endScale - PICKUP.from) * t;
    return {
      transform: [{ translateX: p.x - size / 2 }, { translateY: p.y - size / 2 }, { scale }, { rotate: `${(1 - t) * -12}deg` }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={`pickup-flight-${flight.item.id}`}
      style={[styles.flight, { width: size, height: size, backgroundColor: material.tag, borderColor: material.edge }, style]}
    >
      <ItemIcon name={flight.item.name} size={ref.layout.play.tray.icon} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flight: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: z.toast,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: E.well.radius,
    ...ref.curve,
    borderWidth: E.stitch,
  },
});
