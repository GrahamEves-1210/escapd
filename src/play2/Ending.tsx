// The way out (gameplay v2 §2 pacing, "Payoff"): every room ends at its real
// door. First a beat for the door itself (the close-up's last moment shows
// under it, then the door's photo comes up and the view pushes in), then the
// mode's moment (letters/Moments.tsx, rendered parts): noir's door swings
// open onto a wet street at night and she walks out into it; crime scene's
// file takes a rubber stamp, CASE CLOSED; paranormal's candle gutters and
// goes out, a wisp of smoke off its wick. Then the ending comes up as the
// last of her correspondence (docs/ART_DIRECTION.md, the mystery-book core).
// "Close the case" goes on to case closed. With reduced motion there is no
// moment: the mode's light (candle, desk lamp, spirit mint: theme.glow)
// comes up out of the door and the letter is there.
//
// The letter: once the moment is over the screen settles, as eyes do,
// to the room's own dark with the doorway's glow still pooled in it, and the
// reply to her brief lies there, the last of the same correspondence
// (src/play2/letters: noir's hotel notecard, crime scene's closing sheet with
// the door's print and "The End" stamped, paranormal's old letter with its
// seal whole again). Its running head is the series line and the case's
// number (never an invented title), the headline in the mode's voice (never
// one that says what the ending's own text already says), the ending's
// text, "The End". The cat sits on the letter, its paw prints
// across it. "Close the case" at the foot, at least ref.space.lg off the
// bottom edge.
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { Canvas, Circle, RadialGradient, vec } from "@shopify/react-native-skia";
import Svg, { Defs, RadialGradient as SvgRadial, Rect, Stop } from "react-native-svg";
import type { Rect as Box } from "@/engine/v2";
import type { Genre } from "@/lib/puzzle-types";
import { TreatedImage } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { themeFor } from "@/game/mode";
import type { SceneSource } from "@/render/SceneView";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import { SERIES_LINE, caseLabel } from "@/render/victory";
import { LIGHT, alpha, mix } from "@/theme/payoff";
import { CrimeReply } from "./letters/Crime";
import { MoonReply } from "./letters/Moon";
import { MOMENT, Moment } from "./letters/Moments";
import { NoirReply } from "./letters/Noir";

/** The beats, in ms after the room is solved. */
export const ENDING = {
  /** The close-up's last moment (the door giving) shows under it, then the door's photo fades up. */
  appear: 450,
  fade: 350,
  /** The mode's moment starts (the door swings, the stamp comes down, the candle gutters), and runs for `light`. */
  lightAt: 1100,
  light: 1600,
  /** The view pushes in on the door until the moment is over. */
  push: 1.12,
  /** After the moment, the screen settles to the room's dark round the letter over this long; the letter comes down `letterAfter` into it. */
  settle: 900,
  letterAfter: 250,
  /** Reduced motion: no push, no hold; the light simply comes up. */
  reducedLight: 200,
} as const;

/** The headline, in the mode's voice; the second when the ending's text already says the first. */
const HEADLINES: Record<Genre, readonly string[]> = {
  noir: ["Out into the night.", "You walk out."],
  crime_scene: ["You named them.", "Out past the tape."],
  paranormal: ["It lets you go.", "Into the light."],
};

/**
 * Each mode's light, from its glow: the light's stops (white-hot at the
 * door, the glow round it, fading out) and the page of light it fills the
 * screen with (the glow, mostly white); then the dark it settles to (the
 * mode's ground) with the doorway's glow still pooled where the letter lies.
 */
