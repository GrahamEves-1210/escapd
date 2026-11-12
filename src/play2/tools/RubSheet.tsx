// The pencil rubbing: a small spiral notepad whose top sheet was torn off (its stub still in the wire),
// what was written on that sheet left as dents in the one under it. The player rubs a finger back and
// forth: graphite goes down where they rub (their own strokes, soft and a little uneven, catching the
// paper's tooth) and the dents show through it pale, a darker lip where the lead caught their edge.
// A stub of pencil lies under the pad and comes to the finger. Read once most of the writing has been
// shaded over; at once for a screen reader's activate or under reduced motion (shaded in for them).
//
// The page, the rules, the graphite and the dents are drawn live; the wire coil with the torn stub
// and the pencil are rendered pictures (props.ts), the first laid over the page's top, the second
// carried by its point.
import { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { Easing, ReduceMotion, useDerivedValue, useSharedValue, withTiming } from "react-native-reanimated";
import { BlurMask, Canvas, ColorMatrix, FractalNoise, Group, Image, Line, Paint, Path, Rect, RoundedRect, Shadow, Skia, vec } from "@shopify/react-native-skia";
import { scheduleOnRN } from "react-native-worklets";
import { alpha } from "@/theme/payoff";

import { Sheet, SMOOTH, useArt, useWriting, Written } from "./ink";
import { BINDING, PENCIL } from "./props";
import { cover, hatch, isShort, samplesOf, sizeFor } from "./revealText";
import type { SheetProps } from "./sheet";

const PAGE = "#F4EEDD";
const GRAPHITE = { soft: "#4B4D58", dark: "#26272E" } as const;

/** The band at the pad's top the wire runs through (the binding's picture covers it), and how far the pad sits down the canvas. */
const BIND = 34;
const TOP = 26;
/** The side of the lead: how wide a stroke of shading is, and how near a stroke must pass a letter to shade it. */
const STROKE = 30;
const REACH = 17;
/** The share of the writing shaded over at which it reads (a little more than the lens's: a rubbing is read whole). */
const RUBBED = 0.88;

/** Graphite catches the paper's tooth: noise into alpha (0.3 to 1), multiplied into what's been shaded. */
const TOOTH = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.1, 0, 0, 0, 0.42];
/** And goes down in streaks, the way the hand moved: a slow noise drawn out along the stroke. */
const STREAK = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.3, 0, 0, 0, 0.28];
/** The pad lies a little crooked on the desk (radians). */
const TILT = -0.028;

