import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Image as RNImage, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import {
  GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture, type PanGesture,
} from "react-native-gesture-handler";
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { Genre } from "@/lib/puzzle-types";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import { TreatedImage } from "@/components/noir";
import {
  MIN_ZOOM, aspectOf, clampTransform, doubleTapTarget, fillWidthFit, freeMargin, zoomAround, type Size, type Transform,
} from "./geometry";

/** A bundled asset (require) or a signed photo URL. */
export type SceneSource = number | { uri: string };

export interface LoupeTarget {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SceneViewProps {
  source: SceneSource;
  /** The case's mode: the photo shows in its baked treatment (TreatedImage), on the stage and in the loupe. */
  genre: Genre | null;
  /** False fades the treatment away to the photo's own colours (paranormal's case closed). Default true. */
  treated?: boolean;
  /** A stable id for the photo when its uri is a signed URL that changes. */
  cacheKey?: string;
  accessibilityLabel: string;
  /** Rendered inside the image box, so children position in image fractions. Only on the page in view. */
  children: (stage: Size) => ReactNode;
  /** True while the player pinches, pans, or holds the loupe (chrome fades). */
  onInteractionChange?: (active: boolean) => void;
  /** Completion: the photo pulls back slightly. */
  pulledBack?: boolean;
  /** Use-item mode: a white ring inside the photo's edge. */
  armed?: boolean;
  /** This scene's visible hotspot rects. The loupe ticks when it crosses one; the crop never cuts one. */
  loupeTargets?: LoupeTarget[];
  /** The page in view: hotspots, gestures and the photo's accessibility. Default true. */
  active?: boolean;
  /** Set to false while this page is zoomed, so the pager doesn't swipe away from it. */
  pageable?: SharedValue<boolean>;
  /** The photo's width / height, once known. */
  onAspect?: (aspect: number) => void;
  /** The visible window, once laid out (the pager sets its dots on its foot). */
  onWindow?: (window: Size) => void;
  /**
   * The pager's swipe. The loupe blocks it: a swipe waits for the press-and-
   * hold to fail (it fails as soon as the finger moves), and a held loupe is
   * never swiped away.
   */
  pagerGesture?: PanGesture;
}

const SETTLE_MS = 220;
const P = ref.layout.play;

export function bundledAspect(source: SceneSource): number | null {
  if (typeof source !== "number") return null;
  const resolved = RNImage.resolveAssetSource(source);
  return aspectOf(resolved?.width, resolved?.height);
}

/**
 * One room photo, full bleed: it fills the page's width with square edges,
 * in the mode's baked treatment on the mode's ground (the original shows
 * until the bake is ready); a short page crops it evenly top and
 * bottom, but only into margins no hotspot reaches (else it is contained).
 * No mount, rim or label. Use mode draws a white ring inside its edge.
 * Pinch, pan and the loupe all happen inside the visible window, so hotspot
 * fractions stay locked to the photograph.
 */
export function SceneView({
  source, genre, treated = true, cacheKey, accessibilityLabel, children, onInteractionChange, pulledBack,
  armed = false, loupeTargets = [], active = true, pageable, onAspect, onWindow, pagerGesture,
}: SceneViewProps) {
  const { reducedMotion } = useTheme();
  const theme = useModeTheme();
  const feedback = useFeedback();
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });
  const [aspect, setAspect] = useState<number | null>(() => bundledAspect(source));
  // A size that isn't finite and positive keeps the aspect we have (NaN or Infinity must never reach the layout).
  const onPhotoLoad = (width: number, height: number) => {
    const next = aspectOf(width, height);
    if (next !== null) setAspect(next);
  };

  const free = useMemo(() => freeMargin(loupeTargets), [loupeTargets]);
  const fit = aspect ? fillWidthFit(viewport, aspect, Math.min(free, P.photo.maxCrop)) : null;
  const imageWidth = fit?.image.width ?? 0;
  const imageHeight = fit?.image.height ?? 0;
  const windowWidth = fit?.window.width ?? 0;
  const windowHeight = fit?.window.height ?? 0;

  const vp = useSharedValue<Size>({ width: 0, height: 0 });
  const img = useSharedValue<Size>({ width: 0, height: 0 });
  const reduced = useSharedValue(reducedMotion);
  const isActive = useSharedValue(active);
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const zoomed = useSharedValue(false);
  const loupeOn = useSharedValue(active && !reducedMotion);
  const pinchStart = useSharedValue({ scale: 1, tx: 0, ty: 0, fx: 0, fy: 0 });
  const panStart = useSharedValue({ tx: 0, ty: 0 });
  const pull = useSharedValue(1);
  const showLoupe = useSharedValue(0);
  const loupeX = useSharedValue(0);
  const loupeY = useSharedValue(0);
  const loupeImgX = useSharedValue(0);
  const loupeImgY = useSharedValue(0);
  const overHotspot = useSharedValue(false);
  const targets = useSharedValue<LoupeTarget[]>(loupeTargets);

  useEffect(() => {
    vp.set({ width: windowWidth, height: windowHeight });
    img.set({ width: imageWidth, height: imageHeight });
    if (windowWidth > 0 && windowHeight > 0) onWindow?.({ width: windowWidth, height: windowHeight });
    // onWindow is a callback prop; only the sizes matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowWidth, windowHeight, imageWidth, imageHeight, vp, img]);

  useEffect(() => {
    if (aspect) onAspect?.(aspect);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect]);

  useEffect(() => {
    reduced.set(reducedMotion);
  }, [reducedMotion, reduced]);

  useEffect(() => {
    isActive.set(active);
  }, [active, isActive]);

  useEffect(() => {
    targets.set(loupeTargets);
  }, [loupeTargets, targets]);

  useAnimatedReaction(
    () => zoomed.get() || reduced.get() || !isActive.get(),
    (blocked) => {
      loupeOn.set(!blocked);
      if (blocked) showLoupe.set(0);
    },
  );

  // Only the page in view tells the pager whether it may swipe.
  useAnimatedReaction(
    () => (isActive.get() ? !zoomed.get() : null),
    (canPage) => {
      if (canPage !== null && pageable) pageable.set(canPage);
    },
  );

  useEffect(() => {
    if (pulledBack) {
      pull.set(reducedMotion ? 1 : withTiming(0.94, { duration: motion.completionPullBack }));
      scale.set(withTiming(1, { duration: SETTLE_MS }));
      tx.set(withTiming(0, { duration: SETTLE_MS }));
      ty.set(withTiming(0, { duration: SETTLE_MS }));
    }
  }, [pulledBack, reducedMotion, pull, scale, tx, ty]);

  const notify = (on: boolean) => onInteractionChange?.(on);
  const detent = () => feedback.tick();

  const animateTo = (t: Transform) => {
    "worklet";
    zoomed.set(t.scale > MIN_ZOOM + 0.01);
    if (reduced.get()) {
      scale.set(t.scale);
      tx.set(t.tx);
      ty.set(t.ty);
      return;
    }
    scale.set(withTiming(t.scale, { duration: SETTLE_MS }));
    tx.set(withTiming(t.tx, { duration: SETTLE_MS }));
    ty.set(withTiming(t.ty, { duration: SETTLE_MS }));
  };

  const settle = () => {
    "worklet";
    const c = clampTransform({ scale: scale.get(), tx: tx.get(), ty: ty.get() }, vp.get(), img.get());
    animateTo(c.scale < MIN_ZOOM + 0.02 ? { scale: MIN_ZOOM, tx: 0, ty: 0 } : c);
  };

  // x, y are in the window; the image shares its centre (it may be taller, cropped).
  const placeLoupe = (x: number, y: number) => {
    "worklet";
    const w = img.get().width;
    const h = img.get().height;
    const vw = vp.get().width;
    const vh = vp.get().height;
    if (w <= 0 || h <= 0) return;
    const s = scale.get();
    const ix = (x - vw / 2 - tx.get()) / s + w / 2;
    const iy = (y - vh / 2 - ty.get()) / s + h / 2;
    const mag = motion.loupeMagnification * s;
    const size = motion.loupeSize;
    let lx = x - size / 2;
    let ly = y - size - 16;
    if (ly < 4) ly = y + 28;
    lx = Math.min(Math.max(lx, 4), Math.max(4, vw - size - 4));
    ly = Math.min(Math.max(ly, 4), Math.max(4, vh - size - 4));
    loupeX.set(lx);
    loupeY.set(ly);
    loupeImgX.set(size / 2 - ix * mag);
    loupeImgY.set(size / 2 - iy * mag);
    showLoupe.set(1);

    const fx = ix / w;
    const fy = iy / h;
    let hit = false;
    for (const rect of targets.get()) {
      if (fx >= rect.x && fx <= rect.x + rect.w && fy >= rect.y && fy <= rect.y + rect.h) hit = true;
    }
    if (hit && !overHotspot.get()) scheduleOnRN(detent);
    overHotspot.set(hit);
  };

  const pinch = usePinchGesture({
    enabled: isActive,
    onActivate: (e) => {
      "worklet";
      pinchStart.set({ scale: scale.get(), tx: tx.get(), ty: ty.get(), fx: e.focalX, fy: e.focalY });
      showLoupe.set(0);
      scheduleOnRN(notify, true);
    },
    onUpdate: (e) => {
      "worklet";
      const s = pinchStart.get();
      const next = zoomAround(s, { x: s.fx, y: s.fy }, { x: e.focalX, y: e.focalY }, s.scale * e.scale, vp.get());
      scale.set(next.scale);
      tx.set(next.tx);
      ty.set(next.ty);
    },
    onDeactivate: () => {
      "worklet";
      settle();
      scheduleOnRN(notify, false);
    },
  });

  const pan = usePanGesture({
    enabled: zoomed,
    maxPointers: 1,
    onActivate: () => {
      "worklet";
      panStart.set({ tx: tx.get(), ty: ty.get() });
      scheduleOnRN(notify, true);
    },
    onUpdate: (e) => {
      "worklet";
      const start = panStart.get();
      const c = clampTransform(
        { scale: scale.get(), tx: start.tx + e.translationX, ty: start.ty + e.translationY },
        vp.get(), img.get());
      tx.set(c.tx);
      ty.set(c.ty);
    },
    onDeactivate: () => {
      "worklet";
      scheduleOnRN(notify, false);
    },
  });

  const loupePan = usePanGesture({
    enabled: loupeOn,
    block: pagerGesture,
    // Activates only by the hold (no distance), and fails once the finger moves.
    activateAfterLongPress: 280,
    maxPointers: 1,
    onActivate: (e) => {
      "worklet";
      placeLoupe(e.x, e.y);
      scheduleOnRN(notify, true);
    },
    onUpdate: (e) => {
      "worklet";
      placeLoupe(e.x, e.y);
    },
    onDeactivate: () => {
      "worklet";
      showLoupe.set(0);
      overHotspot.set(false);
      scheduleOnRN(notify, false);
    },
  });

  const doubleTap = useTapGesture({
    enabled: isActive,
    numberOfTaps: 2,
    maxDelay: 250,
    onActivate: (e) => {
      "worklet";
      animateTo(doubleTapTarget({ scale: scale.get(), tx: tx.get(), ty: ty.get() }, { x: e.x, y: e.y }, vp.get(), img.get()));
    },
  });

  const gesture = useSimultaneousGestures(pinch, pan, loupePan, doubleTap);

  const stageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() * pull.get() }],
  }));
  const loupeFrame = useAnimatedStyle(() => ({
    opacity: showLoupe.get(),
    transform: [{ translateX: loupeX.get() }, { translateY: loupeY.get() }],
  }));
  const loupeImageStyle = useAnimatedStyle(() => {
    const mag = motion.loupeMagnification * scale.get();
    return {
      width: img.get().width * mag,
      height: img.get().height * mag,
      transform: [{ translateX: loupeImgX.get() }, { translateY: loupeImgY.get() }],
    };
  });

  const laidOut = fit && windowWidth > 0 && windowHeight > 0;
  return (
    <View
      style={[styles.root, { backgroundColor: theme.ground }]}
      onLayout={(e) => setViewport(e.nativeEvent.layout)}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
      testID="scene-view"
    >
      {laidOut ? (
        <GestureDetector gesture={gesture}>
          <View style={[styles.window, { width: windowWidth, height: windowHeight }]} testID={active ? "scene-window" : undefined}>
            <Animated.View
              style={[
                styles.stage,
                { width: imageWidth, height: imageHeight, left: (windowWidth - imageWidth) / 2, top: (windowHeight - imageHeight) / 2 },
                stageStyle,
              ]}
            >
              {/* One baked image whose source changes once: the transform moves it, so pan and zoom cost nothing per frame. */}
              <TreatedImage
                source={source}
                genre={genre}
                original={!treated}
                cacheKey={cacheKey}
                style={StyleSheet.absoluteFill}
                contentFit="fill"
                accessible={active}
                accessibilityRole="image"
                accessibilityLabel={accessibilityLabel}
                accessibilityHint={reducedMotion ? undefined : "Pinch to look closer. Press and hold for the loupe."}
                onLoad={(e) => onPhotoLoad(e.source.width, e.source.height)}
                testID={active ? "scene-photo" : undefined}
              />
              {active ? children({ width: imageWidth, height: imageHeight }) : null}
            </Animated.View>
            {armed && active ? <View pointerEvents="none" style={[styles.armed, { borderColor: theme.ink }]} testID="scene-armed" /> : null}
            <Animated.View pointerEvents="none" style={[styles.loupe, loupeFrame]}>
              <View style={styles.loupeLens}>
                <Animated.View style={[styles.loupeImage, loupeImageStyle]}>
                  <TreatedImage
                    source={source}
                    genre={genre}
                    original={!treated}
                    cacheKey={cacheKey}
                    style={StyleSheet.absoluteFill}
                    contentFit="fill"
                    accessible={false}
                  />
                </Animated.View>
                <View style={styles.loupeRim} />
              </View>
            </Animated.View>
          </View>
        </GestureDetector>
      ) : (
        <Image
          source={source}
          style={styles.measure}
          onLoad={(e) => onPhotoLoad(e.source.width, e.source.height)}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}
    </View>
  );
}

const LOUPE = motion.loupeSize;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ref.color.ground,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  // The visible photo: square edges, clipped; a void ground until the photo draws.
  window: { overflow: "hidden", backgroundColor: ref.color.void },
  stage: { position: "absolute" },
  // Use mode: a white ring inside the photo's edge.
  armed: {
    ...StyleSheet.absoluteFill,
    borderWidth: P.photo.armed,
    borderColor: ref.color.textPrimary,
  },
  // 02's last-plate frame as a circle: a well ring, the image clipped inside it with a faint rim.
  loupe: {
    position: "absolute",
    top: 0,
    left: 0,
    width: LOUPE,
    height: LOUPE,
    borderRadius: LOUPE / 2,
    borderWidth: P.loupe.ring,
    borderColor: ref.color.well,
    backgroundColor: ref.color.void,
  },
  loupeLens: { flex: 1, borderRadius: LOUPE / 2, overflow: "hidden" },
  loupeImage: { position: "absolute", left: 0, top: 0 },
  loupeRim: { ...StyleSheet.absoluteFill, borderRadius: LOUPE / 2, borderWidth: P.loupe.rim, borderColor: ref.color.rimFaint },
  measure: { width: 1, height: 1, opacity: 0 },
});