export function endingLight(genre: Genre): { glow: [string, string, string]; wash: string; desk: string; pool: string } {
  const theme = themeFor(genre);
  return {
    glow: [mix(theme.glow, LIGHT.white, 0.75), alpha(mix(theme.glow, LIGHT.white, 0.35), 0.9), alpha(theme.glow, 0)],
    wash: mix(theme.glow, LIGHT.white, 0.8),
    desk: theme.ground,
    pool: theme.glow,
  };
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();

/** The mode's headline that doesn't say what `text` already says. */
export function endingHeadline(genre: Genre, text: string): string {
  const said = words(text);
  const options = HEADLINES[genre];
  return options.find((h) => !said.includes(words(h))) ?? options[options.length - 1];
}

/** The page's running head: the series line, and the case's number when the room is known. */
export function runningHead(genre: Genre, roomId?: string): string {
  return roomId ? `${SERIES_LINE[genre]} \u00b7 ${caseLabel(roomId)}` : SERIES_LINE[genre];
}

const REPLY = { noir: NoirReply, crime_scene: CrimeReply, paranormal: MoonReply } as const;

export function Ending({ text, door, genre, roomId, onDone }: {
  text: string;
  door?: { source: SceneSource; cacheKey?: string; box: Box };
  genre: Genre;
  /** The room: its case number in the running head. */
  roomId?: string;
  onDone: () => void;
}) {
  const theme = themeFor(genre);
  const look = endingLight(genre);
  const feedback = useFeedback();
  const { reducedMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const shown = useSharedValue(reducedMotion ? 1 : 0);
  const push = useSharedValue(1);
  const light = useSharedValue(0);
  const moment = useSharedValue(0);
  const settle = useSharedValue(0);
  const lines = useSharedValue(0);

  useEffect(() => {
    feedback.unlock();
    const lightAt = reducedMotion ? 0 : ENDING.lightAt;
    const d = reducedMotion ? ENDING.reducedLight : ENDING.light;
    if (!reducedMotion) {
      shown.set(withDelay(ENDING.appear, withTiming(1, { duration: ENDING.fade })));
      push.set(withDelay(ENDING.appear, withTiming(ENDING.push, { duration: lightAt + d - ENDING.appear, easing: Easing.inOut(Easing.quad) })));
    }
    const timers = [setTimeout(() => feedback.solved(), lightAt + d)];
    if (reducedMotion) light.set(withTiming(1, { duration: d, easing: Easing.in(Easing.quad) }));
    else {
      moment.set(withDelay(lightAt, withTiming(1, { duration: d, easing: Easing.linear })));
      // The moment's own sound, on its beat: the door sweeping the air, the stamp's thump, the breath that takes the flame.
      const beat = genre === "crime_scene" ? MOMENT.crime_scene.approach[1] : genre === "paranormal" ? MOMENT.paranormal.gutter[1] - 0.06 : MOMENT.noir.sweep;
      timers.push(setTimeout(() => (genre === "crime_scene" ? feedback.stamp() : genre === "paranormal" ? feedback.cloth() : feedback.lensUp()), lightAt + d * beat));
    }
    // The screen settles to the room's dark, and the letter comes down into it.
    lines.set(withDelay(reducedMotion ? 150 : lightAt + d + 150 + ENDING.letterAfter, withTiming(1, { duration: 600 })));
    settle.set(withDelay(reducedMotion ? 150 : lightAt + d + 150, withTiming(1, { duration: reducedMotion ? motion.reducedFade : ENDING.settle, easing: Easing.inOut(Easing.quad) })));
    return () => timers.forEach(clearTimeout);
  }, [feedback, genre, shown, push, light, moment, settle, lines, reducedMotion]);

  // The door's close-up fills the screen; the light spreads from its middle.
  const box = door?.box;
  const scale = box ? Math.min(3, 0.9 / Math.max(box.w, box.h)) : 1;
  const imgW = width * scale;
  const imgH = (width / 0.75) * scale;
  const left = box ? width / 2 - (box.x + box.w / 2) * imgW : 0;
  const top = box ? height / 2 - (box.y + box.h / 2) * imgH : 0;
  const reach = Math.hypot(width, height);
  const r = useDerivedValue(() => 20 + light.get() * reach);
  const rootStyle = useAnimatedStyle(() => ({ opacity: shown.get() }));
  // The push centres on the door (the screen's middle).
  const pushStyle = useAnimatedStyle(() => ({ transform: [{ scale: push.get() }] }));
  const wash = useAnimatedStyle(() => ({ opacity: Math.max(0, light.get() - 0.55) * 1.6 }));
  const settleStyle = useAnimatedStyle(() => ({ opacity: settle.get() }));
  const linesStyle = useAnimatedStyle(() => ({ opacity: lines.get(), transform: [{ translateY: (1 - lines.get()) * 16 }, { rotate: `${(1 - lines.get()) * -2}deg` }] }));
  const headline = endingHeadline(genre, text);
  const Reply = REPLY[genre];

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: theme.ground }, rootStyle]} testID="v2-ending">
      {door ? (
        <Animated.View style={[StyleSheet.absoluteFill, pushStyle]} pointerEvents="none">
          <TreatedImage source={door.source} cacheKey={door.cacheKey} genre={null} contentFit="fill" accessible={false} style={{ position: "absolute", width: imgW, height: imgH, left, top }} />
        </Animated.View>
      ) : null}
      {reducedMotion ? (
        <>
          <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            <Circle cx={width / 2} cy={height / 2} r={r}>
              <RadialGradient c={vec(width / 2, height / 2)} r={r} colors={look.glow} positions={[0, 0.5, 1]} />
            </Circle>
          </Canvas>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: look.wash }, wash]} pointerEvents="none" />
        </>
      ) : (
        <Moment genre={genre} m={moment} width={width} height={height} ms={ENDING.light} />
      )}
      {/* It settles to the room's dark, the doorway's glow pooled where the letter lies. */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: look.desk }, settleStyle]} pointerEvents="none" testID="v2-ending-settle">
        <Svg width="100%" height="100%">
          <Defs>
            <SvgRadial id="endPool" cx="50%" cy="46%" rx="70%" ry="48%" fx="50%" fy="46%">
              <Stop offset={0} stopColor={look.pool} stopOpacity={0.42} />
              <Stop offset={0.6} stopColor={look.pool} stopOpacity={0.1} />
              <Stop offset={1} stopColor={look.pool} stopOpacity={0} />
            </SvgRadial>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#endPool)" />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.words,
          { paddingTop: insets.top + ref.space.lg, paddingBottom: Math.max(insets.bottom + ref.space.sm, ref.space.lg) },
        ]}
        testID="v2-ending-words"
      >
        <ScrollView style={styles.scroll} contentContainerStyle={styles.middle} showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.letter, linesStyle]}>
            <Reply
              head={runningHead(genre, roomId)}
              headline={headline}
              text={text}
              seed={roomId ?? genre}
              door={door ? { source: door.source, cacheKey: door.cacheKey } : undefined}
              catLabel="The black cat, sitting on the letter"
              catDelay={reducedMotion ? 0 : ENDING.lightAt + ENDING.light + ENDING.letterAfter + 700}
            />
          </Animated.View>
        </ScrollView>
        <Animated.View style={[styles.foot, linesStyle]}>
          {/* The one way on: the mode's primary pill (its accent, as Begin on the brief), whatever mode the app is in. */}
          <Pressable
            onPress={onDone}
            accessibilityRole="button"
            accessibilityLabel="Close the case"
            testID="v2-ending-done"
            style={({ pressed }) => [styles.button, { backgroundColor: theme.accent, opacity: pressed ? ref.button.square.pressedOpacity : 1 }]}
          >
            <Text style={[ref.type.headline, { color: theme.accentInk }]}>Close the case</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 80, overflow: "hidden" },
  words: { paddingHorizontal: ref.space.lg },
  scroll: { flex: 1 },
  // The letter, in the middle of the light over the button.
  middle: { flexGrow: 1, justifyContent: "center", paddingVertical: ref.space.sm },
  letter: { alignSelf: "center", width: "100%", maxWidth: 420 },
  foot: { paddingTop: ref.space.sm, paddingHorizontal: 4 },
  button: { minHeight: ref.button.ghost.height, borderRadius: ref.button.ghost.height / 2, alignItems: "center", justifyContent: "center", paddingHorizontal: ref.space.lg },
});
