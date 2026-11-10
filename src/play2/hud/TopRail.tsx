// The top of the game's frame: a rail of the mode's wood over the room, a
// brass strip let into its lower edge, and three things on it. The way back
// is a brass key tab; the casebook is a little cloth-bound book, a paper tab
// stuck in it for each clue not yet read; and the case itself is a small
// in-world object between them, never a band of text: a typed slip under a
// paper clip (noir), a manila evidence tag on red twine (crime scene), an
// engraved brass plate (paranormal). The slip shows one line; a tap folds
// the whole case out over the room for a few seconds and puts it away again,
// so the photo keeps every point it can. The rail's height never changes
// (nothing below it jumps).
import { memo, useEffect, useId, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import type { Genre } from "@/lib/puzzle-types";
import { useModeTheme } from "@/game/mode";
import { LETTER_FONT } from "@/theme/payoff";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { PaperClip } from "../letters/Marks";
import { InkMark } from "./Ink";
import { Brass, BRASS, EdgeShadow, hidden, INK, Plank, useHudMaterials, type HudMaterials } from "./materials";
import { Press } from "./Press";

/** The rail's height under the status bar (paranormal's carries the presence under its plate). */
export const RAIL = { noir: 50, crime_scene: 50, paranormal: 64 } satisfies Record<Genre, number>;
export const railHeight = (genre: Genre | null | undefined) => RAIL[genre ?? "noir"];

const SIDE = 46;
const GUTTER = 10;
const GAP = 8;
/** How long the case stays folded out. */
const OPEN_MS = 7000;

export interface TopRailProps {
  objective: string;
  unread: number;
  onBack: () => void;
  onCasebook: () => void;
  /** Under the case's plate (paranormal's presence). */
  below?: ReactNode;
}

export function TopRail({ objective, unread, onBack, onCasebook, below }: TopRailProps) {
  const insets = useSafeAreaInsets();
  const m = useHudMaterials();
  const h = railHeight(m.genre);
  return (
    <View style={[styles.rail, { height: insets.top + h }]} pointerEvents="box-none" testID="v2-rail">
      <Plank height={insets.top + h} lit="bottom" brass={3} seed={11} />
      <EdgeShadow height={14} from="top" color={m.shadow} opacity={0.75} style={[styles.cast, { top: insets.top + h }]} />
      <View style={[styles.row, { top: insets.top, height: h - 3 }]} pointerEvents="box-none">
        <Press onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={styles.side} testID="v2-back">
          <KeyTab />
        </Press>
        <View style={styles.middle} pointerEvents="box-none">
          <CaseSlip text={objective} below={below} />
        </View>
        <Press
          onPress={onCasebook}
          accessibilityRole="button"
          accessibilityLabel={unread ? `Casebook, ${unread} new` : "Casebook"}
          hitSlop={8}
          style={styles.side}
          testID="v2-casebook-open"
        >
          <BookMark />
          {unread ? <UnreadTab count={unread} /> : null}
        </Press>
      </View>
    </View>
  );
}

/** The way back: a brass key tab, pointed the way it goes, its ring's hole at the point, an arrow cut into it. */
const KeyTab = memo(function KeyTab() {
  const id = `kt${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const d = "M15.5 2.2 C23 1.6 33 1.9 40.6 2.3 C43.2 2.5 44.4 3.8 44.5 6.2 C44.9 13 44.8 25 44.4 31.8 C44.2 34.3 43 35.6 40.5 35.7 C33 36.2 23 36.3 15.4 35.8 C14.2 35.7 13.4 35.2 12.6 34.2 C9.4 30.2 5.6 25.4 2.6 21.2 C1.5 19.7 1.5 18.3 2.6 16.8 C5.6 12.6 9.4 7.8 12.6 3.8 C13.4 2.8 14.2 2.3 15.5 2.2 Z";
  return (
    <View style={styles.tab} {...hidden}>
      <Svg width={46} height={38} viewBox="0 0 46 38">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset={0} stopColor={BRASS.sheen} />
            <Stop offset={0.32} stopColor={BRASS.light} />
            <Stop offset={0.66} stopColor={BRASS.mid} />
            <Stop offset={1} stopColor={BRASS.shade} />
          </LinearGradient>
        </Defs>
        <Path d={d} fill="rgba(0,0,0,0.45)" transform="translate(0.8 1.8)" />
        <Path d={d} fill={`url(#${id})`} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
        <Path d="M15.6 4 C23 3.5 33 3.7 40.2 4.1" stroke={BRASS.sheen} strokeWidth={1.2} strokeLinecap="round" opacity={0.9} fill="none" />
        <Path d="M42.8 8 C43.1 15 43 25 42.7 31.4 M40 34 C33 34.4 23 34.5 16 34.1" stroke={BRASS.deep} strokeWidth={1.1} strokeLinecap="round" opacity={0.55} fill="none" />
        <Circle cx={8.6} cy={19} r={2.5} fill={INK} />
        <Path d="M6.6 18.2 A2.5 2.5 0 0 1 10.4 17.4" stroke={BRASS.deep} strokeWidth={0.9} fill="none" />
      </Svg>
      <View style={styles.tabMark}>
        <InkMark name="back" size={24} tone="engraved" weight={2.4} />
      </View>
    </View>
  );
});

/** The casebook: a little cloth-bound book in the mode's colour, a foil frame on its cover, its pages' edge, a ribbon. */
const BookMark = memo(function BookMark() {
  const m = useHudMaterials();
  const { cover, spine, ribbon } = m.book;
  return (
    <View style={styles.book} {...hidden}>
      <Svg width={44} height={46} viewBox="0 0 44 46">
        <Path d="M8 8.4 C17 7.6 28 7.8 37 8.6 L37.6 39.4 C28 40 17 40.2 8.6 39.6 Z" fill="rgba(0,0,0,0.45)" transform="translate(1.2 2)" />
        {/* The pages, a sliver proud of the cover along the fore edge and the foot. */}
        <Path d="M10.6 6.6 L38.4 7.2 L38.8 38.6 L11 39.6 Z" fill="#F4E5C8" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
        <Path d="M36.4 9 L36.7 37.4 M37.6 9.4 L37.8 37" stroke="#C9B38A" strokeWidth={0.6} />
        {/* The ribbon, out of the foot. */}
        <Path d="M24.6 37.4 L24.4 45 L27 42.8 L29.6 45.2 L29.4 37.2 Z" fill={ribbon} stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
        {/* The cover. */}
        <Path d="M8.6 4.6 C16 3.9 27 4 34.6 4.6 C35.6 4.7 36 5.2 36 6.2 L36.2 35.8 C36.2 36.8 35.8 37.3 34.8 37.4 C27 38 16 38 8.6 37.4 C7.4 37.3 6.8 36.8 6.8 35.6 L6.6 6.4 C6.6 5.2 7.2 4.7 8.6 4.6 Z" fill={cover} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
        <Path d="M6.8 6 C8.6 5.4 10.4 5.4 11.6 5.8 L11.8 36.6 C10.2 37 8.4 37 7 36.4 Z" fill={spine} />
        <Path d="M11.7 5.4 L11.9 37" stroke={INK} strokeWidth={0.9} opacity={0.6} />
        <Path d="M8.2 10.4 L10.6 10.4 M8.2 31.6 L10.6 31.6" stroke={m.foil} strokeWidth={1} strokeLinecap="round" opacity={0.9} />
        {/* The foil frame and its lines. */}
        <Rect x={16} y={10} width={15.6} height={10.4} rx={1.2} fill="none" stroke={m.foil} strokeWidth={1.1} />
        <Path d="M19 13.6 L28.6 13.6 M20.4 16.8 L27.2 16.8" stroke={m.foil} strokeWidth={1.1} strokeLinecap="round" />
        <Path d="M23.8 25 Q24.9 27.6 27.4 28.6 Q24.9 29.6 23.8 32.2 Q22.7 29.6 20.2 28.6 Q22.7 27.6 23.8 25 Z" fill={m.foil} />
        <Path d="M14 6.6 C20 6.2 28 6.3 33.6 6.7" stroke="rgba(255,255,255,0.28)" strokeWidth={1} strokeLinecap="round" fill="none" />
      </Svg>
    </View>
  );
});

/** Clues not yet read: a paper tab stuck in the book's top corner, the count on it in pen. */
function UnreadTab({ count }: { count: number }) {
  const m = useHudMaterials();
  const theme = useModeTheme();
  return (
    <View style={styles.unread} testID="v2-casebook-badge" pointerEvents="none">
      <Svg width={20} height={22} viewBox="0 0 20 22" style={StyleSheet.absoluteFill}>
        <Path d="M2.4 1.6 L17.8 1 L18.6 19.6 L15.6 17.8 L12.6 20.2 L9.6 18 L6.4 20.4 L3 18.2 Z" fill="rgba(0,0,0,0.4)" transform="translate(0.6 1.2)" />
        <Path d="M2.4 1.6 L17.8 1 L18.6 19.6 L15.6 17.8 L12.6 20.2 L9.6 18 L6.4 20.4 L3 18.2 Z" fill={m.book.tab} stroke={INK} strokeWidth={1} strokeLinejoin="round" />
      </Svg>
      <Text style={[styles.unreadText, { color: m.book.tabInk, fontFamily: typeof theme.hand.fontFamily === "string" ? theme.hand.fontFamily : ref.font.hand }]} allowFontScaling={false}>
        {count > 9 ? "9+" : count}
      </Text>
    </View>
  );
}

/** The case's faces: a typewriter's (noir), a typed report's under a form's label (crime scene), an engraver's (paranormal). */
const FACE: Record<Genre, { label: object; text: object; name: string }> = {
  noir: {
    name: "The case",
    label: { fontFamily: LETTER_FONT.typewriter, fontSize: 10, lineHeight: 12, letterSpacing: 1.6, textTransform: "uppercase" },
    text: { fontFamily: LETTER_FONT.typewriter, fontSize: 13, lineHeight: 17 },
  },
  crime_scene: {
    name: "The case",
    label: { fontFamily: LETTER_FONT.form, fontSize: 9.5, lineHeight: 12, letterSpacing: 1.5, textTransform: "uppercase" },
    text: { fontFamily: LETTER_FONT.report, fontSize: 13, lineHeight: 17 },
  },
  paranormal: {
    name: "The case",
    label: { fontFamily: LETTER_FONT.fell, fontSize: 10.5, lineHeight: 12, letterSpacing: 2, textTransform: "uppercase" },
    text: { fontFamily: LETTER_FONT.fellItalic, fontSize: 14.5, lineHeight: 18 },
  },
};

/** What the slip is cut from, per mode: its ink, its label's ink, how it lies. */
function slipLook(m: HudMaterials) {
  if (m.genre === "paranormal") return { ink: "#33200A", label: BRASS.deep, tilt: 0, brass: true };
  return { ink: m.paper.ink, label: m.paper.pen, tilt: m.genre === "noir" ? -0.7 : 0.5, brass: false };
}

/**
 * The case, as a thing on the rail. One line at rest; tapped, the whole of it
 * folds out underneath for a few seconds (over the room, taking no touches),
 * then puts itself away. Screen readers get all of it as the label.
 */
function CaseSlip({ text, below }: { text: string; below?: ReactNode }) {
  const m = useHudMaterials();
  const { reducedMotion } = useTheme();
  const face = FACE[m.genre];
  const look = slipLook(m);
  const [open, setOpen] = useState(false);
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.set(withTiming(open ? 1 : 0, { duration: reducedMotion ? 0 : open ? 220 : 160 }));
    if (!open) return;
    const t = setTimeout(() => setOpen(false), OPEN_MS);
    return () => clearTimeout(t);
  }, [open, shown, reducedMotion]);
  const fold = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ translateY: (shown.get() - 1) * 10 }, { rotate: `${look.tilt}deg` }] }));
  const tilt = look.tilt ? { transform: [{ rotate: `${look.tilt}deg` }] } : null;
  return (
    <>
      <Press
        onPress={() => setOpen((o) => !o)}
        cue="tick"
        scale={0.97}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Objective: ${text}`}
        accessibilityHint={open ? "Tap to put it away." : "Tap to read it in full."}
        accessibilityState={{ expanded: open }}
        style={[styles.slip, tilt]}
        testID="v2-objective"
      >
        <SlipFace m={m}>
          <View style={styles.slipText}>
            <Text style={[face.label, { color: look.label }]} numberOfLines={1} allowFontScaling={false}>{face.name}</Text>
            {/* Folded out, the line is on the sheet below: the slip keeps its height (nothing jumps), its line blank. */}
            <Text style={[face.text, look.brass ? styles.engraved : null, { color: look.ink, opacity: open ? 0 : 1 }]} numberOfLines={1} allowFontScaling={false} selectable={false} testID="v2-objective-line">
              {text}
            </Text>
          </View>
          <InkMark name={open ? "up" : "down"} size={14} color={look.label} weight={2.4} tone={look.brass ? "engraved" : "ink"} />
        </SlipFace>
        {m.genre === "noir" ? <PaperClip color={LETTER_CLIP} size={30} rotate={8} style={styles.clip} /> : null}
      </Press>
      {below ? <View style={styles.below} pointerEvents="none">{below}</View> : null}
      {/* The whole case, folded out under the slip. */}
      <Animated.View style={[styles.fold, { top: railHeight(m.genre) - 7 }, fold]} pointerEvents="none" testID="v2-objective-full">
        <View style={[styles.foldBody, look.brass ? null : { backgroundColor: m.paper.fill }, { shadowColor: m.shadow }]} {...hidden}>
          {look.brass ? <Brass radius={4} /> : null}
          <Text style={[face.text, look.brass ? styles.engraved : null, styles.foldText, { color: look.ink }]}>{text}</Text>
        </View>
      </Animated.View>
    </>
  );
}

const LETTER_CLIP = "#8A8391";

/** The slip itself: paper under a clip, a manila tag with its eyelet on twine, or a brass plate on two screws. */
function SlipFace({ m, children }: { m: HudMaterials; children: ReactNode }) {
  if (m.genre === "paranormal") {
    return (
      <View style={[styles.face, styles.plate]}>
        <Brass radius={4} />
        <Screw />
        {children}
        <Screw />
      </View>
    );
  }
  if (m.genre === "crime_scene") {
    return (
      <View style={styles.tagRow}>
        <View style={styles.tagCap} {...hidden}>
          <Svg width={20} height={46} viewBox="0 -10 20 46">
            <Path d="M20 0 H8.4 L0.6 8.6 V27.4 L8.4 36 H20 Z" fill={m.paper.fill} />
            <Path d="M20 0.6 H8.6 L1.2 8.8 V27.2 L8.6 35.4 H20" stroke={m.paper.shade} strokeWidth={1} fill="none" />
            <Circle cx={10.4} cy={18} r={5} fill={m.paper.shade} />
            <Circle cx={10.4} cy={18} r={2.3} fill={INK} />
            {/* The twine, through the eyelet and up over the rail. */}
            <Path d="M10.6 17.6 C6.4 12 4.6 4 7.4 -10" stroke="#B3182F" strokeWidth={1.5} strokeLinecap="round" fill="none" />
            <Path d="M10.2 18.4 C8.6 10 10.4 0 14.6 -10" stroke="#8E1225" strokeWidth={1.5} strokeLinecap="round" fill="none" />
          </Svg>
        </View>
        <View style={[styles.face, styles.tag, { backgroundColor: m.paper.fill, borderColor: m.paper.shade }]}>{children}</View>
      </View>
    );
  }
  return <View style={[styles.face, styles.paper, { backgroundColor: m.paper.fill, shadowColor: m.shadow }]}>{children}</View>;
}

/** A slotted brass screw head. */
const Screw = memo(function Screw() {
  return (
    <View style={styles.screw} {...hidden}>
      <Svg width={9} height={9} viewBox="0 0 9 9">
        <Circle cx={4.5} cy={4.5} r={3.6} fill={BRASS.mid} stroke={BRASS.deep} strokeWidth={0.9} />
        <Path d="M2.4 5.8 L6.6 3.2" stroke={BRASS.deep} strokeWidth={1.1} strokeLinecap="round" />
        <Path d="M2.2 3.4 A3 3 0 0 1 5 1.6" stroke={BRASS.sheen} strokeWidth={0.8} fill="none" strokeLinecap="round" />
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  rail: { position: "absolute", left: 0, right: 0, top: 0, zIndex: 20 },
  cast: { position: "absolute", left: 0, right: 0 },
  row: { position: "absolute", left: 0, right: 0, flexDirection: "row", alignItems: "center", paddingHorizontal: GUTTER, gap: GAP },
  side: { width: SIDE, height: 44, alignItems: "center", justifyContent: "center" },
  middle: { flex: 1, alignSelf: "stretch", justifyContent: "center" },
  tab: { width: 46, height: 38 },
  tabMark: { position: "absolute", left: 15, top: 7 },
  book: { width: 44, height: 46, marginTop: 2 },
  unread: { position: "absolute", top: -3, right: -3, width: 20, height: 22, alignItems: "center", transform: [{ rotate: "7deg" }] },
  unreadText: { fontSize: 14, lineHeight: 17, marginTop: 1 },
  slip: { alignSelf: "stretch" },
  face: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 12, paddingRight: 8, paddingVertical: 3 },
  paper: { borderRadius: 1.5, paddingLeft: 22, shadowOpacity: 0.5, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  plate: { paddingLeft: 7, paddingRight: 7, minHeight: 34 },
  tagRow: { flexDirection: "row", alignItems: "stretch" },
  tagCap: { width: 20, height: 36, marginRight: -0.5, overflow: "visible", justifyContent: "flex-end" },
  tag: { flex: 1, paddingLeft: 4, borderTopRightRadius: 3, borderBottomRightRadius: 3, borderTopWidth: 1, borderBottomWidth: 1, borderRightWidth: 1 },
  slipText: { flex: 1 },
  engraved: { textShadowColor: "rgba(255, 240, 200, 0.55)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0 },
  clip: { position: "absolute", left: 5, top: -7 },
  screw: { width: 9, height: 9 },
  below: { alignItems: "center", marginTop: 3 },
  // Under the rail, over the room: as wide as the slip, hung from where the slip ends.
  fold: { position: "absolute", left: 0, right: 0, zIndex: 2 },
  foldBody: { borderRadius: 2, paddingHorizontal: 12, paddingVertical: 9, shadowOpacity: 0.55, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  foldText: { textAlign: "left" },
});
