// A photograph found in the room (a card with the look "photo", or one from a room stored before there
// were looks): an old print of a corner of the player's own room, the thing it shows in the middle of it
// (cutout.ts snapshot: a crop of her photo round the object's box, sepia, faded, vignetted). A cream
// border, the print's grain and sheen, one corner curled up off the paper; turned over (a tap), its back:
// the paper's maker's watermark and what somebody wrote there, in pencil. Nothing is said about it.
// In the casebook it is mounted in brass photo corners; read up close or lying where it was found, loose.
// Reduced motion: it turns over at once.
import { memo, useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { TreatedImage } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { useBaked, type Crop } from "../cutout";
import { cropOf, useShown } from "../shown";
import { handType } from "./palette";
import { softShadow } from "./Paper";

const GRAIN = require("../../../assets/grain.png");

/** The print's paper: its border (aged white), its back (a shade deeper), the pencil on it, the mounts' brass. */
export const PRINT = {
  border: "#EEE5D0",
  edge: "#D8CCB0",
  back: "#E6DBC2",
  watermark: "rgba(120, 98, 64, 0.16)",
  pencil: "#3F3830",
  brass: ["#F2D38E", "#C99A45", "#7A5A22"] as const,
} as const;

/** What a room stored before cards had looks wrote on its photograph: the words on its back. */
const LEGACY = /^Marking the place, a photograph, face down\. On the back: ([\s\S]+)$/;

/** A card that is a photograph: what it shows (a room object, if known) and what's written on its back; else null. */
export function photoOf(card: { id: string; text: string }, def: { look?: string; object?: string } | undefined): { object?: string; back: string } | null {
  if (def?.look === "photo") return { object: def.object, back: card.text };
  const m = LEGACY.exec(card.text.trim());
  return m ? { back: m[1].replace(/\.$/, "") } : null;
}

interface Props {
  /** The room object it shows (its crop is the print); none: a corner of the first photo. */
  object?: string;
  /** What's written on its back. */
  back: string;
  width: number;
  /** Degrees. */
  rotate?: number;
  /** How it's held down: brass photo corners (in the casebook), or nothing (loose). */
  mount?: "corners" | "none";
  /** Turned over to start with. */
  flipped?: boolean;
  /** A tap turns it over (else it's only looked at). */
  turns?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Snapshot({ object, back, width, rotate = 0, mount = "none", flipped = false, turns = true, style, testID }: Props) {
  const shown = useShown();
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  const feedback = useFeedback();
  const crop = cropOf(shown, object) ?? (() => {
    const p = shown.photo(0);
    return p ? { source: p.source, cacheKey: p.cacheKey, box: { x: 0.3, y: 0.32, w: 0.4, h: 0.36 } } : null;
  })();
  const baked = useBaked("snapshot", shown.genre, crop);
  const aspect = baked?.aspect ?? 1;
  const border = Math.max(5, Math.round(width * 0.065));
  const photoW = width - border * 2;
  const photoH = Math.round(photoW / aspect);
  const height = photoH + border * 2 + Math.round(border * 0.5);

  const [over, setOver] = useState(flipped);
  const turn = useSharedValue(flipped ? 1 : 0);
  const frontStyle = useAnimatedStyle(() => ({ transform: [{ perspective: 900 }, { rotateY: `${turn.get() * 180}deg` }] }));
  const backStyle = useAnimatedStyle(() => ({ transform: [{ perspective: 900 }, { rotateY: `${turn.get() * 180 - 180}deg` }] }));
  const flip = () => {
    const next = !over;
    setOver(next);
    feedback.paper();
    turn.set(withTiming(next ? 1 : 0, { duration: reducedMotion ? 0 : 420 }));
  };
  const hand = handType(theme);
  const backSize = width > 230 ? 30 : width > 150 ? 25 : 16;

  const body = (
    <View style={{ width, height }}>
      {/* The print, face up. */}
      <Animated.View style={[styles.face, { width, height, backgroundColor: PRINT.border, padding: border, paddingBottom: border * 1.5 }, softShadow(theme.ground), frontStyle]}>
        <View style={[styles.photo, { width: photoW, height: photoH }]}>
          {baked ? (
            <Image source={{ uri: baked.uri }} style={{ width: photoW, height: photoH }} contentFit="cover" transition={0} accessible={false} pointerEvents="none" />
          ) : crop ? (
            <Fallback crop={crop} w={photoW} h={photoH} />
          ) : null}
          {/* The print's own grain, and a faint sheen across the emulsion. */}
          <Image source={GRAIN} style={[StyleSheet.absoluteFill, styles.grain]} contentFit="cover" accessible={false} pointerEvents="none" />
          <Sheen w={photoW} h={photoH} />
        </View>
        {/* Loose, one corner has curled up off what it lies on (mounted, the brass corners hold it flat). */}
        {mount === "none" && width > 80 ? <Curl size={Math.round(width * 0.14)} /> : null}
      </Animated.View>
      {/* Its back: the maker's watermark, and the pencil. */}
      <Animated.View style={[styles.face, { width, height, backgroundColor: PRINT.back, padding: border * 1.4 }, softShadow(theme.ground), backStyle]}>
        <Watermark w={width} h={height} />
        <Text
          style={[{ fontFamily: hand.family, fontSize: backSize, lineHeight: Math.round(backSize * 1.3), color: PRINT.pencil }, styles.pencil]}
          adjustsFontSizeToFit
          numberOfLines={4}
        >
          {back}
        </Text>
      </Animated.View>
      {mount === "corners" ? <Corners w={width} h={height} size={Math.round(width * 0.16)} /> : null}
    </View>
  );
  const label = `Photograph. ${over ? `On the back: ${back}` : "Turn it over to read the back."}`;
  return (
    <View style={[{ transform: [{ rotate: `${rotate}deg` }] }, style]} testID={testID}>
      {turns ? (
        <Pressable onPress={flip} accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Turns it over" testID={testID ? `${testID}-turn` : "snapshot-turn"}>
          {body}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={`Photograph. On the back: ${back}`}>{body}</View>
      )}
    </View>
  );
}

/** Before its print is baked (or with no Skia): the photo itself, cropped round the thing and toned warm. */
function Fallback({ crop, w, h }: { crop: Crop; w: number; h: number }) {
  const b = crop.box;
  // The photo is drawn so the box's middle sits in the window's middle, the box filling about two thirds of it.
  const scale = Math.min(4, 0.66 / Math.max(b.w, b.h));
  const imgW = w * scale, imgH = (w / 0.75) * scale;
  const left = w / 2 - (b.x + b.w / 2) * imgW, top = h / 2 - (b.y + b.h / 2) * imgH;
  return (
    <View style={{ width: w, height: h, overflow: "hidden" }}>
      <TreatedImage source={crop.source} cacheKey={crop.cacheKey} genre="noir" contentFit="fill" accessible={false} style={{ position: "absolute", width: imgW, height: imgH, left, top }} />
      <View style={[StyleSheet.absoluteFill, styles.tone]} />
    </View>
  );
}

const Sheen = memo(function Sheen({ w, h }: { w: number; h: number }) {
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.16} />
          <Stop offset="0.35" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="1" stopColor="#3A2410" stopOpacity={0.14} />
        </LinearGradient>
      </Defs>
      <Path d={`M0 0H${w}V${h}H0Z`} fill="url(#sheen)" />
    </Svg>
  );
});

