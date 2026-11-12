// Traces on the photo that only ultraviolet shows (gameplay v2: UV evidence),
// drawn as what they are (traceArt.ts): fingertips with their ridge pattern, a
// palm pressed flat, what was spilt, a stride of shoe prints with their tread,
// and writing. They show only where the UV beam falls (the beam is the mask)
// and never in the ordinary light. Nothing explains them: the player looks.
//
// Writing is its words, lettered crisp in the hand they were written in: solid
// violet-white letters with a dark edge (so they read on a bright wall and a
// dark one) and one thin soft halo behind, never a blur over the letterforms.
// It is native text at the photo's own scale, in a font loaded before the app
// draws. The words show the moment the beam's bright middle touches them, and
// there is nothing there until the words are known (those that hold an answer
// arrive when the light first finds them): no smear standing in for them.
//
// Also here: writing revealed on objects (glow marks), seen under the UV beam
// or plainly while a lamp is lit.
//
// The trace the UV beam is on is reported (`onTrace`) while the UV light is on,
// worked out on the UI thread: the beam's bright middle on any part of its box.
// `traceAt` is the tap's and the magnifier's hit-test.
import { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";
import { BlurMask, Canvas, Group, Paint, Path, RadialGradient, Rect, vec } from "@shopify/react-native-skia";
import Animated, { useAnimatedReaction, useAnimatedStyle, useDerivedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { Rect as Box, TraceHand, TraceKind, TraceSpec } from "@/engine/v2";
import type { Genre } from "@/lib/puzzle-types";
import { handStyle, lettering, lookOf, traceArt, type Art } from "./traceArt";

export interface StageTrace extends Partial<Pick<TraceSpec, "size" | "tread" | "pattern" | "scar" | "stain" | "hand">> {
  id: string;
  label: string;
  kind: TraceKind;
  surface: TraceSpec["surface"];
  seed: number;
  box: Box;
  /** The UV light has found it (the engine said so). */
  revealed: boolean;
  /** Writing: its words, once the app has them (in the definition, or brought by the light finding it). */
  mark?: string;
}

export interface UvTraceProps {
  traces: StageTrace[];
  /** Writing revealed on objects (glow marks). */
  marks: { object: string; box: Box; text: string }[];
  genre: Genre;
  w: number;
  h: number;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  /** The beam's radius (points). */
  r: number;
  uv: boolean;
  /** A lamp is lit: glow marks show plainly. */
  lampLit: boolean;
  onTrace?: (id: string | null) => void;
  /** Screen readers: a trace to look at is a button. */
  onOpen?: (id: string) => void;
}

export const UV = {
  /** The beam's mask: full in its middle, gone at its edge. */
  mask: ["rgba(0,0,0,1)", "rgba(0,0,0,0.9)", "rgba(0,0,0,0)"],
  stops: [0, 0.5, 1],
  /** The beam's bright middle, as a share of its radius: on a trace when it reaches any part of its box. */
  reach: 0.5,
  /** Lettering: solid violet-white, a deep violet edge under it, one thin halo. */
  ink: "#F4EEFF",
  edge: "#1F0B45",
  halo: "rgba(168,128,255,0.9)",
} as const;

/** There is something of it to see under the beam: shapes always; writing once its words are known. */
export const canSee = (t: Pick<StageTrace, "kind" | "mark">) => t.kind !== "writing" || !!t.mark;

/**
 * The trace under a point (photo fractions), the smallest box first, with `slack` round each box: only
 * those there is something to see of, unless `any`.
 */
export function traceAt<T extends Pick<StageTrace, "box" | "kind" | "mark">>(traces: readonly T[], x: number, y: number, slack = 0.04, any = false): T | null {
  let best: T | null = null;
  for (const t of traces) {
    const b = t.box;
    if (!any && !canSee(t)) continue;
    if (x < b.x - slack || x > b.x + b.w + slack || y < b.y - slack || y > b.y + b.h + slack) continue;
    if (!best || b.w * b.h < best.box.w * best.box.h) best = t;
  }
  return best;
}

/**
 * A tap on the photo with the UV light on, at a point (photo fractions): on a trace that can be seen,
 * look at it closely; on writing whose words haven't come yet, find it (the light is pointed there).
 * Null: not on a trace, or no UV.
 */
export function tapTrace(traces: readonly StageTrace[], x: number, y: number, uv: boolean): { look: string } | { find: string } | null {
  if (!uv) return null;
  const t = traceAt(traces, x, y, 0.04, true);
  if (!t) return null;
  return canSee(t) ? { look: t.id } : { find: t.id };
}

export function UvTrace({ traces, marks, genre, w, h, tx, ty, r, uv, lampLit, onTrace, onOpen }: UvTraceProps) {
  // (The parent builds `traces` afresh each render: the drawing is kept by what it's drawn from.)
  const shape = traces.map((t) => `${t.id}:${t.kind}:${t.surface}:${t.seed}:${t.box.x},${t.box.y},${t.box.w},${t.box.h}:${t.size}${t.tread}${t.pattern}${t.scar}${t.stain}`).join("|");
  const drawn = useMemo(
    () => traces.filter((t) => t.kind !== "writing").map((t) => ({ id: t.id, art: traceArt(t, { x: t.box.x * w, y: t.box.y * h, w: t.box.w * w, h: t.box.h * h }, genre) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `shape` is what `traces` draws from.
    [shape, w, h, genre],
  );
  const beam = useDerivedValue(() => vec(tx.get() * w, ty.get() * h));

  // Which trace the UV beam's bright middle is on: heard only when it changes.
  const boxes = traces.map((t) => [t.box.x, t.box.y, t.box.w, t.box.h] as const);
  const ids = traces.map((t) => t.id);
  const sx = w > 0 ? (UV.reach * r) / w : 0;
  const sy = h > 0 ? (UV.reach * r) / h : 0;
  const report = (i: number) => onTrace?.(i >= 0 ? ids[i] ?? null : null);
  useAnimatedReaction(
    () => {
      if (!uv) return -1;
      const x = tx.get(), y = ty.get();
      let hit = -1;
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i];
        if (x >= b[0] - sx && x <= b[0] + b[2] + sx && y >= b[1] - sy && y <= b[1] + b[3] + sy && (hit < 0 || b[2] * b[3] < boxes[hit][2] * boxes[hit][3])) hit = i;
      }
      return hit;
    },
    (cur, prev) => {
      if (cur !== prev) scheduleOnRN(report, cur);
    },
    [uv, boxes, ids, sx, sy],
  );

  if (w <= 0 || h <= 0) return null;
  return (
    <>
      {drawn.length && uv ? (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" testID="v2-uv-traces">
          {/* Under UV: every trace, seen only through the beam. */}
          <Group layer={<Paint />}>
            {drawn.map((d) => <TraceShape key={d.id} art={d.art} />)}
            <Rect x={0} y={0} width={w} height={h} blendMode="dstIn">
              <RadialGradient c={beam} r={r} colors={[...UV.mask]} positions={[...UV.stops]} />
            </Rect>
          </Group>
        </Canvas>
      ) : null}
      {traces.filter((t) => t.kind === "writing" && t.mark).map((t) => (
        <Writing key={t.id} id={t.id} box={t.box} text={t.mark!} hand={lookOf(t, genre).hand} surface={t.surface} seed={t.seed} w={w} h={h} tx={tx} ty={ty} r={r} uv={uv} />
      ))}
      {marks.map((m) => (
        <Mark key={m.object} box={m.box} text={m.text} w={w} h={h} tx={tx} ty={ty} r={r} uv={uv} always={lampLit} />
      ))}
      {onOpen
        ? traces.filter((t) => uv && canSee(t)).map((t) => (
          <View
            key={t.id}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t.label}
            onAccessibilityTap={() => onOpen(t.id)}
            testID={`v2-trace-${t.id}`}
            style={[styles.a11y, { left: t.box.x * w, top: t.box.y * h, width: t.box.w * w, height: t.box.h * h }]}
          />
        ))
        : null}
    </>
  );
}

/**
 * One trace: a soft blot that bleeds into the surface, its glowing body, and its lines drawn crisp over a
 * thin soft copy of themselves (the halo is its own blurred copy underneath: nothing sharp is drawn
 * through a blur). `scale`: a close-up's lines and halo are that much heavier.
 */
export function TraceShape({ art, scale = 1 }: { art: Art; scale?: number }) {
  const { blot, fill, lines, line, cut, cutWidth, tint } = art;
  const body = (
    <>
      {blot ? (
        <Path path={blot} color={tint.blot} style="fill">
          <BlurMask blur={4 * scale} style="normal" />
        </Path>
      ) : null}
      {fill ? <Path path={fill} color={tint.fill} style="fill" /> : null}
      {lines ? (
        <>
          <Path path={lines} color={tint.halo} style="stroke" strokeWidth={line * 2.4} strokeJoin="round" strokeCap="round">
            <BlurMask blur={1.6 * scale} style="normal" />
          </Path>
          <Path path={lines} color={tint.core} style="stroke" strokeWidth={line} strokeJoin="round" strokeCap="round" />
        </>
      ) : null}
    </>
  );
  // A scar: cut clean through everything of this trace.
  return cut ? (
    <Group layer={<Paint />}>
      {body}
      <Path path={cut} color="#000000" style="stroke" strokeWidth={cutWidth ?? 2} strokeCap="butt" blendMode="dstOut" />
    </Group>
  ) : <Group>{body}</Group>;
}

/** The surface's lie and the hand's slant: a wall or an object takes it as written, a floor lays it back. */
type Transforms = Exclude<NonNullable<ViewStyle["transform"]>, string>;
function lie(surface: TraceSpec["surface"], seed: number, skew: string): Transforms {
  const tilt = -3 + (seed % 5);   // -3..1 degrees: nobody writes on a wall dead level
  const slant = skew === "0deg" ? [] : [{ skewX: skew }];
  return surface === "floor" ? [{ perspective: 320 }, { rotateX: "40deg" }, { rotate: `${tilt}deg` }, ...slant] : [{ rotate: `${tilt}deg` }, ...slant];
}

/** Offsets (points) of the dark copies that edge the letters. */
const EDGE: readonly (readonly [number, number])[] = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1.4], [0, -1.4], [1.4, 0], [-1.4, 0]];

