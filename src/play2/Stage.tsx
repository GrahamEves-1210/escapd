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
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Image } from "expo-image";
import {
  BlurMask, Canvas, Circle, Group, Oval, Paint, Path, RadialGradient, Rect, RoundedRect, vec,
} from "@shopify/react-native-skia";
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { Overlay, Rect as Box } from "@/engine/v2";
import type { Genre } from "@/lib/puzzle-types";
import { TreatedImage } from "@/components/noir";
import { useModeTheme } from "@/game/mode";
import { aspectOf, containBox } from "@/render/geometry";
import type { SceneSource } from "@/render/SceneView";
import { measureInWindow } from "@/render/PickupFlight";
import { V2 } from "./layout";
import { useOutlines } from "./useOutlines";

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
  /** A taken object's fill (its rect in photo fractions), drawn over the photo under the dark. */
  patch?: { rect: Box; uri: string } | null;
  /** False: the hard setting, no glints at all. */
  glints: boolean;
  /** The UV flashlight is on: a violet beam, and invisible ink shows where it falls. */
  uv?: boolean;
  /** Writing revealed on objects (glow marks): shown under the UV beam, or always while a lamp is lit. */
  marks?: { object: string; box: Box; text: string }[];
  /** The object under the beam's centre as it moves (UV checks it after a moment). */
  onHover?: (objectId: string | null) => void;
  /** Where the beam points (photo fractions), owned by the parent so others can follow it. */
  beam?: { x: SharedValue<number>; y: SharedValue<number> };
  /** An object being looked at closely: the light swings onto it. */
  focus?: Box | null;
  /** The photo's frame in window points, once laid out (drops from the tray are hit-tested against it). */
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
  uv = false, marks = [], onHover, onFrame, focus = null, beam,
}: StageProps) {
  const theme = useModeTheme();
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [aspect, setAspect] = useState<number | null>(null);
  const frame = useMemo(() => (aspect ? containBox(viewport, aspect) : null), [viewport, aspect]);
  const W = frame?.width ?? 0;
  const H = frame?.height ?? 0;

  // The beam, in photo fractions: the parent's when given (the cat's eyes follow it).
  const ownX = useSharedValue<number>(V2.torch.rest.x);
  const ownY = useSharedValue<number>(V2.torch.rest.y);
  const tx = beam?.x ?? ownX;
  // Each object's real outline, traced from the photo on the device.
  const outlines = useOutlines(source, cacheKey, objects);
  const ty = beam?.y ?? ownY;
  const size = useSharedValue({ w: 0, h: 0 });
  useEffect(() => size.set({ w: W, h: H }), [size, W, H]);

  // What the beam's centre is on, worked out on the UI thread; JS hears only when it changes.
  const boxes = objects.map((o) => [o.box.x, o.box.y, o.box.w, o.box.h, o.box.w * o.box.h] as const);
  const ids = objects.map((o) => o.id);
  const hovered = useSharedValue(-1);
  const hover = (i: number) => onHover?.(i >= 0 ? ids[i] ?? null : null);
  const frameRef = useRef<ComponentRef<typeof View>>(null);
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
  // The close-up's object: the light swings onto it while its sheet is up.
  useEffect(() => {
    if (!focus) return;
    tx.set(withTiming(focus.x + focus.w / 2, { duration: 380 }));
    ty.set(withTiming(focus.y + focus.h / 2, { duration: 380 }));
  }, [focus, tx, ty]);
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
          <View
            ref={frameRef}
            style={[styles.frame, { left: frame.x, top: frame.y, width: W, height: H }]}
            collapsable={false}
            onLayout={() => measureInWindow(frameRef.current).then((rect) => rect && onFrame?.(rect))}
          >
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
                <Rect x={0} y={0} width={W} height={H} color={`rgba(0,0,0,${uv ? Math.min(0.92, darkness + 0.06) : darkness})`} />
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
              {/* The UV flashlight: its beam glows violet. */}
              {uv ? <Beam tx={tx} ty={ty} w={W} h={H} r={R} tint="rgba(150,95,255,0.30)" /> : null}
              {/* Glints: an outline that catches the beam. */}
              {glints
                ? objects.map((o) => (
                    <Glint key={o.id} box={o.box} seen={o.seen} tx={tx} ty={ty} w={W} h={H} r={R} color={theme.ink} outline={outlines[o.id]} />
                  ))
                : null}
            </Canvas>
            {/* Invisible ink: drawn on the object, seen where the UV beam falls (or everywhere while a lamp is lit). */}
            {marks.map((m) => (
              <InkMark key={m.object} mark={m} w={W} h={H} tx={tx} ty={ty} r={R} always={lamps.length > 0} uv={uv} />
            ))}
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
          genre={null}
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

function Beam({ tx, ty, w, h, r, tint }: { tx: SharedValue<number>; ty: SharedValue<number>; w: number; h: number; r: number; tint?: string }) {
  const c = useDerivedValue(() => vec(tx.get() * w, ty.get() * h));
  const cx = useDerivedValue(() => tx.get() * w);
  const cy = useDerivedValue(() => ty.get() * h);
  if (tint) {
    // A coloured pool over the lit area (the UV flashlight).
    return (
      <Circle cx={cx} cy={cy} r={r}>
        <RadialGradient c={c} r={r} colors={[tint, tint, "rgba(0,0,0,0)"]} positions={[0, 0.55, 1]} />
      </Circle>
    );
  }
  return (
    <Circle cx={cx} cy={cy} r={r} blendMode="dstOut">
      <RadialGradient c={c} r={r} colors={["rgba(0,0,0,1)", "rgba(0,0,0,0.92)", "rgba(0,0,0,0)"]} positions={[0, 0.5, 1]} />
    </Circle>
  );
}

/**
 * Writing in invisible ink on an object: a digit, a word, a door symbol and its
 * number, in glowing violet, as someone wrote it there. Seen only where the UV
 * beam falls (fading at its edge), or plainly while a lamp is lit.
 */
function InkMark({ mark, w, h, tx, ty, r, always, uv }: {
  mark: { box: Box; text: string }; w: number; h: number; tx: SharedValue<number>; ty: SharedValue<number>; r: number; always: boolean; uv: boolean;
}) {
  const { box } = mark;
  const cx = (box.x + box.w / 2) * w;
  const cy = (box.y + box.h / 2) * h;
  const size = Math.max(16, Math.min(44, Math.min(box.w * w, box.h * h) * 0.45));
  const style = useAnimatedStyle(() => {
    if (always) return { opacity: 1 };
    if (!uv) return { opacity: 0 };
    const d = Math.hypot(tx.get() * w - cx, ty.get() * h - cy);
    return { opacity: Math.max(0, Math.min(1, 1.6 * (1 - d / r))) };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.ink, { left: box.x * w, top: box.y * h, width: box.w * w, height: box.h * h }, style]}>
      <Text style={[styles.inkText, { fontSize: size, lineHeight: size * 1.15 }]} accessibilityLabel={`Written in invisible ink: ${mark.text}`}>
        {mark.text}
      </Text>
    </Animated.View>
  );
}

