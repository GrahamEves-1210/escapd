import { useEffect, useState, type ReactNode } from "react";
import { Image as RNImage, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import {
  GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture,
} from "react-native-gesture-handler";
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { plateNumeral } from "@/game/format";
import { useFeedback } from "@/game/feedback";
import { useTheme } from "@/theme/ThemeProvider";
import { color, curve, motion, radius, space } from "@/theme/tokens";
import { Text } from "@/components/Text";
import { MIN_ZOOM, clampTransform, containBox, doubleTapTarget, zoomAround, type Size, type Transform } from "./geometry";

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
  accessibilityLabel: string;
  /** Rendered inside the image box, so children position in image fractions. */
  children: (stage: Size) => ReactNode;
  /** True while the player pinches, pans, or holds the loupe (chrome fades). */
  onInteractionChange?: (active: boolean) => void;
  /** Completion: the photo pulls back slightly inside the plate. */
  pulledBack?: boolean;
  /** Zero-based plate index, stamped on the mount. */
  plateIndex?: number;
  plateCount?: number;
  /** Use-item mode: the mount lights in brass. */
  armed?: boolean;
  /** Revealed hotspot rects. The loupe ticks when it crosses one. */
  loupeTargets?: LoupeTarget[];
}

const SETTLE_MS = 220;
const MOUNT_PAD = 6;
const LABEL_BLOCK = 22;

function bundledAspect(source: SceneSource): number | null {
  if (typeof source !== "number") return null;
  const resolved = RNImage.resolveAssetSource(source);
  return resolved?.width && resolved?.height ? resolved.width / resolved.height : null;
}

/**
 * One room photo on a Kodachrome mount. The image is clipped to a continuous
 * 24 pt squircle; the mount is 30 pt with 6 pt of walnut around it. Pinch,
 * pan, and the loupe all happen inside that clip, so hotspot fractions stay
 * locked to the photograph.
 */