/**
 * Words lettered solid and sharp: a thin soft halo (its own copy, underneath), dark copies a point out on
 * every side (an edge that keeps the letters readable on a bright surface), and the letters themselves.
 */
export function Lettering({ text, hand, size, lineHeight, lines, label, k = 1 }: {
  text: string; hand: TraceHand; size: number; lineHeight: number; lines: number; label?: string;
  /** Drawn this many times its size (by `Oversized`, which shows it back at its own): the edge and halo keep their weight. */
  k?: number;
}) {
  const style = handStyle(hand);
  const words = style.upper ? text.toUpperCase() : text;
  const type: TextStyle = { ...style.text, letterSpacing: style.text.letterSpacing === undefined ? undefined : style.text.letterSpacing * k, fontSize: size * k, lineHeight: lineHeight * k, textAlign: "center" };
  return (
    <View>
      <Text style={[type, styles.halo, { textShadowRadius: 5 * k }]} numberOfLines={lines} accessibilityLabel={label}>{words}</Text>
      {EDGE.map(([dx, dy], i) => (
        <Text key={i} style={[type, styles.over, styles.edge, { transform: [{ translateX: dx * k }, { translateY: dy * k }] }]} numberOfLines={lines} accessible={false}>{words}</Text>
      ))}
      <Text style={[type, styles.over, styles.letters]} numberOfLines={lines} accessible={false} testID="v2-uv-letters">{words}</Text>
    </View>
  );
}

