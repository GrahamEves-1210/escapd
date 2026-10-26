import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type AccessibilityActionEvent } from "react-native";
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
const WH = P.wheel;
const [E1, E2, E3, E4] = G.easing;
// The settle: an ease-out with no overshoot (initial slope G.slope).
const SETTLE_EASING = Easing.bezier(E1, E2, E3, E4);
// The wheel's slots round the view in view: one further than the neighbours each side, so a turn brings the next one in.
const WHEEL_SLOTS = [-2, -1, 0, 1, 2] as const;
const SLOT_NAMES: Record<(typeof WHEEL_SLOTS)[number], string> = { [-2]: "far-left", [-1]: "left", 0: "current", 1: "right", 2: "far-right" };
// The strip each side of the middle thumbnail: the tap target for that neighbour.
const SIDE = Math.max(ref.hit.min, (WH.span - WH.width) / 2);

/** `n` round a loop of `count` (0..count-1). */
export function wrapIndex(n: number, count: number): number {
  "worklet";
  return ((n % count) + count) % count;
}

/** The shortest way round a loop of `count` from view `from` to view `to` (forward on a tie). */
export function loopDelta(from: number, to: number, count: number): number {
  const d = wrapIndex(to - from, count);
  return d > count / 2 ? d - count : d;
}

/** The views on the wheel, left to right, round the view in view (with wrap-around): far left, left, current, right, far right. */
export function wheelOrder(index: number, count: number): number[] {
  return WHEEL_SLOTS.map((j) => wrapIndex(index + j, count));
}

export interface ScenePagerProps {
  count: number;
  /** The view in view (ui memory). */
  index: number;
  /** A swipe, a wheel tap or an accessibility action settled on another view. */
  onIndexChange: (index: number) => void;
  /** Views with something new in them (never the one in view). */
  marked: number[];
  /** False while the view in view is zoomed: the pager doesn't take the swipe. */
  pageable: SharedValue<boolean>;
  /** A page's content, one screen wide. `active` is the view in view; `pager` is the swipe, for the page's own gestures to relate to. */
  renderPage: (index: number, active: boolean, onWindow: (window: Size) => void, pager: PanGesture) => ReactNode;
  /** A view's photo for the wheel: fills its thumbnail (the frame clips it). Baked small, once per photo. */
  renderThumb?: (index: number) => ReactNode;
  /** Drawn over the view in view (the toast). */
  overlay?: ReactNode;
  /** No swiping (the case is closing). */
  disabled?: boolean;
}

/**
 * The room's views as pages one screen wide with no gap between them, so one
 * photo's edge meets the next, round a loop: past the last view comes the
 * first and before the first the last, like turning round in the room.
 *
 * One shared value, `pos`, is where the pager is, counted in views round the
 * loop with no wrap (0, 1, 2, 3 ... is view 1, 2, 3, 1 ... of 3); the view
 * in view is `virtual` (React) / `target` (UI thread), the same count. Each
 * mounted page sits at (its slot - pos) screen widths, and the wheel turns
 * by the same pos, so both follow the finger on the UI thread with no
 * re-render per frame. Only the slots next to the one in view are mounted;
 * with two views the slots either side show the same photo, as a loop of two
 * does. On release it projects the velocity, snaps to the nearest page (one
 * at most) and settles on an ease-out with no overshoot, its duration matched
 * to the release speed. With one view nothing loops: it resists and returns.
 * Reduced motion: no following; a swipe cross-fades and the wheel just updates.
 *
 * The thumbnail wheel sits on the photo's foot: the view in view in the
 * middle, its neighbours either side, turned away round a drum. It is the
 * accessible control (adjustable: next and previous view, round the loop),
 * and tapping a neighbour goes to it.
 */
