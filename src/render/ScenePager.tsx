import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type AccessibilityActionEvent, type GestureResponderEvent } from "react-native";
import { GestureDetector, usePanGesture, type PanGesture } from "react-native-gesture-handler";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { FocusRing, useFocusRing } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import type { Size } from "./geometry";

const P = ref.layout.play;
const G = P.pager;
const D = P.dots;
const [E1, E2, E3, E4] = G.easing;
// The settle: an ease-out with no overshoot (initial slope G.slope).
const SETTLE_EASING = Easing.bezier(E1, E2, E3, E4);

export interface ScenePagerProps {
  count: number;
  /** The view in view (ui memory). */
  index: number;
  /** A swipe, a dots tap or an accessibility action settled on another view. */
  onIndexChange: (index: number) => void;
  /** Views with something new in them (never the one in view). */
  marked: number[];
  /** False while the view in view is zoomed: the pager doesn't take the swipe. */
  pageable: SharedValue<boolean>;
  /** A page's content, one screen wide. `active` is the view in view; `pager` is the swipe, for the page's own gestures to relate to. */
  renderPage: (index: number, active: boolean, onWindow: (window: Size) => void, pager: PanGesture) => ReactNode;
  /** Drawn over the view in view (the toast). */
  overlay?: ReactNode;
  /** No swiping (the case is closing). */
  disabled?: boolean;
}

/**
 * The room's views as pages one screen wide with no gap between them, so one
 * photo's edge meets the next. The row follows the finger (the gesture-handler
 * hook API and Reanimated, on the UI thread); on release it projects the
 * velocity, snaps to the nearest page (one at most) and settles on an
 * ease-out with no overshoot, its duration matched to the release speed.
 * Past the first or last page it resists. Only the views next to the one in
 * view are mounted. Reduced motion: no following; a swipe cross-fades.
 * Page dots sit on the photo's foot: the view in view white, the others grey,
 * a ring on a view with something new. The dots are the accessible control
 * (adjustable: next and previous view) and a 44 pt target (tap left of centre
 * to go back, right to go on).
 */
export function ScenePager({ count, index, onIndexChange, marked, pageable, renderPage, overlay, disabled = false }: ScenePagerProps) {
  const { reducedMotion } = useTheme();
  const theme = useModeTheme();
  const feedback = useFeedback();
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  // Each mounted page's visible photo height, for the dots on its foot.
  const [windows, setWindows] = useState<Record<number, number>>({});
  const W = size.width;

  const offset = useSharedValue(0);
  const fade = useSharedValue(1);
  const start = useSharedValue(0);
  const width = useSharedValue(0);
  const pages = useSharedValue(count);
  const reduced = useSharedValue(reducedMotion);
  const locked = useSharedValue(disabled);
  // The page the row is at or on its way to.
  const target = useSharedValue(index);

  useEffect(() => {
    pages.set(count);
    reduced.set(reducedMotion);
    locked.set(disabled);
  }, [count, reducedMotion, disabled, pages, reduced, locked]);

  // A new width: jump to the page in view, no animation.
  useEffect(() => {
    width.set(W);
    cancelAnimation(offset);
    offset.set(-target.get() * W);
  }, [W, width, offset, target]);

  // The row's move to `next`: the settle, or a quick cross-fade under reduced motion.
  const moveTo = useCallback((next: number, w: number, velocity = 0) => {
    "worklet";
    const dest = -next * w;
    if (reduced.get()) {
      const half = motion.reducedFade / 2;
      cancelAnimation(offset);
      fade.set(withTiming(0, { duration: half }, (finished) => {
        if (!finished) return;
        offset.set(dest);
        fade.set(withTiming(1, { duration: half }));
      }));
      return;
    }
    const distance = Math.abs(dest - offset.get());
    const speed = Math.abs(velocity);
    const matched = speed > 1 ? (G.slope * distance / speed) * 1000 : G.maxDuration;
    const duration = Math.min(G.maxDuration, Math.max(G.minDuration, matched));
    offset.set(withTiming(dest, { duration, easing: SETTLE_EASING }));
  }, [fade, offset, reduced]);

  // The index changed from outside (memory loaded, a restart): follow it.
  useEffect(() => {
    if (target.get() === index) return;
    target.set(index);
    if (W > 0) moveTo(index, W);
  }, [index, W, moveTo, target]);

  const settled = useCallback((next: number) => {
    feedback.tick();
    onIndexChange(next);
  }, [feedback, onIndexChange]);

  const go = useCallback((next: number) => {
    if (disabled || next < 0 || next >= count || next === target.get()) return;
    target.set(next);
    if (W > 0) moveTo(next, W);
    settled(next);
  }, [disabled, count, W, moveTo, settled, target]);

  const pan = usePanGesture({
    enabled: pageable,
    activeOffsetX: [-G.activeOffset, G.activeOffset],
    failOffsetY: [-G.failOffset, G.failOffset],
    maxPointers: 1,
    onActivate: () => {
      "worklet";
      cancelAnimation(offset);
      start.set(offset.get());
    },
    onUpdate: (e) => {
      "worklet";
      if (reduced.get() || locked.get()) return;
      const min = -(pages.get() - 1) * width.get();
      let x = start.get() + e.translationX;
      if (x > 0) x *= G.edgeResistance;
      else if (x < min) x = min + (x - min) * G.edgeResistance;
      offset.set(x);
    },
    onDeactivate: (e) => {
      "worklet";
      const w = width.get();
      if (w <= 0 || locked.get()) return;
      const from = target.get();
      let next = from;
      if (reduced.get()) {
        if (e.translationX < -G.reducedSwipe || e.velocityX < -G.swipeVelocity) next = from + 1;
        else if (e.translationX > G.reducedSwipe || e.velocityX > G.swipeVelocity) next = from - 1;
      } else {
        const projected = -(offset.get() + e.velocityX * G.projection) / w;
        next = Math.round(projected);
      }
      next = Math.min(from + 1, Math.max(from - 1, next));
      next = Math.min(pages.get() - 1, Math.max(0, next));
      if (next === from && reduced.get()) return;
      target.set(next);
      moveTo(next, w, e.velocityX);
      if (next !== from) scheduleOnRN(settled, next);
    },
  });

  const rowStyle = useAnimatedStyle(() => ({ opacity: fade.get(), transform: [{ translateX: offset.get() }] }));

  const onWindow = useCallback((i: number) => (win: Size) => {
    setWindows((w) => (w[i] === win.height ? w : { ...w, [i]: win.height }));
  }, []);

  // The dots sit on the photo's foot (the area's foot when the photo is cropped).
  const footInset = Math.max(0, (size.height - (windows[index] ?? size.height)) / 2) + D.inset;

  return (
    <View style={[styles.root, { backgroundColor: theme.ground }]} onLayout={(e) => setSize(e.nativeEvent.layout)} testID="scene-pager">
      {W > 0 ? (
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.row, { width: W * count }, rowStyle]}>
            {Array.from({ length: count }, (_, i) => (
              <View key={i} style={[styles.page, { left: i * W, width: W }]} testID={`scene-page-${i}`}>
                {Math.abs(i - index) <= 1 ? renderPage(i, i === index, onWindow(i), pan) : null}
              </View>
            ))}
          </Animated.View>
        </GestureDetector>
      ) : null}
      {overlay}
      {count > 1 ? (
        <Dots count={count} index={index} marked={marked} bottom={footInset} onGo={go} />
      ) : null}
    </View>
  );
}