function Glint({ box, seen, tx, ty, w, h, r, color, outline }: {
  box: Box; seen: boolean; tx: SharedValue<number>; ty: SharedValue<number>; w: number; h: number; r: number; color: string;
  /** The object's traced outline (photo fractions): the glow runs along its real edge. */
  outline?: { x: number; y: number }[];
}) {
  const inset = V2.glint.inset;
  const x = (box.x + box.w * inset) * w, y = (box.y + box.h * inset) * h;
  const bw = box.w * (1 - 2 * inset) * w, bh = box.h * (1 - 2 * inset) * h;
  const cx = x + bw / 2, cy = y + bh / 2;
  // Only where the beam is: nothing glints in the dark.
  const opacity = useDerivedValue(() => {
    const d = Math.hypot(tx.get() * w - cx, ty.get() * h - cy);
    const lit = Math.max(0, 1 - d / (r * 0.9));
    return (seen ? V2.glint.seen : 1) * V2.glint.peak * lit * lit;
  });
  if (outline && outline.length > 3) {
    const d = outline.map((p, i) => `${i ? "L" : "M"} ${(p.x * w).toFixed(1)} ${(p.y * h).toFixed(1)}`).join(" ") + " Z";
    return (
      <Group opacity={opacity}>
        {/* A wide soft halo, then a fine bright line on the edge itself. */}
        <Path path={d} color={color} style="stroke" strokeWidth={5} strokeJoin="round" opacity={0.5}>
          <BlurMask blur={8} style="normal" />
        </Path>
        <Path path={d} color={color} style="stroke" strokeWidth={1.4} strokeJoin="round" />
      </Group>
    );
  }
  return (
    <Oval x={x} y={y} width={bw} height={bh} color={color} style="stroke" strokeWidth={V2.glint.stroke} opacity={opacity}>
      <BlurMask blur={V2.glint.blur} style="solid" />
    </Oval>
  );
}

function OverlayMark({ kind, box, w, h, ink, glow }: { kind: Overlay; box: Box; w: number; h: number; ink: string; glow: string }) {
  const x = box.x * w, y = box.y * h, bw = box.w * w, bh = box.h * h;
  switch (kind) {
    case "glow_mark":
      // The writing itself is drawn by InkMark, under the beam.
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

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  frame: { position: "absolute", overflow: "hidden" },
  a11y: { position: "absolute" },
  ink: { position: "absolute", alignItems: "center", justifyContent: "center" },
  inkText: {
    color: "rgb(205,170,255)", fontWeight: "700", textAlign: "center", transform: [{ rotate: "-6deg" }],
    textShadowColor: "rgba(150,95,255,0.95)", textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 },
  },
  probe: { ...StyleSheet.absoluteFill, opacity: 0 },
});