export function ScenePager({ count, index, onIndexChange, marked, pageable, renderPage, renderThumb, overlay, disabled = false }: ScenePagerProps) {
  const { reducedMotion } = useTheme();
  const theme = useModeTheme();
  const feedback = useFeedback();
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  // Each mounted page's visible photo height, for the wheel on its foot.
  const [windows, setWindows] = useState<Record<number, number>>({});
  const W = size.width;
  const loops = count > 1;

  // The view in view, counted round the loop (wrapIndex(virtual) is `index`).
  const [virtual, setVirtual] = useState(index);
  let current = virtual;
  if (wrapIndex(virtual, Math.max(1, count)) !== index) {
    // The index changed from outside (memory loaded, a restart): the shortest way there.
    current = loops ? virtual + loopDelta(wrapIndex(virtual, count), index, count) : index;
    setVirtual(current);
  }

  const pos = useSharedValue(index);
  const fade = useSharedValue(1);
  const start = useSharedValue(0);
  const width = useSharedValue(0);
  const pages = useSharedValue(count);
  const reduced = useSharedValue(reducedMotion);
  const locked = useSharedValue(disabled);
  // The slot the pager is at or on its way to.
  const target = useSharedValue(index);

  useEffect(() => {
    pages.set(count);
    reduced.set(reducedMotion);
    locked.set(disabled);
    width.set(W);
  }, [count, reducedMotion, disabled, W, pages, reduced, locked, width]);

  // The move to slot `next`: the settle, or a quick cross-fade under reduced motion (the wheel just updates).
  const moveTo = useCallback((next: number, velocity = 0) => {
    "worklet";
    if (reduced.get()) {
      const half = motion.reducedFade / 2;
      cancelAnimation(pos);
      fade.set(withTiming(0, { duration: half }, (finished) => {
        if (!finished) return;
        pos.set(next);
        fade.set(withTiming(1, { duration: half }));
      }));
      return;
    }
    const distance = Math.abs(next - pos.get()) * width.get();
    const speed = Math.abs(velocity);
    const matched = speed > 1 ? (G.slope * distance / speed) * 1000 : G.maxDuration;
    const duration = Math.min(G.maxDuration, Math.max(G.minDuration, matched));
    pos.set(withTiming(next, { duration, easing: SETTLE_EASING }));
  }, [fade, pos, reduced, width]);

  // A slot set from outside: follow it (at once until laid out).
  useEffect(() => {
    if (target.get() === current) return;
    target.set(current);
    if (W > 0) moveTo(current);
    else pos.set(current);
  }, [current, W, moveTo, target, pos]);

  const settled = useCallback((next: number) => {
    feedback.tick();
    setVirtual(next);
    onIndexChange(wrapIndex(next, count));
  }, [feedback, onIndexChange, count]);

  // One step round the loop: -1 back, +1 on.
  const step = useCallback((delta: number) => {
    if (disabled || !loops || delta === 0) return;
    const next = target.get() + delta;
    target.set(next);
    if (W > 0) moveTo(next);
    else pos.set(next);
    settled(next);
  }, [disabled, loops, W, moveTo, settled, target, pos]);

  const pan = usePanGesture({
    enabled: pageable,
    activeOffsetX: [-G.activeOffset, G.activeOffset],
    failOffsetY: [-G.failOffset, G.failOffset],
    maxPointers: 1,
    testID: "scene-swipe",
    onActivate: () => {
      "worklet";
      cancelAnimation(pos);
      start.set(pos.get());
    },
    onUpdate: (e) => {
      "worklet";
      const w = width.get();
      if (reduced.get() || locked.get() || w <= 0) return;
      const home = target.get();
      let p = start.get() - e.translationX / w;
      if (pages.get() < 2) {
        // One view: nothing loops; it resists.
        p = home + (p - home) * G.edgeResistance;
      } else {
        // At most one page either way: only the neighbours are mounted.
        p = Math.min(home + 1, Math.max(home - 1, p));
      }
      pos.set(p);
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
        next = Math.round(pos.get() - (e.velocityX * G.projection) / w);
      }
      next = Math.min(from + 1, Math.max(from - 1, next));
      if (pages.get() < 2) next = from;
      if (next === from && reduced.get()) return;
      target.set(next);
      moveTo(next, e.velocityX);
      if (next !== from) scheduleOnRN(settled, next);
    },
  });

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));

  const onWindow = useCallback((i: number) => (win: Size) => {
    setWindows((w) => (w[i] === win.height ? w : { ...w, [i]: win.height }));
  }, []);

  // The wheel sits on the photo's foot (the area's foot when the photo is cropped).
  const footInset = Math.max(0, (size.height - (windows[index] ?? size.height)) / 2) + WH.inset;
  const slots = loops ? [current - 1, current, current + 1] : [current];

  return (
    <View style={[styles.root, { backgroundColor: theme.ground }]} onLayout={(e) => setSize(e.nativeEvent.layout)} testID="scene-pager">
      {W > 0 ? (
        <GestureDetector gesture={pan}>
          <Animated.View style={[StyleSheet.absoluteFill, fadeStyle]}>
            {slots.map((slot) => {
              const i = wrapIndex(slot, count);
              return (
                <PageSlot key={slot} slot={slot} pos={pos} width={width} pageWidth={W} testID={`scene-page-${i}`}>
                  {renderPage(i, slot === current, onWindow(i), pan)}
                </PageSlot>
              );
            })}
          </Animated.View>
        </GestureDetector>
      ) : null}
      {overlay}
      {loops ? (
        <Wheel
          count={count}
          current={current}
          pos={pos}
          marked={marked}
          bottom={footInset}
          renderThumb={renderThumb}
          onStep={step}
        />
      ) : null}
    </View>
  );
}

