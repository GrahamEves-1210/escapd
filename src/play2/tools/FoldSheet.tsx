// The fold-in: a printed page, typed lines running right across it that read as nothing much. The
// left strip ends at a dashed line marked A, the right strip starts at one marked B, and between them
// is filler. Each typed line of the hidden message is cut in two down its middle: its left half ends
// at A, its right half starts at B. The player drags the right of the page in: the middle pleats away
// into a shadowed valley, the gripped edge curling up to show the paper's back, until B lies on A and
// the halves meet: the line reads across the join. It snaps home with a paper sound. Let go early and
// it springs flat again. At once for a screen reader's activate or under reduced motion.
//
// The page is drawn live (it folds). A brass paperweight (a rendered picture: props.ts) stands on its
// top-left corner: what holds the left of the page still while the right is brought in.
import { useMemo } from "react";
import { View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { Easing, ReduceMotion, useDerivedValue, useSharedValue, withTiming } from "react-native-reanimated";
import { Canvas, ColorMatrix, DashPathEffect, FractalNoise, Group, Image, Line, LinearGradient, Path, Rect, Shadow, Skia, Text, rect, vec } from "@shopify/react-native-skia";
import { scheduleOnRN } from "react-native-worklets";
import { alpha } from "@/theme/payoff";

import { measureWith, once, SMOOTH, useArt, useFace, useWriting, Written } from "./ink";
import { PAPERWEIGHT } from "./props";
import { filler, foldAt, foldProgress, isShort } from "./revealText";
import type { SheetProps } from "./sheet";

const PAPER = "#F3EBD9";
/** The paper's back, where the gripped edge curls over. */
const BACK = "#DDD1B8";
const TYPE = "#2A2127";
/** The printer's second colour: the fold marks. */
const MARK = "#8A2B3D";
const TOP = 30;
/** Past this much of the way the fold snaps home. */
const HOME_AT = 0.86;
/** Where the paperweight stands on the page (its middle, from the page's top-left corner): on the corner, clear of the print. */
const WEIGHT = { x: 15, y: 13 };
/** The page lies a little crooked (radians). */
const TILT = -0.02;
const tooth = [0.55, 0, 0, 0, 0.725, 0.55, 0, 0, 0, 0.725, 0.55, 0, 0, 0, 0.725, 0, 0, 0, 0, 1];

export function FoldSheet({ text, title, width, shown, done, reduced, onRead, labels }: SheetProps) {
  const short = isShort(text);
  const W = Math.min(width - 44, 330);
  const a = Math.round(W * 0.36);
  const m = Math.round(W * 0.28);
  const half = a - 20;
  const size = short ? 44 : text.length > 70 ? 16 : 17;
  const writing = useWriting(text, title, size, half * 2, "typed", "center", 0.2);
  const small = useFace("typed", 15);
  const rows = writing?.setting.rows ?? 3;
  const lineHeight = Math.round(size * 1.32);
  const H = Math.max(Math.round(W * 0.9), rows * lineHeight + 196);
  const sceneH = TOP + H + 40;
  const px = (width - W) / 2;
  const wy = TOP + 62 + Math.round((H - 62 - 40 - rows * lineHeight) / 2);

  // How far it's folded (0 flat .. 1 home), and how firmly the edge is gripped (it curls).
  const fold = useSharedValue(reduced ? 1 : 0);
  const grip = useSharedValue(0);
  const held = useSharedValue(reduced);

  const pan = usePanGesture({
    enabled: !done,
    minDistance: 0,
    maxPointers: 1,
    testID: "v2-reveal-pan",
    onBegin: () => {
      "worklet";
      grip.set(withTiming(1, { duration: 160, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }));
    },
    onUpdate: (e) => {
      "worklet";
      if (held.get()) return;
      const p = foldProgress(e.translationX, m);
      fold.set(p);
      if (p >= HOME_AT) {
        held.set(true);
        const snap = { duration: 170, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never };
        fold.set(withTiming(1, snap));
        grip.set(withTiming(0, snap));
        shown.set(withTiming(1, { duration: 360, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }));
        scheduleOnRN(onRead);
      }
    },
    onFinalize: () => {
      "worklet";
      const settle = { duration: 300, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never };
      grip.set(withTiming(0, settle));
      // Not home: the paper springs flat.
      if (!held.get()) fold.set(withTiming(0, settle));
    },
  });

  // The page's four parts as the fold moves them.
  const page = useDerivedValue(() => [{ translateX: px + foldAt(a, m, fold.get()).shift }, { translateY: TOP }]);
  const leftMid = useDerivedValue(() => [{ translateX: a }, { scaleX: Math.max(0.0001, foldAt(a, m, fold.get()).lean) }, { translateX: -a }]);
  const rightMid = useDerivedValue(() => {
    const f = foldAt(a, m, fold.get());
    return [{ translateX: f.valley }, { scaleX: Math.max(0.0001, f.lean) }, { translateX: -(a + m / 2) }];
  });
  const right = useDerivedValue(() => [{ translateX: foldAt(a, m, fold.get()).right - (a + m) }]);
  const shade = useDerivedValue(() => foldAt(a, m, fold.get()).shade);
  const lies = useDerivedValue(() => W - m * fold.get());
  // The gripped edge: how wide it has curled over, and what's left of the right strip lying flat.
  const curl = useDerivedValue(() => 15 * grip.get() * (1 - 0.6 * fold.get()));
  const flat = useDerivedValue(() => rect(a + m, 0, W - a - m - curl.get(), H));
  const curlAt = useDerivedValue(() => [{ translateX: W - curl.get() }]);
  const curlWide = useDerivedValue(() => [{ scaleX: curl.get() / 15 }]);
  // The valley lies further off than the creases: the panels' top and bottom edges draw in toward it.
  const leftClip = useDerivedValue(() => {
    const d = 9 * foldAt(a, m, fold.get()).shade;
    return Skia.PathBuilder.Make().moveTo(a, 0).lineTo(a + m / 2, d).lineTo(a + m / 2, H - d).lineTo(a, H).close().detach();
  });
  const rightClip = useDerivedValue(() => {
    const d = 9 * foldAt(a, m, fold.get()).shade;
    return Skia.PathBuilder.Make().moveTo(a + m / 2, d).lineTo(a + m, 0).lineTo(a + m, H).lineTo(a + m / 2, H - d).close().detach();
  });
  const seam = useDerivedValue(() => 0.55 - 0.3 * shown.get());

  // The page's own copy: four typed lines, each as many words as fit between its margins.
  const copy = useMemo(() => {
    if (!small) return [];
    const wide = measureWith(small);
    return [0, 1, 2, 3].map((k) => {
      const words = `${filler(title, 20 + k)} ${filler(title, 30 + k)}`.split(" ");
      let line = words[0];
      for (const w of words.slice(1)) {
        if (wide(`${line} ${w}`) > W - 32) break;
        line = `${line} ${w}`;
      }
      return line;
    });
  }, [small, title, W]);
  const ARROW = marks();
  const weight = useArt(PAPERWEIGHT.art);
  const baseline = (row: number) => wy - TOP + size + row * lineHeight;
  // Everything printed on the page, in the page's own space; drawn once for each part, cut to it.
  const printed = (
    <>
      <Rect x={0} y={0} width={W} height={H} color={PAPER} />
      <Rect x={0} y={0} width={W} height={H} opacity={0.3} blendMode="multiply">
        <FractalNoise freqX={1.4} freqY={1.1} octaves={2} seed={31} tileWidth={0} tileHeight={0} />
        <ColorMatrix matrix={tooth} />
      </Rect>
      {/* The page's furniture: a double rule under the fold marks, one over the folio. */}
      <Line p1={vec(14, 50)} p2={vec(W - 14, 50)} color={alpha(TYPE, 0.6)} strokeWidth={1.3} />
      <Line p1={vec(14, 53.5)} p2={vec(W - 14, 53.5)} color={alpha(TYPE, 0.45)} strokeWidth={0.6} />
      <Line p1={vec(14, H - 32)} p2={vec(W - 14, H - 32)} color={alpha(TYPE, 0.45)} strokeWidth={0.6} />
      {small ? (
        <>
          <Text x={a - 25} y={36} text="A" font={small} color={MARK} />
          <Text x={a + m + 15} y={36} text="B" font={small} color={MARK} />
          <Text x={W / 2 - 18} y={H - 13} text="· 12 ·" font={small} color={alpha(TYPE, 0.7)} />
        </>
      ) : null}
      <Path path={ARROW.right} transform={[{ translateX: a - 12 }, { translateY: 31 }]} color={MARK} />
      <Path path={ARROW.left} transform={[{ translateX: a + m + 12 }, { translateY: 31 }]} color={MARK} />
      {[a, a + m].map((x) => (
        <Line key={x} p1={vec(x, 22)} p2={vec(x, H - 12)} color={alpha(MARK, 0.55)} strokeWidth={1}>
          <DashPathEffect intervals={[4, 5]} />
        </Line>
      ))}
      {/* The page's own copy, typed across all of it above and below: it never did say much. */}
      {small ? (
        <Group color={alpha(TYPE, 0.55)}>
          {[0, 1, 2, 3].map((k) => (
            <Text key={k} x={16} y={k < 2 ? 76 + k * 19 : H - 64 + (k - 2) * 19} text={copy[k]} font={small} />
          ))}
        </Group>
      ) : null}
      {writing ? (
        <Group color={TYPE}>
          {/* Each line's left half, up to A; filler across the middle; its right half, from B. */}
          <Group clip={rect(0, 0, a, H)}>
            <Written words={writing.setting.words} font={writing.font} size={size} x={a - half} y={wy - TOP} />
          </Group>
          <Group clip={rect(a, 0, m, H)}>
            {Array.from({ length: rows }, (_, row) => (
              <Text key={row} x={a + 1} y={baseline(row)} text={filler(title, row)} font={writing.font} />
            ))}
          </Group>
          <Group clip={rect(a + m, 0, W - a - m, H)}>
            <Written words={writing.setting.words} font={writing.font} size={size} x={a + m - half} y={wy - TOP} />
          </Group>
        </Group>
      ) : null}
    </>
  );

  return (
    <GestureDetector gesture={pan}>
      <View
        style={{ width, height: sceneH }}
        accessible
        accessibilityRole="button"
        accessibilityLabel={labels.label}
        accessibilityActions={[{ name: "activate" }]}
        onAccessibilityAction={() => {
          held.set(true);
          fold.set(1);
          shown.set(1);
          onRead();
        }}
        testID="v2-reveal-page"
      >
        <Canvas style={{ width, height: sceneH }} pointerEvents="none">
          <Group origin={{ x: width / 2, y: TOP + H / 2 }} transform={[{ rotate: TILT }]}>
            <Group transform={page}>
              {/* The page's shadow on the desk, as wide as it lies now. */}
              <Rect x={1} y={1} width={lies} height={H - 2} color="#150E13">
                <Shadow dx={0} dy={2.5} blur={3} color={alpha("#000000", 0.5)} />
                <Shadow dx={0} dy={12} blur={18} color={alpha("#000000", 0.32)} />
              </Rect>
              {/* The left strip lies still. */}
              <Group clip={rect(0, 0, a, H)}>{printed}</Group>
              {/* The middle: two panels leaning away into a valley, darker the steeper. */}
              <Group transform={leftMid}>
                <Group clip={leftClip}>
                  {printed}
                  <Rect x={a} y={0} width={m / 2} height={H} opacity={shade}>
                    <LinearGradient start={vec(a, 0)} end={vec(a + m / 2, 0)} colors={[alpha("#1A1014", 0.1), alpha("#1A1014", 0.62)]} />
                  </Rect>
                </Group>
              </Group>
              <Group transform={rightMid}>
                <Group clip={rightClip}>
                  {printed}
                  <Rect x={a + m / 2} y={0} width={m / 2} height={H} opacity={shade}>
                    <LinearGradient start={vec(a + m / 2, 0)} end={vec(a + m, 0)} colors={[alpha("#1A1014", 0.7), alpha("#1A1014", 0.22)]} />
                  </Rect>
                </Group>
              </Group>
              {/* The right strip, carried in; its gripped edge curled over, the paper's back showing. */}
              <Group transform={right}>
                <Group clip={flat}>{printed}</Group>
                <Group transform={curlAt}>
                  <Group transform={curlWide}>
                    <Rect x={-9} y={0} width={9} height={H}>
                      <LinearGradient start={vec(-9, 0)} end={vec(0, 0)} colors={[alpha("#1A1014", 0), alpha("#1A1014", 0.3)]} />
                    </Rect>
                    <Rect x={0} y={0} width={15} height={H}>
                      <LinearGradient start={vec(0, 0)} end={vec(15, 0)} colors={[BACK, "#F4ECDC", BACK, "#B9AC92"]} positions={[0, 0.35, 0.7, 1]} />
                    </Rect>
                  </Group>
                </Group>
                {/* The join: the strip's edge over the fold, a line of shadow under its lip. */}
                <Rect x={a + m - 5} y={0} width={5} height={H} opacity={shade}>
                  <LinearGradient start={vec(a + m - 5, 0)} end={vec(a + m, 0)} colors={[alpha("#1A1014", 0), alpha("#1A1014", 0.4)]} />
                </Rect>
                <Line p1={vec(a + m, 0)} p2={vec(a + m, H)} color={alpha("#1A1014", 1)} strokeWidth={0.8} opacity={seam} />
                <Line p1={vec(a + m + 1, 0)} p2={vec(a + m + 1, H)} color={alpha("#FFFFFF", 0.5)} strokeWidth={0.8} />
              </Group>
              <Line p1={vec(a, 0)} p2={vec(a, H)} color={alpha("#1A1014", 0.22)} strokeWidth={0.8} />
              <Line p1={vec(a - 1, 0)} p2={vec(a - 1, H)} color={alpha("#FFFFFF", 0.6)} strokeWidth={0.9} opacity={shade} />
              {/* The paperweight on the corner of the strip that lies still. */}
              {weight ? (
                <Image image={weight} x={WEIGHT.x - PAPERWEIGHT.centre.x} y={WEIGHT.y - PAPERWEIGHT.centre.y} width={PAPERWEIGHT.w} height={PAPERWEIGHT.h} fit="fill" sampling={SMOOTH} />
              ) : null}
            </Group>
          </Group>
        </Canvas>
      </View>
    </GestureDetector>
  );
}

/** The fold marks' arrowheads: toward the line each letter names. */
const marks = once(() => ({
  right: Skia.Path.MakeFromSVGString("M0 -4.6 L8.4 0.2 L0.2 4.4 C1.4 1.4 1.3 -1.8 0 -4.6 Z")!,
  left: Skia.Path.MakeFromSVGString("M0 -4.6 L-8.4 0.2 L-0.2 4.4 C-1.4 1.4 -1.3 -1.8 0 -4.6 Z")!,
}));
