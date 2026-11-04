// A hint's paw prints: when the player takes a hint that names something in the
// room, the cat walks it there. Small inky prints in the cat's sweet colour
// step out one by one from the cat on the ledge, in a gentle arc across the
// photo, left, right, left, toward the thing, and fade behind it (at 12 fps,
// like the cat). A hint that names nothing here, nothing. Under reduced motion
// the whole trail is simply there, and fades.
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Ellipse, Path } from "react-native-svg";
import type { ObjectDef } from "@/engine/v2";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { useStopMotion } from "./PeekingCat";

/**
 * The trail: a print every `step` points (between `min` and `max` of them),
 * `size` points across, `sway` either side of its line; it starts `clear`
 * points from the cat's head and stops `short` of the thing's middle. Its arc
 * bows `bow` of its length to one side. A print lands every `every` ms (two
 * drawn frames), stays `stay` ms, and fades over `fade` ms. Under reduced
 * motion all of them show `still` ms, then fade. A hint's trail waits for the
 * room (the hint is taken in the casebook) at most `wait` ms.
 */
export const TRAIL = { step: 24, min: 4, max: 14, size: 14, sway: 5, clear: 34, short: 10, bow: 0.16, every: 167, stay: 1500, fade: 700, still: 2600, wait: 60000 } as const;

/** Window points. */
type Point = { x: number; y: number };

/**
 * What a hint points at: an object it names (by its label), among `objects`.
 * The thing to do wins over the thing that helps ("With the lamp on, inspect
 * the desk": the desk), then something not looked at yet, then the first named.
 */
export function hintTarget(text: string, objects: readonly Pick<ObjectDef, "id" | "label">[], seen: readonly string[] = []): string | null {
  const said = text.toLowerCase();
  let best: { id: string; score: number } | null = null;
  for (const o of objects) {
    const label = o.label.trim().toLowerCase();
    if (label.length < 2) continue;
    // Whole words only (a "map" isn't in "mapped").
    const found = new RegExp(`(^|[^a-z])${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z])`).exec(said);
    if (!found) continue;
    const at = found.index;
    const helper = /(with|while) the\s*$/.test(said.slice(Math.max(0, at - 12), at + found[1].length));
    const score = (helper ? 0 : 4) + (seen.includes(o.id) ? 0 : 2) - at / 1000;
    if (!best || score > best.score) best = { id: o.id, score };
  }
  return best?.id ?? null;
}

/** The prints along an arc from `from` to `to` (window points): where each lands and which way it points (degrees, 0 = up). */
export function trailPrints(from: Point, to: Point): { x: number; y: number; angle: number }[] {
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  const walk = len - TRAIL.clear - TRAIL.short;
  if (walk < TRAIL.step) return [];
  const n = Math.max(TRAIL.min, Math.min(TRAIL.max, Math.round(walk / TRAIL.step)));
  // Across the line (to its left as it goes), and the arc's bow.
  const nx = -dy / len, ny = dx / len;
  const side = dx >= 0 ? 1 : -1;
  const bow = len * TRAIL.bow * side;
  const point = (s: number) => {
    const u = (TRAIL.clear + walk * s) / len;
    const b = 4 * u * (1 - u) * bow;
    return { x: from.x + dx * u + nx * b, y: from.y + dy * u + ny * b };
  };
  const out: { x: number; y: number; angle: number }[] = [];
  for (let i = 0; i < n; i++) {
    const s = n === 1 ? 1 : i / (n - 1);
    const p = point(s), q = point(Math.min(1, s + 0.01)), r = point(Math.max(0, s - 0.01));
    const tx = q.x - r.x, ty = q.y - r.y;
    const tl = Math.hypot(tx, ty) || 1;
    // Left, right, left: each print a little to its side of the line.
    const off = (i % 2 === 0 ? -1 : 1) * TRAIL.sway;
    out.push({ x: p.x + (-ty / tl) * off, y: p.y + (tx / tl) * off, angle: (Math.atan2(tx, -ty) * 180) / Math.PI + (i % 2 === 0 ? -8 : 8) });
  }
  return out;
}

