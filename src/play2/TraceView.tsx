// A UV trace, looked at closely: the trace itself, big, on the surface it is on, and nothing else. No
// report, no caption: what it is can be seen, and what it means is the player's to work out by comparing
// it with what else is in the room. Fingertips show their ridge pattern (and a scar, if there is one);
// a footprint is one sole from above beside a scale, so its size and its tread can be read; a stain shows
// its shape and its colour under the light; writing is its words in the hand they were written in.
//
// It is drawn here at its own size (never the room's photo scaled up, which a phone draws soft), from
// the same drawing as the trace on the photo (traceArt.ts). Opening it asks the engine for nothing.
// Tap outside it, the cross, or Android back to go.
import { useEffect } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Canvas, Group, Line as SkLine, Path, vec } from "@shopify/react-native-skia";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { XIcon } from "phosphor-react-native";
import type { Genre } from "@/lib/puzzle-types";
import { TreatedImage } from "@/components/noir";
import { useModeTheme } from "@/game/mode";
import type { SceneSource } from "@/render/SceneView";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { handStyle, lookOf, SOLE_CM, soleArt, textEms, traceArt, type TraceLook } from "./traceArt";
import { Lettering, TraceShape, UV, type StageTrace } from "./UvTrace";

export interface TraceViewProps {
  trace: StageTrace;
  genre: Genre;
  /** The photo it is on, and its width over its height: the surface under the trace. */
  photo?: { source: SceneSource; cacheKey?: string; aspect: number };
  onClose: () => void;
}

/** The scale beside a footprint runs to this many centimetres. */
const RULE_CM = 34;

/** What a screen reader hears: what can be seen, never what it means. */
export function describeTrace(t: Pick<StageTrace, "kind" | "label" | "mark">, look: TraceLook): string {
  switch (t.kind) {
    case "footprints": return `${t.label}: ${look.tread === "bare" ? "bare feet" : `a sole with ${look.tread}`}, ${SOLE_CM[look.size]} centimetres long`;
    case "prints":
    case "palm": return `${t.label}: ${look.pattern} pattern${look.scar ? ", with a scar across it" : ""}`;
    case "stain": return `${t.label}: ${look.stain}`;
    case "writing": return `${t.label}: ${t.mark ?? ""}`;
  }
}

export function TraceView({ trace, genre, photo, onClose }: TraceViewProps) {
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  const { width: winW, height: winH } = useWindowDimensions();
  const look = lookOf(trace, genre);
  const PW = Math.min(winW - 2 * ref.space.lg, 420);
  const PH = Math.min(trace.kind === "writing" ? PW * 0.8 : PW * 1.18, winH * 0.62);

  const rise = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    rise.set(withTiming(1, { duration: reducedMotion ? 0 : 200, easing: Easing.out(Easing.cubic) }));
  }, [rise, reducedMotion]);
  // Opacity and a small lift only: a scale would draw it soft while it moved.
  const plateStyle = useAnimatedStyle(() => ({ opacity: rise.get(), transform: [{ translateY: (1 - rise.get()) * 14 }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: rise.get() * 0.9 }));

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  // The trace's box on the plate: the photo is laid under it at the same scale, so the trace sits where it is.
  const a = photo?.aspect ?? 0.56;
  const bw = trace.box.w * a, bh = trace.box.h;   // in photo heights
  const k = Math.min((PW * 0.9) / bw, (PH * 0.88) / bh);
  const rect = { x: PW / 2 - (bw * k) / 2, y: PH / 2 - (bh * k) / 2, w: bw * k, h: bh * k };
  const image = { width: a * k, height: k, left: PW / 2 - (trace.box.x + trace.box.w / 2) * a * k, top: PH / 2 - (trace.box.y + trace.box.h / 2) * k };

  return (
    <View style={styles.root} testID="v2-trace-view">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.ground }, scrimStyle]} />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Back to the room" testID="v2-trace-away" />
      <Animated.View
        style={[styles.plate, { width: PW, height: PH, borderColor: "rgba(190,160,255,0.5)" }, plateStyle]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={describeTrace(trace, look)}
        testID="v2-trace-plate"
      >
        {/* The surface it is on, under the UV light. */}
        {photo ? (
          <TreatedImage source={photo.source} genre={null} cacheKey={photo.cacheKey} contentFit="fill" accessible={false} style={[styles.photo, image]} />
        ) : null}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.uv]} />
        {trace.kind === "writing" ? (
          <Words text={trace.mark ?? ""} look={look} surfaceSeed={trace.seed} width={PW} />
        ) : trace.kind === "footprints" ? (
          <Footprint trace={trace} genre={genre} look={look} width={PW} height={PH} />
        ) : (
          <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" testID="v2-trace-art">
            <TraceShape art={traceArt(trace, rect, genre, Math.max(3, Math.min(rect.w, rect.h) / 34))} scale={1.6} />
          </Canvas>
        )}
      </Animated.View>
      <Animated.View style={[styles.closeWrap, { top: (winH - PH) / 2 - 56, right: (winW - PW) / 2 }, plateStyle]}>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} testID="v2-trace-close" style={[styles.close, { backgroundColor: theme.raised, borderColor: theme.rim }]}>
          <XIcon size={20} weight="bold" color={theme.ink} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** The words, big, in their hand: as they are on the wall. */
