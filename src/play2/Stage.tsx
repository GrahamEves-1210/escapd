// One photo of the room, in the dark (gameplay v2 §2 "Discover"). The room
// sits in shadow; the player's finger sweeps a torch beam, and objects worth a
// look catch the light: a few small sparkles twinkle round each one where the
// beam falls on it (violet under UV; never in the hard "no glints" setting). A
// tap points the light. A
// lit lamp throws its own pool of light; a UV mark glows; an opened panel and a
// pinned card show where the room changed. A fast horizontal fling turns to the
// next view.
//
// Touch is one pan (the beam) racing one tap (look); both are hit-tested here.
// Screen readers get one button per visible object instead (accessibilityTap).
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import { Image } from "expo-image";
import {
  BlurMask, Canvas, Circle, Group, Paint, Path, RadialGradient, Rect, RoundedRect, Skia, vec, type SkPath,
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
import { useTheme } from "@/theme/ThemeProvider";
import { aspectOf } from "@/render/geometry";
import type { SceneSource } from "@/render/SceneView";
import { V2 } from "./layout";
import { useOutlines } from "./useOutlines";
import { tapTrace, UvTrace, type StageTrace } from "./UvTrace";
import { Ambient, CarLight } from "./fx/Ambient";
import { Burst } from "./fx/Burst";
import type { BurstEvent } from "./fx/useCelebrate";

export interface StageObject {
  id: string;
  label: string;
  box: Box;
  /** The object's outline from its definition (photo fractions), when the room has one; else traced here. Its sparkles sit along it. */
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
  /** Show interactives (accessibility): every object's sparkles stay faintly lit, beam or not. */
  assist: boolean;
  /** A moment celebrated at something on this photo (fx/useCelebrate): drawn on it, the same size zoomed or not. */
  burst?: BurstEvent | null;
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
  uv = false, marks = [], traces = [], onTrace, onHover, onFrame, focus = null, beam, enter = 0, burst = null,
}: StageProps) {
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  // The sparkles' clock: one slow loop for every object (held still, below 0, with reduced motion or no glints).
  const clock = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion || !glints) {
      cancelAnimation(clock);
      clock.set(-1);
      return;
    }
    clock.set(0);
    clock.set(withRepeat(withTiming(1, { duration: SPARKLE.loopMs, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(clock);
  }, [reducedMotion, glints, clock]);
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
  // Each object's real outline (the room's own, or traced from the photo on the device): where its sparkles sit.
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
  // A tap points the light there; looking closer is the magnifier's (dragged onto something). Under UV, a
  // tap on a trace the light has found looks at it too (it isn't an object to drag the magnifier onto
  // only): one it hasn't found yet, the light is pointed at and finds.
  const tapped = (x: number, y: number) => {
    const t = tapTrace(traces, x, y, uv);
    if (t && "look" in t) onLook(t.look);
    else if (t) onTrace?.(t.find);
  };
  const tap = useTapGesture({
    maxDistance: 12,
    onActivate: (e) => {
      "worklet";
      const s = size.get();
      if (s.w <= 0) return;
      tx.set(withTiming(e.x / s.w, { duration: 160 }));
      ty.set(withTiming(e.y / s.h, { duration: 160 }));
      scheduleOnRN(tapped, e.x / s.w, e.y / s.h);
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
                {/* Crime scene: now and then a passing car's light slides across the room. */}
                {!reducedMotion && genre === "crime_scene" ? <CarLight w={W} h={H} /> : null}
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
              {/* The room's own life: dust in the beam, a moth (noir), a wisp (paranormal). */}
              {reducedMotion ? null : <Ambient genre={genre} tx={tx} ty={ty} w={W} h={H} r={R} uv={uv} />}
              {/* Glints: sparkles round each object, catching the beam. */}
              {glints ? (
                <Sparkles objects={objects} outlines={outlines} assist={assist} tx={tx} ty={ty} w={W} h={H} r={R} uv={uv} clock={clock} still={reducedMotion} />
              ) : null}
            </Canvas>
            {/* UV traces and invisible ink: seen where the UV beam falls (ink on objects also while a lamp is lit). */}
            <UvTrace traces={traces} marks={marks} genre={genre} w={W} h={H} tx={tx} ty={ty} r={R} uv={uv} lampLit={lamps.length > 0} onTrace={onTrace} onOpen={onLook} />
            {/* A find or a solved step, celebrated on the thing itself: pinned to it, never scaled by the zoom. */}
            {burst?.box ? (
              <Pinned
                key={burst.id}
                x={(burst.box.x + burst.box.w / 2) * W}
                // Kept clear of the view's top and bottom edges while the room isn't zoomed in on something.
                y={focus ? (burst.box.y + burst.box.h / 2) * H : Math.max(-frame.y + 84, Math.min(-frame.y + viewport.height - 48, (burst.box.y + burst.box.h / 2) * H))}
                zoom={zoom}
              >
                <Burst x={0} y={0} genre={genre} strength={burst.strength} word={burst.word} level={burst.level} count={burst.count} seed={burst.seed} />
              </Pinned>
            ) : null}
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

/** A point on the photo whose contents keep their size as the view zooms (scaled back by the zoom). */
function Pinned({ x, y, zoom, children }: { x: number; y: number; zoom: SharedValue<number>; children: ReactNode }) {
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 / Math.max(0.01, zoom.get()) }] }));
  return <Animated.View pointerEvents="none" style={[styles.pinned, { left: x, top: y }, style]}>{children}</Animated.View>;
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

/**
 * The glints' look: small four-point sparkles (✦) and soft round glints, scattered round each object's
 * edge (its outline's points when it has one, never drawn as a line; else an oval in its box) and a
 * glint or two on it, twinkling (each grows and fades on its own beat) and drifting a little. They are
 * lit by the beam alone: painted with the beam's own falloff, so they show only where it falls, hot at
 * its centre and gone at its edge.
 */
const SPARKLE = {
  /** The clock's loop (ms); every twinkle and drift beats a whole number of times in it, so it loops unseen. */
  loopMs: 12000,
  /** Twinkles per loop (2 to 3 s each) and drifts per loop. */
  twinkle: [4, 5, 6],
  drift: 1,
  /** About one sparkle per this much edge (points), and no fewer or more than these. */
  spacing: 62,
  min: 3,
  max: 12,
  /** Sparkle radii (points): most small, one larger per object. */
  small: [5.6, 8.4],
  large: 13,
  /** How far they wander (points). */
  wander: 2.2,
  /** An object already looked at still sparkles, this faintly. */
  seen: 0.5,
  /** Lit out to this share of the beam's radius. */
  reach: 1.02,
  /** Reduced motion: still, each at this share of its size, the lot a little fainter. */
  stillSize: 0.62,
  stillOpacity: 0.7,
  /** The sparkle's core and its glow: candle-warm white in the torch, violet under UV. */
  core: "255,249,236",
  glow: "255,214,160",
  coreUv: "240,232,255",
  glowUv: "168,128,255",
} as const;

/** One sparkle: where it sits (points), its size, its beat, its wander and whether it is a ✦ or a round glint. */
interface Seed { x: number; y: number; r: number; phase: number; beat: number; dx: number; dy: number; turn: boolean; dot: boolean }

/** A steady random number in [0, 1) from a string and an index: an object's sparkles sit in the same places every time. */
function rand(key: string, i: number): number {
  let h = 2166136261 ^ i;
  for (let c = 0; c < key.length; c++) h = Math.imul(h ^ key.charCodeAt(c), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Points evenly round a closed outline (points), each a share `at` (0..1) of the way round. */
function alongOutline(pts: { x: number; y: number }[], at: number[]): { x: number; y: number }[] {
  const len: number[] = [0];
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i - 1], b = pts[i % pts.length];
    len.push(len[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const total = len[pts.length] || 1;
  return at.map((t) => {
    const d = (((t % 1) + 1) % 1) * total;
    let i = 1;
    while (i < len.length - 1 && len[i] < d) i++;
    const a = pts[i - 1], b = pts[i % pts.length];
    const k = (d - len[i - 1]) / Math.max(1e-6, len[i] - len[i - 1]);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  });
}

/** An object's sparkles (points): round its edge, and a glint or two on it. */
export function sparkleSeeds(o: { id: string; box: Box }, outline: { x: number; y: number }[] | undefined, w: number, h: number): Seed[] {
  const bx = o.box.x * w, by = o.box.y * h, bw = o.box.w * w, bh = o.box.h * h;
  if (bw <= 0 || bh <= 0) return [];
  const cx = bx + bw / 2, cy = by + bh / 2;
  const edge = Math.PI * (bw + bh) * 0.5;
  const n = Math.max(SPARKLE.min, Math.min(SPARKLE.max, Math.round(edge / SPARKLE.spacing)));
  const R = (i: number) => rand(o.id, i);
  const start = R(0);
  const at = Array.from({ length: n }, (_, i) => start + (i + 0.5 * (R(10 + i) - 0.5)) / n);
  let ring: { x: number; y: number }[];
  if (outline && outline.length >= 3) {
    // On the object's real edge, nudged a little outward; kept near its box (a stray outline point never flies off).
    const pts = outline.map((p) => ({ x: p.x * w, y: p.y * h }));
    ring = alongOutline(pts, at).map((p, i) => {
      const d = Math.hypot(p.x - cx, p.y - cy) || 1;
      const push = 1 + 3 * R(30 + i);
      return {
        x: Math.min(bx + bw + 6, Math.max(bx - 6, p.x + ((p.x - cx) / d) * push)),
        y: Math.min(by + bh + 6, Math.max(by - 6, p.y + ((p.y - cy) / d) * push)),
      };
    });
  } else {
    // No outline: round an oval a little inside the box.
    const rx = bw * 0.44, ry = bh * 0.44;
    ring = at.map((t, i) => {
      const a = t * Math.PI * 2;
      const k = 0.9 + 0.2 * R(30 + i);
      return { x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k };
    });
  }
  const big = Math.floor(R(1) * n);
  const seeds: Seed[] = ring.map((p, i) => ({
    ...p,
    r: i === big ? SPARKLE.large : SPARKLE.small[0] + (SPARKLE.small[1] - SPARKLE.small[0]) * R(40 + i),
    phase: R(50 + i),
    beat: SPARKLE.twinkle[Math.floor(R(60 + i) * SPARKLE.twinkle.length)],
    dx: SPARKLE.wander * (R(70 + i) - 0.5) * 2,
    dy: SPARKLE.wander * (R(80 + i) - 0.5) * 2,
    turn: i !== big && R(90 + i) < 0.3,
    // A few are soft round glints rather than stars.
    dot: i !== big && R(100 + i) < 0.25,
  }));
  // A glint or two on the object itself (a big one gets two).
  const inner = bw * bh > 160 * 160 ? 2 : 1;
  for (let j = 0; j < inner; j++) {
    seeds.push({
      x: bx + bw * (0.25 + 0.5 * R(200 + j)), y: by + bh * (0.25 + 0.5 * R(210 + j)), r: 2.8 + 1.4 * R(220 + j), phase: R(230 + j),
      beat: SPARKLE.twinkle[j % SPARKLE.twinkle.length], dx: SPARKLE.wander * (R(240 + j) - 0.5), dy: SPARKLE.wander * (R(250 + j) - 0.5), turn: false, dot: true,
    });
  }
  return seeds;
}

/** The sparkles at a moment of the clock (below 0: still): their stars, or the soft glows behind them. */
function sparklePath(seeds: readonly Seed[], t: number, part: "stars" | "glows"): SkPath {
  "worklet";
  const b = Skia.PathBuilder.Make();
  const TAU = Math.PI * 2;
  for (const s of seeds) {
    let size = SPARKLE.stillSize;
    let x = s.x, y = s.y;
    if (t >= 0) {
      // Grows and fades on its own beat, mostly small, flaring now and then.
      const wave = 0.5 + 0.5 * Math.sin(TAU * (t * s.beat + s.phase));
      size = 0.32 + 0.68 * wave * wave;
      x += s.dx * Math.sin(TAU * (t * SPARKLE.drift + s.phase));
      y += s.dy * Math.cos(TAU * (t * SPARKLE.drift + s.phase * 0.7));
    }
    const r = s.r * size;
    if (r < 0.35) continue;
    if (part === "glows") {
      b.addCircle(x, y, r * (s.dot ? 1.8 : 0.62));
      continue;
    }
    if (s.dot) {
      b.addCircle(x, y, r * 0.5);
      continue;
    }
    // A ✦: four points joined by curves pulled in to its middle (turned 45°, a smaller cross).
    const k = r * 0.14;
    const a = s.turn ? Math.PI / 4 : 0;
    const c = Math.cos(a), sn = Math.sin(a);
    const P = (px: number, py: number) => [x + px * c - py * sn, y + px * sn + py * c] as const;
    const tip = [P(0, -r), P(r, 0), P(0, r), P(-r, 0)];
    const mid = [P(k, -k), P(k, k), P(-k, k), P(-k, -k)];
    b.moveTo(tip[0][0], tip[0][1]);
    for (let i = 0; i < 4; i++) {
      const next = tip[(i + 1) % 4];
      b.quadTo(mid[i][0], mid[i][1], next[0], next[1]);
    }
    b.close();
  }
  return b.build();
}

function Sparkles({ objects, outlines, assist, tx, ty, w, h, r, uv, clock, still }: {
  objects: readonly StageObject[];
  outlines: Record<string, { x: number; y: number }[]>;
  /** Show interactives: every object's sparkles stay faintly lit, beam or not. */
  assist: boolean;
  tx: SharedValue<number>; ty: SharedValue<number>; w: number; h: number; r: number; uv: boolean;
  /** The clock (0..1, round and round; below 0: still). */
  clock: SharedValue<number>;
  still: boolean;
}) {
  // Fresh objects sparkle in full; ones already looked at, faintly.
  const signature = objects.map((o) => `${o.id}:${o.seen ? 1 : 0}:${o.box.x},${o.box.y},${o.box.w},${o.box.h}:${outlines[o.id]?.length ?? 0}`).join("|");
  const { fresh, seen } = useMemo(() => {
    const out = { fresh: [] as Seed[], seen: [] as Seed[] };
    if (w <= 0 || h <= 0) return out;
    for (const o of objects) out[o.seen ? "seen" : "fresh"].push(...sparkleSeeds(o, outlines[o.id], w, h));
    return out;
    // The signature holds every object's id, box, seen and outline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, w, h]);
  const freshStars = useDerivedValue(() => sparklePath(fresh, clock.get(), "stars"));
  const freshGlows = useDerivedValue(() => sparklePath(fresh, clock.get(), "glows"));
  const seenStars = useDerivedValue(() => sparklePath(seen, clock.get(), "stars"));
  const seenGlows = useDerivedValue(() => sparklePath(seen, clock.get(), "glows"));
  const c = useDerivedValue(() => vec(tx.get() * w, ty.get() * h));
  const reach = r * SPARKLE.reach;
  const core = uv ? SPARKLE.coreUv : SPARKLE.core;
  const glow = uv ? SPARKLE.glowUv : SPARKLE.glow;
  const fade = still ? SPARKLE.stillOpacity : 1;
  const coreColors = [rgba(core, 1), rgba(core, 0.95), rgba(core, 0.55), rgba(core, 0)];
  const glowColors = [rgba(glow, 0.95), rgba(glow, 0.85), rgba(glow, 0.4), rgba(glow, 0)];
  const stops = [0, 0.45, 0.78, 1];
  const layer = (stars: SharedValue<SkPath>, glows: SharedValue<SkPath>, opacity: number) => (
    <Group opacity={opacity * fade}>
      <Path path={glows} antiAlias>
        <RadialGradient c={c} r={reach} colors={glowColors} positions={stops} />
        <BlurMask blur={5} style="normal" />
      </Path>
      <Path path={stars} antiAlias>
        <RadialGradient c={c} r={reach} colors={coreColors} positions={stops} />
      </Path>
      {assist ? (
        // Show interactives: faintly there in the dark too.
        <Group opacity={V2.glint.assist}>
          <Path path={glows} color={rgba(glow, 0.7)} antiAlias>
            <BlurMask blur={2.6} style="normal" />
          </Path>
          <Path path={stars} color={rgba(core, 1)} antiAlias />
        </Group>
      ) : null}
    </Group>
  );
  return (
    <Group>
      {layer(seenStars, seenGlows, SPARKLE.seen)}
      {layer(freshStars, freshGlows, 1)}
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
  pinned: { position: "absolute", width: 0, height: 0, overflow: "visible" },
  probe: { ...StyleSheet.absoluteFill, opacity: 0 },
});