/** One paw print: a pad and four toes, in ink. */
function Print({ x, y, angle, i, clock, still, color }: { x: number; y: number; angle: number; i: number; clock: SharedValue<number[]>; still: boolean; color: string }) {
  const size = TRAIL.size;
  const style = useAnimatedStyle(() => {
    const ms = clock.get()[0];
    if (still) {
      const o = ms < TRAIL.still ? 1 : Math.max(0, 1 - (ms - TRAIL.still) / TRAIL.fade);
      return { opacity: o * 0.9, transform: [{ rotate: `${angle}deg` }] };
    }
    const t = ms - i * TRAIL.every;
    // Pressed in (a little big, settling), held, faded.
    const o = t < 0 ? 0 : t < TRAIL.stay ? 1 : Math.max(0, 1 - (t - TRAIL.stay) / TRAIL.fade);
    const scale = t < 0 ? 0.6 : t < 90 ? 1.18 : 1;
    return { opacity: o * 0.9, transform: [{ rotate: `${angle}deg` }, { scale }] };
  });
  return (
    <Animated.View style={[styles.print, { left: x - size / 2, top: y - size / 2, width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 11.6 C8.4 11.6 5.6 14.8 6 17.6 C6.3 20 8.7 20.4 10.4 19.6 C11.4 19.2 12.6 19.2 13.6 19.6 C15.3 20.4 17.7 20 18 17.6 C18.4 14.8 15.6 11.6 12 11.6 Z" fill={color} />
        <Ellipse cx={5.3} cy={10.2} rx={2} ry={2.6} fill={color} transform="rotate(-24 5.3 10.2)" />
        <Ellipse cx={9.3} cy={6.2} rx={2.1} ry={2.8} fill={color} transform="rotate(-8 9.3 6.2)" />
        <Ellipse cx={14.7} cy={6.2} rx={2.1} ry={2.8} fill={color} transform="rotate(8 14.7 6.2)" />
        <Ellipse cx={18.7} cy={10.2} rx={2} ry={2.6} fill={color} transform="rotate(24 18.7 10.2)" />
      </Svg>
    </Animated.View>
  );
}

/** A trail of prints from `from` to `to` (points in the parent's box), played once; `onDone` once it has faded. */
export function PawTrail({ from, to, onDone }: { from: Point; to: Point; onDone?: () => void }) {
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  const prints = useMemo(() => trailPrints(from, to), [from, to]);
  const total = reducedMotion ? TRAIL.still + TRAIL.fade : (prints.length - 1) * TRAIL.every + TRAIL.stay + TRAIL.fade;
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withTiming(total, { duration: total, easing: Easing.linear }));
    const done = setTimeout(() => onDone?.(), total + 50);
    return () => clearTimeout(done);
    // Played once, from when it's drawn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const clock = useStopMotion([t], [0]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="v2-paw-trail">
      {prints.map((p, i) => (
        <Print key={i} {...p} i={i} clock={clock} still={reducedMotion} color={theme.sweet} />
      ))}
    </View>
  );
}

/**
 * The hint's trail in the room: a hint just taken (`hint`, a new `at` each)
 * that names an object (hintTarget) leaves prints from the cat's head (`head`,
 * window points) to it, once the room is in view (`watching`) with that object
 * on the photo (`view`): within TRAIL.wait of the hint, or never. `origin`: the
 * parent's top-left in window points (the prints are drawn in its box).
 */
export function HintTrail({ hint, objects, seen, view, frame, head, watching, origin }: {
  hint: { text: string; at: number } | null;
  /** The room's objects that are there to be found (not hidden, not taken). */
  objects: readonly ObjectDef[];
  seen: readonly string[];
  view: number;
  frame: { x: number; y: number; width: number; height: number } | null;
  head: Point | null;
  watching: boolean;
  origin: Point;
}) {
  // The hint waiting to be walked to, and the one walked (once each).
  const [shown, setShown] = useState<number | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const target = hint ? objects.find((o) => o.id === hintTarget(hint.text, objects, seen)) : undefined;
  const fresh = !!hint && done !== hint.at && (shown === hint.at || Date.now() - hint.at < TRAIL.wait);
  const ready = fresh && !!target && target.photo_index === view && watching && !!frame && !!head;
  // A beat after the room comes back into view, so the eye is there to see it.
  useEffect(() => {
    if (!ready || !hint || shown === hint.at) return;
    const timer = setTimeout(() => setShown(hint.at), 450);
    return () => clearTimeout(timer);
  }, [ready, hint, shown]);
  if (!ready || !hint || shown !== hint.at || !target || !frame || !head) return null;
  const to = { x: frame.x + (target.box.x + target.box.w / 2) * frame.width - origin.x, y: frame.y + (target.box.y + target.box.h / 2) * frame.height - origin.y };
  return <PawTrail key={hint.at} from={{ x: head.x - origin.x, y: head.y - origin.y }} to={to} onDone={() => setDone(hint.at)} />;
}

const styles = StyleSheet.create({
  print: { position: "absolute" },
});