/** One page, (slot - pos) screen widths from the middle. */
function PageSlot({ slot, pos, width, pageWidth, testID, children }: {
  slot: number;
  pos: SharedValue<number>;
  width: SharedValue<number>;
  pageWidth: number;
  testID: string;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: (slot - pos.get()) * width.get() }] }));
  return (
    <Animated.View style={[styles.page, { width: pageWidth }, style]} testID={testID}>
      {children}
    </Animated.View>
  );
}

function Wheel({ count, current, pos, marked, bottom, renderThumb, onStep }: {
  count: number;
  current: number;
  pos: SharedValue<number>;
  marked: number[];
  bottom: number;
  renderThumb?: (index: number) => ReactNode;
  onStep: (delta: number) => void;
}) {
  const focus = useFocusRing();
  const index = wrapIndex(current, count);
  const fresh = marked.filter((m) => m !== index);
  const value = `${index + 1} of ${count}${fresh.length ? `. Something new on view ${fresh.map((m) => m + 1).join(" and ")}` : ""}`;

  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === "increment") onStep(1);
    if (e.nativeEvent.actionName === "decrement") onStep(-1);
  };

  return (
    <View pointerEvents="box-none" style={[styles.wheelSlot, { bottom }]}>
      <Pressable
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="View"
        accessibilityValue={{ text: value }}
        accessibilityHint="Swipe up or down to change view."
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={onAction}
        onFocus={focus.onFocus}
        onBlur={focus.onBlur}
        // Only the side strips take a touch: a tap on the middle reaches the photo.
        pointerEvents="box-none"
        testID="view-wheel"
        style={styles.wheel}
      >
        {WHEEL_SLOTS.map((j) => {
          const slot = current + j;
          const photo = wrapIndex(slot, count);
          return (
            <WheelThumb
              key={slot}
              slot={slot}
              pos={pos}
              isNew={j !== 0 && marked.includes(photo) && photo !== index}
              testID={`view-wheel-${SLOT_NAMES[j]}`}
              photoTestID={`view-thumb-${photo}${j === 0 ? "-current" : ""}`}
            >
              {renderThumb?.(photo)}
            </WheelThumb>
          );
        })}
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          focusable={false}
          onPress={() => onStep(-1)}
          style={[styles.side, { left: 0 }]}
          testID="view-wheel-previous"
        />
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          focusable={false}
          onPress={() => onStep(1)}
          style={[styles.side, { right: 0 }]}
          testID="view-wheel-next"
        />
        <FocusRing visible={focus.focused} shape="pill" />
      </Pressable>
    </View>
  );
}

