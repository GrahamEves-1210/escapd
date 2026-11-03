// One photo of the room, in the dark (gameplay v2 §2 "Discover"). The room
// sits in shadow; the player's finger sweeps a torch beam, and objects worth a
// look catch the light: a faint line along each one's real outline glints as
// the beam passes (or never, in the hard "no glints" setting). A tap looks at what is under the finger. A
// lit lamp throws its own pool of light; a UV mark glows; an opened panel and a
// pinned card show where the room changed. A fast horizontal fling turns to the
// next view.
//
// Touch is one pan (the beam) racing one tap (look); both are hit-tested here.
// Screen readers get one button per visible object instead (accessibilityTap).
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import { Image } from "expo-image";
import {
  BlurMask, Canvas, Circle, Group, Oval, Paint, Path, RadialGradient, Rect, RoundedRect, vec,
} from "@shopify/react-native-skia";
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from "react-native-gesture-handler";
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useDerivedValue, useSharedValue, withRepeat, withTiming, type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { Overlay, Rect as Box } from "@/engine/v2";
import type { Genre } from "@/lib/puzzle-types";
import { TreatedImage } from "@/components/noir";
import { useModeTheme } from "@/game/mode";
import { outlinePath } from "@/game/outline";
import { useTheme } from "@/theme/ThemeProvider";
import { aspectOf } from "@/render/geometry";
import type { SceneSource } from "@/render/SceneView";
import { V2 } from "./layout";
import { useOutlines } from "./useOutlines";
import { UvTrace, type StageTrace } from "./UvTrace";

export interface StageObject {
  id: string;
  label: string;
  box: Box;
  /** The object's outline from its definition (photo fractions), when the room has one; else traced here. */
  outline?: { x: number; y: number }[];
  seen: boolean;
}

export interface StageProps {
  source: SceneSource;
  cacheKey?: string;
  genre: Genre;
  objects: StageObject[];
  overlays: { object: string; overlay: Overlay; box: Box }[];
  /** A taken object's fill (its rect in photo fractions), drawn over the photo under the dark. */
  patch?: { rect: Box; uri: string } | null;
  /** False: the hard setting, no glints at all. */
  glints: boolean;
  /** The UV flashlight is on: a violet beam, and invisible ink shows where it falls. */
  uv?: boolean;
  /** Writing revealed on objects (glow marks): shown under the UV beam, or always while a lamp is lit. */
  marks?: { object: string; box: Box; text: string }[];
  /** UV traces on this photo (prints, stains, footprints, writing): drawn only under the UV beam. */
  traces?: StageTrace[];
  /** The trace under the UV beam's centre as it moves (UV reveals it after a moment). */
  onTrace?: (traceId: string | null) => void;
  /** The object under the beam's centre as it moves (UV checks it after a moment). */
  onHover?: (objectId: string | null) => void;
  /** Where the beam points (photo fractions), owned by the parent so others can follow it. */
  beam?: { x: SharedValue<number>; y: SharedValue<number> };
  /** Turned to from this side (1: from the right, -1: from the left, 0: no slide). */
  enter?: 1 | -1 | 0;
  /** An object being looked at closely: the light swings onto it. */
  focus?: Box | null;
  /**
   * The photo's frame once laid out, in points from the view's top-left corner
   * (the view this Stage fills). Worked out from layout alone, so it never
   * carries the slide-in or a close-up's zoom: the parent adds the view's own
   * place on screen (drops from the tray are hit-tested against it).
   */
  onFrame?: (frame: { x: number; y: number; width: number; height: number }) => void;
  /** Show interactives (accessibility): a faint outline on every object, always. */
  assist: boolean;
  onLook: (objectId: string | null) => void;
  onPage: (dir: 1 | -1) => void;
  accessibilityLabel: string;
}

