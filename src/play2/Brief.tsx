// The brief: a short page of context shown over the room when a case is first
// opened (docs/ART_DIRECTION.md, the mystery-book core), before she plays.
// What happened, who she is, what to find, then the objective and Begin.
// Remembered per room (useBrief): a resumed case opens straight on the room.
//
// Each mode's paper (theme/payoff.ts, BRIEF_PAPER):
// - noir: a book's opening page. The series line over a fleuron rule,
//   "Chapter One" over the case's number, the context set in the book face
//   with a raised initial, "Your case" and the objective; a bookmark ribbon.
// - crime scene: a case dossier. A manila folder with its tab ("Case file"),
//   a typed sheet clipped in it (the typewriter face), CONFIDENTIAL stamped
//   on it, "Summary" and "Assignment".
// - paranormal: a moonlit note. Lavender paper taped on, a crescent moon,
//   the context handwritten in indigo ink, "What it wants".
// The cat sits by the page's foot, with a line for her over the Begin button.
//
// The words: the definition's own `brief` when it has one (the writer's),
// else the mode's opening (BRIEF_OPENING) and the room's objective. The case
// is never named: its series line and its number (victory.ts, caseLabel).
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import type { RoomDefinitionV2 } from "@/engine/v2";
import type { Genre } from "@/lib/puzzle-types";
import { ModePill } from "@/capture/ui/ModePill";
import { themeFor } from "@/game/mode";
import { FleuronRule, Twinkle, Washi } from "@/render/keepsake";
import { SERIES_LINE, caseLabel } from "@/render/victory";
import { useTheme } from "@/theme/ThemeProvider";
import { BRIEF_PAPER, PAGE_INK, PAYOFF_TYPE, alpha, handType } from "@/theme/payoff";
import { font, motion, ref } from "@/theme/tokens";
import { SittingCat } from "./SittingCat";

/** The mode's opening, when the room has no brief of its own: what happened and who she is (the objective says what to find). */
export const BRIEF_OPENING: Record<Genre, string> = {
  noir: "It's past midnight and the rain hasn't let up. You came here to look around, and somebody turned the key behind you. You're the detective: this room is your case now.",
  crime_scene: "The call came in at dawn and the file landed on your desk. You're the investigator, first through the tape, and nothing in the room has been moved. It still remembers what happened.",
  paranormal: "The house went quiet at midnight, and this room hasn't felt right since. You're the one who listens: the candles gutter when you come in, and something here has been waiting for you.",
};

/** What each mode calls the objective on its page. */
export const OBJECTIVE_LABEL: Record<Genre, string> = { noir: "Your case", crime_scene: "Assignment", paranormal: "What it wants" };

/** The cat's line over Begin. */
export const BRIEF_CAT_LINE = "I'll be right here if you need a tip ♥";

/** Begin, in every mode. */
export const BEGIN = "Begin";

/** The brief's sizes. */
export const BRIEF_LAYOUT = {
  edge: 16,
  pad: 22,
  radius: 18,
  maxWidth: 420,
  cat: 62,
  /** Begin's band: its top pad, the pill. */
  actions: ref.space.lg + ref.button.ghost.height,
} as const;
const B = BRIEF_LAYOUT;

const KEY = (roomId: string) => `escapd.v2.brief.${roomId}`;

/**
 * The definition's own brief as plain text, if it has one: a string, a list
 * of lines, or an object of lines (what happened, who you are, what to find).
 */
export function ownBrief(def: Pick<RoomDefinitionV2, "objective"> & { brief?: unknown }): string | null {
  const b = def.brief;
  const text = (v: unknown): string => (typeof v === "string" ? v.trim() : Array.isArray(v) ? v.map(text).filter(Boolean).join(" ") : "");
  if (typeof b === "string" || Array.isArray(b)) return text(b) || null;
  if (b && typeof b === "object") {
    const o = b as Record<string, unknown>;
    const keys = ["text", "context", "story", "what", "happened", "who", "you", "role", "find", "goal"];
    const out = keys.map((k) => text(o[k])).filter(Boolean).join(" ");
    return out || null;
  }
  return null;
}

