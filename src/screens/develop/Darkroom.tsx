// 06 · The darkroom: the build wait's one visual. A walnut bench under a red
// safelight, seen from above (assets/develop, rendered by
// scripts/blender/props/darkroom_*.py): an enamel tray of developer, tongs, a
// bottle, the brass safelight, and a drying line with wooden pegs strung
// across the top. The player's own photos are the prints.
//
// Nothing here measures or claims progress the screen doesn't have. Each
// print's state is one the server reported:
//   - a photo sent: its sheet is laid in the tray, blank (`sent`);
//   - queued, or trying again: the sheets lie blank in the bath;
//   - building (`developing`): their pictures come up, one after another;
//   - ready (`ready`): each is lifted out, pegged on the line, and the lights
//     come up on them in their own colours.
// What moves in between is only the room: the tray rocks (a drag rocks it by
// hand), the light slides on the liquid, the prints are shuffled bottom to
// top, the safelight breathes, a hung print drips. No timer stands in for a
// stage.
//
// How a photo lies in the tray: the bench is shot straight on from SCENE.elev
// above, so a sheet lying flat is a rectangle squashed by SCENE.squash, and a
// photo is laid into it with one transform (scaleY, then its turn). Under the
// safelight it is drawn as the silver image it is (Skia, one colour matrix:
// safelit.ts); the photo itself is under it and shows when the print leaves
// the red light. The light on the liquid (twelve frames at 6 a second,
// stop-motion like the cat) is drawn over the prints, so they sit under it.
//
// Performance: everything that moves is a transform or an opacity on the UI
// thread, off one frame callback; nothing re-renders per frame.
//
// Reduced motion: nothing rocks, slides, pulses or drips. The sheets appear,
// their pictures fade up, the pile changes by a fade, and at ready the prints
// are simply on the line.
//
// With no photos on this phone (a case followed from home after the app
// restarted), one sheet with the mode's drawn cover on it; in the shell, the
// tray alone.
//
// Decorative: hidden from screen readers (the status line carries the status).
// The cat is the caller's (`children`): it sits behind the bench, outside the
// hidden frame, so it can still be petted.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Canvas, Image as SkiaImage } from "@shopify/react-native-skia";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { useCapturePalette } from "@/capture/ui/palette";
import { TreatedImage } from "@/components/noir";
import { useModeTheme } from "@/game/mode";
import type { Genre } from "@/lib/puzzle-types";
import type { CatLook } from "@/play2/PeekingCat";
import { ModeCover } from "@/screens/hub/art/ModeCover";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { useSafelit } from "./safelit";

const D = ref.layout.develop;
const BAKE = ref.layout.review.tile.bake;

const ART = {
  bench: require("../../../assets/develop/bench.png") as number,
  tray: require("../../../assets/develop/tray.png") as number,
  sheen: require("../../../assets/develop/sheen.png") as number,
  line: require("../../../assets/develop/line.png") as number,
  print: require("../../../assets/develop/print.png") as number,
  wet: require("../../../assets/develop/print-wet.png") as number,
  blank: require("../../../assets/develop/print-blank.png") as number,
  peg: require("../../../assets/develop/peg.png") as number,
};
/** A peg with its handles dipped in the mode's accent: the mode's one mark on the room. */
const DIPPED: Record<Genre | "shell", number> = {
  noir: require("../../../assets/develop/peg-noir.png") as number,
  crime_scene: require("../../../assets/develop/peg-crime-scene.png") as number,
  paranormal: require("../../../assets/develop/peg-paranormal.png") as number,
  shell: require("../../../assets/develop/peg-shell.png") as number,
};

/**
 * The scene, in points on a `width` x `height` stage (the numbers the render
 * scripts print). The bench picture `pic` sits on the stage's foot, centred
 * (it is wider than the stage, so the frame crops it); the line hangs from the
 * top. `edge`: the bench's back edge, `liquid`: the liquid's middle and half
 * extents, `glass`: the safelight's glass, all in the bench picture. `sheet`:
 * a sheet of paper lying in the tray, before the squash; `dry`: one on the line.
 */
