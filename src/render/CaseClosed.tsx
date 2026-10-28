// Case closed, per mode (docs/DESIGN.md, Modes · Case closed), as the victory
// moment of GAME_FEEL_PROMPT.md, 5: the most satisfying few seconds in the
// app. The mode's ground, a centred column, then 07's pinned band of actions.
// It fits one screen with no scroll at the default text size, down to an
// iPhone SE (ref.layout.play.complete): the case (noir's folder, the accused's
// card, the room) takes the column's spare height, from its compact size up to
// its own maximum, and whatever is left is shared above and below the card.
// Large text scrolls.
// It now rates the case (1–3 magnifiers), on observation, not speed: hints
// and wrong answers count, time does not (victory.ts, magnifierRating).
//
// The moment, in order (victory.ts, victoryTimeline; ms in
// ref.layout.play.complete.beat):
// 1. The impact.
//    - Noir: the case file (a folder, its title typed on a paper label)
//      comes in, and CASE CLOSED slams onto it in brass.
//    - Crime scene: the accused's card comes in and GUILTY slams onto it
//      again (it slammed on the reveal; here it lands for the record).
//    - Paranormal: the room comes in under its tint and snaps back to its own
//      colours; "The presence is gone." drops onto it with weight (a thud),
//      then CASE CLOSED slams.
//    A stamp falls, overshoots and settles; its ink spreads; the `stamp` cue
//    (haptic and sound) fires on impact and the case card is nudged.
// 2. The stats land one by one, a `tick` each: time, tips taken, wrong codes
//    (crime scene "Wrong calls", as its count includes accusations;
//    paranormal "Missteps"; victory.ts, statLines). Only what the game holds
//    (a v2 game's own count, or the completed session's); nothing is shown
//    that it doesn't. Their numbers are lining figures in the system face, a
//    size up from the label (the modes' display faces have old-style
//    figures: 0 reads as o).
// 3. The rating's magnifiers fill one by one, a `tick` each, then `solved`
//    ("Observation"; paranormal's "Second sight": victory.ts, RATING_LABEL).
// 4. The actions come in: the mode's next case first.
// Reduced motion: no fall, nudge or stagger; it all fades in within about
// 600 ms, the haptics kept.
//
// Said once: where CASE CLOSED is stamped, a case line that only says "Case
// closed." again is left out (the planner's endings end on it). Crime scene's
// accused card is followed by why and how, when the accusation named them.
// The column grows the case (folder, card, room) into a phone's spare height,
// up to a size of its own, so nothing is left as one big gap over the
// actions; the actions sit at least ref.space.lg off the bottom edge.
//
// Sharing (not built): the stamp, title, stats and rating are one View, the
// case card (`testID="case-card"`, held in `card`), so a share button can
// capture it later (e.g. react-native-view-shot on that ref) and hand it to
// `onShare`, which nothing calls yet.
import { useEffect, useLayoutEffect, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Genre } from "@/lib/puzzle-types";
import { TreatedImage } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { setMode, themeFor } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import type { ModeTheme } from "@/theme/tokens";
import { motion, ref } from "@/theme/tokens";
import { MagnifierRating } from "./MagnifierRating";
import { Card } from "./parts";
import type { SceneSource } from "./SceneView";
import { useSlam } from "./slam";
import { Stamp } from "./Stamp";
import { SuspectFile, type SuspectFace } from "./SuspectFile";
import { PeekingCat, type CatReaction } from "@/play2/PeekingCat";
import { RATING_LABEL, magnifierRating, statLines, victoryTimeline, type CaseSummary, type VictoryTimeline } from "./victory";

export type { CaseSummary } from "./victory";

const P = ref.layout.play;
const C = P.complete;
const GONE_LINE = /the presence is gone/i;

/**
 * This screen's own sizes (over ref.layout.play.complete's compact ones): how
 * far the case grows on a tall phone, the stats' figures, the folder's form.
 */
