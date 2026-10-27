// One photo of the room, in the dark (gameplay v2 §2 "Discover"). The room
// sits in shadow; the player's finger sweeps a torch beam, and objects worth a
// look catch the light: a soft outline glints as the beam passes (or never, in
// the hard "no glints" setting). A tap looks at what is under the finger. A
// lit lamp throws its own pool of light; a UV mark glows; an opened panel and a
// pinned card show where the room changed. A fast horizontal fling turns to the
// next view.
//
// Touch is one pan (the beam) racing one tap (look); both are hit-tested here.
// Screen readers get one button per visible object instead (accessibilityTap).
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import {
  BlurMask, Canvas, Circle, Group, Paint, RadialGradient, Rect, RoundedRect, vec,
} from "@shopify/react-native-skia";
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from "react-native-gesture-handler";
import { useDerivedValue, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { Overlay, Rect as Box } from "@/engine/v2";
import type { Genre } from "@/lib/puzzle-types";
import { TreatedImage } from "@/components/noir";
import { useModeTheme } from "@/game/mode";
import { aspectOf, containBox } from "@/render/geometry";
import type { SceneSource } from "@/render/SceneView";
import { V2 } from "./layout";

export interface StageObject {
  id: string;
  label: string;
  box: Box;
  seen: boolean;
}

export interface StageProps {
  source: SceneSource;
  cacheKey?: string;
  genre: Genre;
  objects: StageObject[];
  overlays: { object: string; overlay: Overlay; box: Box }[];
  /** False: the hard setting, no glints at all. */
  glints: boolean;
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

export function Stage({ source, cacheKey, genre, objects, overlays, glints, assist, onLook, onPage, accessibilityLabel }: StageProps) {
  const theme = useModeTheme();
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [aspect, setAspect] = useState<number | null>(null);
  const frame = useMemo(() => (aspect ? containBox(viewport, aspect) : null), [viewport, aspect]);
  const W = frame?.width ?? 0;
  const H = frame?.height ?? 0;

  const tx = useSharedValue<number>(V2.torch.rest.x);
  const ty = useSharedValue<number>(V2.torch.rest.y);
  const size = useSharedValue({ w: 0, h: 0 });
  useEffect(() => size.set({ w: W, h: H }), [size, W, H]);

  const look = (x: number, y: number) => onLook(hitTest(objects, x, y));
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
      tx.set(Math.min(1, Math.max(0, e.x / s.w)));
      ty.set(Math.min(1, Math.max(0, e.y / s.h)));
    },
    onDeactivate: (e) => {
      "worklet";
      if (Math.abs(e.translationX) > V2.page.flingDistance && Math.abs(e.velocityX) > V2.page.flingVelocity
        && Math.abs(e.translationX) > 2 * Math.abs(e.translationY)) {
        scheduleOnRN(onPage, e.translationX < 0 ? 1 : -1);
      }
    },
  });
  const tap = useTapGesture({
    maxDistance: 12,
    onActivate: (e) => {
      "worklet";
      const s = size.get();
      if (s.w <= 0) return;
      scheduleOnRN(look, e.x / s.w, e.y / s.h);
    },
  });
  const gesture = useCompetingGestures(pan, tap);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setViewport({ width, height });
  };

  const darkness = V2.torch.darkness[genre];
  const R = V2.torch.radius * W;
  const lamps = overlays.filter((o) => o.overlay === "light_on");

  return (
    <View style={styles.root} onLayout={onLayout} testID="v2-stage">
      {frame ? (
        <GestureDetector gesture={gesture}>
          <View style={[styles.frame, { left: frame.x, top: frame.y, width: W, height: H }]} collapsable={false}>
            <TreatedImage
              source={source}
              genre={genre}
              cacheKey={cacheKey}
              style={StyleSheet.absoluteFill}
              contentFit="fill"
              accessible
              accessibilityRole="image"
              accessibilityLabel={accessibilityLabel}
              onLoad={(e) => setAspect((a) => a ?? aspectOf(e.source.width, e.source.height))}
            />
            <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
              {/* Marks the room has gained, drawn on the photo under the dark. */}
              {overlays.map((o) => (
                <OverlayMark key={`${o.object}-${o.overlay}`} kind={o.overlay} box={o.box} w={W} h={H} ink={theme.ink} glow={theme.glow ?? theme.stamp} />
              ))}
              {/* The dark, with the beam and every lit lamp punched out of it. */}
              <Group layer={<Paint />}>
                <Rect x={0} y={0} width={W} height={H} color={`rgba(0,0,0,${darkness})`} />
                <Beam tx={tx} ty={ty} w={W} h={H} r={R} />
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
              {/* Glints: an outline that catches the beam. */}
              {glints || assist
                ? objects.map((o) => (
                    <Glint key={o.id} box={o.box} seen={o.seen} tx={tx} ty={ty} w={W} h={H} r={R} assist={assist} beam={glints} color={theme.ink} />
                  ))
                : null}
            </Canvas>
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
      ) : (
        // Measure the photo first: the frame is laid out once its aspect is known.
        <TreatedImage
          source={source}
          genre={genre}
          cacheKey={cacheKey}
          style={styles.probe}
          contentFit="contain"
          accessible={false}
          onLoad={(e) => setAspect(aspectOf(e.source.width, e.source.height) ?? 0.75)}
        />
      )}
    </View>
  );
}