/** The smallest visible object under a point (image fractions), or null. */
export function hitTest(objects: readonly StageObject[], x: number, y: number): string | null {
  let best: StageObject | null = null;
  for (const o of objects) {
    const { box: b } = o;
    if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) continue;
    if (!best || b.w * b.h < best.box.w * best.box.h) best = o;
  }
  return best?.id ?? null;
}

export function Stage({
  source, cacheKey, genre, objects, overlays, patch, glints, assist, onLook, onPage, accessibilityLabel,
  uv = false, marks = [], traces = [], onTrace, onHover, onFrame, focus = null, beam, enter = 0,
}: StageProps) {
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  // The glints' shimmer: one slow clock for every outline (still, with reduced motion or no glints).
  const shimmer = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion || !glints) {
      cancelAnimation(shimmer);
      shimmer.set(-1);
      return;
    }
    shimmer.set(0);
    shimmer.set(withRepeat(withTiming(1, { duration: GLINT.shimmerMs, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(shimmer);
  }, [reducedMotion, glints, shimmer]);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [aspect, setAspect] = useState<number | null>(null);
  // The room fills the whole view, edge to edge like a game's viewport (no
  // bars): scaled to cover it, centred, the overflow trimmed.
  const frame = useMemo(() => {
    if (!aspect || viewport.width <= 0 || viewport.height <= 0) return null;
    const scale = Math.max(viewport.width / aspect, viewport.height) / viewport.height;
    const height = viewport.height * scale;
    const width = height * aspect;
    return { x: (viewport.width - width) / 2, y: (viewport.height - height) / 2, width, height };
  }, [viewport, aspect]);
  const W = frame?.width ?? 0;
  const H = frame?.height ?? 0;

  // The beam, in photo fractions: the parent's when given (the cat's eyes follow it).
  const ownX = useSharedValue<number>(V2.torch.rest.x);
  const ownY = useSharedValue<number>(V2.torch.rest.y);
  const tx = beam?.x ?? ownX;
  // Each object's real outline: the room's own, or traced from the photo on the device.
  const outlines = useOutlines(source, cacheKey, objects);
  const ty = beam?.y ?? ownY;
  const size = useSharedValue({ w: 0, h: 0 });
  useEffect(() => size.set({ w: W, h: H }), [size, W, H]);

  // What the beam's centre is on, worked out on the UI thread; JS hears only when it changes.
  const boxes = objects.map((o) => [o.box.x, o.box.y, o.box.w, o.box.h, o.box.w * o.box.h] as const);
  const ids = objects.map((o) => o.id);
  const hovered = useSharedValue(-1);
  const hover = (i: number) => onHover?.(i >= 0 ? ids[i] ?? null : null);
  // The frame, told to the parent whenever it changes (never measured on screen: the view may be mid-slide).
  const fx = frame?.x, fy = frame?.y;
  useEffect(() => {
    if (fx === undefined || fy === undefined || W <= 0 || H <= 0) return;
    onFrame?.({ x: fx, y: fy, width: W, height: H });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onFrame is a fresh closure each render; only the frame matters.
  }, [fx, fy, W, H]);
  const pan = usePanGesture({
    maxPointers: 1,
    minDistance: 4,
    onBegin: (e) => {
      "worklet";
      const s = size.get();
      if (s.w <= 0) return;
      tx.set(withTiming(e.x / s.w, { duration: 90 }));
      ty.set(withTiming(e.y / s.h, { duration: 90 }));
    },
    onUpdate: (e) => {
      "worklet";
      const s = size.get();
      if (s.w <= 0) return;
      const x = Math.min(1, Math.max(0, e.x / s.w));
      const y = Math.min(1, Math.max(0, e.y / s.h));
      tx.set(x);
      ty.set(y);
      let hit = -1;
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i];
        if (x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3] && (hit < 0 || b[4] < boxes[hit][4])) hit = i;
      }
      if (hit !== hovered.get()) {
        hovered.set(hit);
        scheduleOnRN(hover, hit);
      }
    },
    onDeactivate: (e) => {
      "worklet";
      if (Math.abs(e.translationX) > V2.page.flingDistance && Math.abs(e.velocityX) > V2.page.flingVelocity
        && Math.abs(e.translationX) > 2 * Math.abs(e.translationY)) {
        scheduleOnRN(onPage, e.translationX < 0 ? 1 : -1);
      }
    },
  });
  // A tap points the light there; looking closer is the magnifier's (dragged onto something).
  const tap = useTapGesture({
    maxDistance: 12,
    onActivate: (e) => {
      "worklet";
      const s = size.get();
      if (s.w <= 0) return;
      tx.set(withTiming(e.x / s.w, { duration: 160 }));
      ty.set(withTiming(e.y / s.h, { duration: 160 }));
    },
  });
  // Looking closer: the light swings onto the object and the view pushes in on
  // it, as if stepping up to it, into the part of the view above the sheet.
  const zoom = useSharedValue(1);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  useEffect(() => {
    const t = { duration: 460, easing: Easing.inOut(Easing.cubic) };
    if (!focus || !frame) {
      zoom.set(withTiming(1, t));
      panX.set(withTiming(0, t));
      panY.set(withTiming(0, t));
      return;
    }
    tx.set(withTiming(focus.x + focus.w / 2, { duration: 380 }));
    ty.set(withTiming(focus.y + focus.h / 2, { duration: 380 }));
    const fw = frame.width, fh = frame.height;
    const scale = Math.max(1, Math.min(2.4, (viewport.width * 0.7) / (focus.w * fw), (viewport.height * 0.34) / (focus.h * fh)));
    const cx = (focus.x + focus.w / 2) * fw;
    const cy = (focus.y + focus.h / 2) * fh;
    // The object's centre to the middle of the view's upper part (the sheet covers the rest).
    zoom.set(withTiming(scale, t));
    panX.set(withTiming(viewport.width / 2 - frame.x - cx * scale, t));
    panY.set(withTiming(viewport.height * 0.26 - frame.y - cy * scale, t));
  }, [focus, frame, viewport, tx, ty, zoom, panX, panY]);
  const zoomStyle = useAnimatedStyle(() => ({
    transformOrigin: "0% 0%",
    transform: zoom.get() === 1 && panX.get() === 0 && panY.get() === 0
      ? []
      : [{ translateX: panX.get() }, { translateY: panY.get() }, { scale: zoom.get() }],
  }));

  // Turning to another view: the room slides in from the side turned to.
  const { width: windowW } = useWindowDimensions();
  const slide = useSharedValue(enter * windowW * 0.6);
  const slideIn = useSharedValue(enter === 0 ? 1 : 0);
  useEffect(() => {
    slide.set(withTiming(0, { duration: 340, easing: Easing.out(Easing.cubic) }));
    slideIn.set(withTiming(1, { duration: 260 }));
  }, [slide, slideIn]);
  const slideStyle = useAnimatedStyle(() => ({ opacity: slideIn.get(), transform: [{ translateX: slide.get() }] }));
  const gesture = useCompetingGestures(pan, tap);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setViewport({ width, height });
  };

  const darkness = V2.torch.darkness[genre];
  const R = V2.torch.radius * W;
  const lamps = overlays.filter((o) => o.overlay === "light_on");

  return (
    <Animated.View style={[styles.root, slideStyle]} onLayout={onLayout} testID="v2-stage">
      {frame ? (
        <Animated.View style={[styles.frame, { left: frame.x, top: frame.y, width: W, height: H }, zoomStyle]}>
        <GestureDetector gesture={gesture}>
          <View style={StyleSheet.absoluteFill} collapsable={false}>
            <TreatedImage
              source={source}
              genre={null}
              cacheKey={cacheKey}
              style={StyleSheet.absoluteFill}
              contentFit="fill"
              accessible
              accessibilityRole="image"
              accessibilityLabel={accessibilityLabel}
              onLoad={(e) => setAspect((a) => a ?? aspectOf(e.source.width, e.source.height))}
            />
            {patch ? (
              <Image
                source={{ uri: patch.uri }}
                contentFit="fill"
                transition={600}
                accessible={false}
                testID="v2-removed-patch"
                style={{ position: "absolute", left: patch.rect.x * W, top: patch.rect.y * H, width: patch.rect.w * W, height: patch.rect.h * H }}
              />
            ) : null}
            <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
              {/* Marks the room has gained, drawn on the photo under the dark. */}
              {overlays.map((o) => (
                <OverlayMark key={`${o.object}-${o.overlay}`} kind={o.overlay} box={o.box} w={W} h={H} ink={theme.ink} glow={theme.glow ?? theme.stamp} />
              ))}
              {/* The dark, with the beam and every lit lamp punched out of it. */}
              <Group layer={<Paint />}>
                <Rect x={0} y={0} width={W} height={H} color={`rgba(0,0,0,${uv ? Math.min(0.95, darkness + 0.04) : darkness})`} />
                <Beam tx={tx} ty={ty} w={W} h={H} r={R} uv={uv} />
                {lamps.map((l) => {
                  const cx = (l.box.x + l.box.w / 2) * W;
                  const cy = (l.box.y + l.box.h / 2) * H;
                  const reach = Math.max(l.box.w * W, l.box.h * H) * V2.torch.lampReach;
                  return (
                    <Circle key={l.object} cx={cx} cy={cy} r={reach} blendMode="dstOut">
                      <RadialGradient c={vec(cx, cy)} r={reach} colors={["rgba(0,0,0,1)", "rgba(0,0,0,0.85)", "rgba(0,0,0,0)"]} positions={[0, 0.45, 1]} />
                    </Circle>
                  );
                })}
              </Group>
              {/* The light itself: a faint warm cast in the torch's pool, or the UV flashlight's violet. */}
              <Beam tx={tx} ty={ty} w={W} h={H} r={R} uv={uv} tint />
              {/* Glints: an outline that catches the beam. */}
              {glints
                ? objects.map((o) => (
                    <Glint
                      key={o.id} box={o.box} seen={o.seen} assist={assist} tx={tx} ty={ty} w={W} h={H} r={R}
                      color={uv ? GLINT.uv : theme.ink} outline={outlines[o.id]} shimmer={shimmer} uv={uv}
                    />
                  ))
                : null}
            </Canvas>
            {/* UV traces and invisible ink: seen where the UV beam falls (ink on objects also while a lamp is lit). */}
            <UvTrace traces={traces} marks={marks} genre={genre} w={W} h={H} tx={tx} ty={ty} r={R} uv={uv} lampLit={lamps.length > 0} onTrace={onTrace} onOpen={onLook} />
            {/* One button per object for screen readers; no touch handlers, so the gestures above get every touch. */}
            {objects.map((o) => (
              <View
                key={o.id}
                accessible
                accessibilityRole="button"
                accessibilityLabel={o.label}
                onAccessibilityTap={() => onLook(o.id)}
                testID={`v2-object-${o.id}`}
                style={[styles.a11y, { left: o.box.x * W, top: o.box.y * H, width: o.box.w * W, height: o.box.h * H }]}
              />
            ))}
          </View>
        </GestureDetector>
        </Animated.View>
      ) : (
        // Measure the photo first: the frame is laid out once its aspect is known.
        <TreatedImage
          source={source}
          genre={null}
          cacheKey={cacheKey}
          style={styles.probe}
          contentFit="contain"
          accessible={false}
          onLoad={(e) => setAspect(aspectOf(e.source.width, e.source.height) ?? 0.75)}
        />
      )}
    </Animated.View>
  );
}

