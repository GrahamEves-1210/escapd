// A note that only reads with something in the room, brought to light by hand.
//
//   heat:   a blank letter written in lemon juice, dropped on a lamp that's on. The brass lamp hangs
//           over the desk, its bulb hot and glowing; drag the sheet up under it and the writing browns
//           in word by word, nearest the heat first and darkest, until it holds (a faint scorch at the
//           edge where it got too close).
//   mirror: a scrap in mirror writing, dropped on the room's mirror. The scrap is held above an arched
//           wall mirror; drag it down to the glass and its reflection comes clear, reading the right
//           way round, in the glass's silvery tint.
//
// The card is already in the casebook when this opens (the engine showed it): this is the moment of
// reading it. Under reduced motion, or for a screen reader (activate), it reads at once. Paper from
// the letters (Paper.tsx: grain, a fold, a torn edge), writing in the hand face, line art inked like
// the journal's; the room dimmed in the mode's ground behind.
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type TextStyle } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  Easing, ReduceMotion, interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { alpha, mix } from "@/theme/payoff";
import { ref } from "@/theme/tokens";
import { Paper } from "../letters/Paper";

import { handLayout, HOLD_AT, isShort, progressFor, REACH, type HandWord, type RevealKind, splitCard } from "./revealText";

export { revealOf, type RevealKind } from "./revealText";

/** The pen's ink: the line art's outlines. */
const INK = "#1E1418";
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
const BRASS = { deep: "#5E4116", mid: "#B28A45", light: "#E9CD8A", sheen: "#F7E6B8" } as const;
const WOOD = { deep: "#24160F", mid: "#4A2E1F", light: "#6B4530" } as const;
const SILVER = { light: "#DCE3E4", mid: "#A7B4BA", deep: "#6F7E88" } as const;
const WARM = { core: "#FFF7DF", bulb: "#FFE7AE", glow: "#FFCF85", amber: "#E09A3A" } as const;
const hidden = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" as const };

/** The lamp's drawing: its height, and where its bulb hangs (its centre and lowest point). */
const LAMP_H = 150;
const BULB_Y = 118;
const BULB_R = 17;
/** The sheet starts this far below the bulb, so at the hold its top edge is just under it. */
const PAGE_GAP = Math.round(HOLD_AT * REACH) + 2;

export function Reveal({ kind, title, text: card, onClose }: { kind: RevealKind; title: string; text: string; onClose: () => void }) {
  const { lead, writing: text } = splitCard(card);
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
    feedback.paper();
  };
  useEffect(() => {
    if (reducedMotion) shown.set(1);
  }, [reducedMotion, shown]);

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

  const pageStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drag.get() }] }));
  const hint = kind === "heat" ? "Hold it up to the lamp's warmth" : "Hold it up to the mirror";
  const page = {
    style: pageStyle,
    accessible: true,
    accessibilityRole: "button" as const,
    accessibilityLabel: done ? `${title}: ${text}` : kind === "heat" ? `${title}: hold it to the warm bulb to read it` : `${title}: hold it to the mirror to read it`,
    accessibilityActions: [{ name: "activate" }],
    onAccessibilityAction: readNow,
    testID: "v2-reveal-page",
  };
  const caption = (
    <View style={styles.caption} pointerEvents="none">
      {done ? (
        lead ? <Text style={[ref.type.handSmall, { fontFamily: hand, color: theme.inkMuted, textAlign: "center" }]} testID="v2-reveal-lead">{lead.replace(/:$/, ".")}</Text> : null
      ) : (
        <Text style={[ref.type.handSmall, { fontFamily: hand, color: theme.inkMuted, textAlign: "center" }]} testID="v2-reveal-hint">{hint}</Text>
      )}
    </View>
  );

  return (
    <View style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: alpha(theme.ground, 0.97) }]} testID={`v2-reveal-${kind}`}>
      {/* Once it's read, a tap anywhere puts it away. */}
      {done ? <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} testID="v2-reveal-away" /> : null}
      {kind === "heat" ? (
        <View style={[styles.scene, { width: screenW }]} pointerEvents="box-none">
          <Glow width={screenW} near={near} />
          <View style={[styles.lamp, { width: screenW }]} pointerEvents="none" {...hidden}>
            <Lamp width={screenW} />
            <Shimmer near={near} reduced={reducedMotion} style={{ left: screenW / 2 - 60, top: BULB_Y + BULB_R - 2 }} />
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
                <Warmth near={near} shown={shown} width={letterW} />
                <Writing text={text} seed={title} font={hand} shown={shown} />
              </Paper>
            </Animated.View>
          </GestureDetector>
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
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={done ? "Done" : "Put it away"}
        hitSlop={12}
        style={({ pressed }) => [styles.close, { top: insets.top + 14, backgroundColor: alpha(theme.raised, 0.9), borderColor: theme.rim, opacity: pressed ? 0.7 : 1 }]}
        testID="v2-reveal-close"
      >
        <InkCross color={theme.ink} />
      </Pressable>
    </View>
  );
}

