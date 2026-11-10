// The red lens: a printed card, a jumble to the bare eye (rows of red letters and scribble overprinted
// on a line in pale blue-green), and a round red gel in a brass ring. Through the gel only the red of
// things gets through: the paper and the red ink come out the same red and the jumble is gone; the
// blue-green line has no red in it and reads dark and clear. The player slides the lens over the card;
// once it has passed over most of the line the line is read (it stays: the jumble pales, the line
// darkens). At once for a screen reader's activate or under reduced motion.
import { useMemo } from "react";
import { View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from "react-native-reanimated";
import { BlurMask, Canvas, Circle, ColorMatrix, Group, Paint, Path, Rect, Skia, SweepGradient, Text, rect, rrect, vec, type SkFont } from "@shopify/react-native-skia";
import { scheduleOnRN } from "react-native-worklets";
import { alpha } from "@/theme/payoff";

import { once, Sheet, useWriting, Written } from "./ink";
import { cover, isShort, READ_AT, samplesOf, sizeFor, type Setting } from "./revealText";
import type { SheetProps } from "./sheet";

const INK = "#1E1418";
const CARD = "#F6F1E6";
/** The hidden line's ink (almost no red in it) and the jumble's (all red: through the gel it is the paper). */
const LINE = "#84DCE0";
const NOISE = "#F2473B";
/** The line as it stays once read. */
const READ = "#1F2A33";
const BRASS = { deep: "#5E4116", mid: "#B28A45", light: "#E9CD8A", sheen: "#F7E6B8" } as const;

/**
 * Through the gel only the red of a thing gets through. First every colour becomes how much red it has,
 * stretched so the paper and the red ink (overprinted twice, even) are both all of it and the pale
 * blue-green almost none; then that is shown in the gel's own red, dark where there was none.
 */
const RED_OF = [
  3, 0, 0, 0, -1.4,
  3, 0, 0, 0, -1.4,
  3, 0, 0, 0, -1.4,
  0, 0, 0, 1, 0,
];
const GEL = [
  0.74, 0, 0, 0, 0.14,
  0.2, 0, 0, 0, 0.02,
  0.16, 0, 0, 0, 0.04,
  0, 0, 0, 1, 0,
];

const TOP = 34;
/** The gel's radius, and its brass ring's width. */
const R = 56;
const RING = 9;
/** The card lies a little crooked (radians). */
const TILT = 0.024;

export function LensSheet({ text, title, width, shown, reduced, onRead, feedback, labels }: SheetProps) {
  const short = isShort(text);
  const cardW = Math.min(width - 52, 320);
  const size = short ? 50 : sizeFor(text);
  const writing = useWriting(text, title, size, cardW - 60, "hand", "center");
  const rows = writing?.setting.rows ?? (short ? 1 : 3);
  const lineHeight = Math.round(size * 1.32);
  const cardH = Math.max(Math.round(cardW * 0.6), rows * lineHeight + 96);
  const ox = (width - cardW) / 2;
  const sceneH = TOP + cardH + 2 * R + 60;
  const wx = ox + 30;
  const wy = TOP + Math.round((cardH - rows * lineHeight) / 2) - 2;
  const samples = useMemo(() => (writing ? samplesOf(writing.setting, size, wx, wy) : []), [writing, size, wx, wy]);
  const noise = useMemo(() => jumble(title, ox, TOP, cardW, cardH, wy, size, lineHeight), [title, ox, cardW, cardH, wy, size, lineHeight]);

  const cx = width / 2;
  const cy = TOP + cardH / 2;
  const COS = Math.cos(TILT);
  const SIN = Math.sin(TILT);
  // The lens: where it lies (resting under the card), where the drag took hold, how far it's lifted.
  const lx = useSharedValue(width / 2 + 6);
  const ly = useSharedValue(TOP + cardH + R + 34);
  const grip = useSharedValue({ x: 0, y: 0 });
  const lift = useSharedValue(0);
  const covered = useSharedValue<number[]>([]);
  const amount = useSharedValue(0);
  const held = useSharedValue(reduced);

  const up = () => feedback.lensUp();
  const down = () => feedback.lensDown();
  const pan = usePanGesture({
    minDistance: 0,
    maxPointers: 1,
    testID: "v2-reveal-pan",
    onBegin: () => {
      "worklet";
      grip.set({ x: lx.get(), y: ly.get() });
      lift.set(withTiming(1, { duration: 140, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }));
      scheduleOnRN(up);
    },
    onUpdate: (e) => {
      "worklet";
      const g = grip.get();
      const x = Math.min(width - R - 4, Math.max(R + 4, g.x + e.translationX));
      const y = Math.min(sceneH - R - 4, Math.max(R + 4, g.y + e.translationY));
      lx.set(x);
      ly.set(y);
      if (held.get() || samples.length === 0) return;
      // Where the gel is on the (crooked) card, and what of the line is under it.
      const px = cx + (x - cx) * COS + (y - cy) * SIN;
      const py = cy - (x - cx) * SIN + (y - cy) * COS;
      covered.modify((c) => {
        "worklet";
        if (c.length * 2 !== samples.length) c = new Array(samples.length / 2).fill(0);
        amount.set(cover(samples, c, px, py, R * 0.8));
        return c;
      });
      if (amount.get() >= READ_AT) {
        held.set(true);
        shown.set(withTiming(1, { duration: 520, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }));
        scheduleOnRN(onRead);
      }
    },
    onFinalize: () => {
      "worklet";
      lift.set(withTiming(0, { duration: 200, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }));
      scheduleOnRN(down);
    },
  });

  // The gel's window, in the card's own (turned) space; the lens itself, where the finger has it.
  const gel = useDerivedValue(() => {
    const px = cx + (lx.get() - cx) * COS + (ly.get() - cy) * SIN;
    const py = cy - (lx.get() - cx) * SIN + (ly.get() - cy) * COS;
    return rrect(rect(px - R, py - R, 2 * R, 2 * R), R, R);
  });
  const lens = useDerivedValue(() => [{ translateX: lx.get() }, { translateY: ly.get() - 5 * lift.get() }, { scale: 1 + 0.05 * lift.get() }]);
  const lensShade = useDerivedValue(() => [{ translateX: lx.get() + 3 + 4 * lift.get() }, { translateY: ly.get() + 6 + 8 * lift.get() }]);
  const jumbleFade = useDerivedValue(() => 1 - 0.8 * shown.get());
  const readIn = useDerivedValue(() => shown.get());
  const handle = useAnimatedStyle(() => ({ transform: [{ translateX: lx.get() - R - 18 }, { translateY: ly.get() - R - 18 }] }));

  const ART = lensArt();
  const card = rrect(rect(ox, TOP, cardW, cardH), 3, 3);
  // What's printed on the card, drawn twice: to the bare eye, and (inside the gel) through it.
  const printed = (through: boolean) => (
    <>
      <Rect x={ox + 9} y={TOP + 9} width={cardW - 18} height={cardH - 18} style="stroke" strokeWidth={1.4} color={LINE} opacity={0.8} />
      <Rect x={ox + 13} y={TOP + 13} width={cardW - 26} height={cardH - 26} style="stroke" strokeWidth={0.6} color={LINE} opacity={0.8} />
      {writing ? (
        <>
          <Group color={LINE}>
            <Written words={writing.setting.words} font={writing.font} size={size} x={wx} y={wy} />
          </Group>
          {through ? null : (
            <Group color={READ} opacity={readIn}>
              <Written words={writing.setting.words} font={writing.font} size={size} x={wx} y={wy} />
            </Group>
          )}
          <Group blendMode="multiply" color={NOISE} opacity={through ? 1 : jumbleFade}>
            <Jumble noise={noise} font={writing.font} setting={writing.setting} />
          </Group>
        </>
      ) : null}
    </>
  );

  return (
    <View style={{ width, height: sceneH }} pointerEvents="box-none">
      <Canvas style={{ width, height: sceneH }} pointerEvents="none">
        {/* The gel off the card: the desk through it, dark red. */}
        <Circle cx={lx} cy={ly} r={R} color={alpha("#D2362D", 0.72)} />
        <Group origin={{ x: cx, y: cy }} transform={[{ rotate: TILT }]}>
          <Sheet x={ox} y={TOP} w={cardW} h={cardH} r={3} color={CARD} shade={alpha("#000000", 0.45)} lift={1.1} grain={0.4} seed={21}>
            {printed(false)}
          </Sheet>
          <Group clip={gel}>
            <Group clip={card} layer={<Paint><ColorMatrix matrix={GEL}><ColorMatrix matrix={RED_OF} /></ColorMatrix></Paint>}>
              <Rect x={ox} y={TOP} width={cardW} height={cardH} color={CARD} />
              {printed(true)}
            </Group>
          </Group>
        </Group>
        {/* The lens: its shadow, the glass's shine, the brass ring and its pull, inked. */}
        <Group transform={lensShade}>
          <Circle cx={0} cy={0} r={R + RING / 2} style="stroke" strokeWidth={RING + 2} color={alpha("#000000", 0.4)}>
            <BlurMask blur={5} style="normal" />
          </Circle>
        </Group>
        <Group transform={lens}>
          <Path path={ART.shine} style="stroke" strokeWidth={5} strokeCap="round" color={alpha("#FFFFFF", 0.26)}>
            <BlurMask blur={1.5} style="normal" />
          </Path>
          <Path path={ART.glint} style="stroke" strokeWidth={2.2} strokeCap="round" color={alpha("#FFFFFF", 0.5)} />
          <Circle cx={0} cy={0} r={R - 1} style="stroke" strokeWidth={5} color={alpha("#5A0F0C", 0.28)}>
            <BlurMask blur={3} style="inner" />
          </Circle>
          <Path path={ART.pull} style="stroke" strokeWidth={8.4} strokeCap="round" color={INK} />
          <Path path={ART.pull} style="stroke" strokeWidth={5.2} strokeCap="round" color={BRASS.mid} />
          <Path path={ART.pull} style="stroke" strokeWidth={1.2} strokeCap="round" color={BRASS.sheen} opacity={0.75} transform={[{ translateX: -1 }, { translateY: -1 }]} />
          <Circle cx={0} cy={0} r={R + RING / 2} style="stroke" strokeWidth={RING}>
            <SweepGradient c={vec(0, 0)} colors={[BRASS.mid, BRASS.light, BRASS.sheen, BRASS.mid, BRASS.deep, BRASS.mid, BRASS.light, BRASS.deep, BRASS.mid]} />
          </Circle>
          <Circle cx={0} cy={0} r={R + RING / 2} style="stroke" strokeWidth={1} color={alpha(BRASS.deep, 0.7)} />
          <Circle cx={0} cy={0} r={R + RING} style="stroke" strokeWidth={2} color={INK} />
          <Circle cx={0} cy={0} r={R} style="stroke" strokeWidth={1.6} color={INK} />
          <Circle cx={1} cy={0.8} r={R + RING} style="stroke" strokeWidth={0.9} color={alpha(INK, 0.3)} />
        </Group>
      </Canvas>
      {/* The card, for the screen reader: its activate reads the line at once. */}
      <View
        style={{ position: "absolute", left: ox, top: TOP, width: cardW, height: cardH }}
        pointerEvents="none"
        accessible
        accessibilityRole="button"
        accessibilityLabel={labels.label}
        accessibilityActions={[{ name: "activate" }]}
        onAccessibilityAction={() => {
          held.set(true);
          shown.set(1);
          onRead();
        }}
        testID="v2-reveal-page"
      />
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: 2 * R + 36, height: 2 * R + 36 }, handle]} testID="v2-reveal-gel" />
      </GestureDetector>
    </View>
  );
}