/** How many times its size lettering on the photo is drawn (see `Oversized`). */
const OVER = 2;

/**
 * Lettering on the photo is drawn at twice its size and shown at half: the room's photo is pushed in on
 * when something is looked at closely, and a phone scales text it has already drawn (soft, at more than
 * its size). Drawn double, it stays sharp through the push-in.
 */
function Oversized({ width, transform, children }: { width: number; transform: Transforms; children: ReactNode }) {
  return <View style={{ width: width * OVER, transform: [...transform, { scale: 1 / OVER }] }}>{children}</View>;
}

/**
 * A writing trace's words on the photo, where the UV beam falls: whole and solid while the beam's bright
 * middle is on any part of them, gone past its edge.
 */
function Writing({ id, box, text, hand, surface, seed, w, h, tx, ty, r, uv }: {
  id: string; box: Box; text: string; hand: TraceHand; surface: TraceSpec["surface"]; seed: number; w: number; h: number;
  tx: SharedValue<number>; ty: SharedValue<number>; r: number; uv: boolean;
}) {
  const at = lettering(text, hand, { x: box.x * w, y: box.y * h, w: box.w * w, h: box.h * h }, { w, h });
  const { left, top, width, height } = at;
  const style = useAnimatedStyle(() => {
    if (!uv) return { opacity: 0 };
    // How far the beam's centre is from the nearest of the words.
    const bx = tx.get() * w, by = ty.get() * h;
    const dx = Math.max(left - bx, 0, bx - (left + width)), dy = Math.max(top - by, 0, by - (top + height));
    const d = Math.hypot(dx, dy);
    return { opacity: Math.max(0, Math.min(1, (0.92 * r - d) / (0.32 * r))) };
  });
  return (
    <Animated.View pointerEvents="none" testID={`v2-uv-writing-${id}`} style={[styles.ink, { left, top, width, height }, style]}>
      <Oversized width={width - 8} transform={lie(surface, seed, handStyle(hand).skew)}>
        <Lettering text={text} hand={hand} size={at.size} lineHeight={at.lineHeight} lines={at.lines} label={`Written in invisible ink: ${text}`} k={OVER} />
      </Oversized>
    </Animated.View>
  );
}

