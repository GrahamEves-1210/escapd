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
// Before it can be read it arrives (letters/Envelope.tsx): the mode's envelope
// lies on the desk, she opens it with a touch or a drag (the string comes
// off, the wax seal cracks in two, the flap goes over), and the letter
// slides out of it and settles where it lies. About a second, a touch has it
// out at once, once a case (remembered per room: a brief opened before lies
// there already), and not at all with reduced motion.
//
// The words: the definition's own `brief` when it has one (the writer's),
// else the mode's opening (BRIEF_OPENING) and the room's objective. The case
// is never named: its series line and its number (victory.ts, caseLabel).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import type { RoomDefinitionV2 } from "@/engine/v2";
import type { Genre } from "@/lib/puzzle-types";
import { ModePill } from "@/capture/ui/ModePill";
import { useFeedback } from "@/game/feedback";
import { themeFor } from "@/game/mode";
import { SERIES_LINE, caseLabel } from "@/render/victory";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import { CrimeBrief } from "./letters/Crime";
import { ENVELOPE, EnvelopeBack, EnvelopeFrames } from "./letters/Envelope";
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

/** The letter's postscript, in its writer's hand (the cat never says a word): where the tips are. */
export const BRIEF_POSTSCRIPT = "P.S. Stuck? There are tips in the casebook.";

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

/** The arrival's beats (ms) and sizes. */
export const ARRIVAL = {
  /** The envelope comes to rest on the desk, a little askew (degrees). */
  land: 320,
  askew: -2,
  /** Its place: its middle this far down the desk. */
  at: 0.47,
  /** The letter slides out of its mouth (from `scale` of its size, its top edge `tuck` points inside) as the envelope goes off the desk. */
  slide: 560,
  scale: 0.74,
  tuck: 10,
  awayAfter: 160,
  away: 400,
  /** Left alone it stirs, after this long and then this often. */
  nudgeAfter: 3200,
  nudgeEvery: 4200,
} as const;
/** How long the opening runs, from the touch to the letter lying where it lies. */
export const ARRIVAL_MS = ((ENVELOPE.frames - 1) * 1000) / ENVELOPE.fps + Math.max(ARRIVAL.slide, ARRIVAL.awayAfter + ARRIVAL.away);

const OPENED = (roomId: string) => `escapd.v2.brief.opened.${roomId}`;

