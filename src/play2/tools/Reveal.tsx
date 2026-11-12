// A note that only reads with something in the room, brought to light by hand.
//
//   heat:   a blank letter written in lemon juice, dropped on a lamp that's on. The brass lamp hangs
//           over the desk, its bulb hot and glowing; drag the sheet up under it and the writing browns
//           in word by word, nearest the heat first and darkest, until it holds (a faint scorch at the
//           edge where it got too close).
//   mirror: a scrap in mirror writing, dropped on the room's mirror. The scrap is held above an arched
//           wall mirror; drag it down to the glass and its reflection comes clear, reading the right
//           way round, in the glass's silvery tint.
//   rub:    a spiral notepad whose top sheet was torn off. Rub the pencil over the page: graphite goes
//           down where the finger rubs and the dents of what was written show through it pale
//           (RubSheet.tsx).
//   lens:   a printed card, a jumble of red over a pale blue-green line. Slide the red gel in its brass
//           ring across it: the red is gone inside the gel and the line reads dark (LensSheet.tsx).
//   fold:   a typed page, each line of the message cut in two either side of filler. Drag the right of
//           it in until B meets A: the middle pleats away and the lines read across the join
//           (FoldSheet.tsx).
//
// The card is already in the casebook when this opens (the engine showed it): this is the moment of
// reading it. Under reduced motion, or for a screen reader (activate), it reads at once. Paper from
// the letters (Paper.tsx: grain, a fold, a torn edge) or drawn the same way on a canvas (ink.tsx),
// writing in the hand face (a typewriter's for the printed page), line art inked like the journal's;
// the room dimmed in the mode's ground behind. The hard objects are rendered pictures (props.ts, from
// scripts/blender/props/reveal_*.py): the brass lamp (off, and lit over it as it comes on), the mirror's
// carved frame and what lies on its glass, the red lens, the pencil, the notepad's wire. Everything
// written, shaded, reflected or folded is drawn live, under and around them.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions, type TextStyle } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  Easing, ReduceMotion, interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming, type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";
import { useFeedback } from "@/game/feedback";
import { CloseStud } from "../hud/Table";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { alpha, mix } from "@/theme/payoff";
import { ref } from "@/theme/tokens";
import { Paper } from "../letters/Paper";

import { FoldSheet } from "./FoldSheet";
import { LensSheet } from "./LensSheet";
import { RubSheet } from "./RubSheet";
import type { SheetProps } from "./sheet";
import { warmFaces } from "./ink";
import { LAMP, MIRROR } from "./props";
import { handLayout, HOLD_AT, isShort, progressFor, REACH, revealOf as findReveal, sizeFor, SYMBOL, type HandWord, type RevealKind, writingOf } from "./revealText";

export type { RevealKind } from "./revealText";

/**
 * The card a result showed that reads with a tool, as the sheet opens it (revealText.ts); asked after
 * every action, so the first ask also starts reading the drawn sheets' faces and every sheet's pictures:
 * by the time one opens, its writing and its props are there.
 */
export function revealOf(...args: Parameters<typeof findReveal>): ReturnType<typeof findReveal> {
  warmFaces();
  warmPictures();
  return findReveal(...args);
}

let warmed = false;
/** Fetches the lamp's and the mirror's pictures ahead (once): from a dev server they would otherwise arrive a beat after the sheet. */
function warmPictures(): void {
  if (warmed) return;
  warmed = true;
  for (const source of [LAMP.off, LAMP.lit, MIRROR.frame, MIRROR.glass]) {
    try {
      const uri = Image.resolveAssetSource?.(source)?.uri;
      if (uri) Image.prefetch?.(uri)?.catch?.(() => {});
    } catch {
      // No such cache here: the picture loads when the sheet opens.
    }
  }
}

/** Lemon juice as it scorches: first a pale straw, then brown, darker the nearer the heat. */
const JUICE = { faint: "rgba(214, 176, 112, 0)", straw: "rgba(196, 146, 74, 0.55)", light: "#A8702F", dark: "#55300F" } as const;
/** The lemon-juice letter's writing paper, and the scrap the backwards note is on. */
const LETTER_PAPER = "#F5ECDB";
const SCRAP = "#F0E6D0";
/** The scrap as the glass gives it back: a touch cooler and greyer. */
const REFLECTED = "#DDD9CD";
/** The backwards note's ink, and the same ink as the glass gives it back. */
const NOTE_INK = "#2C2438";
const GLASS_INK = "#232C36";
const SILVER = { light: "#DCE3E4", mid: "#A7B4BA", deep: "#6F7E88" } as const;
const WARM = { core: "#FFF7DF", bulb: "#FFE7AE", glow: "#FFCF85", amber: "#E09A3A" } as const;
const hidden = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" as const };