const content = (s: string) => s.toLowerCase().replace(/[^a-z' ]+/g, " ").split(/\s+/).filter((w) => w.length > 3);

/**
 * The room's brief without the sentences that only say the objective again
 * (most of their words are the objective's): the objective has its own place
 * under it. At least two sentences are kept.
 */
export function withoutObjective(brief: string, objective: string): string {
  const sentences = brief.match(/[^.!?]+[.!?]+["\u201d']?\s*|[^.!?]+$/g)?.map((x) => x.trim()).filter(Boolean) ?? [brief];
  const goal = new Set(content(objective));
  const says = (x: string) => {
    const words = content(x);
    return words.length > 0 && words.filter((w) => goal.has(w)).length / words.length >= 0.6;
  };
  const kept = sentences.filter((x) => !says(x));
  return (kept.length >= 2 ? kept : sentences.slice(0, Math.max(2, kept.length))).join(" ");
}

/** The brief's words: the context (the room's own brief, else the mode's opening) and the objective. */
export function briefWords(def: Pick<RoomDefinitionV2, "mode" | "objective"> & { brief?: unknown }): { context: string; objective: string } {
  const objective = def.objective.trim();
  const own = ownBrief(def);
  return { context: own ? withoutObjective(own, objective) : BRIEF_OPENING[def.mode], objective };
}

/**
 * Whether the brief is up: once the room is ready, on a case not yet begun
 * (`fresh`) in a room whose brief she hasn't dismissed. A case already under
 * way (from before the brief) opens on the room, and its brief counts as seen.
 * `pending`: ready, but not yet known (the device's note is still being read).
 */
export function useBrief(roomId: string, { ready, fresh }: { ready: boolean; fresh: boolean }) {
  // What the device has for this room (null while it is read).
  const [note, setNote] = useState<{ room: string; seen: boolean } | null>(null);
  const seen = note?.room === roomId ? note.seen : null;
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(KEY(roomId))
      .then((v) => !cancelled && setNote({ room: roomId, seen: v === "1" }))
      .catch(() => !cancelled && setNote({ room: roomId, seen: false }));
    return () => {
      cancelled = true;
    };
  }, [roomId]);
  const [open, setOpen] = useState<boolean | null>(null);
  if (open === null && ready && seen !== null) setOpen(!seen && fresh);
  useEffect(() => {
    if (open === false && seen === false) AsyncStorage.setItem(KEY(roomId), "1").catch(() => {});
  }, [open, seen, roomId]);
  const dismiss = useCallback(() => {
    setOpen(false);
    AsyncStorage.setItem(KEY(roomId), "1").catch(() => {});
  }, [roomId]);
  const show = useCallback(() => setOpen(true), []);
  return { open: open === true, pending: ready && open === null, dismiss, show };
}

export function Brief({ def, roomId, onBegin }: {
  def: Pick<RoomDefinitionV2, "mode" | "objective"> & { brief?: unknown };
  roomId: string;
  onBegin: () => void;
}) {
  const genre = def.mode;
  const theme = themeFor(genre);
  const { reducedMotion: reduced } = useTheme();
  const insets = useSafeAreaInsets();
  const words = briefWords(def);
  const label = caseLabel(roomId);

  const shown = useSharedValue(reduced ? 1 : 0);
  const rise = useSharedValue(reduced ? 0 : 18);
  const foot = useSharedValue(reduced ? 1 : 0);
  const out = useSharedValue(1);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (reduced) return;
    shown.set(withTiming(1, { duration: 420 }));
    rise.set(withTiming(0, { duration: 520 }));
    foot.set(withDelay(400, withTiming(1, { duration: 320 })));
  }, [reduced, shown, rise, foot]);
  const begin = () => {
    if (leaving) return;
    setLeaving(true);
    out.set(withTiming(0, { duration: reduced ? motion.reducedFade : 280 }));
    setTimeout(onBegin, reduced ? motion.reducedFade : 280);
  };
  const rootStyle = useAnimatedStyle(() => ({ opacity: out.get() }));
  const pageStyle = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ translateY: rise.get() }] }));
  const footStyle = useAnimatedStyle(() => ({ opacity: foot.get() }));

  const page = genre === "crime_scene"
    ? <Dossier genre={genre} label={label} words={words} />
    : genre === "paranormal"
      ? <MoonNote genre={genre} label={label} words={words} />
      : <OpeningPage genre={genre} label={label} words={words} />;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: theme.ground, paddingTop: insets.top }, rootStyle]} testID={`v2-brief-${genre}`}>
      <Glow glow={theme.glow} sweet={theme.sweet} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} testID="brief-scroll">
        <Animated.View style={[styles.pageWrap, pageStyle]}>
          {page}
          <Twinkle size={14} color={theme.foil} reduced={reduced} style={styles.twinkleA} />
          <Twinkle size={10} color={theme.sweet} delay={700} reduced={reduced} style={styles.twinkleB} />
        </Animated.View>
      </ScrollView>
      <Animated.View style={[styles.foot, { paddingBottom: Math.max(insets.bottom + ref.space.ctaBottom, ref.space.lg) }, footStyle]}>
        {/* The cat, with a word for her. */}
        <View style={styles.catRow}>
          <SittingCat width={B.cat} delay={reduced ? 0 : 450} label="The black cat, ready when you are" />
          <View style={[styles.speech, { backgroundColor: alpha(theme.sweet, 0.12), borderColor: alpha(theme.sweet, 0.35) }]}>
            <Text style={[handType(18, 23), { color: theme.sweet }]} testID="brief-cat-line">{BRIEF_CAT_LINE}</Text>
          </View>
        </View>
        <ModePill variant="ghost" label={BEGIN} onPress={begin} disabled={leaving} testID="v2-brief-begin" />
      </Animated.View>
    </Animated.View>
  );
}