/** A glow mark on an object: big, as someone wrote it there; under the UV beam, or plainly while a lamp is lit. */
function Mark({ box, text, w, h, tx, ty, r, uv, always }: {
  box: Box; text: string; w: number; h: number; tx: SharedValue<number>; ty: SharedValue<number>; r: number; uv: boolean; always: boolean;
}) {
  const cx = (box.x + box.w / 2) * w, cy = (box.y + box.h / 2) * h;
  const size = Math.round(Math.max(21, Math.min(40, Math.min(box.w * w, box.h * h) * 0.42)));
  const style = useAnimatedStyle(() => {
    if (always) return { opacity: 1 };
    if (!uv) return { opacity: 0 };
    const d = Math.hypot(tx.get() * w - cx, ty.get() * h - cy);
    return { opacity: Math.max(0, Math.min(1, (0.95 * r - d) / (0.3 * r))) };
  });
  const width = Math.max(box.w * w + 24, Math.min(w - 16, text.length * size * 0.5 + 24));
  return (
    <Animated.View pointerEvents="none" style={[styles.ink, { left: cx - width / 2, top: box.y * h - 6, width, height: box.h * h + 12 }, style]}>
      <Oversized width={width - 8} transform={[{ rotate: "-5deg" }]}>
        <Lettering text={text} hand="left-slant" size={size} lineHeight={Math.ceil(size * 1.22)} lines={2} label={`Written in invisible ink: ${text}`} k={OVER} />
      </Oversized>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  a11y: { position: "absolute" },
  ink: { position: "absolute", alignItems: "center", justifyContent: "center" },
  over: { position: "absolute", left: 0, right: 0, top: 0 },
  // The halo: the words once more underneath, the only soft thing here, and thin.
  halo: { color: UV.edge, textShadowColor: UV.halo, textShadowOffset: { width: 0, height: 0 } },
  edge: { color: UV.edge },
  letters: { color: UV.ink },
});
