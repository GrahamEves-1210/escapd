// Picking up an item (GAME_FEEL_PROMPT.md, 1): the item flies from the
// object it came out of into its slot in the evidence tray, on an arc, and
// lands with a small bounce (the tray's tile) and the `pickup` cue. The
// flight is one shared progress value driving transforms only, on the UI
// thread. Positions are measured once, in window coordinates, before it
// starts; when they can't be measured the item simply lands.
import { useEffect, type ComponentRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
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

/** A node's box in window coordinates, or null if it can't be measured within `timeout` ms. */
export function measureInWindow(node: Measurable | null | undefined, timeout: number = PICKUP.measureTimeout): Promise<Rect | null> {
  return new Promise((resolve) => {
    if (!node?.measureInWindow) {
      resolve(null);
      return;
    }
    const timer = setTimeout(() => resolve(null), timeout);
    try {
      node.measureInWindow((x, y, width, height) => {
        clearTimeout(timer);
        resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
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
  item: InventoryItem;
  /** Where it starts and lands, relative to the overlay (the player's root). */
  from: Rect;
  to: Rect;
}

/** The item in the air. Lands (onLanded) after the flight's duration. */
export function PickupFlight({ flight, onLanded }: { flight: Flight; onLanded: (key: number) => void }) {
  const theme = useModeTheme();
  const material = evidenceMaterial(theme.genre);
  const progress = useSharedValue(0);
  const { from, to } = flight;
  const size = PICKUP.size;
  const endScale = Math.min(to.width, to.height) / size;

  useEffect(() => {
    progress.set(withTiming(1, { duration: PICKUP.flight, easing: Easing.bezier(0.3, 0, 0.6, 1) }));
    const timer = setTimeout(() => onLanded(flight.key), PICKUP.flight);
    return () => clearTimeout(timer);
    // One flight per key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight.key]);

  const style = useAnimatedStyle(() => {
    const t = progress.get();
    const p = flightPoint(from, to, t);
    const scale = PICKUP.from + (Math.min(1, endScale) - PICKUP.from) * t;
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