export const SCENE = {
  width: 358,
  height: 432,
  pic: { w: 440, h: 320 },
  edge: 60,
  tray: { x: 220, y: 195 },
  liquid: { x: 220, y: 186.28, hw: 140.2, hd: 74.5, corner: 26 },
  squash: 0.788,
  unit: 120,
  glass: { x: 110.77, y: 64.61, r: 124 },
  sheet: { w: 120, h: 155.2, border: 7.2, margin: 2 },
  dry: { w: 58, h: 75, pic: { w: 62, h: 79 }, margin: 2 },
  sheen: { w: 288, h: 158, columns: 4, rows: 3, count: 12 },
  line: { w: 440, h: 22, at: 25, top: 6, sag: 8 },
  peg: { w: 16, h: 40, grip: { x: 8, y: 30.02 }, bite: { x: 8, y: 35.45 } },
  cat: { w: 68, dx: 58, sink: 3 },
  // The ready seal's middle, below the bench's back edge (clear of the cat).
  seal: 98,
} as const;

/** How the room moves (ms, degrees, points on the 358-wide stage). */
export const DARK = {
  // The tray rocks `degrees` either way every `period`; a drag of `handPt` rocks it a degree, up to `hand`.
  rock: { degrees: 0.85, period: 5600, hand: 3.2, handPt: 22, slosh: 0.018 },
  // A sheet is laid in from `lift` above, over `ms`.
  drop: { ms: 560, lift: 22 },
  // A picture comes up over `rise`, each `stagger` after the one above it in the pile; it sinks back (trying again) over `sink`.
  develop: { rise: 5200, stagger: 800, sink: 900, ready: 320 },
  // The pile is shuffled every `every`: the top sheet slips under (`sink`), the rest slide up a place (`slide`), it shows again at the bottom (`rise`).
  shuffle: { every: 6800, sink: 420, slide: 1100, rise: 520 },
  // Ready: `first` in, the top print is lifted to its peg over `fly` (rising `arc` on the way), each next `stagger` later; it swings once on the peg.
  hang: { first: 60, stagger: 80, fly: 500, arc: 14, swing: [2.6, -1.6, 0.8, 0] as readonly number[], swingMs: 220 },
  // The safelight's glow breathes between `low` and `high` every `period`.
  pulse: { period: 4800, low: 0.62, high: 0.86 },
  // The light on the liquid steps at `fps` (half the cat's 12: slow water).
  sheen: { fps: 6, opacity: 0.9 },
  // A drop gathers under a hung print over `gather`, falls `fall` points over `drop`, and the next comes `every` later.
  drip: { gather: 1500, drop: 520, fall: 46, every: 3400 },
  // The veil over the line while the room is dark, and the lamp that comes up at ready.
  veil: { dark: 0.6, reach: 124, lamp: 0.2 },
} as const;

/** Where the sheets lie in the tray, top of the pile first: units from the liquid's middle (x right, y away), and their turn. Sheets below the last share it. */
export const SLOTS: readonly { x: number; y: number; turn: number }[] = [
  { x: 0.04, y: -0.02, turn: -3 },
  { x: -0.52, y: 0.04, turn: -9 },
  { x: 0.54, y: -0.03, turn: 8 },
  { x: -0.2, y: 0.07, turn: 5 },
  { x: 0.26, y: 0.05, turn: -6 },
];
/** How each print leans on its peg. */
const TILTS = [-2.4, 1.6, -1.2, 2.6, -1.8, 1.1, -2.2] as const;

/** A sheet whose print under the safelight can't be drawn (safelit.ts), and the mode's cover: a red wash over the picture. */
const WASH = "rgba(168, 22, 12, 0.6)";

export interface DarkroomPhoto {
  uri: string;
}

/** Which place in the pile print `index` has: the newest sent on top; `shift` shuffles since, each sending the top to the bottom. */
export function slotOf(index: number, sent: number, count: number, shift: number): number {
  if (sent < count) return Math.max(0, sent - 1 - index);
  return (((count - 1 - index - shift) % count) + count) % count;
}

/** The scene on a `width` x `height` stage: its scale, the bench picture's box, and where its anchors land. */
export function sceneLayout(width: number, height: number) {
  const s = Math.min(width / SCENE.width, height / SCENE.height);
  const pic = { left: (width - SCENE.pic.w * s) / 2, top: height - SCENE.pic.h * s, width: SCENE.pic.w * s, height: SCENE.pic.h * s };
  return {
    s,
    pic,
    edge: pic.top + SCENE.edge * s,
    liquid: { x: pic.left + SCENE.liquid.x * s, y: pic.top + SCENE.liquid.y * s },
    glass: { x: pic.left + SCENE.glass.x * s, y: pic.top + SCENE.glass.y * s },
  };
}