type PageProps = { genre: Genre; label: string; words: { context: string; objective: string } };

/** Noir: the book's opening page. */
function OpeningPage({ genre, label, words }: PageProps) {
  const P = BRIEF_PAPER[genre];
  const ink = PAGE_INK[genre];
  const theme = themeFor(genre);
  const [first, rest] = [words.context.slice(0, 1), words.context.slice(1)];
  return (
    <View>
      <View style={[styles.leaf, { backgroundColor: alpha(P.paper, 0.55) }]} />
      <View style={[styles.paper, { backgroundColor: P.paper, borderRadius: B.radius }]} testID="brief-page">
        <Ribbon color={theme.sweet} />
        <View style={styles.head}>
          <Text style={[ref.type.series, styles.centre, { color: ink }]}>{SERIES_LINE[genre]}</Text>
          <FleuronRule color={PAGE_INK[genre]} width={170} />
        </View>
        <View style={styles.heading}>
          <Text style={[PAYOFF_TYPE.chapter, styles.centre, { color: ink }]}>Chapter One</Text>
          <Text style={[styles.caseNo, { color: P.ink }]} accessibilityRole="header" testID="brief-case">{label}</Text>
        </View>
        <Text style={[styles.book, { color: P.ink }]} testID="brief-context">
          <Text style={[styles.initial, { color: ink, fontFamily: theme.display.fontFamily }]}>{first}</Text>
          {rest}
        </Text>
        <Objective label={OBJECTIVE_LABEL[genre]} text={words.objective} labelColor={ink} color={P.ink} rule={P.rule} textStyle={styles.bookItalic} />
      </View>
    </View>
  );
}