export const CLOSED_LAYOUT = {
  /** The case's largest size: noir's folder (the accused's card keeps its token's); the room's aspect (width / height). */
  folderMax: 300,
  accusedMax: C.accused.max,
  photoAspect: 4 / 3,
  /** A stat's figures: lining, tabular, in the system face; units a step down. */
  figure: { fontSize: 28, lineHeight: 34, fontWeight: "700", fontVariant: ["lining-nums", "tabular-nums"] } as const satisfies TextStyle,
  unit: { fontSize: 15, lineHeight: 34, fontWeight: "600" } as const satisfies TextStyle,
  statPadY: 14,
  /** The folder: its back (with the tab) shows `lip` over the front; a paper sheet peeks between. */
  folder: { tabHeight: 16, lip: 12, tabLine: 44, paperInset: 18, paperHeight: 26, frontEdge: ref.color.specularDark },
  /** The actions never sit closer than this to the bottom edge. */
  bottomMin: ref.space.lg,
} as const;
const L = CLOSED_LAYOUT;

/** A line without the sentences that only say "Case closed." (the stamp says it). Empty when nothing else is left. */
export function withoutCaseClosed(line: string): string {
  const sentences = line.match(/[^.!?]+[.!?]*\s*/g) ?? [line];
  return sentences.filter((s) => !/^\s*case closed[.!]*\s*$/i.test(s)).join("").trim();
}

/** The case card's host view, for a capture. */
export type CaseCard = ComponentRef<typeof View>;

export interface CaseClosedProps {
  genre: Genre;
  title: string;
  message?: string;
  exit?: string;
  /** The completed session's stats (victory.ts, caseSummary). undefined while loading; null when there are none. */
  summary?: CaseSummary | null;
  /** Crime scene: the suspect the player accused. */
  accused?: SuspectFace | null;
  /** Crime scene: why and how, as the accusation named them (shown under the accused). */
  recap?: { why?: string; how?: string } | null;
  /** Paranormal: the room, snapping back to full colour. */
  photo?: SceneSource | null;
  /** A closing line over the actions. */
  next?: string;
  /** The pinned band, as the photo guide's foot: its pill (ModePill "ghost", the mode's accent), then quiet pills (ModePill "quiet"). */
  actions: ReactNode;
  /**
   * The share hook (not built yet): a future share button calls this with
   * the case card's ref to capture it. Unused for now.
   */
  onShare?: (card: RefObject<CaseCard | null>) => void;
}

/** The plan for everything after the impact, made once the stats are in (or given up on). */
interface Plan {
  /** ms after mount when it was made: the beats' delays count from here. */
  at: number;
  timeline: VictoryTimeline;
  summary: CaseSummary | null;
}