/** Where the letter is: not yet known, in its envelope on the desk, coming out of it, out. */
type Stage = "wait" | "envelope" | "opening" | "letter";

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
  const feedback = useFeedback();
  const insets = useSafeAreaInsets();
  const words = briefWords(def);
  const label = caseLabel(roomId);

  // The letter arrives in its envelope, once a case: opened before (or with reduced motion), it lies there already.
  const [found, setFound] = useState<Stage>("wait");
  // Whether it came out of its envelope just now (the cat waits for it).
  const [arrived, setArrived] = useState(false);
  const stage: Stage = reduced ? "letter" : found;
  useEffect(() => {
    if (reduced) return;
    let cancelled = false;
    const settle = (opened: boolean) => !cancelled && setFound((s) => (s === "wait" ? (opened ? "letter" : "envelope") : s));
    AsyncStorage.getItem(OPENED(roomId)).then((v) => settle(v === "1")).catch(() => settle(false));
    return () => {
      cancelled = true;
    };
  }, [roomId, reduced]);

  const shown = useSharedValue(reduced ? 1 : 0);
  const rise = useSharedValue(reduced ? 0 : 18);
  const foot = useSharedValue(reduced ? 1 : 0);
  const out = useSharedValue(1);
  // The envelope: its frame, how far it has landed, its turn on the desk, how far it has gone off it; the letter's way out of it.
  const frame = useSharedValue(0);
  const landed = useSharedValue(0);
  const turn = useSharedValue<number>(ARRIVAL.askew);
  const away = useSharedValue(0);
  const slid = useSharedValue(1);
  const [desk, setDesk] = useState<{ w: number; h: number } | null>(null);
  const [page, setPage] = useState<number | null>(null);
  const [art, setArt] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Where the envelope lies on the desk (points): its canvas, its mouth and its foot.
  const k = desk ? Math.min(1, (desk.w - 2 * B.edge) / (ENVELOPE.width * (ENVELOPE.right - ENVELOPE.left))) : 1;
  const canvas = { w: ENVELOPE.width * k, h: ENVELOPE.height * k };
  const top = desk ? desk.h * ARRIVAL.at - ((ENVELOPE.mouth + ENVELOPE.foot) / 2) * canvas.h : 0;
  const mouth = top + ENVELOPE.mouth * canvas.h, footAt = top + ENVELOPE.foot * canvas.h;
  const deskH = desk?.h ?? 0;
  const drop = deskH - footAt + 60;
  const from = page === null ? 60 : mouth + ARRIVAL.tuck - page;

  // A letter already out: it comes up on the desk, Begin after it.
  useEffect(() => {
    if (reduced || found !== "letter" || slid.get() !== 1) return;
    shown.set(withTiming(1, { duration: 420 }));
    rise.set(withTiming(0, { duration: 520 }));
    foot.set(withDelay(400, withTiming(1, { duration: 320 })));
  }, [reduced, found, shown, rise, foot, slid]);
  // The envelope comes to rest once its picture is there (or a moment later, without it).
  useEffect(() => {
    if (stage !== "envelope") return;
    const t = setTimeout(() => setArt(true), 900);
    return () => clearTimeout(t);
  }, [stage]);
  useEffect(() => {
    if (stage !== "envelope" || !art || !desk) return;
    landed.set(withTiming(1, { duration: ARRIVAL.land, easing: Easing.out(Easing.cubic) }));
    // Left alone, it stirs (nothing says what to do with an envelope).
    const stir = () => turn.set(withSequence(withTiming(ARRIVAL.askew - 1.6, { duration: 110 }), withTiming(ARRIVAL.askew + 1.1, { duration: 130 }), withTiming(ARRIVAL.askew, { duration: 160 })));
    let every: ReturnType<typeof setInterval> | undefined;
    const first = setTimeout(() => {
      stir();
      every = setInterval(stir, ARRIVAL.nudgeEvery);
    }, ARRIVAL.nudgeAfter);
    return () => {
      clearTimeout(first);
      if (every) clearInterval(every);
    };
  }, [stage, art, desk, landed, turn]);

  /** The letter is out, lying where it lies; Begin under it. */
  const settled = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    for (const v of [frame, away, slid, shown, rise]) cancelAnimation(v);
    slid.set(1);
    away.set(1);
    rise.set(0);
    shown.set(1);
    foot.set(withTiming(1, { duration: 320 }));
    setFound("letter");
  }, [frame, away, slid, shown, rise, foot]);
  /** She opens it: the string comes off or the wax cracks, the flap goes over, the letter slides out and the envelope goes. */
  const openEnvelope = useCallback(() => {
    if (found !== "envelope") return;
    setFound("opening");
    setArrived(true);
    AsyncStorage.setItem(OPENED(roomId), "1").catch(() => {});
    const flap = ((ENVELOPE.frames - 1) * 1000) / ENVELOPE.fps;
    if (genre === "paranormal") feedback.waxCrack();
    else if (genre === "crime_scene") feedback.stringOff();
    else feedback.paperFold();
    slid.set(0);
    rise.set(0);
    landed.set(1);
    turn.set(withTiming(0, { duration: flap }));
    frame.set(withTiming(ENVELOPE.frames - 1, { duration: flap, easing: Easing.linear }));
    shown.set(withDelay(flap, withTiming(1, { duration: 40 })));
    slid.set(withDelay(flap, withTiming(1, { duration: ARRIVAL.slide, easing: Easing.bezier(0.3, 0, 0.2, 1) })));
    away.set(withDelay(flap + ARRIVAL.awayAfter, withTiming(1, { duration: ARRIVAL.away, easing: Easing.in(Easing.quad) })));
    timers.current.push(setTimeout(() => feedback.paper(), flap), setTimeout(settled, ARRIVAL_MS + 30));
  }, [found, roomId, genre, feedback, slid, rise, landed, turn, frame, shown, away, settled]);
  // A drag opens it as a touch does.
  const touch = useRef<{ x: number; y: number } | null>(null);

  const begin = () => {
    if (leaving || stage !== "letter") return;
    setLeaving(true);
    // The letter slides away off the desk as it goes (the room comes up out of the dark after it: transitions/LightsOn).
    if (!reduced) rise.set(withTiming(44, { duration: 280 }));
    out.set(withTiming(0, { duration: reduced ? motion.reducedFade : 280 }));
    setTimeout(onBegin, reduced ? motion.reducedFade : 280);
  };
  const rootStyle = useAnimatedStyle(() => ({ opacity: out.get() }));
  const pageStyle = useAnimatedStyle(() => {
    const p = slid.get();
    // It keeps the envelope's width while it is mostly in it, and opens out to its own as it clears the mouth.
    const g = Math.max(0, (p - 0.4) / 0.6);
    return { opacity: shown.get(), transform: [{ translateY: rise.get() + (1 - p) * from }, { scale: ARRIVAL.scale + (1 - ARRIVAL.scale) * g * g * (3 - 2 * g) }] };
  });
  const footStyle = useAnimatedStyle(() => ({ opacity: foot.get() }));
  // The envelope on the desk: landing, turned a little, going off the desk's foot and fading as it goes. (Each style
  // reads its shared values itself, so each is redrawn when they move.)
  const lying = (down: number, gone: number, turned: number) => {
    "worklet";
    return {
      opacity: down * (1 - Math.max(0, (gone - 0.55) / 0.45)),
      transform: [{ translateY: (1 - down) * -26 + gone * drop }, { rotate: `${turned - (1 - down) * 3}deg` }],
    };
  };
  const envelopeStyle = useAnimatedStyle(() => lying(landed.get(), away.get(), turn.get()));
  // The back panel goes over the letter only once the flap is right over (it is cut from the open envelope: before
  // that it would hide the flap lying on it, and the seal).
  const backStyle = useAnimatedStyle(() => {
    const at = lying(landed.get(), away.get(), turn.get());
    return frame.get() < ENVELOPE.frames - 1 ? { ...at, opacity: 0 } : at;
  });
  // While the letter is in the envelope, nothing of it shows below the envelope's foot (it is longer than the envelope).
  const hide = (out: number, gone: number) => {
    "worklet";
    return out === 1 ? 0 : Math.max(0, deskH - footAt + 7 * k - gone * drop);
  };
  const clipStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -hide(slid.get(), away.get()) }] }));
  const unclipStyle = useAnimatedStyle(() => ({ transform: [{ translateY: hide(slid.get(), away.get()) }] }));

  // The letter itself: laid out once, and left alone while the envelope's business goes on round it.
  const context = words.context, objective = words.objective;
  // (the cat comes after the letter has come out of its envelope, when that's how it came)
  const catDelay = reduced ? 0 : found === "wait" || found === "envelope" || arrived ? ARRIVAL_MS + 150 : 450;
  const letter = useMemo(() => {
    const props: BriefLetterProps = {
      label,
      series: SERIES_LINE[genre],
      context,
      objective,
      objectiveLabel: OBJECTIVE_LABEL[genre],
      postscript: BRIEF_POSTSCRIPT,
      catLabel: "The black cat, ready when you are",
      catDelay,
      photo,
    };
    return genre === "crime_scene" ? <CrimeBrief {...props} /> : genre === "paranormal" ? <MoonBrief {...props} /> : <NoirBrief {...props} />;
  }, [genre, label, context, objective, catDelay, photo]);
  const sealed = stage === "envelope" || stage === "opening";
  const read = stage === "opening" || stage === "letter";

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: theme.ground, paddingTop: insets.top }, rootStyle]} testID={`v2-brief-${genre}`}>
      <Lamp glow={theme.glow} />
      <View style={styles.desk} onLayout={(e) => setDesk({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {sealed && desk ? (
          <Animated.View style={[styles.envelope, { left: (desk.w - canvas.w) / 2, top }, envelopeStyle]} pointerEvents="none">
            <EnvelopeFrames genre={genre} frame={frame} k={k} onLoad={() => setArt(true)} />
          </Animated.View>
        ) : null}
        <Animated.View style={[StyleSheet.absoluteFill, styles.clip, clipStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, unclipStyle]}>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.content} testID="brief-scroll" scrollEnabled={stage === "letter"}>
              {read ? (
                <Animated.View style={[styles.pageWrap, pageStyle]} onLayout={(e) => setPage(e.nativeEvent.layout.y)}>{letter}</Animated.View>
              ) : null}
            </ScrollView>
          </Animated.View>
        </Animated.View>
        {stage === "opening" && desk ? (
          <Animated.View style={[styles.envelope, { left: (desk.w - canvas.w) / 2, top }, backStyle]} pointerEvents="none">
            <EnvelopeBack genre={genre} k={k} />
          </Animated.View>
        ) : null}
      </View>
      <Animated.View
        style={[styles.foot, { paddingBottom: Math.max(insets.bottom + ref.space.ctaBottom, ref.space.lg) }, footStyle]}
        pointerEvents={stage === "letter" ? "auto" : "none"}
        accessibilityElementsHidden={stage !== "letter"}
        importantForAccessibility={stage === "letter" ? "auto" : "no-hide-descendants"}
      >
        <ModePill variant="ghost" label={BEGIN} onPress={begin} disabled={leaving || stage !== "letter"} testID="v2-brief-begin" />
      </Animated.View>
      {sealed ? (
        // The whole desk takes the touch: a touch or a drag opens the envelope; once it is opening, a touch has the letter out at once.
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={stage === "envelope" ? openEnvelope : settled}
          onTouchStart={(e) => {
            touch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
          }}
          onTouchMove={(e) => {
            const t = touch.current;
            if (stage === "envelope" && t && Math.hypot(e.nativeEvent.pageX - t.x, e.nativeEvent.pageY - t.y) > 12) openEnvelope();
          }}
          accessibilityRole="button"
          accessibilityLabel={stage === "envelope" ? "Open the envelope" : "Skip"}
          accessible={stage === "envelope"}
          testID="v2-brief-envelope"
        />
      ) : null}
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
  desk: { flex: 1 },
  envelope: { position: "absolute" },
  clip: { overflow: "hidden" },
  scroll: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: B.edge, paddingTop: ref.space.lg, paddingBottom: ref.space.sm },
  pageWrap: { alignSelf: "center", width: "100%", maxWidth: B.maxWidth, transformOrigin: "50% 0%" },
  foot: { paddingTop: ref.space.sm, paddingHorizontal: ref.space.lg + 4, zIndex: 2 },
});