export function SceneView({
  source, accessibilityLabel, children, onInteractionChange, pulledBack,
  plateIndex = 0, plateCount = 1, armed = false, loupeTargets = [],
}: SceneViewProps) {
  const { reducedMotion } = useTheme();
  const feedback = useFeedback();
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });
  const [aspect, setAspect] = useState<number | null>(() => bundledAspect(source));

  // Gutters, the mount's padding, and the stamped plate label sit outside the photograph.
  const photo = aspect
    ? containBox({
      width: Math.max(0, viewport.width - space.plate * 2 - MOUNT_PAD * 2),
      height: Math.max(0, viewport.height - LABEL_BLOCK - space.sm - MOUNT_PAD * 2),
    }, aspect)
    : null;
  const photoWidth = photo?.width ?? 0;
  const photoHeight = photo?.height ?? 0;

  const vp = useSharedValue<Size>({ width: 0, height: 0 });
  const img = useSharedValue<Size>({ width: 0, height: 0 });
  const reduced = useSharedValue(reducedMotion);
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const zoomed = useSharedValue(false);
  const loupeOn = useSharedValue(!reducedMotion);
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
    const size = { width: photoWidth, height: photoHeight };
    vp.set(size);
    img.set(size);
  }, [photoWidth, photoHeight, vp, img]);

  useEffect(() => {
    reduced.set(reducedMotion);
  }, [reducedMotion, reduced]);

  useEffect(() => {
    targets.set(loupeTargets);
  }, [loupeTargets, targets]);

  useAnimatedReaction(
    () => zoomed.get() || reduced.get(),
    (blocked) => {
      loupeOn.set(!blocked);
      if (blocked) showLoupe.set(0);
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

  const notify = (active: boolean) => onInteractionChange?.(active);
  const detent = () => feedback.tap();

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

  const placeLoupe = (x: number, y: number) => {
    "worklet";
    const w = img.get().width;
    const h = img.get().height;
    if (w <= 0 || h <= 0) return;
    const s = scale.get();
    const ix = (x - w / 2 - tx.get()) / s + w / 2;
    const iy = (y - h / 2 - ty.get()) / s + h / 2;
    const mag = motion.loupeMagnification * s;
    const size = motion.loupeSize;
    let lx = x - size / 2;
    let ly = y - size - 16;
    if (ly < 4) ly = y + 28;
    lx = Math.min(Math.max(lx, 4), Math.max(4, w - size - 4));
    ly = Math.min(Math.max(ly, 4), Math.max(4, h - size - 4));
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
    minDistance: 0,
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

  const stamp = `ESCAPD 400  ·  PLATE ${plateNumeral(plateIndex)}${plateCount > 1 ? `  /  ${plateNumeral(plateCount - 1)}` : ""}`;

  return (
    <View style={styles.root} onLayout={(e) => setViewport(e.nativeEvent.layout)} testID="scene-view">
      {photo && photoWidth > 0 && photoHeight > 0 ? (
        <View style={[styles.mount, armed && styles.mountArmed, { width: photoWidth + MOUNT_PAD * 2 }]}>
          <GestureDetector gesture={gesture}>
            <View style={[styles.plate, { width: photoWidth, height: photoHeight }]}>
              <Animated.View style={[StyleSheet.absoluteFill, stageStyle]}>
                <Image
                  source={source}
                  style={StyleSheet.absoluteFill}
                  contentFit="fill"
                  transition={0}
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel={accessibilityLabel}
                  accessibilityHint={reducedMotion ? undefined : "Pinch to look closer. Press and hold for the loupe."}
                  onLoad={(e) => setAspect(e.source.width / e.source.height)}
                />
                {children({ width: photoWidth, height: photoHeight })}
              </Animated.View>
              <View pointerEvents="none" style={styles.rim} />
              <RegistrationMarks />
              <Animated.View pointerEvents="none" style={[styles.loupe, loupeFrame]}>
                <View style={styles.loupeLens}>
                  <Animated.View style={[styles.loupeImage, loupeImageStyle]}>
                    <Image source={source} style={StyleSheet.absoluteFill} contentFit="fill" />
                  </Animated.View>
                </View>
              </Animated.View>
            </View>
          </GestureDetector>
          <Text variant="stamp" tone="accent" align="center" style={styles.plateLabel}>{stamp}</Text>
        </View>
      ) : (
        <Image
          source={source}
          style={styles.measure}
          onLoad={(e) => setAspect(e.source.width / e.source.height)}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}
    </View>
  );
}

function RegistrationMarks() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.mark, styles.markTL]} />
      <View style={[styles.mark, styles.markTR]} />
      <View style={[styles.mark, styles.markBL]} />
      <View style={[styles.mark, styles.markBR]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.canvas,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.plate,
  },
  mount: {
    padding: MOUNT_PAD,
    borderRadius: radius.mount,
    ...curve,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  mountArmed: { borderColor: color.accent },
  plate: {
    borderRadius: radius.image,
    ...curve,
    overflow: "hidden",
    backgroundColor: color.canvas,
  },
  rim: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.image,
    ...curve,
    borderWidth: 1,
    borderColor: color.rim,
  },
  plateLabel: { marginTop: 6 },
  mark: { position: "absolute", width: 12, height: 12, borderColor: color.accent },
  markTL: { top: 8, left: 8, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  markTR: { top: 8, right: 8, borderTopWidth: 1.5, borderRightWidth: 1.5 },
  markBL: { bottom: 8, left: 8, borderBottomWidth: 1.5, borderLeftWidth: 1.5 },
  markBR: { bottom: 8, right: 8, borderBottomWidth: 1.5, borderRightWidth: 1.5 },
  loupe: {
    position: "absolute",
    top: 0,
    left: 0,
    width: motion.loupeSize,
    height: motion.loupeSize,
    borderRadius: motion.loupeSize / 2,
    borderWidth: 3,
    borderColor: color.accent,
    backgroundColor: color.canvas,
  },
  loupeLens: { flex: 1, borderRadius: motion.loupeSize / 2, overflow: "hidden" },
  loupeImage: { position: "absolute", left: 0, top: 0 },
  measure: { width: 1, height: 1, opacity: 0 },
});