/** A short line (a digit, a symbol) is written large, as a person would; a note at a reading size. */
const sizeFor = (text: string) => (isShort(text) ? 46 : text.length > 70 ? 20 : 22);

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

/**
 * The door's wheel symbols, drawn by hand (the hand face has none of its own): a 24-point box each,
 * the outline a little off true, as a pen would fill it in.
 */
const SYMBOL: Record<string, string> = {
  "▲": "M12.3 3.2 C15.4 8.6 18.6 14.4 21.4 20.2 C15.4 20.9 8.6 20.4 2.8 20.8 C5.8 14.8 9 8.8 12.3 3.2 Z",
  "●": "M12 3.4 C17.2 3.1 20.9 7.2 20.7 12.3 C20.5 17.4 16.6 21 11.6 20.7 C6.7 20.5 3.1 16.7 3.3 11.8 C3.5 7 7.1 3.6 12 3.4 Z",
  "◆": "M12.1 2.6 C15 5.8 18 9 21 12.1 C18 15.3 14.9 18.5 11.8 21.5 C8.9 18.3 5.9 15.1 3 11.9 C6 8.8 9.1 5.7 12.1 2.6 Z",
  "■": "M4.2 4.5 C9.4 3.9 14.8 4.3 19.9 4 C20.3 9.4 19.9 14.7 20.2 19.9 C14.9 20.4 9.3 19.8 3.9 20.2 C4.3 15 3.7 9.7 4.2 4.5 Z",
  "★": "M12 2.8 L14.6 9.2 L21.3 9.5 L16.1 13.8 L17.9 20.6 L12.1 16.8 L6.2 20.7 L8 13.9 L2.8 9.6 L9.5 9.1 Z",
  "✚": "M9.4 3.2 C11.1 3 12.9 3.1 14.6 3.2 L14.5 9.4 L20.8 9.5 C21 11.2 20.9 12.9 20.8 14.6 L14.6 14.5 L14.7 20.8 C12.9 21 11.1 20.9 9.4 20.8 L9.5 14.6 L3.2 14.7 C3 12.9 3.1 11.1 3.2 9.4 L9.5 9.5 Z",
};

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
function Warmth({ near, shown, width }: { near: SharedValue<number>; shown: SharedValue<number>; width: number }) {
  const light = useAnimatedStyle(() => ({ opacity: 0.15 + 0.85 * near.get() }));
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

/** The lamp's light falling over the desk: always on, brighter as the sheet is brought in. */
function Glow({ width, near }: { width: number; near: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: 0.7 + 0.3 * near.get() }));
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