export function CaseClosed({ genre, title, message: rawMessage, exit: rawExit, summary, accused, recap, photo, next, actions }: CaseClosedProps) {
  const theme = themeFor(genre);
  const { reducedMotion: reduced } = useTheme();
  const feedback = useFeedback();
  const insets = useSafeAreaInsets();
  // The room grows no taller than the column's width at its aspect.
  const { width } = useWindowDimensions();
  const roomMax = Math.max(C.photo.min, (width - C.inset * 2) / L.photoAspect);
  // Case closed is the mode's last screen: its parts take the mode's look.
  useLayoutEffect(() => setMode(genre), [genre]);

  const [mountedAt] = useState(() => Date.now());
  const elapsed = () => Date.now() - mountedAt;
  // The share hook: the case card, for a future capture.
  const card = useRef<CaseCard>(null);
  // The beats up to the impact need no data.
  const [head] = useState(() => victoryTimeline({ genre, reduced, stats: 0, rating: null }));

  const guilty = genre === "crime_scene" && accused;
  // Where CASE CLOSED is stamped, the case's lines don't say it again.
  const stamped = !guilty;
  const message = (rawMessage && stamped ? withoutCaseClosed(rawMessage) : rawMessage) || undefined;
  const exit = (rawExit && stamped ? withoutCaseClosed(rawExit) : rawExit) || undefined;
  // Paranormal says it once: not again when the case's own lines already do.
  const gone = genre === "paranormal" && ![message, exit].some((line) => line && GONE_LINE.test(line));

  // The nudge: the case card jolts down and shakes once as a stamp hits.
  const nudgeX = useSharedValue(0);
  const nudgeY = useSharedValue(0);
  const nudge = () => {
    if (reduced) return;
    const { x, y, step } = C.slam.nudge;
    const t = (to: number) => withTiming(to, { duration: step });
    nudgeY.set(withSequence(t(y), t(-y / 2), t(0)));
    nudgeX.set(withSequence(t(x), t(-x), t(x / 2), t(0)));
  };
  // The cat, peering over the top of the case, celebrates when the stamp lands.
  const [catReaction, setCatReaction] = useState<CatReaction>(null);
  const landed = () => {
    nudge();
    setCatReaction({ kind: "found", at: Date.now() });
  };
  const still = { x: useSharedValue(0.5), y: useSharedValue(0.5) };
  // Over noir's folder it sits on the folder's top edge, below the tab.
  const peek = (onTab = false) => (
    <View style={[styles.catPeek, onTab && { transform: [{ translateY: L.folder.tabHeight }] }]} pointerEvents="box-none">
      <PeekingCat width={60} beamX={still.x} beamY={still.y} frame={null} reaction={catReaction} />
    </View>
  );
  const nudgeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: nudgeX.get() }, { translateY: nudgeY.get() }] }));

  // Paranormal: the tint comes off the room at its beat.
  const [snapped, setSnapped] = useState(reduced);
  useEffect(() => {
    if (genre !== "paranormal" || snapped) return;
    const timer = setTimeout(() => setSnapped(true), head.snap ?? 0);
    return () => clearTimeout(timer);
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The plan: as soon as the stats are in; if they're slow, at most `wait`
  // past their beat, without them (a late answer still shows, quietly).
  const [plan, setPlan] = useState<Plan | null>(null);
  useEffect(() => {
    if (plan) return;
    const make = (s: CaseSummary | null) => {
      const at = elapsed();
      const timeline = victoryTimeline({ genre, reduced, stats: statLines(genre, s).length, rating: magnifierRating(s), dataAt: at });
      setPlan({ at, timeline, summary: s });
    };
    if (summary !== undefined) {
      make(summary);
      return;
    }
    const deadline = (reduced ? C.reduced.stats : head.impact + C.beat.statsGap) + C.beat.wait;
    const timer = setTimeout(() => make(null), Math.max(0, deadline - elapsed()));
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, plan]);

  // The plan's haptics: a tick per stat and per earned magnifier, then `solved`; and the actions come in.
  const ctaOpacity = useSharedValue(0);
  useEffect(() => {
    if (!plan) return;
    const now = elapsed();
    const at = (t: number, fn: () => void) => setTimeout(fn, Math.max(0, t - now));
    const { stats, magnifiers, solved, cta } = plan.timeline;
    const timers = [...stats, ...magnifiers].map((t) => at(t, feedback.tick));
    timers.push(at(solved, feedback.solved));
    ctaOpacity.set(withDelay(Math.max(0, cta - now), withTiming(1, { duration: reduced ? motion.reducedFade : C.beat.enter })));
    return () => timers.forEach(clearTimeout);
    // Once per plan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);
  const ctaStyle = useAnimatedStyle(() => ({ opacity: ctaOpacity.get() }));

  // A late answer (after the plan gave up on it) shows without its beats.
  const late = plan && !plan.summary && summary ? summary : null;
  const shown = plan?.summary ?? late;
  const lines = statLines(genre, shown);
  const rating = magnifierRating(shown);
  const since = (t: number | undefined) => (late || t === undefined ? 0 : Math.max(0, t - (plan?.at ?? 0)));
  const statDelay = (i: number) => (reduced ? since(plan?.timeline.stats[0]) : since(plan?.timeline.stats[i]));

  const caseStamp = (
    <Stamp
      text="Case closed"
      size="medium"
      slam
      delay={head.stamp}
      onLanded={landed}
      style={styles.stamp}
      testID="closed-stamp"
    />
  );
  const titleText = (
    <Text style={[C.title, styles.centre, { color: theme.ink }]} accessibilityRole="header" testID="closed-title">{title}</Text>
  );

  const room = genre === "paranormal" && photo;
  const goneLine = gone ? (
    <GoneLine
      theme={theme}
      delay={head.gone ?? 0}
      reduced={reduced}
      onPhoto={!!room}
      onLanded={() => {
        feedback.thud();
        landed();
      }}
    />
  ) : null;

  return (
    <View style={[styles.root, { backgroundColor: theme.ground, paddingTop: insets.top }]} testID={`case-closed-${genre}`}>
      {/* The column fills the space over the actions: the case grows into what is spare, the rest is centred. */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} testID="closed-scroll">
        <Animated.View style={[styles.fill, nudgeStyle]}>
          <View ref={card} collapsable={false} style={[styles.card, { backgroundColor: theme.ground }]} testID="case-card">
            {genre === "noir" ? (
              <Beat delay={0} reduced={reduced} style={styles.folder}>
                <CaseFolder theme={theme} title={title} stamp={caseStamp} />
                {peek(true)}
              </Beat>
            ) : null}

            {guilty ? (
              <Beat delay={0} reduced={reduced} style={styles.accused}>
                <SuspectFile
                  suspect={accused}
                  size="large"
                  style={styles.accusedCard}
                  testID="closed-accused"
                  stamp={<Stamp text="Guilty" size="medium" slam delay={head.stamp} onLanded={landed} testID="closed-guilty" />}
                  stampLabel="Guilty"
                />
                {peek()}
              </Beat>
            ) : null}
            {guilty && recap && (recap.why || recap.how) ? (
              <Beat delay={head.impact} reduced={reduced} style={styles.recap}>
                <View
                  style={styles.recapRow}
                  accessible
                  accessibilityLabel={[recap.why && `Why: ${recap.why}`, recap.how && `How: ${recap.how}`].filter(Boolean).join(". ")}
                  testID="closed-recap"
                >
                  {([["Why", recap.why], ["How", recap.how]] as const).map(([label, value]) => (value ? (
                    <View key={label} style={styles.recapItem}>
                      <Text style={[ref.type.meta, styles.centre, styles.recapLabel, { color: theme.inkMuted }]}>{label}</Text>
                      <Text style={[ref.type.headline, styles.centre, { color: theme.ink }]} numberOfLines={2}>{value}</Text>
                    </View>
                  ) : null))}
                </View>
              </Beat>
            ) : null}

            {room ? (
              // The room, with "The presence is gone." dropped onto it.
              <View style={[styles.room, { maxHeight: roomMax }]} testID="closed-room">
                <Beat delay={0} reduced={reduced} style={styles.photoFrame}>
                  <TreatedImage
                    source={photo}
                    genre="paranormal"
                    original={snapped}
                    style={StyleSheet.absoluteFill}
                    accessible
                    accessibilityLabel="The room, back to its own colours"
                    testID="closed-photo"
                  />
                </Beat>
                {goneLine ? <View style={styles.roomLine} pointerEvents="none">{goneLine}</View> : null}
                {peek()}
              </View>
            ) : goneLine}

            {genre !== "noir" ? (
              <>
                {/* Crime scene's GUILTY takes CASE CLOSED's place. */}
                {guilty ? null : caseStamp}
                <Beat delay={0} reduced={reduced} style={styles.titleBlock}>{titleText}</Beat>
              </>
            ) : null}

            {message || exit ? (
              <Beat delay={head.impact} reduced={reduced} style={styles.titleBlock}>
                {message ? <Text style={[P.type.body, styles.centre, { color: theme.ink }]}>{message}</Text> : null}
                {exit ? <Text style={[ref.type.subtitle, styles.centre, message ? styles.exit : null, { color: theme.inkMuted }]}>{exit}</Text> : null}
              </Beat>
            ) : null}

            {lines.length ? (
              <View style={styles.stats} testID="closed-stats">
                {lines.map((line, i) => (
                  <Beat key={line.key} delay={statDelay(i)} reduced={reduced || !!late} rise style={styles.stat}>
                    <Card style={styles.statCard}>
                      <View accessible accessibilityLabel={`${line.label}: ${line.value}`} style={styles.statInner} testID={`closed-stat-${line.key}`}>
                        <Figure value={line.value} color={theme.ink} />
                        <Text style={[ref.type.meta, styles.centre, { color: theme.inkMuted }]}>{line.label}</Text>
                      </View>
                    </Card>
                  </Beat>
                ))}
              </View>
            ) : null}

            {rating && plan ? (
              <Beat delay={since(plan.timeline.rating)} reduced={reduced || !!late} style={styles.after}>
                <MagnifierRating
                  rating={rating}
                  label={RATING_LABEL[genre]}
                  theme={theme}
                  reduced={reduced || !!late}
                  delays={plan.timeline.magnifiers.map(since)}
                  testID="closed-rating"
                />
              </Beat>
            ) : null}
          </View>
        </Animated.View>
      </ScrollView>
      <Animated.View style={[styles.actions, { paddingBottom: Math.max(insets.bottom + ref.space.ctaBottom, L.bottomMin) }, ctaStyle]} testID="closed-actions">
        {next ? <Text style={[P.type.hint, styles.centre, { color: theme.inkMuted }]}>{next}</Text> : null}
        {actions}
      </Animated.View>
    </View>
  );
}

/** Fades in `delay` ms after it mounts; `rise` also lifts it into place (not under reduced motion). */
function Beat({ delay, reduced, rise = false, style, children }: {
  delay: number;
  reduced: boolean;
  rise?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const opacity = useSharedValue(0);
  const lift = useSharedValue(rise && !reduced ? C.beat.rise : 0);
  useEffect(() => {
    const duration = reduced ? motion.reducedFade : C.beat.enter;
    opacity.set(withDelay(delay, withTiming(1, { duration })));
    if (rise && !reduced) lift.set(withDelay(delay, withTiming(0, { duration })));
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ translateY: lift.get() }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/** A stat's value: its figures large and lining, its units (min, h) a step down. */
function Figure({ value, color }: { value: string; color: string }) {
  const parts = value.split(/(\d+)/).filter(Boolean);
  return (
    <Text style={[L.figure, styles.centre, { color }]} numberOfLines={1} adjustsFontSizeToFit>
      {parts.map((part, i) => (/\d/.test(part) ? part : <Text key={i} style={[L.unit, { color }]}>{part}</Text>))}
    </Text>
  );
}

/**
 * Noir's case file: a folder in two leaves, its depth in steps of lightness
 * (no shadows): the back, with its tab, shows a lip over the front; a sheet
 * of paper peeks out between them; the front leaf is a shade lighter, its
 * top edge catching the light. The case's name is typed on its paper label,
 * the stamp comes down on it.
 */
function CaseFolder({ theme, title, stamp }: { theme: ModeTheme; title: string; stamp: ReactNode }) {
  const F = C.folder;
  const back = { backgroundColor: theme.surface, borderColor: theme.rim };
  return (
    <View style={styles.folderFill} testID="closed-folder">
      <View style={[styles.tab, back]}>
        <View style={[styles.tabLine, { backgroundColor: theme.inkMuted }]} />
      </View>
      <View style={[styles.folderBack, back]}>
        <View style={[styles.paper, { backgroundColor: theme.ink }]} />
        <View style={[styles.folderBody, { backgroundColor: theme.raised, borderColor: theme.rim, borderTopColor: L.folder.frontEdge }]}>
          <View style={[styles.label, { backgroundColor: theme.ink, transform: [{ rotate: `${F.label.tilt}deg` }] }]}>
            <Text style={[C.title, styles.centre, { color: theme.ground }]} accessibilityRole="header" testID="closed-title">{title}</Text>
          </View>
          {/* The stamp may run over the folder's edges, as a real one would; its word never wraps. */}
          <View style={styles.folderStamp}>{stamp}</View>
        </View>
      </View>
    </View>
  );
}

/**
 * Paranormal's "The presence is gone.", dropped like a stamp (a fade under
 * reduced motion): onto the room, on the player's see-through pill
 * (ref.layout.play.gone), or onto the page when there is no room to show.
 */
function GoneLine({ theme, delay, reduced, onPhoto, onLanded }: {
  theme: ModeTheme;
  delay: number;
  reduced: boolean;
  onPhoto: boolean;
  onLanded: () => void;
}) {
  const { body } = useSlam({ enabled: true, delay, from: C.slam.goneFrom, reducedMotion: reduced, onLanded });
  return (
    <Animated.View style={[onPhoto && styles.gonePill, body]} testID="closed-gone">
      {onPhoto ? <View style={[StyleSheet.absoluteFill, styles.goneFill, { backgroundColor: theme.ground }]} /> : null}
      <Text style={[P.type.gone, styles.centre, { color: theme.ink }]}>The presence is gone.</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  // At least the space over the actions, so the case can grow into it.
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: C.inset, paddingVertical: C.pad },
  fill: { flexGrow: 1 },
  card: { flexGrow: 1, justifyContent: "center", alignItems: "center", gap: C.gap.head },
  // Noir's folder grows from its compact size to folder.max.
  catPeek: { position: "absolute", right: ref.space.xl, bottom: "100%" },
  folder: { alignSelf: "stretch", flexGrow: 1, maxHeight: L.folderMax },
  folderFill: { flexGrow: 1 },
  tab: {
    width: C.folder.tabWidth,
    height: L.folder.tabHeight,
    justifyContent: "center",
    paddingHorizontal: 12,
    marginBottom: -P.hairline,
    borderWidth: P.hairline,
    borderBottomWidth: 0,
    borderTopLeftRadius: C.folder.tabRadius,
    borderTopRightRadius: C.folder.tabRadius,
    ...ref.curve,
  },
  tabLine: { width: L.folder.tabLine, height: 3, borderRadius: 1.5, opacity: 0.35 },
  folderBack: {
    flexGrow: 1,
    paddingTop: L.folder.lip,
    borderWidth: P.hairline,
    borderRadius: C.folder.radius,
    borderTopLeftRadius: 0,
    ...ref.curve,
  },
  // A sheet of paper between the leaves: only its top shows, over the front's edge.
  paper: {
    position: "absolute",
    top: L.folder.lip / 2 - 2,
    left: L.folder.paperInset,
    right: L.folder.paperInset * 1.6,
    height: L.folder.paperHeight,
    borderRadius: 2,
    opacity: 0.6,
    transform: [{ rotate: "0.8deg" }],
  },
  folderBody: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: C.folder.pad,
    gap: ref.space.sm,
    marginHorizontal: -P.hairline,
    marginBottom: -P.hairline,
    borderWidth: P.hairline,
    borderRadius: C.folder.radius,
    ...ref.curve,
  },
  folderStamp: { alignSelf: "stretch", alignItems: "center", marginHorizontal: -C.folder.pad * 2 },
  label: {
    alignSelf: "stretch",
    paddingHorizontal: C.folder.label.padX,
    paddingVertical: C.folder.label.padY,
    borderRadius: C.folder.label.radius,
  },
  // The accused's card grows from its compact padding to accused.max, its words centred.
  accused: { alignSelf: "stretch", flexGrow: 1, maxHeight: L.accusedMax },
  recap: { alignSelf: "stretch" },
  recapRow: { flexDirection: "row", justifyContent: "center", gap: ref.space.xl },
  recapItem: { flexShrink: 1, alignItems: "center", gap: 2 },
  recapLabel: { textTransform: "uppercase", letterSpacing: 1.2 },
  accusedCard: { flexGrow: 1, justifyContent: "center", paddingVertical: C.accused.padY },
  // The room grows from photo.min to the column's width at photo.aspect (set inline).
  room: { alignSelf: "stretch", flexGrow: 1, minHeight: C.photo.min },
  photoFrame: { ...StyleSheet.absoluteFill, borderRadius: C.photo.radius, overflow: "hidden", ...ref.curve },
  roomLine: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", paddingHorizontal: ref.space.sm },
  gonePill: { paddingHorizontal: P.gone.padX, paddingVertical: P.gone.padY, borderRadius: ref.radius.round, overflow: "hidden", ...ref.curve },
  goneFill: { borderRadius: ref.radius.round, opacity: P.gone.fillOpacity },
  stamp: { alignSelf: "center", marginVertical: C.stamp.room },
  titleBlock: { alignItems: "center", alignSelf: "stretch" },
  centre: { textAlign: "center" },
  exit: { marginTop: C.gap.exit },
  // A compact row: three of 07's cards, each its value over its label.
  stats: { alignSelf: "stretch", flexDirection: "row", gap: ref.space.sm, marginTop: C.gap.card - C.gap.head },
  stat: { flex: 1 },
  statCard: { flex: 1, paddingHorizontal: C.stat.padX, paddingVertical: L.statPadY, justifyContent: "center" },
  statInner: { alignItems: "center", gap: C.stat.gap },
  after: { marginTop: C.gap.card - C.gap.head },
  // The photo guide's foot: its reading column, the pill to the quiet buttons ref.space.sm apart.
  actions: { paddingTop: C.actions.pad, paddingHorizontal: ref.space.reading, gap: ref.space.sm },
});
