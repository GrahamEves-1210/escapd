// The typewriter ribbon: a nickel spool standing on the desk, wound with a black-over-red ribbon, a metal
// clip on the ribbon's end. The player takes the clip and pulls the ribbon out to the right: the spool
// turns, the ribbon comes off the front of the winding, and the last line typed shows on it where the
// type bars knocked the ink out: pale letter shapes in the black, back to front and running right to
// left, as a used ribbon carries them. Its first letter comes out first, by the clip; the rest follow from
// the spool. The ribbon stays where it's left and winds back the same way. It is read once the whole line
// is out. Nothing turns the letters round: reading them backwards is the puzzle.
//
// The spool, its turning top flange (frames) and the clip are rendered pictures (props.ts). The ribbon,
// its weave and sheen, the struck letters (the typewriter's face, set by ink.tsx, drawn mirrored) and the
// older typing gone over and over beyond the line are drawn live. Reduced motion, or a screen reader's
// activate, has the line out at once.
import { useEffect } from "react";
import { View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { Easing, ReduceMotion, useDerivedValue, useSharedValue, withTiming } from "react-native-reanimated";
import { BlurMask, Canvas, ColorMatrix, FractalNoise, Group, Image, Line, LinearGradient, Rect, Text, rect, vec } from "@shopify/react-native-skia";
import { scheduleOnRN } from "react-native-worklets";
import { alpha } from "@/theme/payoff";

import { SMOOTH, useArt, useWriting, Written } from "./ink";
import { RIBBON } from "./props";
import { filler, isShort } from "./revealText";
import type { SheetProps } from "./sheet";
import { flangeFrame, LEADER, pullToRead } from "./tune";

/** The ribbon's two inks as the spool's picture has them where the ribbon leaves it, and the letters struck out of them. */
const BLACK = RIBBON.black;
const RED = RIBBON.red;
const STRUCK = "#A9A29B";
const TOP = 14;
/** The spool stands at the screen's left edge, a third of it off: the room is the ribbon's. */
const LEFT = -46;
/** How much ribbon is out before any pull (the clip hangs just clear of the flange), and how much the flange hides. */
const OUT = RIBBON.flangeR + 18;
const HIDDEN = RIBBON.flangeR + 4;
/** The whole scene is drawn this much over the pictures' size: the letters are to be read backwards, so they are large. */
const SCALE = 1.15;
/** Ink into alpha: the weave's darker threads, multiplied in. */
const weave = [0.5, 0, 0, 0, 0.74, 0.5, 0, 0, 0, 0.74, 0.5, 0, 0, 0, 0.74, 0, 0, 0, 0, 1];

export function RibbonSheet({ text, title, width, shown, reduced, onRead, feedback, labels }: SheetProps) {
  // The line as typed, on one line.
  const line = text.replace(/\s+/g, " ").trim();
  const size = isShort(line) ? 26 : 20;
  const writing = useWriting(line, title, size, 6000, "typed", "left", 0.35);
  // The line's own length (the setting's width is the room it was given): to its last word's end.
  const lineW = writing ? writing.setting.words.reduce((w, p) => Math.max(w, p.x + p.w), 0) : line.length * size * 0.6;
  const ready = writing !== null;
  const read = pullToRead(lineW, OUT, HIDDEN);
  const most = read + 36;

  const spool = useArt(RIBBON.spool);
  const flange = useArt(RIBBON.flange);
  const clip = useArt(RIBBON.clip);
  const sceneH = (TOP + RIBBON.h + 6) * SCALE;
  // The canvas is drawn SCALE up: everything below is in the pictures' own points, the screen `across` of them wide.
  const across = width / SCALE;
  const leaves = LEFT + RIBBON.leaves.x;
  const bandTop = TOP + RIBBON.leaves.top;
  const bandH = RIBBON.leaves.bottom - RIBBON.leaves.top;
  const blackH = Math.round(bandH * (1 - RIBBON.redShare));

  // How far it's been pulled (points), where the drag took hold, how far since the spool last ticked.
  const pulled = useSharedValue(0);
  const grip = useSharedValue(0);
  const ticked = useSharedValue(0);
  const held = useSharedValue(reduced);
  // Out at once (reduced motion; once the face has set the line and its length is known).
  useEffect(() => {
    if (reduced && writing) pulled.set(read);
  }, [reduced, writing, read, pulled]);

  const tick = () => feedback.tick();
  const pan = usePanGesture({
    minDistance: 0,
    maxPointers: 1,
    testID: "v2-reveal-pan",
    onBegin: () => {
      "worklet";
      grip.set(pulled.get());
    },
    onUpdate: (e) => {
      "worklet";
      const p = Math.min(most, Math.max(0, grip.get() + e.translationX / SCALE));
      pulled.set(p);
      // The spool's ratchet: a tick every so much ribbon.
      if (Math.abs(p - ticked.get()) > 26) {
        ticked.set(p);
        scheduleOnRN(tick);
      }
      // How much of the line is out (Reveal reads this as the sheet being worked: no hint comes up over a ribbon being pulled).
      if (!held.get()) shown.set(Math.min(0.95, (0.95 * p) / Math.max(1, read)));
      if (ready && p >= read && !held.get()) {
        held.set(true);
        shown.set(withTiming(1, { duration: 360, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }));
        scheduleOnRN(onRead);
      }
    },
  });
  const readNow = () => {
    pulled.set(read);
    held.set(true);
    shown.set(1);
    onRead();
  };

  // The ribbon from the winding to its clip; the line on it, measured back from the clip; the spool's turn.
  const end = useDerivedValue(() => leaves + OUT + pulled.get());
  const band = useDerivedValue(() => rect(leaves, bandTop - 1, end.get() - leaves, bandH + 2));
  const bandW = useDerivedValue(() => end.get() - leaves);
  const shadeW = useDerivedValue(() => Math.max(0, end.get() - leaves - RIBBON.flangeR + 14));
  const mirrored = useDerivedValue(() => [{ translateX: end.get() - LEADER }, { scaleX: -1 }]);
  const clipAt = useDerivedValue(() => [{ translateX: end.get() - RIBBON.clipEnd.x }, { translateY: bandTop - RIBBON.clipTop }]);
  const fx = LEFT + RIBBON.axis.x - RIBBON.flangeCentre.x;
  const fy = TOP + RIBBON.axis.y - RIBBON.flangeCentre.y;
  const frameX = useDerivedValue(() => fx - (flangeFrame(pulled.get(), RIBBON.radius, RIBBON.frames) % RIBBON.columns) * RIBBON.flangeW);
  const frameY = useDerivedValue(() => fy - Math.floor(flangeFrame(pulled.get(), RIBBON.radius, RIBBON.frames) / RIBBON.columns) * RIBBON.flangeH);
  const rows = Math.ceil(RIBBON.frames / RIBBON.columns);
  const baseline = bandTop + (size > 22 ? 26 : 22);
  // Older typing, further in: lines gone over and over each other, nothing to read. It starts a little after the line ends.
  const older = [filler(title, 41), filler(title, 42)];

  return (
    <View style={{ width, height: sceneH }} pointerEvents="box-none">
      <Canvas style={{ width, height: sceneH }} pointerEvents="none">
        <Group transform={[{ scale: SCALE }]}>
        {spool ? <Image image={spool} x={LEFT} y={TOP} width={RIBBON.w} height={RIBBON.h} fit="fill" sampling={SMOOTH} /> : null}
        {/* The ribbon's shadow on the desk under it. */}
        <Rect x={leaves + RIBBON.flangeR - 14} y={bandTop + bandH + 20} width={shadeW} height={9} color={alpha("#000000", 0.34)}>
          <BlurMask blur={7} style="normal" />
        </Rect>
        {/* The ribbon: black over red, its weave, a sheen along it, darker where it comes out from under the flange. */}
        <Group clip={band}>
          <Rect x={leaves} y={bandTop} width={bandW} height={blackH} color={BLACK} />
          <Rect x={leaves} y={bandTop + blackH} width={bandW} height={bandH - blackH} color={RED} />
          <Rect x={leaves} y={bandTop} width={bandW} height={bandH} opacity={0.5} blendMode="multiply">
            <FractalNoise freqX={0.9} freqY={1.6} octaves={2} seed={17} tileWidth={0} tileHeight={0} />
            <ColorMatrix matrix={weave} />
          </Rect>
          {writing ? (
            <Group transform={mirrored}>
              <Group color={alpha(STRUCK, 0.2)}>
                {older.map((words, i) => (
                  <Text key={i} x={lineW + 26 + i * 7} y={baseline + (i ? 3 : -2)} text={words} font={writing.font} />
                ))}
              </Group>
              {/* The line: each letter a pale shape where the ink was knocked out, soft at its edge. */}
              <Group color={alpha(STRUCK, 0.3)} style="stroke" strokeWidth={1.6}>
                <Written words={writing.setting.words} font={writing.font} size={size} x={0} y={baseline - size} />
              </Group>
              <Group color={alpha(STRUCK, 0.92)}>
                <Written words={writing.setting.words} font={writing.font} size={size} x={0} y={baseline - size} />
              </Group>
            </Group>
          ) : null}
          <Rect x={leaves} y={bandTop} width={bandW} height={bandH}>
            <LinearGradient start={vec(0, bandTop)} end={vec(0, bandTop + bandH)} colors={[alpha("#FFFFFF", 0.1), alpha("#FFFFFF", 0.02), alpha("#000000", 0), alpha("#000000", 0.22)]} positions={[0, 0.2, 0.6, 1]} />
          </Rect>
          <Rect x={leaves} y={bandTop} width={RIBBON.flangeR + 26} height={bandH}>
            <LinearGradient start={vec(leaves, 0)} end={vec(leaves + RIBBON.flangeR + 26, 0)} colors={[alpha("#000000", 0.5), alpha("#000000", 0)]} />
          </Rect>
          <Line p1={vec(leaves, bandTop + 0.6)} p2={vec(across + 40, bandTop + 0.6)} color={alpha("#000000", 0.5)} strokeWidth={1.2} />
          <Line p1={vec(leaves, bandTop + bandH - 0.6)} p2={vec(across + 40, bandTop + bandH - 0.6)} color={alpha("#000000", 0.5)} strokeWidth={1.2} />
        </Group>
        {/* The top flange, over the ribbon where it leaves the winding: the picture for how far the spool has turned. */}
        {flange ? (
          <Group clip={rect(fx, fy, RIBBON.flangeW, RIBBON.flangeH)}>
            <Image image={flange} x={frameX} y={frameY} width={RIBBON.flangeW * RIBBON.columns} height={RIBBON.flangeH * rows} fit="fill" sampling={SMOOTH} />
          </Group>
        ) : null}
        {/* The clip on the ribbon's end. */}
        <Group transform={clipAt}>
          <Rect x={8} y={RIBBON.clipH + 4} width={RIBBON.clipW - 12} height={7} color={alpha("#000000", 0.3)}>
            <BlurMask blur={5} style="normal" />
          </Rect>
          {clip ? <Image image={clip} x={0} y={0} width={RIBBON.clipW} height={RIBBON.clipH} fit="fill" sampling={SMOOTH} /> : null}
        </Group>
        </Group>
      </Canvas>
      {/* The spool, for the screen reader: its activate has the line out at once. */}
      <View
        style={{ position: "absolute", left: 0, top: TOP * SCALE, width: (RIBBON.w + LEFT) * SCALE, height: RIBBON.h * SCALE }}
        pointerEvents="none"
        accessible
        accessibilityRole="button"
        accessibilityLabel={labels.label}
        accessibilityActions={[{ name: "activate" }]}
        onAccessibilityAction={readNow}
        testID="v2-reveal-page"
      />
      <GestureDetector gesture={pan}>
        <View style={{ position: "absolute", left: 0, top: (bandTop - 26) * SCALE, width, height: (bandH + 52) * SCALE }} testID="v2-reveal-ribbon" />
      </GestureDetector>
    </View>
  );
}