export function RubSheet({ text, title, width, shown, reduced, onRead, feedback, labels }: SheetProps) {
  const short = isShort(text);
  const padW = Math.min(width - 84, 290);
  const padH = BIND + Math.round(padW * 1.12);
  const ox = (width - padW) / 2;
  const sceneH = TOP + padH + 84;
  const size = short ? 56 : sizeFor(text) + 3;
  const writing = useWriting(text, title, size, padW - 58, "hand", short ? "center" : "left");
  const wx = ox + 34;
  const wy = TOP + BIND + (short ? Math.round(padW * 0.3) : 40);
  const samples = useMemo(() => (writing ? samplesOf(writing.setting, size, wx, wy) : []), [writing, size, wx, wy]);
  const lineHeight = writing?.setting.lineHeight ?? Math.round(size * 1.32);
  const ruleGap = short ? 27 : lineHeight;

  // The strokes so far (flat points; NaN lifts the pencil), which samples they've shaded, and the share.
  const pts = useSharedValue<number[]>([]);
  const covered = useSharedValue<number[]>([]);
  const amount = useSharedValue(reduced ? 1 : 0);
  const held = useSharedValue(reduced);
  const travel = useSharedValue(0);
  const last = useSharedValue({ x: 0, y: 0 });
  // The pencil: where its point is, and how it leans (lying under the pad, then in the hand).
  const rest = { x: ox + 30, y: TOP + padH + 48 };
  const tipX = useSharedValue(rest.x);
  const tipY = useSharedValue(rest.y);
  const lean = useSharedValue(0.1);

  // Shaded in at once (reduced motion, a screen reader): a pencil's back-and-forth over the writing.
  const fill = () => {
    if (!writing) return;
    pts.set(hatch(wx - 10, wy + 2, wx + writing.setting.width + 10, wy + writing.setting.height + 6, 15));
    amount.set(1);
    held.set(true);
    shown.set(1);
  };
  useEffect(() => {
    if (reduced) fill();
    // Once the face has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, writing]);

  // The lead on the paper: a tick in the hand every so far, and a stroke's scratch (at most one every
  // 300 ms, so a fast rub doesn't pile strokes on each other).
  const scratched = useRef(0);
  const tick = () => {
    feedback.tick();
    const now = Date.now();
    if (now - scratched.current < 300) return;
    scratched.current = now;
    feedback.pencilRub();
  };
  const cx = width / 2;
  const cy = TOP + padH / 2;
  const COS = Math.cos(TILT);
  const SIN = Math.sin(TILT);
  const pan = usePanGesture({
    minDistance: 0,
    maxPointers: 1,
    testID: "v2-reveal-pan",
    onBegin: (e) => {
      "worklet";
      // Where the lead is on the (crooked) pad.
      const px = cx + (e.x - cx) * COS + (e.y - cy) * SIN;
      const py = cy - (e.x - cx) * SIN + (e.y - cy) * COS;
      last.set({ x: px, y: py });
      pts.modify((a) => {
        "worklet";
        a.push(NaN, NaN, px, py, px + 0.5, py + 0.5);
        return a;
      });
      const quick = { duration: 110, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never };
      tipX.set(withTiming(e.x, quick));
      tipY.set(withTiming(e.y, quick));
      lean.set(withTiming(0.62, quick));
    },
    onUpdate: (e) => {
      "worklet";
      const px = cx + (e.x - cx) * COS + (e.y - cy) * SIN;
      const py = cy - (e.x - cx) * SIN + (e.y - cy) * COS;
      const from = last.get();
      const dx = px - from.x;
      const dy = py - from.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 3) return;
      last.set({ x: px, y: py });
      tipX.set(e.x);
      tipY.set(e.y);
      pts.modify((a) => {
        "worklet";
        a.push(px, py);
        return a;
      });
      // What this stroke went over (stepped along it, so a fast rub misses nothing).
      const steps = Math.max(1, Math.ceil(d / 8));
      covered.modify((c) => {
        "worklet";
        if (c.length * 2 !== samples.length) c = new Array(samples.length / 2).fill(0);
        let share = 0;
        for (let i = 1; i <= steps; i++) share = cover(samples, c, from.x + (dx * i) / steps, from.y + (dy * i) / steps, REACH);
        amount.set(share);
        return c;
      });
      // The lead dragging on the paper: a faint tick every so far.
      const far = travel.get() + d;
      if (far > 46) {
        travel.set(0);
        scheduleOnRN(tick);
      } else travel.set(far);
      if (samples.length > 0 && amount.get() >= RUBBED && !held.get()) {
        held.set(true);
        shown.set(withTiming(1, { duration: 420, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }));
        scheduleOnRN(onRead);
      }
    },
    onFinalize: () => {
      "worklet";
      // Set down where it was lifted, rolling flat.
      lean.set(withTiming(0.24, { duration: 260, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }));
    },
  });

  const strokes = useDerivedValue(() => {
    const b = Skia.PathBuilder.Make();
    const p = pts.get();
    let down = false;
    for (let i = 0; i < p.length; i += 2) {
      if (Number.isNaN(p[i])) {
        down = false;
      } else if (down) {
        b.lineTo(p[i], p[i + 1]);
      } else {
        b.moveTo(p[i], p[i + 1]);
        down = true;
      }
    }
    return b.detach();
  });
  // Shading builds: darker as more of the page has been gone over, and the dents sharper once it's read.
  const build = useDerivedValue(() => 0.74 + 0.26 * Math.min(1, amount.get() * 1.2));
  const dent = useDerivedValue(() => 0.66 + 0.3 * shown.get());
  const pencil = useDerivedValue(() => [{ translateX: tipX.get() }, { translateY: tipY.get() }, { rotate: lean.get() }]);

  const centre = { x: width / 2, y: TOP + padH / 2 };
  const binding = useArt(BINDING.art);
  const pencilArt = useArt(PENCIL.art);
  // The binding's picture is for a pad BINDING.padW wide: a narrower pad scales it.
  const k = padW / BINDING.padW;
  const page = Skia.XYWHRect(ox, TOP + BIND - 6, padW, padH - BIND + 6);
  const rules: number[] = [];
  for (let y = Math.round(wy + size + 5 - ruleGap * 3); y < TOP + padH - 14; y += ruleGap) if (y > TOP + BIND + 22) rules.push(y + 0.5);

  return (
    <GestureDetector gesture={pan}>
      <View
        style={{ width, height: sceneH }}
        accessible
        accessibilityRole="button"
        accessibilityLabel={labels.label}
        accessibilityActions={[{ name: "activate" }]}
        onAccessibilityAction={() => {
          fill();
          onRead();
        }}
        testID="v2-reveal-page"
      >
        <Canvas style={{ width, height: sceneH }} pointerEvents="none">
          <Group origin={centre} transform={[{ rotate: TILT }]}>
          {/* The pad: its board, the sheets under the top one, the page. */}
          <RoundedRect x={ox - 1} y={TOP + 3} width={padW + 5} height={padH + 5} r={3} color="#5A4A3C">
            <Shadow dx={0} dy={12} blur={18} color={alpha("#000000", 0.38)} />
          </RoundedRect>
          {[3, 2, 1].map((i) => (
            <Rect key={i} x={ox + i * 0.9} y={TOP + i * 1.5} width={padW} height={padH} color={i % 2 ? "#DDD4BF" : "#EAE2CE"} />
          ))}
          <Sheet x={ox} y={TOP} w={padW} h={padH} r={1.5} color={PAGE} shade={alpha("#2A1C24", 0.25)} lift={0.3} grain={0.38} seed={11}>
            {rules.map((y) => (
              <Line key={y} p1={vec(ox + 8, y)} p2={vec(ox + padW - 8, y + 0.4)} color={alpha("#6F88A4", 0.34)} strokeWidth={1} />
            ))}
            <Line p1={vec(ox + 25, TOP + BIND + 8)} p2={vec(ox + 25.6, TOP + padH - 6)} color={alpha("#9A2B45", 0.2)} strokeWidth={1} />
          </Sheet>
          {/* The shading: her strokes, soft, eaten by the paper's tooth; the dents left pale in it. */}
          <Group clip={page} layer={<Paint opacity={build} />}>
            <Path path={strokes} style="stroke" strokeWidth={STROKE} strokeCap="round" strokeJoin="round" color={GRAPHITE.soft} opacity={0.66}>
              <BlurMask blur={3.2} style="normal" />
            </Path>
            <Path path={strokes} style="stroke" strokeWidth={9} strokeCap="round" strokeJoin="round" color={GRAPHITE.dark} opacity={0.22} transform={[{ translateX: 4 }, { translateY: -6 }]}>
              <BlurMask blur={1.2} style="normal" />
            </Path>
            <Path path={strokes} style="stroke" strokeWidth={5} strokeCap="round" strokeJoin="round" color={GRAPHITE.dark} opacity={0.2} transform={[{ translateX: -6 }, { translateY: 7 }]}>
              <BlurMask blur={1} style="normal" />
            </Path>
            <Rect x={ox - 20} y={TOP - 20} width={padW + 40} height={padH + 40} blendMode="dstIn">
              <FractalNoise freqX={0.012} freqY={0.34} octaves={2} seed={9} tileWidth={0} tileHeight={0} />
              <ColorMatrix matrix={STREAK} />
            </Rect>
            <Rect x={ox - 20} y={TOP - 20} width={padW + 40} height={padH + 40} blendMode="dstIn">
              <FractalNoise freqX={0.7} freqY={0.6} octaves={2} seed={5} tileWidth={0} tileHeight={0} />
              <ColorMatrix matrix={TOOTH} />
            </Rect>
            {writing ? (
              <>
                <Group blendMode="srcATop" color={GRAPHITE.dark} opacity={0.5}>
                  <Written words={writing.setting.words} font={writing.font} size={size} x={wx + 1} y={wy + 1.2} />
                </Group>
                <Group blendMode="dstOut" color="#000000" opacity={dent}>
                  <Written words={writing.setting.words} font={writing.font} size={size} x={wx} y={wy} />
                  <Group style="stroke" strokeWidth={0.9}>
                    <Written words={writing.setting.words} font={writing.font} size={size} x={wx} y={wy} />
                  </Group>
                </Group>
              </>
            ) : null}
          </Group>
          {/* The sheet above, torn off: its stub still in the wire coil (over the page and the shading). */}
          {binding ? <Image image={binding} x={ox - BINDING.pad.x * k} y={TOP - BINDING.pad.y * k} width={BINDING.w * k} height={BINDING.h * k} fit="fill" sampling={SMOOTH} /> : null}
          </Group>
          {/* The pencil stub: its point at the finger, its shadow on the page. */}
          <Group transform={pencil}>
            <RoundedRect x={12} y={-9} width={PENCIL.w - PENCIL.tip.x - 16} height={18} r={8} color={alpha("#000000", 0.36)} transform={[{ translateX: 3 }, { translateY: 6 }]}>
              <BlurMask blur={4} style="normal" />
            </RoundedRect>
            {pencilArt ? <Image image={pencilArt} x={-PENCIL.tip.x} y={-PENCIL.tip.y} width={PENCIL.w} height={PENCIL.h} fit="fill" sampling={SMOOTH} /> : null}
          </Group>
        </Canvas>
      </View>
    </GestureDetector>
  );
}