/**
 * The torch's light. Punched out of the dark (dstOut) with a long, soft
 * falloff, like a real torch's pool: full in the middle, easing off through
 * the outer half, no edge. With `tint`, the colour the light casts over what it
 * falls on, drawn over the dark: a faint warm cast, or the UV flashlight's
 * violet (and the UV light is dimmer: less of the room shows through it).
 */
function Beam({ tx, ty, w, h, r, uv, tint = false }: {
  tx: SharedValue<number>; ty: SharedValue<number>; w: number; h: number; r: number; uv: boolean; tint?: boolean;
}) {
  const reach = r * BEAM.feather;
  const c = useDerivedValue(() => vec(tx.get() * w, ty.get() * h));
  const cx = useDerivedValue(() => tx.get() * w);
  const cy = useDerivedValue(() => ty.get() * h);
  if (tint) {
    const colors = uv ? BEAM.uvTint : BEAM.warmTint;
    return (
      <Circle cx={cx} cy={cy} r={reach}>
        <RadialGradient c={c} r={reach} colors={colors} positions={BEAM.stops} />
      </Circle>
    );
  }
  return (
    <Circle cx={cx} cy={cy} r={reach} blendMode="dstOut">
      <RadialGradient c={c} r={reach} colors={uv ? BEAM.uvClear : BEAM.clear} positions={BEAM.stops} />
    </Circle>
  );
}