function Dots({ count, index, marked, bottom, onGo }: {
  count: number;
  index: number;
  marked: number[];
  bottom: number;
  onGo: (next: number) => void;
}) {
  const focus = useFocusRing();
  const theme = useModeTheme();
  const [pillWidth, setPillWidth] = useState(0);
  const fresh = marked.filter((m) => m !== index);
  const value = `${index + 1} of ${count}${fresh.length ? `. Something new on view ${fresh.map((m) => m + 1).join(" and ")}` : ""}`;

  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === "increment") onGo(index + 1);
    if (e.nativeEvent.actionName === "decrement") onGo(index - 1);
  };
  // UIPageControl's tap: left of centre goes back, right goes on.
  const onPress = (e: GestureResponderEvent) => {
    onGo(e.nativeEvent.locationX < pillWidth / 2 ? index - 1 : index + 1);
  };

  return (
    <View pointerEvents="box-none" style={[styles.dotsSlot, { bottom }]}>
      <Pressable
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="View"
        accessibilityValue={{ text: value }}
        accessibilityHint="Swipe up or down to change view."
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={onAction}
        onPress={onPress}
        onFocus={focus.onFocus}
        onBlur={focus.onBlur}
        onLayout={(e) => setPillWidth(e.nativeEvent.layout.width)}
        testID="view-dots"
        style={styles.dotsHit}
      >
        <View style={styles.pill}>
          <View style={styles.pillFill} />
          {Array.from({ length: count }, (_, i) => {
            const current = i === index;
            const isNew = !current && marked.includes(i);
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  current ? { backgroundColor: theme.ink } : isNew ? [styles.dotNew, { borderColor: theme.ink }] : { backgroundColor: theme.inkMuted },
                ]}
                testID={current ? `view-dot-${i}-current` : isNew ? `view-dot-${i}-new` : `view-dot-${i}`}
              />
            );
          })}
          <FocusRing visible={focus.focused} shape="pill" />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden", backgroundColor: ref.color.ground },
  row: { position: "absolute", top: 0, bottom: 0, left: 0 },
  page: { position: "absolute", top: 0, bottom: 0 },
  dotsSlot: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  // A 44 pt tall target round the pill.
  dotsHit: { minHeight: ref.hit.min, justifyContent: "center", paddingHorizontal: D.padX },
  // 02's privacy note: a see-through void pill.
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: D.gap,
    paddingHorizontal: D.padX,
    paddingVertical: D.padY,
    borderRadius: ref.radius.round,
    ...ref.curve,
  },
  pillFill: { ...StyleSheet.absoluteFill, borderRadius: ref.radius.round, backgroundColor: ref.color.void, opacity: D.fillOpacity },
  dot: { width: D.size, height: D.size, borderRadius: ref.radius.round },
  // Something new: a white ring, a different shape from the filled dots.
  dotNew: { width: D.marked, height: D.marked, borderWidth: D.ring, borderColor: ref.color.textPrimary },
});