/** The line's height at `x` on a `width` stage: hung from beyond both edges, lowest in the middle. */
export function lineY(x: number, width: number, s: number): number {
  const t = (x - width / 2) / ((SCENE.line.w / 2) * s);
  return (SCENE.line.at + SCENE.line.top + SCENE.line.sag * (1 - t * t)) * s;
}

/** Where print `index` of `count` hangs: its peg's grip on the line, and its lean. They close up (and overlap) as the line fills. */
export function hangAt(index: number, count: number, width: number, s: number) {
  const pitch = count > 1 ? Math.min(70 * s, (width - (SCENE.dry.w + 28) * s) / (count - 1)) : 0;
  const x = width / 2 + (index - (count - 1) / 2) * pitch;
  return { x, y: lineY(x, width, s), tilt: TILTS[index % TILTS.length] };
}

type Layout = ReturnType<typeof sceneLayout> & { width: number; height: number };

/** A fade of `ms`: opacity, so it plays under reduced motion too. */
const faded = (ms: number) => ({ duration: ms, reduceMotion: ReduceMotion.Never });

export function Darkroom({ photos, sent, developing, ready, style, seal, children }: {
  photos: readonly DarkroomPhoto[];
  /** How many of the photos have been sent: that many sheets lie in the tray. */
  sent: number;
  /** The case is being built: the pictures come up. */
  developing: boolean;
  /** The case is ready: the prints are pegged on the line and the lights come up. */
  ready: boolean;
  /** The stage's place in the column (flex, min and max height). */
  style?: StyleProp<ViewStyle>;
  /** The ready seal: pressed onto the picture below the cat, over the tray. */
  seal?: ReactNode;
  /** The cat, given where to sit (its width and box) and what to watch. */
  children?: (seat: { width: number; look: CatLook }) => ReactNode;
}) {
  const palette = useCapturePalette();
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (size && size.width === width && size.height === height) return;
    setSize({ width, height });
  };
  const layout: Layout | null = useMemo(() => (size && size.height > 0 ? { ...sceneLayout(size.width, size.height), ...size } : null), [size]);

  // The sheets: the photos, or the mode's cover when there are none on this phone.
  const cover = photos.length === 0 && palette.genre !== null;
  const count = cover ? 1 : photos.length;
  const inTray = cover ? 1 : Math.min(sent, count);
  const all = count > 0 && inTray >= count;

  // The room's clock (ms) and the tray's rock (degrees): its own slow swing, plus the hand's.
  const clock = useSharedValue(0);
  const hand = useSharedValue(0);
  const rock = useSharedValue(0);
  const frames = useFrameCallback((frame) => {
    "worklet";
    clock.set(clock.get() + Math.min(frame.timeSincePreviousFrame ?? 0, 64));
    rock.set(DARK.rock.degrees * Math.sin((2 * Math.PI * clock.get()) / DARK.rock.period) + hand.get());
  }, !reducedMotion);
  useEffect(() => {
    frames.setActive(!reducedMotion);
  }, [reducedMotion, frames]);

  // The lights: 1 while the room is dark, 0 once they are up. They catch, stutter once, then come on (beam.flicker).
  const lights = useSharedValue(ready ? 0 : 1);
  useEffect(() => {
    const up = { duration: D.beam.lightsOn, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never };
    if (!ready || reducedMotion) {
      lights.set(withTiming(ready ? 0 : 1, up));
      return;
    }
    const [catchTo, catchMs, dipTo, dipMs] = D.beam.flicker;
    lights.set(withSequence(withTiming(catchTo, { duration: catchMs }), withTiming(dipTo, { duration: dipMs }), withTiming(0, up)));
  }, [ready, reducedMotion, lights]);

  // The pile's shuffle: the top sheet slips under and shows again at the bottom. Reduced motion: the whole pile fades to the next.
  const [shift, setShift] = useState(0);
  const [sinking, setSinking] = useState<number | "all" | null>(null);
  const shiftRef = useRef(0);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!all || ready || count < 2 || held) return;
    const sink = reducedMotion ? D.still.fade / 2 : DARK.shuffle.sink;
    let after: ReturnType<typeof setTimeout> | null = null;
    const id = setInterval(() => {
      const top = (((count - 1 - shiftRef.current) % count) + count) % count;
      setSinking(reducedMotion ? "all" : top);
      after = setTimeout(() => {
        shiftRef.current += 1;
        setShift(shiftRef.current);
        setSinking(null);
      }, sink);
    }, reducedMotion ? D.still.hold + D.still.fade : DARK.shuffle.every);
    return () => {
      clearInterval(id);
      if (after) clearTimeout(after);
      setSinking(null);
    };
  }, [all, ready, count, held, reducedMotion]);

  // A drag rocks the tray by hand; let go and it settles back into its own swing.
  const pan = usePanGesture({
    enabled: !reducedMotion && !ready,
    activeOffsetX: [-8, 8],
    failOffsetY: [-16, 16],
    maxPointers: 1,
    testID: "build-drag",
    onActivate: () => {
      "worklet";
      scheduleOnRN(setHeld, true);
    },
    onUpdate: (e) => {
      "worklet";
      hand.set(Math.max(-DARK.rock.hand, Math.min(DARK.rock.hand, e.translationX / DARK.rock.handPt)));
    },
    onDeactivate: () => {
      "worklet";
      hand.set(withSpring(0, { damping: 9, stiffness: 60 }));
      scheduleOnRN(setHeld, false);
    },
  });

  // The cat watches the tray: the newest print, its eyes going over and back with the liquid. Ready: it looks up.
  const [side, setSide] = useState(1);
  useEffect(() => {
    if (reducedMotion || ready) return;
    const id = setInterval(() => setSide((v) => -v), DARK.rock.period / 2);
    return () => clearInterval(id);
  }, [reducedMotion, ready]);
  const catWidth = layout ? Math.round(SCENE.cat.w * layout.s) : SCENE.cat.w;
  const catHeight = (catWidth * 585) / 560;
  const seat = layout ? { left: layout.width / 2 + SCENE.cat.dx * layout.s - catWidth / 2, top: layout.edge + SCENE.cat.sink * layout.s - catHeight } : null;
  const look: CatLook = !layout || !seat || ready ? null : {
    x: layout.liquid.x + (reducedMotion ? 0 : side * 34 * layout.s) - (seat.left + catWidth / 2),
    y: layout.liquid.y - (seat.top + catHeight / 2),
    from: "cat",
    quiet: true,
  };

  const tray = useAnimatedStyle(() => ({ transform: [{ rotate: `${rock.get()}deg` }] }));
  const sheenRock = useAnimatedStyle(() => ({ transform: [{ rotate: `${rock.get()}deg` }] }));
  const sheenFrame = useAnimatedStyle(() => {
    const { fps, opacity } = DARK.sheen;
    const { columns, count: n, w, h } = SCENE.sheen;
    const k = layout?.s ?? 1;
    const f = Math.floor((clock.get() * fps) / 1000) % n;
    return { opacity, transform: [{ translateX: -(f % columns) * w * k }, { translateY: -Math.floor(f / columns) * h * k }] };
  });
  const pulse = useAnimatedStyle(() => {
    const { low, high, period } = DARK.pulse;
    return { opacity: low + (high - low) * (0.5 + 0.5 * Math.sin((2 * Math.PI * clock.get()) / period)) };
  });
  const veil = useAnimatedStyle(() => ({ opacity: lights.get() }));
  const lamp = useAnimatedStyle(() => ({ opacity: 1 - lights.get() }));

  return (
    <View style={[styles.stage, style]}>
      <GestureDetector gesture={pan}>
        <View
          onLayout={onLayout}
          style={[styles.frame, { backgroundColor: palette.well }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          testID="build-room"
        >
          {layout ? (
            <>
              <Image source={ART.bench} style={[styles.abs, layout.pic]} contentFit="fill" testID="build-bench" />
              <Animated.View pointerEvents="none" style={[styles.abs, glowBox(layout), pulse]} testID="build-safelight">
                <Glow size={SCENE.glass.r * 2 * layout.s} />
              </Animated.View>
              <Animated.View style={[styles.abs, layout.pic, styles.trayPivot, tray]} testID="build-tray">
                <Image source={ART.tray} style={StyleSheet.absoluteFill} contentFit="fill" />
              </Animated.View>
              {Array.from({ length: count }, (_, i) => (
                <Print
                  key={i}
                  index={i}
                  count={count}
                  uri={cover ? null : photos[i].uri}
                  genre={palette.genre}
                  slot={slotOf(i, inTray, count, shift)}
                  inTray={i < inTray}
                  developing={developing}
                  ready={ready}
                  sinking={sinking === "all" || sinking === i}
                  layout={layout}
                  rock={rock}
                  reduced={reducedMotion}
                />
              ))}
              <Animated.View pointerEvents="none" style={[styles.abs, styles.sheen, sheenBox(layout), sheenRock]} testID="build-sheen">
                <Animated.View style={[{ width: SCENE.sheen.w * SCENE.sheen.columns * layout.s, height: SCENE.sheen.h * SCENE.sheen.rows * layout.s }, sheenFrame]} testID="build-sheen-frame">
                  <Image source={ART.sheen} style={StyleSheet.absoluteFill} contentFit="fill" />
                </Animated.View>
              </Animated.View>
              <Image
                source={ART.line}
                style={[styles.abs, styles.line, { left: (layout.width - SCENE.line.w * layout.s) / 2, top: SCENE.line.at * layout.s, width: SCENE.line.w * layout.s, height: SCENE.line.h * layout.s }]}
                contentFit="fill"
                testID="build-line"
              />
              <Animated.View pointerEvents="none" style={[styles.abs, styles.fill, styles.lamp, lamp]}>
                <Lamp width={layout.width} height={DARK.veil.reach * 1.5 * layout.s} tint={theme.glow} />
              </Animated.View>
              {Array.from({ length: count }, (_, i) => {
                const at = hangAt(i, count, layout.width, layout.s);
                const { peg } = SCENE;
                return (
                  <Image
                    key={i}
                    source={i % 2 ? DIPPED[palette.genre ?? "shell"] : ART.peg}
                    style={[styles.abs, styles.peg, { left: at.x - peg.grip.x * layout.s, top: at.y - peg.grip.y * layout.s, width: peg.w * layout.s, height: peg.h * layout.s }]}
                    contentFit="fill"
                    testID={`build-peg-${i}`}
                  />
                );
              })}
              <Animated.View pointerEvents="none" style={[styles.abs, styles.veil, { height: DARK.veil.reach * layout.s }, veil]} testID="build-beam">
                <Veil width={layout.width} height={DARK.veil.reach * layout.s} color={palette.well} />
              </Animated.View>
              {ready && !reducedMotion ? Array.from({ length: count }, (_, i) => (i % 3 === 1 || count === 1 ? <Drip key={i} index={i} count={count} layout={layout} /> : null)) : null}
              <View pointerEvents="none" style={[styles.rim, { borderColor: palette.rim }]} />
            </>
          ) : null}
        </View>
      </GestureDetector>
      {layout && seal ? (
        <View style={[styles.abs, styles.seal, { left: layout.width / 2, top: layout.edge + SCENE.seal * layout.s }]} pointerEvents="none">
          {seal}
        </View>
      ) : null}
      {seat && children ? (
        <View style={[styles.abs, seat]} pointerEvents="box-none" testID="build-cat">
          {children({ width: catWidth, look })}
        </View>
      ) : null}
    </View>
  );
}

const glowBox = (layout: Layout) => {
  const r = SCENE.glass.r * layout.s;
  return { left: layout.glass.x - r, top: layout.glass.y - r, width: r * 2, height: r * 2 };
};

const sheenBox = (layout: Layout) => {
  const { w, h } = SCENE.sheen;
  return {
    left: layout.liquid.x - (w / 2) * layout.s,
    top: layout.liquid.y - (h / 2) * layout.s,
    width: w * layout.s,
    height: h * layout.s,
    overflow: "hidden" as const,
    borderRadius: SCENE.liquid.corner * layout.s,
  };
};

/**
 * One sheet of photo paper: lying in the tray at its place in the pile
 * (`slot`), rocking with it; its picture blank until the case is building;
 * lifted to its peg on the line when the case is ready.
 */
function Print({ index, count, uri, genre, slot, inTray, developing, ready, sinking, layout, rock, reduced }: {
  index: number;
  count: number;
  /** The photo, or null for the mode's cover. */
  uri: string | null;
  genre: Genre | null;
  slot: number;
  inTray: boolean;
  developing: boolean;
  ready: boolean;
  sinking: boolean;
  layout: Layout;
  rock: SharedValue<number>;
  reduced: boolean;
}) {
  const { s } = layout;
  const pose = SLOTS[Math.min(slot, SLOTS.length - 1)];
  const deep = Math.max(0, slot - (SLOTS.length - 1));
  const drop = useSharedValue(inTray ? 1 : 0);
  const dev = useSharedValue(ready ? 1 : 0);
  const hung = useSharedValue(0);
  const swing = useSharedValue(0);
  const fade = useSharedValue(1);
  const px = useSharedValue(pose.x);
  const py = useSharedValue(pose.y);
  const turn = useSharedValue(pose.turn + deep * 4);
  // Laid in the tray when its photo has been sent.
  useEffect(() => {
    drop.set(inTray ? withTiming(1, { ...faded(DARK.drop.ms), easing: Easing.out(Easing.cubic) }) : 0);
  }, [inTray, drop]);

  // Its place in the pile.
  useEffect(() => {
    const to = { duration: reduced ? 0 : DARK.shuffle.slide, easing: Easing.inOut(Easing.cubic) };
    px.set(withTiming(pose.x, to));
    py.set(withTiming(pose.y, to));
    turn.set(withTiming(pose.turn + deep * 4, to));
  }, [pose, deep, reduced, px, py, turn]);

  // Slipping under the pile, and showing again.
  useEffect(() => {
    const ms = reduced ? D.still.fade / 2 : sinking ? DARK.shuffle.sink : DARK.shuffle.rise;
    fade.set(withTiming(sinking ? 0 : 1, faded(ms)));
  }, [sinking, reduced, fade]);

  // The picture: up while the case is building (the top of the pile first), blank again when it isn't; all the way up at ready.
  useEffect(() => {
    if (ready) dev.set(withTiming(1, faded(DARK.develop.ready)));
    else if (developing && inTray) dev.set(withDelay(slot * DARK.develop.stagger, withTiming(1, { ...faded(DARK.develop.rise), easing: Easing.inOut(Easing.quad) })));
    else dev.set(withTiming(0, faded(DARK.develop.sink)));
    // Not `slot`: the stagger is the place it had when the building began, not each shuffle since.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [developing, ready, inTray, dev]);

  // Ready: lifted to its peg, the top of the pile first, and a swing as the peg takes it.
  useEffect(() => {
    if (!ready) {
      hung.set(0);
      return;
    }
    const wait = reduced ? 0 : DARK.hang.first + slot * DARK.hang.stagger;
    hung.set(withDelay(wait, withTiming(1, { duration: reduced ? 0 : DARK.hang.fly, easing: Easing.inOut(Easing.cubic) })));
    if (!reduced) {
      const [a, b, c, d] = DARK.hang.swing;
      const step = (to: number) => withTiming(to, { duration: DARK.hang.swingMs, easing: Easing.inOut(Easing.quad) });
      swing.set(withDelay(wait + DARK.hang.fly - 80, withSequence(step(a), step(b), step(c), step(d))));
    }
    // Not `slot`: they leave in the pile's order as the case came ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, reduced, hung, swing]);

  const w = SCENE.sheet.w * s;
  const h = SCENE.sheet.h * s;
  const at = hangAt(index, count, layout.width, s);
  const dryScale = SCENE.dry.w / SCENE.sheet.w;
  const top = at.y + (SCENE.peg.bite.y - SCENE.peg.grip.y - 3) * s;
  const body = useAnimatedStyle(() => {
    const e = hung.get();
    const tilt = rock.get();
    const a = (tilt * Math.PI) / 180;
    // In the tray: its place, turned with the tray, sliding a touch downhill.
    const lx = (px.get() + tilt * DARK.rock.slosh) * SCENE.unit * s;
    const ly = -py.get() * SCENE.unit * SCENE.squash * s;
    const tx = layout.liquid.x + lx * Math.cos(a) - ly * Math.sin(a);
    const ty = layout.liquid.y + lx * Math.sin(a) + ly * Math.cos(a) - (1 - drop.get()) * DARK.drop.lift * s;
    // On the line: hung from its top edge, so it leans and swings about the peg.
    const lean = ((at.tilt + swing.get()) * Math.PI) / 180;
    const hx = at.x - Math.sin(lean) * (h * dryScale) / 2;
    const hy = top + Math.cos(lean) * (h * dryScale) / 2;
    const x = tx + (hx - tx) * e;
    const y = ty + (hy - ty) * e - Math.sin(Math.PI * e) * DARK.hang.arc * s;
    const size = (1 + (dryScale - 1) * e) * (1 + (1 - drop.get()) * 0.06);
    return {
      opacity: drop.get() * (fade.get() + (1 - fade.get()) * e),
      transform: [
        { translateX: x - w / 2 },
        { translateY: y - h / 2 },
        { scaleY: SCENE.squash + (1 - SCENE.squash) * e },
        { rotate: `${(turn.get() + tilt) * (1 - e) + (at.tilt + swing.get()) * e}deg` },
        { scale: size },
      ],
    };
  });
  // Out of the red light as it leaves the tray.
  const red = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, hung.get() / 0.7) }));
  const blank = useAnimatedStyle(() => ({ opacity: (1 - dev.get()) * (1 - Math.min(1, hung.get() / 0.7)) }));
  const dry = useAnimatedStyle(() => ({ opacity: Math.min(1, hung.get() / 0.7) }));

  const b = SCENE.sheet.border * s;
  const m = SCENE.sheet.margin * s;
  const k = w / SCENE.dry.w;
  const windowBox = { left: b, top: b, width: w - 2 * b, height: h - 2 * b };
  const wetBox = { left: -m, top: -m, width: w + 2 * m, height: h + 2 * m };
  const dryBox = { left: -SCENE.dry.margin * k, top: -SCENE.dry.margin * k, width: SCENE.dry.pic.w * k, height: SCENE.dry.pic.h * k };
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { left: 0, top: 0, width: w, height: h, zIndex: Z.prints + (ready ? index : count - slot) }, body]} testID={`build-print-${index}`}>
      <View style={[styles.abs, styles.picture, windowBox]}>
        {uri === null ? (
          genre ? <ModeCover genre={genre} style={StyleSheet.absoluteFill} testID="build-cover" /> : null
        ) : (
          <TreatedImage source={uri} genre={genre} maxEdge={BAKE} contentFit="cover" style={StyleSheet.absoluteFill} testID={`build-photo-${index}`} />
        )}
        <Animated.View style={[StyleSheet.absoluteFill, red]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: WASH }]} />
          {uri !== null ? <Safelit uri={uri} width={windowBox.width} height={windowBox.height} /> : null}
        </Animated.View>
      </View>
      <Animated.View style={[styles.abs, wetBox, blank]} testID={`build-blank-${index}`}>
        <Image source={ART.blank} style={StyleSheet.absoluteFill} contentFit="fill" />
      </Animated.View>
      <Animated.View style={[styles.abs, wetBox, red]}>
        <Image source={ART.wet} style={StyleSheet.absoluteFill} contentFit="fill" />
      </Animated.View>
      <Animated.View style={[styles.abs, dryBox, dry]}>
        <Image source={ART.print} style={StyleSheet.absoluteFill} contentFit="fill" />
      </Animated.View>
    </Animated.View>
  );
}