/** The beam's falloff: a smooth, Gaussian-like curve over these stops (as a share of its reach). */
const FALLOFF = [1, 0.97, 0.86, 0.64, 0.4, 0.2, 0.07, 0];
const rgba = (rgb: string, a: number) => `rgba(${rgb},${+a.toFixed(3)})`;
const BEAM = {
  /** The pool reaches this far past the beam's radius, its soft edge feathered out over the extra. */
  feather: 1.18,
  stops: [0, 0.16, 0.33, 0.5, 0.65, 0.79, 0.91, 1],
  clear: FALLOFF.map((a) => rgba("0,0,0", a)),
  uvClear: FALLOFF.map((a) => rgba("0,0,0", a * 0.72)),
  warmTint: FALLOFF.map((a) => rgba("255,206,150", a * 0.1)),
  uvTint: FALLOFF.map((a) => rgba("138,86,255", a * 0.4)),
};

/** The glints' look: a soft blurred glow on the outline and a fine crisp line, brighter under the beam. */
const GLINT = {
  line: 1.3,
  /** The line under the beam's centre, hot white (violet under UV), fading out to the beam's edge. */
  hot: "rgba(255,250,240,1)",
  hotUv: "rgba(230,214,255,1)",
  /** The glow under UV: the outlines light up violet. */
  uv: "rgb(196,168,255)",
  /** A spark of light that runs along the outline, this share of it long, once round in this long. */
  spark: 0.07,
  shimmerMs: 4200,
};