function Beam({ tx, ty, w, h, r }: { tx: SharedValue<number>; ty: SharedValue<number>; w: number; h: number; r: number }) {
  const c = useDerivedValue(() => vec(tx.get() * w, ty.get() * h));
  const cx = useDerivedValue(() => tx.get() * w);
  const cy = useDerivedValue(() => ty.get() * h);
  return (
    <Circle cx={cx} cy={cy} r={r} blendMode="dstOut">
      <RadialGradient c={c} r={r} colors={["rgba(0,0,0,1)", "rgba(0,0,0,0.92)", "rgba(0,0,0,0)"]} positions={[0, 0.5, 1]} />
    </Circle>
  );
}

function Glint({ box, seen, tx, ty, w, h, r, assist, beam, color }: {
  box: Box; seen: boolean; tx: SharedValue<number>; ty: SharedValue<number>; w: number; h: number; r: number;
  assist: boolean; beam: boolean; color: string;
}) {
  const x = box.x * w, y = box.y * h, bw = box.w * w, bh = box.h * h;
  const cx = x + bw / 2, cy = y + bh / 2;
  const reach = r + Math.max(bw, bh) / 2;
  const opacity = useDerivedValue(() => {
    const d = Math.hypot(tx.get() * w - cx, ty.get() * h - cy);
    const lit = beam ? Math.max(0, 1 - d / reach) : 0;
    const strength = (seen ? V2.glint.seen : 1) * lit * lit;
    return Math.max(assist ? V2.glint.assist : 0, strength);
  });
  return (
    <RoundedRect x={x} y={y} width={bw} height={bh} r={V2.glint.radius} color={color} style="stroke" strokeWidth={V2.glint.stroke} opacity={opacity}>
      <BlurMask blur={V2.glint.blur} style="solid" />
    </RoundedRect>
  );
}

function OverlayMark({ kind, box, w, h, ink, glow }: { kind: Overlay; box: Box; w: number; h: number; ink: string; glow: string }) {
  const x = box.x * w, y = box.y * h, bw = box.w * w, bh = box.h * h;
  switch (kind) {
    case "glow_mark":
      return (
        <RoundedRect x={x + bw * 0.25} y={y + bh * 0.3} width={bw * 0.5} height={bh * 0.4} r={8} color="rgba(170,120,255,0.75)">
          <BlurMask blur={10} style="normal" />
        </RoundedRect>
      );
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

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  frame: { position: "absolute", overflow: "hidden" },
  a11y: { position: "absolute" },
  probe: { ...StyleSheet.absoluteFill, opacity: 0 },
});