/** The lamp in the scene: the room it has, and where its bulb hangs in that (its centre; its radius, as in the lamp's picture). */
const LAMP_H = 150;
const BULB_Y = 118;
const BULB_R = 17;
/** The sheet starts this far below the bulb, so at the hold its top edge is just under it. */
const PAGE_GAP = Math.round(HOLD_AT * REACH) + 2;

export function Reveal({ kind, title, text: card, onClose }: { kind: RevealKind; title: string; text: string; onClose: () => void }) {
  // The card is the writing, whole: nothing narrates it before or after it's read.
  const text = writingOf(card);
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  const feedback = useFeedback();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const pageW = Math.min(screenW - 64, 316);
  // The lemon-juice letter stands upright, a sheet of writing paper, as tall as the screen leaves room for.
  const letterW = Math.min(screenW - 96, 276);
  const letterH = Math.max(200, Math.min(320, screenH - 560));
  const hand = typeof theme.hand.fontFamily === "string" ? theme.hand.fontFamily : ref.font.hand;
  // How far the writing has come up (0..1): it only ever grows, so letting go keeps what's been read.
  const shown = useSharedValue(reducedMotion ? 1 : 0);
  // How near the sheet is held right now (0..1): the warmth on it, the glass's pull. Falls back when let go.
  const near = useSharedValue(0);
  const drag = useSharedValue(0);
  // Set once the writing holds (the drag keeps updating after; it finishes once).
  const held = useSharedValue(reducedMotion);
  const [done, setDone] = useState(reducedMotion);

  const finish = () => {
    if (done) return;
    setDone(true);
    // The lens settles on the line with a clean click; the fold creases; paper for the rest.
    if (kind === "lens") feedback.snap();
    else if (kind === "fold") feedback.paperFold();
    else feedback.paper();
  };
  useEffect(() => {
    if (reducedMotion) shown.set(1);
  }, [reducedMotion, shown]);
  // The lamp comes on as the letter is brought to it (0 off .. 1 lit): a beat dark, a catch, then steady.
  const lamp = useSharedValue(reducedMotion || kind !== "heat" ? 1 : 0);
  useEffect(() => {
    if (kind !== "heat" || reducedMotion) {
      lamp.set(1);
      return;
    }
    const to = (v: number, ms: number) => withTiming(v, { duration: ms, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never });
    lamp.set(withDelay(260, withSequence(to(0.7, 70), to(0.3, 90), to(1, 380))));
  }, [kind, reducedMotion, lamp]);

  const pan = usePanGesture({
    enabled: !done,
    minDistance: 2,
    maxPointers: 1,
    testID: "v2-reveal-pan",
    onUpdate: (e) => {
      "worklet";
      const p = progressFor(kind, e.translationY);
      drag.set(kind === "heat" ? -p * REACH : p * REACH);
      near.set(p);
      if (p > shown.get()) shown.set(p);
      if (p >= HOLD_AT && !held.get()) {
        held.set(true);
        shown.set(withTiming(1, { duration: 320, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }));
        scheduleOnRN(finish);
      }
    },
    onDeactivate: () => {
      "worklet";
      const settle = { duration: 320, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never };
      drag.set(withTiming(0, settle));
      near.set(withTiming(0, settle));
    },
  });
  // A screen reader (or a tap, once it's done) reads it at once.
  const readNow = () => {
    held.set(true);
    shown.set(1);
    finish();
  };

  // How to read it is never said up front. Only if she does nothing with the sheet for a while (no touch, the
  // writing no further on) do a few words come up under it; a touch puts them away. Once read, nothing is said.
  const [idle, setIdle] = useState(false);
  const [touches, setTouches] = useState(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleAt = useRef(0);
  useEffect(() => {
    if (done) return;
    const check = () => {
      const now = shown.get();
      const busyWithIt = now !== idleAt.current || near.get() > 0.02;
      idleAt.current = now;
      if (busyWithIt) idleTimer.current = setTimeout(check, HINT_AFTER_MS);
      else setIdle(true);
    };
    idleAt.current = shown.get();
    idleTimer.current = setTimeout(check, HINT_AFTER_MS);
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [done, touches, shown, near]);
  const touched = () => {
    setIdle(false);
    setTouches((n) => n + 1);
    return false;
  };

  const pageStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drag.get() }] }));
  const hint = HINT[kind];
  const page = {
    style: pageStyle,
    accessible: true,
    accessibilityRole: "button" as const,
    accessibilityLabel: done ? `${title}: ${text}` : `${title}: ${HOW[kind]}`,
    accessibilityActions: [{ name: "activate" }],
    onAccessibilityAction: readNow,
    testID: "v2-reveal-page",
  };
  const caption = (
    <View style={styles.caption} pointerEvents="none">
      {!done && idle ? <Text style={[ref.type.handSmall, { fontFamily: hand, color: theme.inkMuted, textAlign: "center" }]} testID="v2-reveal-hint">{hint}</Text> : null}
    </View>
  );

  return (
    <View style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: theme.ground }]} onStartShouldSetResponderCapture={touched} testID={`v2-reveal-${kind}`}>
      {/* Once it's read, a tap anywhere puts it away. */}
      {done ? <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} testID="v2-reveal-away" /> : null}
      {kind === "heat" ? (
        <View style={[styles.scene, { width: screenW }]} pointerEvents="box-none">
          <Glow width={screenW} near={near} lamp={lamp} />
          <View style={[styles.lamp, { width: screenW }]} pointerEvents="none" {...hidden}>
            <Lamp width={screenW} lamp={lamp} />
            <Shimmer near={near} lamp={lamp} reduced={reducedMotion} style={{ left: screenW / 2 - 60, top: BULB_Y + BULB_R - 2 }} />
          </View>
          <GestureDetector gesture={pan}>
            <Animated.View {...page} style={[{ width: letterW, marginTop: LAMP_H - (BULB_Y + BULB_R) + PAGE_GAP }, styles.under, pageStyle]}>
              <Paper
                color={LETTER_PAPER}
                seed={`${title}:juice`}
                folds={[0.36, 0.69]}
                grain={0.6}
                age={0.14}
                ageColor="#A0703A"
                shade={alpha(theme.ground, 0.7)}
                lift={1.3}
                style={styles.letter}
                padding={[styles.letterPad, { minHeight: letterH }]}
              >
                <Warmth near={near} lamp={lamp} shown={shown} width={letterW} />
                <Writing text={text} seed={title} font={hand} shown={shown} />
              </Paper>
            </Animated.View>
          </GestureDetector>
          {caption}
        </View>
      ) : kind === "rub" || kind === "lens" || kind === "fold" ? (
        <View style={[styles.scene, { width: screenW }]} pointerEvents="box-none">
          <Drawn kind={kind} text={text} title={title} width={screenW} height={screenH} shown={shown} done={done} reduced={reducedMotion} onRead={finish} feedback={feedback} ground={theme.ground} labels={{ label: page.accessibilityLabel }} />
          {caption}
        </View>
      ) : (
        <View style={[styles.scene, { width: screenW }]} pointerEvents="box-none">
          <GestureDetector gesture={pan}>
            <Animated.View {...page} style={[{ width: pageW - 10 }, styles.over, pageStyle]}>
              <Note text={text} seed={title} font={hand} shade={alpha(theme.ground, 0.7)} />
            </Animated.View>
          </GestureDetector>
          <Mirror width={Math.min(screenW - 56, 300)} text={text} shown={shown} near={near}>
            {/* The note's reflection: the very same scrap, turned round, so its writing reads plainly. */}
            <View style={[styles.backwards, { width: pageW - 10 }]}>
              <Note text={text} seed={title} font={hand} ink={GLASS_INK} paper={REFLECTED} shade="rgba(0, 0, 0, 0)" />
            </View>
          </Mirror>
          {caption}
        </View>
      )}
      {/* The same brass stud that closes a close-up. */}
      <View style={[styles.close, { top: insets.top + 14 }]}>
        <CloseStud onPress={onClose} label={done ? "Done" : "Put it away"} testID="v2-reveal-close" />
      </View>
    </View>
  );
}