/** The lens's fixed drawing about its centre: the glass's shine, and the ring-pull it's carried by. */
const lensArt = once(() => ({
  shine: Skia.Path.MakeFromSVGString(`M${-R * 0.72} ${-R * 0.2} A${R * 0.76} ${R * 0.76} 0 0 1 ${-R * 0.16} ${-R * 0.73}`)!,
  glint: Skia.Path.MakeFromSVGString(`M${R * 0.5} ${R * 0.52} A${R * 0.74} ${R * 0.74} 0 0 0 ${R * 0.66} ${R * 0.3}`)!,
  pull: (() => {
    const b = Skia.PathBuilder.Make();
    const d = (R + RING + 11) * Math.SQRT1_2;
    b.addCircle(d, d, 10);
    return b.detach();
  })(),
}));

interface Noise {
  /** Rows of letters set across the card, on and between the writing's own lines. */
  rows: { text: string; x: number; y: number; rot: number }[];
  /** Loose letters turned any way. */
  loose: { ch: string; x: number; y: number; rot: number; scale: number }[];
  /** Scribble and hatching. */
  scribble: ReturnType<typeof Skia.Path.MakeFromSVGString>;
}

/** The jumble overprinted in red: the same for the same card. */
function jumble(seed: string, ox: number, top: number, w: number, h: number, wy: number, size: number, lineHeight: number): Noise {
  let n = 11;
  for (const ch of seed) n = (n * 31 + ch.charCodeAt(0)) % 9973;
  const r = () => {
    n = (n * 9301 + 49297) % 233280;
    return n / 233280;
  };
  const letters = "ABDEFGHKMNPQRSTWXYZ23456789&?";
  const pick = () => letters[Math.floor(r() * letters.length)];
  const rows: Noise["rows"] = [];
  const pitch = lineHeight / 2;
  // On the writing's baselines and half way between, up and down the whole card.
  const first = wy + size - Math.ceil((wy + size - top - 26) / pitch) * pitch;
  for (let y = first; y < top + h - 14; y += pitch) {
    const count = Math.ceil((w - 40) / (size * 0.52));
    let text = "";
    for (let i = 0; i < count; i++) text += r() < 0.14 ? " " : pick();
    rows.push({ text, x: ox + 20 + r() * 8, y: y + (r() - 0.5) * 3, rot: (r() - 0.5) * 0.03 });
  }
  const loose: Noise["loose"] = Array.from({ length: 26 }, () => ({ ch: pick(), x: ox + 26 + r() * (w - 60), y: top + 34 + r() * (h - 52), rot: (r() - 0.5) * 1.6, scale: 0.8 + r() * 0.9 }));
  const b = Skia.PathBuilder.Make();
  for (let i = 0; i < 16; i++) {
    let x = ox + 22 + r() * (w * 0.4);
    let y = top + 24 + r() * (h - 48);
    b.moveTo(x, y);
    const steps = 4 + Math.floor(r() * 5);
    for (let k = 0; k < steps; k++) {
      const nx = x + 14 + r() * 26;
      const ny = Math.min(top + h - 20, Math.max(top + 20, y + (r() - 0.5) * 30));
      b.quadTo((x + nx) / 2 + (r() - 0.5) * 16, (y + ny) / 2 + (r() - 0.5) * 26, Math.min(ox + w - 20, nx), ny);
      x = nx;
      y = ny;
    }
  }
  return { rows, loose, scribble: b.detach() };
}

/** The jumble, drawn (its paint is the Group's it's in). */
function Jumble({ noise, font, setting }: { noise: Noise; font: SkFont; setting: Setting }) {
  return (
    <Group>
      {noise.rows.map((row, i) => (
        <Group key={i} origin={{ x: row.x, y: row.y }} transform={[{ rotate: row.rot }]} opacity={0.86}>
          <Text x={row.x} y={row.y} text={row.text} font={font} />
        </Group>
      ))}
      {noise.loose.map((g, i) => (
        <Group key={i} origin={{ x: g.x, y: g.y }} transform={[{ rotate: g.rot }, { scale: g.scale }]} opacity={0.8}>
          <Text x={g.x} y={g.y} text={g.ch} font={font} />
        </Group>
      ))}
      {noise.scribble ? <Path path={noise.scribble} style="stroke" strokeWidth={Math.max(1.6, setting.lineHeight * 0.07)} strokeCap="round" opacity={0.7} /> : null}
    </Group>
  );
}
