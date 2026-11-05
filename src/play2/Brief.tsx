// The brief: a short page of context shown over the room when a case is first
// opened (docs/ART_DIRECTION.md, the mystery-book core), before she plays.
// What happened, who she is, what to find, then the objective and Begin.
// Remembered per room (useBrief): a resumed case opens straight on the room.
//
// Each mode's page is a letter, a real thing she was sent (src/play2/letters;
// its paper and inks theme/payoff.ts LETTER, its faces LETTER_FONT), the
// first of a correspondence the way out answers (Ending.tsx):
// - noir: a letter typed on hotel onion-skin, folded in three, paper-clipped,
//   the cat's line added by hand with a lipstick blot (letters/Noir.tsx).
// - crime scene: a case intake sheet out of a kraft evidence envelope, her
//   room's print clipped on, the assignment filled in in ballpoint, the cat's
//   line on a sticky note (letters/Crime.tsx).
// - paranormal: an old deckled, foxed letter in IM Fell, its wax seal broken,
//   candle wax and a pressed sprig on it (letters/Moon.tsx).
// The cat sits by the letter, part of the scene; Begin under it.
//
// The words: the definition's own `brief` when it has one (the writer's),
// else the mode's opening (BRIEF_OPENING) and the room's objective. The case
// is never named: its series line and its number (victory.ts, caseLabel).
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import type { RoomDefinitionV2 } from "@/engine/v2";
import type { Genre } from "@/lib/puzzle-types";
import { ModePill } from "@/capture/ui/ModePill";
import { themeFor } from "@/game/mode";
import { SERIES_LINE, caseLabel } from "@/render/victory";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import { CrimeBrief } from "./letters/Crime";
import { MoonBrief } from "./letters/Moon";
import { NoirBrief } from "./letters/Noir";
import type { BriefLetterProps, Photo } from "./letters/types";

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
  maxWidth: 420,
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

export function Brief({ def, roomId, onBegin, photo }: {
  def: Pick<RoomDefinitionV2, "mode" | "objective"> & { brief?: unknown };
  roomId: string;
  onBegin: () => void;
  /** Her room's first photo, for the print on the crime scene's file. */
  photo?: Photo;
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

  const props: BriefLetterProps = {
    label,
    series: SERIES_LINE[genre],
    context: words.context,
    objective: words.objective,
    objectiveLabel: OBJECTIVE_LABEL[genre],
    catLine: BRIEF_CAT_LINE,
    catLabel: "The black cat, ready when you are",
    catDelay: reduced ? 0 : 450,
    photo,
  };
  const letter = genre === "crime_scene" ? <CrimeBrief {...props} /> : genre === "paranormal" ? <MoonBrief {...props} /> : <NoirBrief {...props} />;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: theme.ground, paddingTop: insets.top }, rootStyle]} testID={`v2-brief-${genre}`}>
      <Lamp glow={theme.glow} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} testID="brief-scroll">
        <Animated.View style={[styles.pageWrap, pageStyle]}>{letter}</Animated.View>
      </ScrollView>
      <Animated.View style={[styles.foot, { paddingBottom: Math.max(insets.bottom + ref.space.ctaBottom, ref.space.lg) }, footStyle]}>
        <ModePill variant="ghost" label={BEGIN} onPress={begin} disabled={leaving} testID="v2-brief-begin" />
      </Animated.View>
    </Animated.View>
  );
}

/** The desk lamp's pool on the ground the letter lies on. */
function Lamp({ glow }: { glow: string }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="briefLamp" cx="42%" cy="30%" rx="85%" ry="55%" fx="42%" fy="30%">
            <Stop offset={0} stopColor={glow} stopOpacity={0.16} />
            <Stop offset={1} stopColor={glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#briefLamp)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 90 },
  scroll: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: B.edge, paddingTop: ref.space.lg, paddingBottom: ref.space.sm },
  pageWrap: { alignSelf: "center", width: "100%", maxWidth: B.maxWidth },
  foot: { paddingTop: ref.space.sm, paddingHorizontal: ref.space.lg + 4, zIndex: 2 },
});