/** A brass desk lamp, its arm bent over from the right, the dome shade lit inside, the bulb hot. Inked. */
function Lamp({ width }: { width: number }) {
  const c = width / 2;
  const rimY = 108;
  const shade = `M${c - 13} 36 C${c - 20} 50 ${c - 56} 72 ${c - 72} ${rimY} C${c - 40} ${rimY + 12} ${c + 40} ${rimY + 12} ${c + 72} ${rimY} C${c + 56} 72 ${c + 20} 50 ${c + 13} 36 Z`;
  const arm = `M${c} 30 C${c - 2} 10 ${c + 34} 4 ${c + 84} 9 S${c + 160} 22 ${width + 12} 6`;
  return (
    <Svg width={width} height={LAMP_H} viewBox={`0 0 ${width} ${LAMP_H}`}>
      <Defs>
        <LinearGradient id="brass" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={BRASS.deep} />
          <Stop offset="0.3" stopColor={BRASS.mid} />
          <Stop offset="0.46" stopColor={BRASS.light} />
          <Stop offset="0.62" stopColor={BRASS.mid} />
          <Stop offset="1" stopColor={BRASS.deep} />
        </LinearGradient>
        <RadialGradient id="inside" cx="50%" cy="20%" r="80%">
          <Stop offset="0" stopColor={WARM.core} />
          <Stop offset="0.6" stopColor={WARM.bulb} />
          <Stop offset="1" stopColor={WARM.amber} />
        </RadialGradient>
        <RadialGradient id="bulb" cx="45%" cy="40%" r="60%">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.7" stopColor={WARM.core} />
          <Stop offset="1" stopColor={WARM.bulb} />
        </RadialGradient>
      </Defs>
      {/* The arm: inked, brass, a line of sheen along it. */}
      <Path d={arm} stroke={INK} strokeWidth={9} fill="none" strokeLinecap="round" />
      <Path d={arm} stroke="url(#brass)" strokeWidth={6} fill="none" strokeLinecap="round" />
      <Path d={arm} stroke={BRASS.sheen} strokeOpacity={0.6} strokeWidth={1.2} fill="none" strokeLinecap="round" transform="translate(0 -1.4)" />
      {/* The shade's lit mouth, then the bulb hanging in it. */}
      <Ellipse cx={c} cy={rimY + 3} rx={70} ry={11} fill="url(#inside)" />
      <Circle cx={c} cy={BULB_Y} r={BULB_R} fill="url(#bulb)" stroke={INK} strokeOpacity={0.45} strokeWidth={1.4} />
      <Path d={`M${c - 7} ${BULB_Y - 2} l3 4 l3 -5 l3 5 l3 -5 l2 3`} stroke={WARM.amber} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* The dome, over the bulb's top: brass, hatched on its shadowed side, gone over in ink twice. */}
      <Path d={shade} fill="url(#brass)" />
      <G stroke={INK} strokeOpacity={0.35} strokeWidth={1} strokeLinecap="round">
        <Path d={`M${c - 46} 92 q4 -14 14 -26`} fill="none" />
        <Path d={`M${c - 38} 98 q4 -16 14 -30`} fill="none" />
        <Path d={`M${c - 54} 100 q3 -8 8 -16`} fill="none" />
        <Path d={`M${c + 50} 96 q-3 -10 -9 -18`} fill="none" />
      </G>
      <Path d={`M${c + 6} 46 C${c + 22} 58 ${c + 34} 74 ${c + 40} 96`} stroke={BRASS.sheen} strokeOpacity={0.7} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <Path d={shade} stroke={INK} strokeWidth={2.2} fill="none" strokeLinejoin="round" />
      <Path d={shade} stroke={INK} strokeOpacity={0.3} strokeWidth={1} fill="none" transform="translate(1.2 0.8)" />
      {/* The rolled rim, catching the light from under it. */}
      <Path d={`M${c - 72} ${rimY} C${c - 40} ${rimY + 12} ${c + 40} ${rimY + 12} ${c + 72} ${rimY}`} stroke={BRASS.light} strokeWidth={3.2} fill="none" strokeLinecap="round" />
      <Path d={`M${c - 73} ${rimY + 1.5} C${c - 40} ${rimY + 14} ${c + 40} ${rimY + 14} ${c + 73} ${rimY + 1.5}`} stroke={INK} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      {/* The knuckle where the arm holds it. */}
      <Ellipse cx={c} cy={36} rx={14} ry={4} fill={BRASS.mid} stroke={INK} strokeWidth={1.8} />
      <Circle cx={c} cy={29} r={5.5} fill={BRASS.light} stroke={INK} strokeWidth={1.8} />
    </Svg>
  );
}