/** The bottom right corner, curled up off whatever it lies on: the back's paper shows, a little pencil on it, a shadow under. */
const Curl = memo(function Curl({ size }: { size: number }) {
  const s = size;
  return (
    <View style={[styles.curl, { width: s, height: s }]} pointerEvents="none">
      <Svg width={s} height={s}>
        <Defs>
          <LinearGradient id="curl" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={PRINT.back} />
            <Stop offset="1" stopColor="#C9BB98" />
          </LinearGradient>
        </Defs>
        {/* The corner gone from the front (the table under it). */}
        <Path d={`M${s} 0 L${s} ${s} L0 ${s} Z`} fill="#000000" fillOpacity={0.18} />
        {/* The curled-over flap, its back up. */}
        <Path d={`M${s} 0 Q${s * 0.42} ${s * 0.3} 0 ${s} Q${s * 0.5} ${s * 0.55} ${s} 0 Z`} fill="url(#curl)" stroke={PRINT.edge} strokeWidth={0.6} />
        <Path d={`M${s * 0.62} ${s * 0.42} q${s * 0.08} ${-s * 0.05} ${s * 0.14} ${-s * 0.01}`} stroke={PRINT.pencil} strokeOpacity={0.5} strokeWidth={0.9} fill="none" strokeLinecap="round" />
      </Svg>
    </View>
  );
});

/** The photo paper maker's faint watermark, repeated on the slant across the back. */
const Watermark = memo(function Watermark({ w, h }: { w: number; h: number }) {
  let d = "";
  for (let y = -w; y < h + w; y += 14) d += `M0 ${y} L${w} ${y + w * 0.35}`;
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path d={d} stroke={PRINT.watermark} strokeWidth={0.7} strokeDasharray="10 5 2 5" />
    </Svg>
  );
});

/** Four brass photo corners, holding the print to the page. */
const Corners = memo(function Corners({ w, h, size }: { w: number; h: number; size: number }) {
  const s = size;
  const corner = (key: string, transform: string) => (
    <Path key={key} d={`M0 0 L${s} 0 L0 ${s} Z`} fill="url(#brass)" stroke={PRINT.brass[2]} strokeWidth={0.8} transform={transform} />
  );
  return (
    <Svg width={w + 4} height={h + 4} style={[StyleSheet.absoluteFill, { left: -2, top: -2 }]} pointerEvents="none">
      <Defs>
        <LinearGradient id="brass" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={PRINT.brass[0]} />
          <Stop offset="0.55" stopColor={PRINT.brass[1]} />
          <Stop offset="1" stopColor={PRINT.brass[2]} />
        </LinearGradient>
      </Defs>
      {corner("tl", "translate(0 0)")}
      {corner("tr", `translate(${w + 4} 0) scale(-1 1)`)}
      {corner("bl", `translate(0 ${h + 4}) scale(1 -1)`)}
      {corner("br", `translate(${w + 4} ${h + 4}) scale(-1 -1)`)}
    </Svg>
  );
});

const styles = StyleSheet.create({
  face: { position: "absolute", left: 0, top: 0, borderRadius: 2, backfaceVisibility: "hidden", alignItems: "center", justifyContent: "center" },
  photo: { overflow: "hidden", backgroundColor: "#3A2E22" },
  grain: { opacity: 0.22 },
  tone: { backgroundColor: "#9A6A32", opacity: 0.32 },
  curl: { position: "absolute", right: 0, bottom: 0 },
  pencil: { textAlign: "center", transform: [{ rotate: "-3deg" }] },
});