/** Crime scene: a case dossier, a typed sheet clipped into a manila folder. */
function Dossier({ genre, label, words }: PageProps) {
  const P = BRIEF_PAPER[genre];
  const ink = PAGE_INK[genre];
  return (
    <View testID="brief-page">
      {/* The folder: its tab, and its face behind the sheet. */}
      <View style={[styles.tab, { backgroundColor: P.tab }]}>
        <Text style={[styles.typed, styles.tabText, { color: P.ink }]}>Case file</Text>
      </View>
      <View style={[styles.folder, { backgroundColor: P.folder }]}>
        <View style={[styles.sheet, { backgroundColor: P.paper }]}>
          <PaperClip />
          <Text style={[ref.type.series, { color: ink }]}>{SERIES_LINE[genre]}</Text>
          <View style={styles.dossierHead}>
            <Text style={[styles.typedBold, styles.flex, { color: P.ink }]} accessibilityRole="header" testID="brief-case">{label.toUpperCase()}</Text>
            <View style={[styles.confidential, { borderColor: ink }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Text style={[PAYOFF_TYPE.library, { color: ink }]}>Confidential</Text>
            </View>
          </View>
          <View style={[styles.hairline, { backgroundColor: P.rule }]} />
          <Text style={[styles.typedLabel, { color: ink }]}>Summary</Text>
          <Text style={[styles.typed, { color: P.ink }]} testID="brief-context">{words.context}</Text>
          <Objective label={OBJECTIVE_LABEL[genre]} text={words.objective} labelColor={ink} color={P.ink} rule={P.rule} textStyle={styles.typed} labelStyle={styles.typedLabel} />
        </View>
      </View>
    </View>
  );
}

/** Paranormal: a note on moonlit paper, taped on, handwritten. */
function MoonNote({ genre, label, words }: PageProps) {
  const P = BRIEF_PAPER[genre];
  const ink = PAGE_INK[genre];
  const theme = themeFor(genre);
  return (
    <View style={styles.noteWrap}>
      <View style={[styles.paper, styles.note, { backgroundColor: P.paper, boxShadow: `0px 0px 50px ${alpha(theme.glow, 0.18)}` }]} testID="brief-page">
        <Moon color={ink} />
        <Text style={[ref.type.series, { color: ink }]}>{SERIES_LINE[genre]}</Text>
        <Text style={[handType(17, 22), { color: P.muted }]} accessibilityRole="header" testID="brief-case">{label}</Text>
        <Text style={[handType(21, 29), styles.noteText, { color: P.ink }]} testID="brief-context">{words.context}</Text>
        <Objective label={OBJECTIVE_LABEL[genre]} text={words.objective} labelColor={ink} color={P.ink} rule={P.rule} textStyle={handType(19, 26)} labelStyle={handType(17, 22)} plainLabel />
      </View>
      <Washi color={theme.sweet} width={92} height={22} tilt={-6} style={styles.washi} />
    </View>
  );
}

/** The objective under a hairline: its label in the page's ink, then the line. */
function Objective({ label, text, labelColor, color, rule, textStyle, labelStyle, plainLabel }: {
  label: string;
  text: string;
  labelColor: string;
  color: string;
  rule: string;
  textStyle: object;
  labelStyle?: object;
  plainLabel?: boolean;
}) {
  return (
    <View style={[styles.objective, { borderTopColor: rule }]} accessible accessibilityLabel={`${label}: ${text}`} testID="brief-objective">
      <Text style={[plainLabel ? null : PAYOFF_TYPE.chapter, labelStyle, { color: labelColor }]}>{plainLabel ? `${label}:` : label}</Text>
      <Text style={[textStyle, { color }]}>{text}</Text>
    </View>
  );
}

/** A bookmark ribbon hanging from the page's top edge. */
function Ribbon({ color }: { color: string }) {
  const w = 16;
  const h = 44;
  return (
    <View style={styles.ribbon} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={w} height={h}>
        <Path d={`M0 0 H${w} V${h} L${w / 2} ${h - 7} L0 ${h} Z`} fill={color} />
      </Svg>
    </View>
  );
}

/** A paper clip over the sheet's top edge, drawn in one wire. */
function PaperClip() {
  return (
    <View style={styles.clip} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={22} height={58} viewBox="0 0 22 58" fill="none">
        <Path d="M7 20 V44 a4 4 0 0 0 8 0 V10 a6.5 6.5 0 0 0 -13 0 V46 a9 9 0 0 0 18 0 V18" stroke="#7D7468" strokeWidth={2.4} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

/** A crescent moon, drawn in the note's ink, with a star. */
function Moon({ color }: { color: string }) {
  return (
    <View style={styles.moon} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={46} height={40} viewBox="0 0 46 40" fill="none">
        <Path d="M24 4 A16 16 0 1 0 38 28 A12.5 12.5 0 1 1 24 4 Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" fill={alpha(color, 0.08)} />
        <Path d="M40 6 l1.2 2.8 2.8 1.2 -2.8 1.2 -1.2 2.8 -1.2 -2.8 -2.8 -1.2 2.8 -1.2 Z" fill={color} />
        <Circle cx={33} cy={17} r={1.2} fill={color} />
      </Svg>
    </View>
  );
}

/** The mode's soft light on the ground behind the page. */
function Glow({ glow, sweet }: { glow: string; sweet: string }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="briefGlow" cx="50%" cy="34%" rx="80%" ry="50%" fx="50%" fy="34%">
            <Stop offset={0} stopColor={glow} stopOpacity={0.2} />
            <Stop offset={1} stopColor={glow} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="briefSweet" cx="88%" cy="90%" rx="55%" ry="30%" fx="88%" fy="90%">
            <Stop offset={0} stopColor={sweet} stopOpacity={0.12} />
            <Stop offset={1} stopColor={sweet} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#briefGlow)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#briefSweet)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 90 },
  scroll: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: B.edge, paddingTop: ref.space.lg, paddingBottom: ref.space.xl + 8 },
  pageWrap: { alignSelf: "center", width: "100%", maxWidth: B.maxWidth },
  centre: { textAlign: "center" },
  flex: { flex: 1, gap: 2 },
  leaf: { ...StyleSheet.absoluteFill, borderRadius: B.radius, transform: [{ rotate: "1.4deg" }, { translateY: 5 }] },
  paper: { padding: B.pad, gap: 14, ...ref.curve },
  ribbon: { position: "absolute", top: 0, right: 24 },
  head: { alignItems: "center", gap: 2 },
  heading: { alignItems: "center", gap: 2 },
  caseNo: { fontFamily: ref.font.cover, fontSize: 26, lineHeight: 32, textAlign: "center" },
  book: { fontFamily: font.narrative, fontSize: 17, lineHeight: 26 },
  bookItalic: { fontFamily: font.narrativeItalic, fontSize: 17, lineHeight: 25 },
  initial: { fontSize: 38, lineHeight: 26 },
  objective: { borderTopWidth: 1, paddingTop: 12, gap: 4 },
  // The dossier.
  tab: { alignSelf: "flex-start", marginLeft: 18, paddingHorizontal: 16, paddingTop: 7, paddingBottom: 5, borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  tabText: { fontFamily: "CourierPrime_700Bold", fontSize: 13, lineHeight: 16, letterSpacing: 1.5, textTransform: "uppercase" },
  folder: { borderRadius: 14, borderTopLeftRadius: 4, padding: 10, paddingTop: 14 },
  sheet: { padding: 18, paddingTop: 22, gap: 10, borderRadius: 3, transform: [{ rotate: "-0.8deg" }] },
  clip: { position: "absolute", top: -22, right: 34, transform: [{ rotate: "6deg" }] },
  dossierHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  confidential: { borderWidth: 2, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, transform: [{ rotate: "-8deg" }], opacity: 0.9 },
  hairline: { height: 1 },
  typed: { fontFamily: "CourierPrime_400Regular", fontSize: 15, lineHeight: 22 },
  typedBold: { fontFamily: "CourierPrime_700Bold", fontSize: 18, lineHeight: 24, letterSpacing: 1 },
  typedLabel: { fontFamily: "CourierPrime_700Bold", fontSize: 13, lineHeight: 17, letterSpacing: 1.4, textTransform: "uppercase" },
  // The moonlit note.
  noteWrap: { paddingTop: 10 },
  note: { borderRadius: 6, gap: 8, transform: [{ rotate: "-1.2deg" }], paddingTop: 26 },
  noteText: { marginTop: 4 },
  washi: { position: "absolute", top: 0, alignSelf: "center" },
  moon: { position: "absolute", top: 14, right: 16 },
  catRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, alignSelf: "center", maxWidth: B.maxWidth },
  speech: { flexShrink: 1, borderWidth: 1, borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14 },
  twinkleA: { top: -10, left: 10 },
  twinkleB: { bottom: 30, left: -6 },
  foot: { paddingTop: ref.space.sm, paddingHorizontal: ref.space.lg + 4, gap: ref.space.sm, zIndex: 2 },
});