/** The photo as it looks under the safelight (safelit.ts): nothing until its print is made. */
function Safelit({ uri, width, height }: { uri: string; width: number; height: number }) {
  const image = useSafelit(uri);
  if (!image) return null;
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <SkiaImage image={image} x={0} y={0} width={width} height={height} fit="cover" />
    </Canvas>
  );
}

/** A drop of water gathering at the foot of a hung print and falling, over and over. */
function Drip({ index, count, layout }: { index: number; count: number; layout: Layout }) {
  const { s } = layout;
  const at = hangAt(index, count, layout.width, s);
  const t = useSharedValue(0);
  useEffect(() => {
    const { gather, drop, every } = DARK.drip;
    const start = DARK.hang.first + count * DARK.hang.stagger + DARK.hang.fly + 900 + index * 700;
    t.set(withDelay(start, withRepeat(withSequence(
      withTiming(1, { duration: gather, easing: Easing.out(Easing.quad) }),
      withTiming(2, { duration: drop, easing: Easing.in(Easing.quad) }),
      withTiming(2, { duration: every }),
      withTiming(0, { duration: 0 }),
    ), -1, false)));
  }, [t, index, count]);
  const foot = at.y + (SCENE.peg.bite.y - SCENE.peg.grip.y - 3 + SCENE.dry.h) * s;
  const drop = useAnimatedStyle(() => {
    const v = t.get();
    const falling = Math.max(0, v - 1);
    return {
      opacity: v <= 0 ? 0 : v < 1 ? v : 1 - falling * falling,
      transform: [{ translateY: falling * DARK.drip.fall * s }, { scaleX: Math.min(1, v) }, { scaleY: Math.min(1, v) * (1 + falling * 0.6) }],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.abs, styles.drop, { left: at.x - (SCENE.dry.w / 2 - 9) * s, top: foot - 1.5 * s, width: 3.6 * s, height: 5.4 * s }, drop]} testID={`build-drip-${index}`} />;
}

/** The safelight's glow round its glass. */
function Glow({ size }: { size: number }) {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="darkroomGlow" cx="50%" cy="50%" r="50%">
          <Stop offset={0} stopColor="#FF5A2E" stopOpacity={0.5} />
          <Stop offset={0.3} stopColor="#F0260F" stopOpacity={0.22} />
          <Stop offset={1} stopColor="#C8140A" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={size} height={size} fill="url(#darkroomGlow)" />
    </Svg>
  );
}