function Words({ text, look, surfaceSeed, width }: { text: string; look: TraceLook; surfaceSeed: number; width: number }) {
  const style = handStyle(look.hand);
  const inner = width - 2 * ref.space.xl;
  const ems = textEms(text, style.em);
  // One line when it fits at a good size, else wrapped: never small.
  const size = Math.round(Math.max(34, Math.min(64, inner / (ems + (style.text.letterSpacing ?? 0) * text.length / 20))));
  const lines = Math.min(5, Math.max(1, Math.ceil((ems * size * 1.06) / inner)));
  const tilt = -3 + (surfaceSeed % 5);
  return (
    <View style={styles.words} pointerEvents="none" testID="v2-trace-words">
      <View style={{ width: inner, transform: [{ rotate: `${tilt}deg` }, ...(style.skew === "0deg" ? [] : [{ skewX: style.skew }])] }}>
        <Lettering text={text} hand={look.hand} size={size} lineHeight={Math.ceil(size * 1.2)} lines={lines} />
      </View>
    </View>
  );
}

/** One sole from above, heel down, beside a scale in centimetres: its size and its tread, to be read off. */
function Footprint({ trace, genre, look, width, height }: { trace: StageTrace; genre: Genre; look: TraceLook; width: number; height: number }) {
  const pad = 22;
  const perCm = (height - 2 * pad) / RULE_CM;
  const L = SOLE_CM[look.size] * perCm;
  const base = height - pad;             // the scale's zero, at the heel
  const ruleX = 46;
  const cx = ruleX + (width - ruleX) / 2;
  const ticks: { y: number; len: number }[] = [];
  for (let cm = 0; cm <= RULE_CM; cm++) ticks.push({ y: base - cm * perCm, len: cm % 5 === 0 ? 14 : 7 });
  return (
    <>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" testID="v2-trace-art">
        <TraceShape art={soleArt(trace, cx, base - L / 2, L, genre)} scale={1.6} />
        {/* The scale: a rule up the side from the heel, a tick a centimetre, a long one every five. */}
        <Group>
          <SkLine p1={vec(ruleX, base)} p2={vec(ruleX, base - RULE_CM * perCm)} color={RULE} strokeWidth={1.5} />
          {ticks.map((t, i) => <SkLine key={i} p1={vec(ruleX, t.y)} p2={vec(ruleX - t.len, t.y)} color={RULE} strokeWidth={t.len > 8 ? 1.5 : 1} />)}
          {/* Where the heel and the toe come to on it. */}
          <Path path={`M${ruleX} ${base} L${cx - L * 0.2} ${base} M${ruleX} ${base - L} L${cx - L * 0.2} ${base - L}`} color={RULE_FAINT} style="stroke" strokeWidth={1} />
        </Group>
      </Canvas>
      {ticks.filter((_, cm) => cm % 5 === 0 && cm > 0).map((t, i) => (
        <Text key={i} style={[styles.cm, { top: t.y - 8, left: 2, width: ruleX - 18 }]} accessible={false}>{(i + 1) * 5}</Text>
      ))}
      <Text style={[styles.cm, styles.unit, { top: base - RULE_CM * perCm - 2, left: ruleX + 6 }]} accessible={false}>cm</Text>
    </>
  );
}

const RULE = "rgba(244,238,255,0.92)";
const RULE_FAINT = "rgba(244,238,255,0.4)";

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", zIndex: 55 },
  plate: { borderRadius: 18, borderWidth: 1.5, overflow: "hidden", backgroundColor: "#120A26" },
  photo: { position: "absolute" },
  // The room's dark and the lamp's violet over the surface: it stays the surface, and the trace stands off it.
  uv: { backgroundColor: "rgba(26,8,64,0.8)" },
  words: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  cm: { position: "absolute", fontFamily: ref.font.typewriterBold, fontSize: 13, lineHeight: 16, color: UV.ink, textAlign: "right" },
  unit: { textAlign: "left", fontSize: 12 },
  closeWrap: { position: "absolute" },
  close: { width: 40, height: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
});