/** Idle this long with the sheet unread, and the hint comes up (ms). */
export const HINT_AFTER_MS = 5000;
/**
 * The few words that come up under a sheet left untouched (never before, never once it's read), and how the
 * screen reader is told to read it (always, in full).
 */
const HINT: Record<RevealKind, string> = {
  heat: "Warm it at the bulb",
  mirror: "Hold it to the glass",
  rub: "Rub with the pencil",
  lens: "Lens over the card",
  fold: "Bring A to B",
  tune: "Turn the crank",
  ribbon: "Pull the ribbon",
};
const HOW: Record<RevealKind, string> = {
  heat: "hold it to the warm bulb to read it",
  mirror: "hold it to the mirror to read it",
  rub: "rub the pencil over the page to read it",
  lens: "slide the red lens over it to read it",
  fold: "fold it so its two strips meet to read it",
  tune: "turn its crank to hear it",
  ribbon: "pull the ribbon out to read it",
};

/** The sheets drawn on a canvas, each its own object and gesture. */
function Drawn({ kind, ...props }: SheetProps & { kind: "rub" | "lens" | "fold" }) {
  return kind === "rub" ? <RubSheet {...props} /> : kind === "lens" ? <LensSheet {...props} /> : <FoldSheet {...props} />;
}

/** Words laid out as written: each its own tilt and lift, wrapping like a line of handwriting. */
function Hand({ lines, font, size, color, word }: { lines: HandWord[][]; font: string; size: number; color: string; word?: (w: HandWord, style: TextStyle, key: string) => ReactNode }) {
  const line = Math.round(size * 1.32);
  const style: TextStyle = { fontFamily: font, fontSize: size, lineHeight: line, color };
  const short = isShort(lines.map((ws) => ws.map((w) => w.word).join("")).join(" "));
  return (
    <View style={styles.hand}>
      {lines.map((ws, li) => (
        <View key={li} style={[styles.line, short && styles.lineShort]}>
          {ws.map((w, wi) => {
            const key = `${li}:${wi}`;
            if (w.word === " ") return <View key={key} style={{ width: size * 0.3 }} />;
            const st: TextStyle = { ...style, marginRight: !short && wi < ws.length - 1 ? size * 0.28 : 0, transform: [{ translateY: w.dy }, { rotate: `${w.rot}deg` }] };
            if (word) return word(w, st, key);
            return SYMBOL[w.word] ? <Glyph key={key} d={SYMBOL[w.word]} size={size} color={color} style={st} /> : <Text key={key} style={st}>{w.word}</Text>;
          })}
        </View>
      ))}
    </View>
  );
}