/** The dark over the line while the safelight is the only light. */
function Veil({ width, height, color }: { width: number; height: number; color: string }) {
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="darkroomVeil" x1="0" y1="0" x2="0" y2="1">
          <Stop offset={0} stopColor={color} stopOpacity={DARK.veil.dark} />
          <Stop offset={0.62} stopColor={color} stopOpacity={DARK.veil.dark * 0.9} />
          <Stop offset={1} stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#darkroomVeil)" />
    </Svg>
  );
}

/** The lamp that comes on over the line when the case is ready, in the mode's glow. */
function Lamp({ width, height, tint }: { width: number; height: number; tint: string }) {
  return (
    <Svg width={width} height={height}>
      <Defs>
        <RadialGradient id="darkroomLamp" cx={width / 2} cy={height * 0.3} rx={width * 0.62} ry={height * 0.7} fx={width / 2} fy={height * 0.3} gradientUnits="userSpaceOnUse">
          <Stop offset={0} stopColor={tint} stopOpacity={DARK.veil.lamp} />
          <Stop offset={1} stopColor={tint} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#darkroomLamp)" />
    </Svg>
  );
}

/** The layers, back to front: the bench, glow and tray; the prints (the pile's order, then the line's); the light on the liquid; the line and its lamp; the pegs, the dark, a drop, the rim. */
const Z = { prints: 10, sheen: 30, line: 40, pegs: 50 } as const;