/**
 * One thumbnail round the drum: at `d` = slot - pos views off centre it is
 * `d` x step degrees round, so drum x sin(angle) to the side, turned away by
 * `tilt` of that angle, shrunk, dimmed and (past the neighbours) faded.
 */
function WheelThumb({ slot, pos, isNew, testID, photoTestID, children }: {
  slot: number;
  pos: SharedValue<number>;
  isNew: boolean;
  testID: string;
  photoTestID: string;
  children: ReactNode;
}) {
  const theme = useModeTheme();
  const drum = useAnimatedStyle(() => {
    const d = Math.max(-2, Math.min(2, slot - pos.get()));
    const a = Math.abs(d);
    const angle = d * WH.step;
    const scale = a <= 1 ? 1 - (1 - WH.neighbourScale) * a : WH.neighbourScale - (WH.neighbourScale - WH.farScale) * (a - 1);
    const opacity = a <= WH.fadeFrom ? 1 : Math.max(0, 1 - (a - WH.fadeFrom) / (WH.fadeTo - WH.fadeFrom));
    return {
      opacity,
      zIndex: 10 - Math.round(a * 4),
      transform: [
        { perspective: WH.perspective },
        { translateX: WH.drum * Math.sin((angle * Math.PI) / 180) },
        { rotateY: `${angle * WH.tilt}deg` },
        { scale },
      ],
    };
  });
  const shade = useAnimatedStyle(() => ({ opacity: WH.dim * Math.min(1, Math.abs(slot - pos.get())) }));

  return (
    <Animated.View pointerEvents="none" style={[styles.thumb, drum]} testID={testID}>
      <View style={styles.thumbClip} testID={photoTestID}>
        {children}
        <Animated.View style={[styles.thumbShade, shade]} />
      </View>
      <View style={[styles.thumbRim, { borderColor: theme.rim }]} />
      {isNew ? <View style={[styles.thumbNew, { backgroundColor: theme.ink }]} testID={`${photoTestID}-new`} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden", backgroundColor: ref.color.ground },
  page: { position: "absolute", top: 0, bottom: 0, left: 0 },
  wheelSlot: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  wheel: { width: WH.span, height: Math.max(WH.slot, ref.hit.min), alignItems: "center", justifyContent: "center" },
  // Each thumbnail sits in the middle; its transform takes it round the drum.
  thumb: {
    position: "absolute",
    width: WH.width,
    height: WH.height,
    borderRadius: WH.radius,
    backgroundColor: ref.color.void,
    boxShadow: WH.shadow,
    ...ref.curve,
  },
  thumbClip: { ...StyleSheet.absoluteFill, borderRadius: WH.radius, overflow: "hidden", ...ref.curve },
  thumbShade: { ...StyleSheet.absoluteFill, backgroundColor: ref.color.void },
  thumbRim: { ...StyleSheet.absoluteFill, borderRadius: WH.radius, borderWidth: WH.rim, ...ref.curve },
  // Something new: a white dot on the corner, ringed in void so it reads on any photo.
  thumbNew: {
    position: "absolute",
    top: -WH.marked / 2 + WH.markedRing,
    right: -WH.marked / 2 + WH.markedRing,
    width: WH.marked + WH.markedRing * 2,
    height: WH.marked + WH.markedRing * 2,
    borderRadius: ref.radius.round,
    borderWidth: WH.markedRing,
    borderColor: ref.color.void,
  },
  side: { position: "absolute", top: 0, bottom: 0, width: SIDE },
});