/** One drawn symbol, sitting on the line like a written character. */
function Glyph({ d, size, color, style }: { d: string; size: number; color: string; style?: TextStyle }) {
  const box = Math.round(size * 0.66);
  const { transform, marginRight } = style ?? {};
  return (
    <View style={{ height: Math.round(size * 1.32), width: box + size * 0.08, justifyContent: "center", alignItems: "center", paddingTop: size * 0.1, marginRight, transform }}>
      <Svg width={box} height={box} viewBox="0 0 24 24">
        <Path d={d} fill={color} stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

/** The lemon-juice writing: invisible at first; each word browns as the heat reaches it, straw then scorched. */
function Writing({ text, seed, font, shown }: { text: string; seed: string; font: string; shown: SharedValue<number> }) {
  return (
    <View accessible accessibilityLabel={text} testID="v2-reveal-text">
      <View {...hidden}>
        <Hand lines={handLayout(text, seed)} font={font} size={sizeFor(text)} color={JUICE.faint} word={(w, st, key) => <JuiceWord key={key} w={w} style={st} shown={shown} />} />
      </View>
    </View>
  );
}

function JuiceWord({ w, style, shown }: { w: HandWord; style: TextStyle; shown: SharedValue<number> }) {
  const brown = mix(JUICE.light, JUICE.dark, (w.depth - 0.7) / 0.3);
  const anim = useAnimatedStyle(() => ({ color: interpolateColor(shown.get(), [w.at, w.at + 0.14, w.at + 0.42], [JUICE.faint, JUICE.straw, brown]) }));
  // A drawn symbol browns the same way, as two layers: the straw first, then the scorch over it.
  const straw = useAnimatedStyle(() => ({ opacity: interpolate(shown.get(), [w.at, w.at + 0.14], [0, 0.55], "clamp") }));
  const scorch = useAnimatedStyle(() => ({ opacity: interpolate(shown.get(), [w.at + 0.14, w.at + 0.42], [0, 1], "clamp") }));
  const d = SYMBOL[w.word];
  if (d) {
    const size = style.fontSize ?? 22;
    return (
      <View style={{ marginRight: style.marginRight }}>
        <Animated.View style={straw}><Glyph d={d} size={size} color={JUICE.light} style={{ transform: style.transform }} /></Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, scorch]}><Glyph d={d} size={size} color={brown} style={{ transform: style.transform }} /></Animated.View>
      </View>
    );
  }
  return <Animated.Text style={[style, anim]}>{w.word}</Animated.Text>;
}