function Glint({ box, seen, assist, tx, ty, w, h, r, color, outline, shimmer, uv }: {
  box: Box; seen: boolean; assist: boolean; tx: SharedValue<number>; ty: SharedValue<number>; w: number; h: number; r: number; color: string;
  /** The object's outline (photo fractions): the glint runs along its real edge. */
  outline?: { x: number; y: number }[];
  /** The shimmer's clock (0..1, round and round; below 0: still). */
  shimmer: SharedValue<number>;
  uv: boolean;
}) {
  const bx = box.x * w, by = box.y * h, bw = box.w * w, bh = box.h * h;
  // Only where the beam is: nothing glints in the dark. Lit by how near the
  // beam is to the object (anywhere on it, so a tall door glints all along).
  const opacity = useDerivedValue(() => {
    const px = tx.get() * w, py = ty.get() * h;
    const d = Math.hypot(Math.max(bx - px, 0, px - bx - bw), Math.max(by - py, 0, py - by - bh));
    const lit = Math.max(0, 1 - d / (r * 0.9));
    const glint = (seen ? V2.glint.seen : 1) * V2.glint.peak * lit * lit;
    return assist ? Math.max(glint, V2.glint.assist) : glint;
  });
  // The beam's centre, for the line's hot spot.
  const c = useDerivedValue(() => vec(tx.get() * w, ty.get() * h));
  // The spark's run along the outline (each object's starts somewhere else round it).
  const offset = (Math.abs(Math.sin(bx * 12.9898 + by * 78.233)) * 43758.5453) % 1;
  const sparkStart = useDerivedValue(() => (shimmer.get() < 0 ? 0 : (shimmer.get() + offset) % 1));
  const sparkEnd = useDerivedValue(() => (shimmer.get() < 0 ? 0 : Math.min(1, ((shimmer.get() + offset) % 1) + GLINT.spark)));
  // A smooth curve through the outline, spikes cleaned off, corners kept (src/game/outline.ts).
  const path = useMemo(() => (outline && outline.length >= 3 ? outlinePath(outline, w, h) : null), [outline, w, h]);
  if (path) {
    const hot = uv ? GLINT.hotUv : GLINT.hot;
    return (
      <Group opacity={opacity}>
        {/* A soft glow hugging the edge, */}
        <Path path={path} color={color} style="stroke" strokeWidth={V2.glint.halo} strokeJoin="round" strokeCap="round" opacity={uv ? 0.6 : 0.4} antiAlias>
          <BlurMask blur={V2.glint.blur} style="normal" />
        </Path>
        {/* a fine crisp line on the edge itself, */}
        <Path path={path} color={color} style="stroke" strokeWidth={GLINT.line} strokeJoin="round" strokeCap="round" antiAlias opacity={0.85} />
        {/* hot where the beam's centre falls on it, */}
        <Path path={path} style="stroke" strokeWidth={GLINT.line + 0.4} strokeJoin="round" strokeCap="round" antiAlias>
          <RadialGradient c={c} r={r * 0.75} colors={[hot, hot.replace(/,1\)$/, ",0.35)"), "rgba(255,255,255,0)"]} positions={[0, 0.45, 1]} />
        </Path>
        {/* and a spark of light running round it. */}
        <Path path={path} color={hot} style="stroke" strokeWidth={2.4} strokeCap="round" strokeJoin="round" start={sparkStart} end={sparkEnd} antiAlias opacity={0.75}>
          <BlurMask blur={1.6} style="solid" />
        </Path>
      </Group>
    );
  }
  // No outline (yet): a faint thin oval inside the box, never a lit box.
  const inset = V2.glint.inset;
  return (
    <Group opacity={opacity}>
      <Oval
        x={bx + bw * inset} y={by + bh * inset} width={bw * (1 - 2 * inset)} height={bh * (1 - 2 * inset)}
        color={color} style="stroke" strokeWidth={V2.glint.stroke} opacity={V2.glint.oval} antiAlias
      >
        <BlurMask blur={2} style="normal" />
      </Oval>
    </Group>
  );
}