/** Heat coming off the bulb: a few faint wavering lines, stronger as the sheet nears (still under reduced motion). */
function Shimmer({ near, reduced, style }: { near: SharedValue<number>; reduced: boolean; style: object }) {
  const clock = useSharedValue(0.25);
  useEffect(() => {
    if (!reduced) clock.set(withRepeat(withTiming(1.25, { duration: 1800, easing: Easing.linear }), -1, false));
  }, [reduced, clock]);
  const a = useAnimatedStyle(() => {
    const t = clock.get() % 1;
    return { opacity: (0.3 + 0.7 * near.get()) * (0.12 + 0.3 * Math.sin(Math.PI * t)), transform: [{ translateX: Math.sin(t * Math.PI * 2) * 2.5 }, { scaleY: 0.92 + 0.12 * t }] };
  });
  const b = useAnimatedStyle(() => {
    const t = (clock.get() + 0.5) % 1;
    return { opacity: (0.3 + 0.7 * near.get()) * (0.12 + 0.3 * Math.sin(Math.PI * t)), transform: [{ translateX: -Math.sin(t * Math.PI * 2) * 2.5 }, { scaleY: 0.92 + 0.12 * t }] };
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
 * An arched wall mirror in a carved dark frame with a gilt bead, the glass silvered and a little foxed,
 * soft highlights, its edges darkening. The note's reflection comes up in it as the note is brought
 * close: the backwards writing reading the right way round, in the glass's tint.
 */
function Mirror({ width, text, shown, near, children }: { width: number; text: string; shown: SharedValue<number>; near: SharedValue<number>; children: ReactNode }) {
  const height = Math.round(width * 1.12);
  const F = 22;
  const gw = width - F * 2;
  const gh = height - F * 2;
  const arch = (inset: number) => {
    const r = (width - inset * 2) / 2;
    return `M${inset} ${height - inset} V${inset + r} A${r} ${r} 0 0 1 ${width - inset} ${inset + r} V${height - inset} Z`;
  };
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
      {/* The frame: carved dark wood, lit from the top left, a crest and two rosettes. */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="wood" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={WOOD.light} />
            <Stop offset="0.45" stopColor={WOOD.mid} />
            <Stop offset="1" stopColor={WOOD.deep} />
          </LinearGradient>
        </Defs>
        <Path d={arch(0)} fill="url(#wood)" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" transform="translate(1 1) scale(0.994)" />
        <Path d={arch(7)} fill="none" stroke={WOOD.light} strokeOpacity={0.55} strokeWidth={1.2} />
        <G stroke={INK} strokeOpacity={0.35} strokeWidth={1} strokeLinecap="round" fill="none">
          <Path d={`M8 ${height * 0.62} q2 18 0 36`} />
          <Path d={`M${width - 9} ${height * 0.55} q-2 22 0 40`} />
          <Path d={`M12 ${height * 0.8} q2 10 0 20`} />
        </G>
        {[F * 0.5, width - F * 0.5].map((x) => (
          <G key={x}>
            <Circle cx={x} cy={height - F * 0.5} r={6} fill={BRASS.mid} stroke={INK} strokeWidth={1.4} />
            <Circle cx={x} cy={height - F * 0.5} r={2} fill={BRASS.deep} />
          </G>
        ))}
        <Path d={`M${width / 2 - 16} 6 C${width / 2 - 10} -2 ${width / 2 - 4} 8 ${width / 2} 1 C${width / 2 + 4} 8 ${width / 2 + 10} -2 ${width / 2 + 16} 6 C${width / 2 + 8} 12 ${width / 2 - 8} 12 ${width / 2 - 16} 6 Z`}
          fill={BRASS.mid} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
      </Svg>
      {/* The glass. */}
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
          {/* The room behind her, dim in the glass. */}
          <Rect x={0} y={0} width={gw} height={gh} fill="url(#room)" />
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
        {/* The glass over it all: its cool tint, soft highlights, foxed silvering, the edges darkening. */}
        <Svg width={gw} height={gh} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="streak" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.3" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </LinearGradient>
            <RadialGradient id="vignette" cx="50%" cy="50%" r="60%">
              <Stop offset="0.55" stopColor="#141826" stopOpacity="0" />
              <Stop offset="1" stopColor="#141826" stopOpacity="0.6" />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={gw} height={gh} fill="#6E8296" fillOpacity={0.16} />
          <Path d={`M${gw * 0.08} ${gh * 0.62} L${gw * 0.5} ${gh * 0.06} L${gw * 0.62} ${gh * 0.06} L${gw * 0.2} ${gh * 0.62} Z`} fill="url(#streak)" />
          <Path d={`M${gw * 0.3} ${gh * 0.7} L${gw * 0.74} ${gh * 0.12} L${gw * 0.78} ${gh * 0.12} L${gw * 0.34} ${gh * 0.7} Z`} fill="url(#streak)" opacity={0.7} />
          <G fill="#3A3C44">
            <Circle cx={gw * 0.06} cy={gh * 0.86} r={3} fillOpacity={0.25} />
            <Circle cx={gw * 0.1} cy={gh * 0.92} r={1.6} fillOpacity={0.3} />
            <Circle cx={gw * 0.93} cy={gh * 0.74} r={2.4} fillOpacity={0.22} />
            <Circle cx={gw * 0.88} cy={gh * 0.95} r={4} fillOpacity={0.18} />
            <Circle cx={gw * 0.04} cy={gh * 0.45} r={1.4} fillOpacity={0.25} />
          </G>
          <Rect x={0} y={0} width={gw} height={gh} fill="url(#vignette)" />
        </Svg>
      </View>
      {/* The gilt bead round the glass, and the ink line where frame meets glass. */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Path d={arch(F - 3)} fill="none" stroke={BRASS.light} strokeWidth={3} />
        <Path d={arch(F - 3)} fill="none" stroke={BRASS.deep} strokeOpacity={0.8} strokeWidth={1} strokeDasharray="1.5 3.5" />
        <Path d={arch(F)} fill="none" stroke={INK} strokeWidth={1.6} />
        <Path d={arch(F - 6)} fill="none" stroke={INK} strokeOpacity={0.5} strokeWidth={1} />
      </Svg>
    </View>
  );
}

/** The close mark: an × in two quick pen strokes. */
function InkCross({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Path d="M3 3.4 C6 6.2 9.6 9.8 13 12.8" stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Path d="M12.6 3 C9.6 6.4 6.6 9.4 3.2 13" stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", justifyContent: "center", zIndex: 90 },
  scene: { alignItems: "center" },
  lamp: { height: LAMP_H, zIndex: 3 },
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
  close: { position: "absolute", right: 16, width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center", zIndex: 4 },
});