/** The lamp's light on the sheet (stronger the nearer it's held), and the faint scorch it leaves at the edge. */
function Warmth({ near, lamp, shown, width }: { near: SharedValue<number>; lamp: SharedValue<number>; shown: SharedValue<number>; width: number }) {
  const light = useAnimatedStyle(() => ({ opacity: (0.15 + 0.85 * near.get()) * lamp.get() }));
  const scorch = useAnimatedStyle(() => ({ opacity: interpolate(shown.get(), [0.55, 1], [0, 1], "clamp") }));
  return (
    <View style={[StyleSheet.absoluteFill, styles.warmth]} pointerEvents="none" {...hidden}>
      <Animated.View style={[StyleSheet.absoluteFill, light]}>
        <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="onpage" cx="50%" cy="0%" r="75%">
              <Stop offset="0" stopColor={WARM.glow} stopOpacity="0.55" />
              <Stop offset="0.55" stopColor={WARM.glow} stopOpacity="0.12" />
              <Stop offset="1" stopColor={WARM.glow} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#onpage)" />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.scorch, { left: width * 0.16, width: width * 0.56 }, scorch]}>
        <Svg width="100%" height="100%" viewBox="0 0 120 40" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="scorch" cx={58} cy={0} r={46} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#6E360E" stopOpacity="0.5" />
              <Stop offset="0.4" stopColor="#8E521D" stopOpacity="0.2" />
              <Stop offset="1" stopColor="#9A5A22" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="scorch2" cx={80} cy={0} r={26} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#5A2A0A" stopOpacity="0.4" />
              <Stop offset="1" stopColor="#8E521D" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="120" height="40" fill="url(#scorch)" />
          <Rect x="0" y="0" width="120" height="40" fill="url(#scorch2)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** The lamp's light falling over the desk (once it's on), brighter as the sheet is brought in. */
function Glow({ width, near, lamp }: { width: number; near: SharedValue<number>; lamp: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: (0.7 + 0.3 * near.get()) * lamp.get() }));
  const h = 620;
  return (
    <Animated.View style={[styles.glow, { width, height: h, top: BULB_Y - 180 }, style]} pointerEvents="none" {...hidden}>
      <Svg width={width} height={h}>
        <Defs>
          <RadialGradient id="desk" cx={width / 2} cy={180} rx={Math.max(width * 0.75, 300)} ry={420} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={WARM.glow} stopOpacity="0.5" />
            <Stop offset="0.18" stopColor={WARM.glow} stopOpacity="0.24" />
            <Stop offset="0.5" stopColor={WARM.amber} stopOpacity="0.07" />
            <Stop offset="1" stopColor={WARM.amber} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="bloom" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={WARM.core} stopOpacity="0.9" />
            <Stop offset="0.35" stopColor={WARM.glow} stopOpacity="0.4" />
            <Stop offset="1" stopColor={WARM.glow} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={h} fill="url(#desk)" />
        <Circle cx={width / 2} cy={180 + 26} r={84} fill="url(#bloom)" />
      </Svg>
    </Animated.View>
  );
}

/**
 * The brass gooseneck lamp (its picture: props.ts), its bulb's centre at the scene's: the lamp off, and
 * the same lamp lit laid over it as it comes on. The neck runs off the screen's right edge.
 */
function Lamp({ width, lamp }: { width: number; lamp: SharedValue<number> }) {
  const at = { position: "absolute" as const, left: width / 2 - LAMP.bulb.x, top: BULB_Y - LAMP.bulb.y, width: LAMP.w, height: LAMP.h };
  const lit = useAnimatedStyle(() => ({ opacity: lamp.get() }));
  return (
    <View style={[styles.lampArt, { width, height: BULB_Y - LAMP.bulb.y + LAMP.h }]}>
      <Image source={LAMP.off} style={at} fadeDuration={0} testID="v2-reveal-lamp" />
      <Animated.Image source={LAMP.lit} style={[at, lit]} fadeDuration={0} testID="v2-reveal-lamp-lit" />
    </View>
  );
}

