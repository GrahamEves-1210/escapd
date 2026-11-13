// The music box: a small walnut box, its lid thrown open, seen from above. A brass cylinder with four
// pins lies over a steel comb of six teeth, long for the low notes to short for the high, each engraved
// with one of the door's wheel marks. The player turns the crank (a finger round its pivot): the
// cylinder turns, geared down, and each pin comes round to the comb and plucks the tooth in its column.
// The tooth is lifted, let go and rings (its edge shivers, its mark glints) and its note sounds. The
// four notes in their order are what the box has to say; it says it again for as long as it is cranked,
// and it can be read with the sound off: which column each pin is in, which tooth it plucks.
//
// The box and the crank's arm are rendered pictures (props.ts). The pins, the cylinder's seam, the
// ringing teeth and the glints are drawn live. Reduced motion, or a screen reader's activate, turns the
// cylinder to where all four pins lie in view at once, the first nearest the comb, their teeth's marks lit.
import { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { Easing, ReduceMotion, useDerivedValue, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { BlurMask, Canvas, Circle, Group, Image, Line, Path, RadialGradient, RoundedRect, Skia, vec, type SkImage } from "@shopify/react-native-skia";
import { scheduleOnRN } from "react-native-worklets";
import { alpha } from "@/theme/payoff";

import { once, SMOOTH, useArt } from "./ink";
import { MUSICBOX } from "./props";
import { SYMBOL } from "./revealText";
import type { SheetProps } from "./sheet";
import { crankStep, GEAR, LEAD_IN, NOTE_STEP, parkedTurn, pinAngle, plucks, PLUCK_AT, TUNE_MARKS, tuneOf } from "./tune";

const INK = "#1E1418";
const TOP = 8;
/** The square round the crank's pivot a finger can turn it from (in the picture's points). */
const REACH = 2 * (MUSICBOX.arm + 38);
/** How long a plucked tooth rings (ms), and how far from plucking a pin starts to lift its tooth (degrees). */
const RING_MS = 950;
const LIFT_FROM = 20;
const C = MUSICBOX.cyl;

export function TuneSheet({ text, width, shown, reduced, onRead, feedback, labels }: SheetProps) {
  const notes = useMemo(() => tuneOf(text), [text]);
  // The box fills the screen's width (a little over its picture's size on a wide phone, under it on a narrow one).
  const k = Math.min(1.1, (width - 16) / MUSICBOX.w);
  const ox = (width - MUSICBOX.w * k) / 2;
  const sceneH = TOP + MUSICBOX.h * k + 10;
  const box = useArt(MUSICBOX.art);
  const arm = useArt(MUSICBOX.crank);

  // How far the cylinder has turned (degrees, forward only), and the crank's arm (radians, wherever the finger has it).
  const turn = useSharedValue(reduced ? parkedTurn(notes.length) : 0);
  const crank = useSharedValue(-0.7);
  const last = useSharedValue(0);
  const held = useSharedValue(reduced);
  // Each tooth's ring (1 as it's plucked, dying away), and the marks held lit when the tune is shown still.
  const r0 = useSharedValue(0);
  const r1 = useSharedValue(0);
  const r2 = useSharedValue(0);
  const r3 = useSharedValue(0);
  const r4 = useSharedValue(0);
  const r5 = useSharedValue(0);
  const rings = useMemo(() => [r0, r1, r2, r3, r4, r5], [r0, r1, r2, r3, r4, r5]);
  const still = useSharedValue(reduced ? 1 : 0);

  const sound = (tooth: number) => feedback.musicNote(tooth);
  const pan = usePanGesture({
    minDistance: 0,
    maxPointers: 1,
    testID: "v2-reveal-pan",
    onBegin: (e) => {
      "worklet";
      const c = (REACH * k) / 2;
      last.set(Math.atan2(e.y - c, e.x - c));
    },
    onUpdate: (e) => {
      "worklet";
      const c = (REACH * k) / 2;
      // Too near the pivot a finger has no angle to speak of.
      if (Math.hypot(e.x - c, e.y - c) < 9 * k) return;
      const at = Math.atan2(e.y - c, e.x - c);
      const d = crankStep(last.get(), at);
      last.set(at);
      crank.set(crank.get() + d);
      // The worm only drives one way: turned back, the arm comes round and the cylinder stays.
      if (d <= 0) return;
      const before = turn.get();
      const after = before + ((d * 180) / Math.PI) * GEAR;
      turn.set(after);
      // How far through its first playing (Reveal reads this as the sheet being worked: no hint comes up over a turning crank).
      if (!held.get()) shown.set(Math.min(0.9, (0.9 * after) / (LEAD_IN + (notes.length - 1) * NOTE_STEP)));
      if (still.get() > 0) still.set(withTiming(0, { duration: 300, reduceMotion: ReduceMotion.Never }));
      for (let j = 0; j < notes.length; j++) {
        if (plucks(j, after) === plucks(j, before)) continue;
        const ring = rings[notes[j]];
        ring.set(1);
        ring.set(withTiming(0, { duration: RING_MS, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }));
        scheduleOnRN(sound, notes[j]);
        // The last pin's note: the tune has been played through.
        if (j === notes.length - 1 && !held.get()) {
          held.set(true);
          shown.set(withTiming(1, { duration: 400, reduceMotion: ReduceMotion.Never }));
          scheduleOnRN(onRead);
        }
      }
    },
  });

  // Read at once (a screen reader): the cylinder turned to show the whole tune, and the tune played, a note at a time.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const readNow = () => {
    turn.set(parkedTurn(notes.length));
    still.set(1);
    held.set(true);
    shown.set(1);
    onRead();
    notes.forEach((tooth, j) => timers.current.push(setTimeout(() => feedback.musicNote(tooth, false), 250 + j * 420)));
  };

  const place = useMemo(() => [{ translateX: ox }, { translateY: TOP }, { scale: k }], [ox, k]);
  const armAt = useDerivedValue(() => [{ translateX: MUSICBOX.pivot.x }, { translateY: MUSICBOX.pivot.y }, { rotate: crank.get() }]);
  const armShade = useDerivedValue(() => [{ translateX: MUSICBOX.pivot.x + 2.5 }, { translateY: MUSICBOX.pivot.y + 4 }, { rotate: crank.get() }]);

  return (
    <View style={{ width, height: sceneH }} pointerEvents="box-none">
      <Canvas style={{ width, height: sceneH }} pointerEvents="none">
        <Group transform={place}>
          {box ? <Image image={box} x={0} y={0} width={MUSICBOX.w} height={MUSICBOX.h} fit="fill" sampling={SMOOTH} /> : null}
          {/* The cylinder's own marks as it turns: its seam, then the pins, each in the column of the tooth it plucks. */}
          <Seam turn={turn} />
          {notes.map((tooth, j) => (
            <Pin key={j} j={j} tooth={tooth} turn={turn} />
          ))}
          {/* The teeth as they're lifted, let go and ring; their marks' glint. */}
          {box ? TUNE_MARKS.map((_, tooth) => <Tooth key={tooth} tooth={tooth} notes={notes} turn={turn} ring={rings[tooth]} still={still} art={box} />) : null}
          {/* The crank: its shadow in the box, its arm and knob round the pivot. */}
          <Group transform={armShade}>
            <RoundedRect x={-7} y={-6} width={MUSICBOX.arm + 20} height={13} r={6.5} color={alpha("#000000", 0.42)}>
              <BlurMask blur={3} style="normal" />
            </RoundedRect>
          </Group>
          <Group transform={armAt}>
            {arm ? <Image image={arm} x={-MUSICBOX.crankPivot.x} y={-MUSICBOX.crankPivot.y} width={MUSICBOX.crankW} height={MUSICBOX.crankH} fit="fill" sampling={SMOOTH} /> : null}
          </Group>
        </Group>
      </Canvas>
      {/* The box, for the screen reader: its activate shows and plays the tune at once. */}
      <View
        style={{ position: "absolute", left: ox, top: TOP, width: MUSICBOX.w * k, height: MUSICBOX.h * k }}
        pointerEvents="none"
        accessible
        accessibilityRole="button"
        accessibilityLabel={labels.label}
        accessibilityActions={[{ name: "activate" }]}
        onAccessibilityAction={readNow}
        testID="v2-reveal-page"
      />
      <GestureDetector gesture={pan}>
        <View
          style={{ position: "absolute", left: ox + (MUSICBOX.pivot.x - REACH / 2) * k, top: TOP + (MUSICBOX.pivot.y - REACH / 2) * k, width: REACH * k, height: REACH * k }}
          testID="v2-reveal-crank"
        />
      </GestureDetector>
    </View>
  );
}

/** Where a place round the cylinder is seen from above: how far down its face, how foreshortened, how nearly gone over its edge. */
function seen(angle: number): { y: number; flat: number; clear: number } {
  "worklet";
  const a = (angle * Math.PI) / 180;
  const inView = Math.abs(angle) < 90;
  return { y: C.y + C.r * Math.sin(a), flat: inView ? Math.max(0.12, Math.cos(a)) : 0, clear: inView ? Math.min(1, (90 - Math.abs(angle)) / 12) : 0 };
}

/** One pin: a brass stud on the cylinder, in its tooth's column, carried round as the cylinder turns. */
function Pin({ j, tooth, turn }: { j: number; tooth: number; turn: SharedValue<number> }) {
  const [x0, x1] = MUSICBOX.columns[tooth];
  const x = (x0 + x1) / 2;
  const at = useDerivedValue(() => {
    const s = seen(pinAngle(j, turn.get()));
    return [{ translateX: x }, { translateY: s.y }, { scaleY: s.flat }];
  });
  const clear = useDerivedValue(() => seen(pinAngle(j, turn.get())).clear);
  return (
    <Group transform={at} opacity={clear}>
      <Circle cx={1.6} cy={2.2} r={4.8} color={alpha("#000000", 0.5)}>
        <BlurMask blur={1.6} style="normal" />
      </Circle>
      <Circle cx={0} cy={0} r={4.5}>
        <RadialGradient c={vec(-1.4, -1.7)} r={6.4} colors={["#FFF6D8", "#E0AC4C", "#7A4E16"]} />
      </Circle>
      <Circle cx={0} cy={0} r={4.5} style="stroke" strokeWidth={1} color={INK} />
    </Group>
  );
}

/** The cylinder's seam, in the bare stretch between the tune's last pin and its first: what shows it turning when no pin is in view. */
function Seam({ turn }: { turn: SharedValue<number> }) {
  const at = useDerivedValue(() => [{ translateY: seen(pinAngle(0, turn.get() + 105)).y }]);
  const clear = useDerivedValue(() => seen(pinAngle(0, turn.get() + 105)).clear);
  return (
    <Group transform={at} opacity={clear}>
      <Line p1={vec(C.x0 + 5, 0)} p2={vec(C.x1 - 5, 0)} color={alpha("#3A2208", 0.55)} strokeWidth={1.1} />
      <Line p1={vec(C.x0 + 5, 1.1)} p2={vec(C.x1 - 5, 1.1)} color={alpha("#FFE9B0", 0.35)} strokeWidth={0.7} />
    </Group>
  );
}

/** The marks as a pen draws them (revealText.SYMBOL), for the glint on a plucked tooth. */
const marks = once(() => TUNE_MARKS.map((m) => Skia.Path.MakeFromSVGString(SYMBOL[m])!));

/**
 * One tooth of the comb over its picture: lifted as its pin comes to it (its tip catches the light), let go
 * (its edge shivers: the picture's own tooth again, a hair off), its engraved mark glinting as it rings.
 */
function Tooth({ tooth, notes, turn, ring, still, art }: { tooth: number; notes: number[]; turn: SharedValue<number>; ring: SharedValue<number>; still: SharedValue<number>; art: SkImage }) {
  const [x0, x1] = MUSICBOX.columns[tooth];
  const cx = (x0 + x1) / 2;
  const root = MUSICBOX.roots[tooth];
  const mine = useMemo(() => notes.map((t, j) => (t === tooth ? j : -1)).filter((j) => j >= 0), [notes, tooth]);
  const shape = useMemo(() => Skia.XYWHRect(x0 - 1, MUSICBOX.tip, x1 - x0 + 2, root - MUSICBOX.tip), [x0, x1, root]);
  // How far its pin has it lifted (0..1): from LIFT_FROM degrees short of the edge to the edge.
  const lift = useDerivedValue(() => {
    let most = 0;
    for (const j of mine) {
      const short = PLUCK_AT - pinAngle(j, turn.get());
      if (short >= 0 && short < LIFT_FROM) most = Math.max(most, 1 - short / LIFT_FROM);
    }
    return most;
  });
  const shiver = useDerivedValue(() => [{ translateY: -1.4 * lift.get() + Math.sin(ring.get() * 46) * 2.4 * ring.get() }]);
  const ghost = useDerivedValue(() => Math.min(0.85, lift.get() * 0.5 + ring.get() * 1.2));
  const edge = useDerivedValue(() => Math.min(1, lift.get() * 0.8 + ring.get()));
  const glint = useDerivedValue(() => Math.max(Math.pow(ring.get(), 0.6), mine.length > 0 ? still.get() * 0.6 : 0));
  const size = MUSICBOX.mark;
  const markAt = [{ translateX: cx - size / 2 }, { translateY: MUSICBOX.markY - size / 2 }, { scale: size / 24 }];
  return (
    <Group>
      <Group clip={shape} opacity={ghost}>
        <Group transform={shiver}>
          <Image image={art} x={0} y={0} width={MUSICBOX.w} height={MUSICBOX.h} fit="fill" sampling={SMOOTH} />
        </Group>
      </Group>
      <Line p1={vec(x0 + 3, MUSICBOX.tip + 1.2)} p2={vec(x1 - 3, MUSICBOX.tip + 1.2)} color="#FFFFFF" strokeWidth={1.4} strokeCap="round" opacity={edge} />
      <Group opacity={glint} blendMode="screen">
        <Circle cx={cx} cy={MUSICBOX.markY} r={size * 0.95} color={alpha("#FFE3A6", 0.5)}>
          <BlurMask blur={5} style="normal" />
        </Circle>
        <Path path={marks()[tooth]} transform={markAt} color="#FFF4D6" />
      </Group>
    </Group>
  );
}