function OverlayMark({ kind, box, w, h, ink, glow }: { kind: Overlay; box: Box; w: number; h: number; ink: string; glow: string }) {
  const x = box.x * w, y = box.y * h, bw = box.w * w, bh = box.h * h;
  switch (kind) {
    case "glow_mark":
      // The writing itself is drawn by UvTrace, under the beam.
      return null;
    case "panel_open":
      return (
        <Group>
          <RoundedRect x={x + bw * 0.2} y={y + bh * 0.2} width={bw * 0.6} height={bh * 0.6} r={6} color="rgba(0,0,0,0.7)" />
          <RoundedRect x={x + bw * 0.2} y={y + bh * 0.2} width={bw * 0.6} height={bh * 0.6} r={6} color={ink} style="stroke" strokeWidth={1.5} opacity={0.6} />
        </Group>
      );
    case "pinned_card":
      return <RoundedRect x={x + bw - 18} y={y - 6} width={16} height={20} r={2} color={glow} opacity={0.9} />;
    case "light_on":
    case "object_removed":
      return null;
  }
}

/** How much of a photo's height the view may trim to fill its width. */

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  frame: { position: "absolute", overflow: "hidden" },
  a11y: { position: "absolute" },
  probe: { ...StyleSheet.absoluteFill, opacity: 0 },
});