/** Heat coming off the bulb: a few faint wavering lines, stronger as the sheet nears (still under reduced motion). */
function Shimmer({ near, lamp, reduced, style }: { near: SharedValue<number>; lamp: SharedValue<number>; reduced: boolean; style: object }) {
  const clock = useSharedValue(0.25);
  useEffect(() => {
    if (!reduced) clock.set(withRepeat(withTiming(1.25, { duration: 1800, easing: Easing.linear }), -1, false));
  }, [reduced, clock]);
  const a = useAnimatedStyle(() => {
    const t = clock.get() % 1;
    return { opacity: lamp.get() * (0.3 + 0.7 * near.get()) * (0.12 + 0.3 * Math.sin(Math.PI * t)), transform: [{ translateX: Math.sin(t * Math.PI * 2) * 2.5 }, { scaleY: 0.92 + 0.12 * t }] };
  });
  const b = useAnimatedStyle(() => {
    const t = (clock.get() + 0.5) % 1;
    return { opacity: lamp.get() * (0.3 + 0.7 * near.get()) * (0.12 + 0.3 * Math.sin(Math.PI * t)), transform: [{ translateX: -Math.sin(t * Math.PI * 2) * 2.5 }, { scaleY: 0.92 + 0.12 * t }] };
  });
  const wave = (x: number, h: number) => `M${x} 6 c-3 ${h * 0.16} 3 ${h * 0.3} 0 ${h * 0.46} s3 ${h * 0.3} 0 ${h * 0.46}`;
  return (
    <View style={[styles.shimmer, style]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, a]}>
        <Svg width={120} height={72}>
          <Path d={wave(44, 34)} stroke={WARM.bulb} strokeWidth={1} fill="none" strokeLinecap="round" />
          <Path d={wave(80, 28)} stroke={WARM.bulb} strokeOpacity={0.7} strokeWidth={0.9} fill="none" strokeLinecap="round" />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, b]}>
        <Svg width={120} height={72}>
          <Path d={wave(62, 40)} stroke={WARM.bulb} strokeWidth={1} fill="none" strokeLinecap="round" />
          <Path d={wave(28, 24)} stroke={WARM.bulb} strokeOpacity={0.6} strokeWidth={0.9} fill="none" strokeLinecap="round" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** The scrap the backwards note is written on: torn from something, the writing back to front. */
function Note({ text, seed, font, shade, ink = NOTE_INK, paper = SCRAP }: { text: string; seed: string; font: string; shade: string; ink?: string; paper?: string }) {
  return (
    <Paper color={paper} seed={`${seed}:scrap`} edges={{ top: "torn", right: "torn" }} grain={0.55} age={0.1} ageColor="#8A6A40" shade={shade} lift={1.3} style={styles.scrap} padding={styles.scrapPad}>
      <View style={styles.backwards} {...hidden}>
        <Hand lines={handLayout(text, seed)} font={font} size={sizeFor(text)} color={ink} />
      </View>
    </Paper>
  );
}

/**
 * An arched wall mirror: a carved dark frame with a gilt bead (its picture, over everything), the glass
 * silvered (drawn here: its tone, the room dim in it, the light off the note), and what lies on the glass
 * (its picture: soft highlights, the bevel, foxed silvering) over the reflection. The note's reflection
 * comes up in the glass as the note is brought close: the backwards writing reading the right way round,
 * in the glass's tint.
 */