const styles = StyleSheet.create({
  stage: { alignSelf: "stretch" },
  frame: { flex: 1, overflow: "hidden", borderRadius: ref.radius.frame, ...ref.curve },
  abs: { position: "absolute" },
  fill: { left: 0, top: 0, right: 0 },
  trayPivot: { transformOrigin: `${(SCENE.tray.x / SCENE.pic.w) * 100}% ${(SCENE.tray.y / SCENE.pic.h) * 100}%` },
  picture: { overflow: "hidden", backgroundColor: "#1A0605" },
  // A point: the seal centres itself on it.
  seal: { width: 0, height: 0, alignItems: "center", justifyContent: "center", overflow: "visible" },
  sheen: { zIndex: Z.sheen },
  line: { zIndex: Z.line },
  lamp: { zIndex: Z.line + 1 },
  peg: { zIndex: Z.pegs },
  veil: { left: 0, top: 0, right: 0, zIndex: Z.pegs + 1 },
  drop: { zIndex: Z.pegs + 2, backgroundColor: "rgba(255, 238, 224, 0.82)", borderRadius: 2, borderTopLeftRadius: 1, borderTopRightRadius: 1 },
  // The frame's 1 pt edge, over the scene, so the frame holds its shape where the bench meets the page.
  rim: { ...StyleSheet.absoluteFill, zIndex: Z.pegs + 3, borderWidth: D.frame.rim, borderRadius: ref.radius.frame, ...ref.curve },
});