function Mirror({ width, text, shown, near, children }: { width: number; text: string; shown: SharedValue<number>; near: SharedValue<number>; children: ReactNode }) {
  const height = Math.round(width * 1.12);
  // The pictures are for a mirror MIRROR.width wide: a narrower one scales them.
  const k = width / MIRROR.width;
  const F = MIRROR.inset * k;
  const gw = width - F * 2;
  const gh = height - F * 2;
  const reflection = useAnimatedStyle(() => {
    const s = shown.get();
    return {
      opacity: interpolate(s, [0, 0.08, 0.7, 1], [0, 0.2, 0.8, 0.86], "clamp"),
      transform: [{ translateY: (1 - s) * 18 - near.get() * 6 }, { scale: 0.72 + 0.08 * s }],
    };
  });
  const lift = useAnimatedStyle(() => ({ opacity: 0.12 + 0.3 * near.get() }));
  return (
    <View style={[styles.mirror, { width, height }]} pointerEvents="none">
      {/* The glass (its edge runs under the frame's gilt slip). */}
      <View style={[styles.glass, { left: F, top: F, width: gw, height: gh, borderTopLeftRadius: gw / 2, borderTopRightRadius: gw / 2 }]}>
        <Svg width={gw} height={gh} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="silver" x1="0" y1="0" x2="0.7" y2="1">
              <Stop offset="0" stopColor={SILVER.light} />
              <Stop offset="0.55" stopColor={SILVER.mid} />
              <Stop offset="1" stopColor={SILVER.deep} />
            </LinearGradient>
            <LinearGradient id="room" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.55" stopColor="#2A2436" stopOpacity="0" />
              <Stop offset="1" stopColor="#2A2436" stopOpacity="0.42" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={gw} height={gh} fill="url(#silver)" />
          {/* The room behind her, dim in the glass; the glass's own cool tint. */}
          <Rect x={0} y={0} width={gw} height={gh} fill="url(#room)" />
          <Rect x={0} y={0} width={gw} height={gh} fill="#6E8296" fillOpacity={0.16} />
        </Svg>
        <Animated.View style={[StyleSheet.absoluteFill, lift]} {...hidden}>
          {/* The light off the note, nearing. */}
          <Svg width={gw} height={gh}>
            <Defs>
              <RadialGradient id="near" cx="50%" cy="48%" r="45%">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.7" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x={0} y={0} width={gw} height={gh} fill="url(#near)" />
          </Svg>
        </Animated.View>
        {/* The note's reflection: the same scrap, turned the right way round. */}
        <View style={[styles.reflectWrap, { paddingTop: gw * 0.34 }]}>
          <Animated.View style={reflection} accessible accessibilityLabel={text} testID="v2-reveal-text">
            <View {...hidden}>{children}</View>
          </Animated.View>
        </View>
      </View>
      {/* What lies on the glass, over the reflection; then the frame, over the glass's edge. */}
      <Image
        source={MIRROR.glass}
        style={{ position: "absolute", left: F - MIRROR.bleed * k, top: F - MIRROR.bleed * k, width: MIRROR.glassW * k, height: MIRROR.glassH * k }}
        fadeDuration={0}
        testID="v2-reveal-mirror-glass"
        {...hidden}
      />
      <Image
        source={MIRROR.frame}
        style={{ position: "absolute", left: -MIRROR.box.x * k, top: -MIRROR.box.y * k, width: MIRROR.w * k, height: MIRROR.h * k }}
        fadeDuration={0}
        testID="v2-reveal-mirror-frame"
        {...hidden}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", justifyContent: "center", zIndex: 90 },
  scene: { alignItems: "center" },
  lamp: { height: LAMP_H, zIndex: 3 },
  // The lamp's picture hangs below the lamp's room (its neck runs on down) and is cut at the screen's edges.
  lampArt: { position: "absolute", left: 0, top: 0, overflow: "hidden" },
  glow: { position: "absolute", left: 0 },
  shimmer: { position: "absolute", width: 120, height: 72 },
  under: { zIndex: 1 },
  over: { zIndex: 3, marginBottom: 18 },
  letter: { transform: [{ rotate: "-2deg" }] },
  letterPad: { paddingHorizontal: 26, paddingTop: 34, paddingBottom: 34, justifyContent: "center", overflow: "hidden" },
  warmth: { margin: 0 },
  scorch: { position: "absolute", top: 0, height: 44 },
  scrap: { transform: [{ rotate: "2.5deg" }] },
  scrapPad: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 18 },
  backwards: { transform: [{ scaleX: -1 }] },
  hand: { gap: 2 },
  line: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end" },
  lineShort: { justifyContent: "center" },
  mirror: { zIndex: 1 },
  glass: { position: "absolute", overflow: "hidden", borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  reflectWrap: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  caption: { marginTop: 22, paddingHorizontal: 40, minHeight: 44 },
  close: { position: "absolute", right: 16, zIndex: 4 },
});
