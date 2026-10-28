// Case closed, per mode: the victory moment, made a collectible
// (docs/ART_DIRECTION.md: pillar 4, "worth sharing", and the mystery-book
// core: "case closed is the last page, or a library card stamped Solved").
// One card she'd screenshot: a page of warm cream book paper, its bookmark
// ribbon in the mode's sweet colour, the series line ("A Moonlit Mystery")
// over a fleuron rule; the room's photo tucked into photo corners as a
// polaroid with the case's name handwritten in its foot; a gold-foil seal
// pressed on with the mode's word (noir: CASE CLOSED; crime scene: GUILTY;
// paranormal: THE PRESENCE IS GONE, as the room snaps back to its own
// colours); the sitting cat beside it, cheering; the ending's line set like
// a book's last line; then the library card's record, each entry handwritten
// on its ruled line (crime scene's culprit, motive and method; the time, the
// tips taken, the wrong calls; the rating: magnifiers in brass, or
// paranormal's "Second sight" in moons); and at its foot the app's name and a
// library date stamp, SOLVED and the day, so a screenshot says where it's
// from. Behind it, the mode's ground and its soft glow; a few twinkles; a
// little confetti when the seal lands. Then the pinned actions.
//
// The moment, in order (victory.ts, victoryTimeline; ms in
// ref.layout.play.complete.beat):
// 1. The page and polaroid are set down and the cat pops up; the seal is
//    pressed on (it falls, overshoots and settles: slam.ts) with the `stamp`
//    cue, the page is nudged, the cat cheers and the confetti bursts.
//    Paranormal's room first snaps back to its own colours.
// 2. The record's entries land one by one, a `tick` each (only what the
//    game holds: a v2 game's own count, or the completed session's).
// 3. The rating's marks fill one by one, a `tick` each, then `solved`.
// 4. The actions come in.
// Reduced motion: no fall, nudge, stagger or confetti; it all fades in within
// about 600 ms, the haptics kept.
//
// Said once: where the seal says CASE CLOSED (or the presence is gone), a
// sentence of the case's lines that only says so again is left out.
//
// It fits one screen with no scroll at the default text size on a 390 x 844
// phone, and down to an iPhone SE for noir and paranormal: the polaroid is
// sized to the height left over (from photo.min up to its share of the
// page's width). Crime scene's longer record, and large text, scroll.
//
// Sharing (not built: neither react-native-view-shot nor expo-sharing is a
// dependency): the page is one View (`testID="case-card"`, held in `card`),
// so a share button can capture it later and hand it to `onShare`.
import { useEffect, useLayoutEffect, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import type { Genre } from "@/lib/puzzle-types";
import { useFeedback } from "@/game/feedback";
import { setMode, themeFor } from "@/game/mode";
import { SittingCat } from "@/play2/SittingCat";
import { useTheme } from "@/theme/ThemeProvider";
import { LIGHT, PAGE, PAYOFF_TYPE, alpha, handType } from "@/theme/payoff";
import { motion, ref } from "@/theme/tokens";
import {
  ClockMark, Confetti, CrossMark, FleuronRule, FoilSeal, LibraryStamp, POLAROID, Polaroid, TipMark, Twinkle, captionSize, look,
} from "./keepsake";
import { MagnifierRating } from "./MagnifierRating";
import type { SceneSource } from "./SceneView";
import { suspectA11yLabel, type SuspectFace } from "./SuspectFile";
import { RATING_LABEL, RATING_MARK, SERIES_LINE, magnifierRating, statLines, victoryTimeline, type CaseSummary, type VictoryTimeline } from "./victory";

export type { CaseSummary } from "./victory";

const C = ref.layout.play.complete;

/** This screen's own sizes. */
export const CLOSED_LAYOUT = {
  /** The page: `edge` from the screen's sides, `pad` inside, `radius` corners, its parts `gap` apart. */
  edge: 16,
  pad: 16,
  radius: 22,
  gap: 9,
  /** The polaroid's photo (square): at least `min`, at most `max`, and no more than `share` of the page's inner width. */
  photo: { min: 108, max: 232, share: 0.65 },
  /** Room in the photo row for the polaroid's tilt and its corners. */
  heroPad: 14,
  /** The polaroid's tilt; the seal's. */
  tilt: { polaroid: -3, seal: 9 },
  /** The foil seal across. */
  seal: 96,
  /** The sitting cat beside the polaroid: at most this wide. */
  cat: 80,
  /** The series line and its fleuron rule. */
  head: ref.type.series.lineHeight + 18,
  /** The ending's line, set as a book's last line. */
  last: PAYOFF_TYPE.last,
  /** A record entry: its ruled line's height; its value handwritten at `value` pt; its icon. */
  row: 30,
  value: 20,
  icon: 15,
  /** The stats' row of cells: a label over a handwritten value. */
  cell: 58,
  /** A record value's figures: lining, tabular (the hand face's 0 still reads as 0). */
  figure: { fontVariant: ["lining-nums", "tabular-nums"] } as const satisfies TextStyle,
  /** The rating's marks. */
  mark: 24,
  /** The footer line. */
  footer: 26,
  /** The cat's line over the page, shown with `room` pt to spare. */
  shelf: { size: 22, lineHeight: 28, gap: 14, room: 90 },
  /** The actions never sit closer than this to the bottom edge. */
  bottomMin: ref.space.lg,
  /** The pinned band: its top pad, the pill, the gap, the quiet pill. */
  actions: C.actions.pad + ref.button.ghost.height + ref.space.sm + ref.button.quiet.height,
} as const;
const L = CLOSED_LAYOUT;

/** The cat's line over the page, on a tall phone. */
export const SHELF_LINE = "Another one for your shelf \u2665";


const CASE_CLOSED = /^\s*case closed[.!]*\s*$/i;
const PRESENCE_GONE = /^\s*the presence is gone[.!]*\s*$/i;

/** A line without the sentences that only say `said` (the seal says it). Empty when nothing else is left. */
function without(line: string, said: RegExp): string {
  const sentences = line.match(/[^.!?]+[.!?]*\s*/g) ?? [line];
  return sentences.filter((s) => !said.test(s)).join("").trim();
}

/** A line without the sentences that only say "Case closed." (the seal says it). Empty when nothing else is left. */
export function withoutCaseClosed(line: string): string {
  return without(line, CASE_CLOSED);
}

/** What the seal says, per mode (crime scene with an accused: GUILTY). */
export const SEAL_WORD: Record<Genre, string> = {
  noir: "Case closed",
  crime_scene: "Case closed",
  paranormal: "The presence is gone",
};

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
  /** Crime scene: why and how, as the accusation named them (the record's motive and method). */
  recap?: { why?: string; how?: string } | null;
  /** The room's photo, for the polaroid (paranormal's snaps back to its own colours). Without one, the mode's drawn cover. */
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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Today as a library stamp has it: 28 Oct 2026. */
export function stampDate(d = new Date()): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** About how many lines `text` takes at `size` pt across `width` (the budget's estimate, not layout). */
const linesFor = (text: string | undefined, size: number, width: number, max: number) =>
  text ? Math.min(max, Math.max(1, Math.ceil((text.length * size * 0.5) / Math.max(1, width)))) : 0;

export function CaseClosed({ genre, title, message: rawMessage, exit: rawExit, summary, accused, recap, photo, next, actions }: CaseClosedProps) {
  const theme = themeFor(genre);
  const payoff = look(theme, genre);
  const { reducedMotion: reduced } = useTheme();
  const feedback = useFeedback();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // Case closed is the mode's last screen: its parts take the mode's look.
  useLayoutEffect(() => setMode(genre), [genre]);

  const [mountedAt] = useState(() => Date.now());
  const elapsed = () => Date.now() - mountedAt;
  // The share hook: the case card, for a future capture.
  const card = useRef<CaseCard>(null);
  // The beats up to the impact need no data.
  const [head] = useState(() => victoryTimeline({ genre, reduced, stats: 0, rating: null }));

  const guilty = genre === "crime_scene" && !!accused;
  const paranormal = genre === "paranormal";
  // What the seal says, the case's lines don't say again.
  const said = paranormal ? PRESENCE_GONE : CASE_CLOSED;
  const trim = (line?: string) => (line ? without(without(line, said), CASE_CLOSED) : line) || undefined;
  const message = trim(rawMessage);
  const exit = trim(rawExit);

  // The nudge: the page jolts down and shakes once as the seal hits; the cat cheers; confetti.
  const nudgeX = useSharedValue(0);
  const nudgeY = useSharedValue(0);
  const [cheer, setCheer] = useState(0);
  const landed = () => {
    feedback.stamp();
    setCheer((n) => n + 1);
    if (reduced) return;
    const { x, y, step } = C.slam.nudge;
    const t = (to: number) => withTiming(to, { duration: step });
    nudgeY.set(withSequence(t(y), t(-y / 2), t(0)));
    nudgeX.set(withSequence(t(x), t(-x), t(x / 2), t(0)));
  };
  const nudgeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: nudgeX.get() }, { translateY: nudgeY.get() }] }));

  // Paranormal: the tint comes off the room at its beat.
  const [snapped, setSnapped] = useState(reduced);
  useEffect(() => {
    if (!paranormal || snapped) return;
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

  // The plan's haptics: a tick per entry and per earned mark, then `solved`; and the actions come in.
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
  const shown = plan ? (plan.summary ?? late) : null;
  const lines = statLines(genre, shown);
  const rating = magnifierRating(shown);
  const since = (t: number | undefined) => (late || t === undefined ? 0 : Math.max(0, t - (plan?.at ?? 0)));
  const statDelay = (i: number) => (reduced ? since(plan?.timeline.stats[0]) : since(plan?.timeline.stats[i]));

  // Crime scene's record: the culprit, then why and how.
  const caseRows = guilty && accused
    ? ([["Culprit", accused.name], ["Motive", recap?.why], ["Method", recap?.how]] as [string, string | undefined][]).filter((r): r is [string, string] => !!r[1])
    : [];

  // The polaroid takes the height left over, up to its share of the page's width.
  const inner = width - 2 * (L.edge + L.pad);
  const actionsHeight = L.actions + (next ? ref.layout.play.type.hint.lineHeight + ref.space.sm : 0) + Math.max(insets.bottom + ref.space.ctaBottom, L.bottomMin);
  const lastHeight = linesFor(message, L.last.fontSize, inner, 3) * L.last.lineHeight + linesFor(exit, 15, inner, 2) * 20;
  const parts = [L.head, lastHeight, caseRows.length * L.row, lines.length ? L.cell : 0, rating || lines.length ? L.mark + 8 : 0, L.footer].filter(Boolean);
  const fixed = insets.top + 2 * C.pad + 2 * L.pad + L.heroPad + parts.length * L.gap + parts.reduce((a, b) => a + b, 0) + actionsHeight;
  const side = Math.round(Math.max(L.photo.min, Math.min(L.photo.max, inner * L.photo.share, height - fixed - POLAROID.frame - POLAROID.foot)));
  const polaroidW = side + POLAROID.frame * 2;
  const polaroidH = side + POLAROID.frame + POLAROID.foot;
  const heroH = polaroidH + L.heroPad;
  const column = inner - polaroidW;
  const catW = Math.round(Math.max(56, Math.min(L.cat, column - 12)));
  // On a tall phone, the cat's line over the page: the book goes on her shelf.
  const spare = height - fixed - polaroidH;
  const shelfLine = spare > L.shelf.room;
  const sealWord = guilty ? "Guilty" : SEAL_WORD[genre];
  const sealTestID = guilty ? "closed-guilty" : paranormal ? "closed-gone" : "closed-stamp";
  const sealSize = Math.min(L.seal, column + 34);

  return (
    <View style={[styles.root, { backgroundColor: theme.ground, paddingTop: insets.top }]} testID={`case-closed-${genre}`}>
      <Backdrop glow={payoff.glow} sweet={payoff.sweet} />
      {/* The column fills the space over the actions: the page is centred in it. */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} testID="closed-scroll">
        {shelfLine ? (
          <Beat delay={reduced ? 0 : C.beat.cta * 6} reduced={reduced} style={styles.shelf}>
            <Text style={[handType(L.shelf.size, L.shelf.lineHeight), styles.centre, { color: payoff.sweet }]} testID="closed-shelf">
              {SHELF_LINE}
            </Text>
          </Beat>
        ) : null}
        <Beat delay={0} reduced={reduced} rise={16}>
          <Animated.View style={nudgeStyle}>
            {/* The page under it: the book's next leaf, a shade deeper. */}
            <View style={[styles.leaf, { backgroundColor: PAGE.deep }]} />
            <View
              ref={card}
              collapsable={false}
              style={[styles.card, { backgroundColor: PAGE.paper, boxShadow: `0px 18px 44px ${alpha(theme.ground, 0.9)}, 0px 0px 60px ${alpha(payoff.glow, 0.14)}` }]}
              testID="case-card"
            >
              <Ribbon color={payoff.sweet} />

              <View style={styles.head}>
                <Text style={[ref.type.series, styles.centre, { color: payoff.pageInk }]} testID="closed-series">{SERIES_LINE[genre]}</Text>
                <FleuronRule color={PAGE.foilOnPaper} width={Math.min(200, inner * 0.62)} />
              </View>

              {/* The polaroid tucked into its corners, the seal on it, the cat beside it. */}
              <View style={[styles.hero, { height: heroH }]} testID="closed-room">
                <Beat delay={reduced ? 0 : 120} reduced={reduced} rise={14} style={[styles.polaroid, { top: L.heroPad / 2 }]}>
                  <Polaroid
                    width={polaroidW}
                    photoHeight={side}
                    source={photo}
                    genre={genre}
                    original={paranormal && snapped}
                    caption={title}
                    captionSize={captionSize(title, side)}
                    lookOf={{ ...payoff, paper: PAGE.print }}
                    tilt={L.tilt.polaroid}
                    shade={PAGE.printShade}
                    corners={PAGE.ink}
                    photoLabel={paranormal ? "The room, back to its own colours" : "The room"}
                    photoTestID="closed-photo"
                    captionTestID="closed-title"
                    testID="closed-polaroid"
                  />
                </Beat>

                <FoilSeal
                  text={sealWord}
                  foil={payoff.foil}
                  size={sealSize}
                  fontSize={paranormal ? Math.round(sealSize * 0.11) : guilty ? Math.round(sealSize * 0.17) : Math.round(sealSize * 0.14)}
                  tilt={L.tilt.seal}
                  delay={head.stamp}
                  reduced={reduced}
                  onLanded={landed}
                  style={[styles.seal, { left: Math.max(polaroidW - sealSize * 0.45, polaroidW + column / 2 - sealSize / 2 - 10) }]}
                  testID={sealTestID}
                />

                <View style={styles.cat} pointerEvents="box-none">
                  <SittingCat width={catW} delay={reduced ? 0 : 300} cheer={cheer} label="The black cat, very pleased with you" />
                </View>

                <Confetti
                  fire={cheer}
                  colors={[payoff.sweet, payoff.foil, theme.accent, payoff.glow]}
                  x={Math.max(polaroidW - sealSize * 0.45, polaroidW + column / 2 - sealSize / 2 - 10) + sealSize / 2}
                  y={sealSize / 2 + 4}
                  reduced={reduced}
                  testID="closed-confetti"
                />
              </View>

              {message || exit ? (
                <Beat delay={head.impact} reduced={reduced} style={styles.words}>
                  {message ? <Text style={[L.last, styles.centre, { color: PAGE.ink }]} testID="closed-message">{message}</Text> : null}
                  {exit ? <Text style={[styles.exit, styles.centre, { color: PAGE.muted }]}>{exit}</Text> : null}
                </Beat>
              ) : null}

              {caseRows.length ? (
                <Beat delay={head.impact} reduced={reduced}>
                  <View
                    accessible
                    accessibilityLabel={[`Guilty. ${suspectA11yLabel(accused!)}`, recap?.why && `Why: ${recap.why}.`, recap?.how && `How: ${recap.how}.`].filter(Boolean).join(" ")}
                    testID="closed-accused"
                  >
                    {caseRows.map(([label, value], i) => (
                      <Entry
                        key={label}
                        label={label}
                        value={value}
                                                first={i === 0}
                        testID={label === "Culprit" ? undefined : label === "Motive" ? "closed-recap" : "closed-recap-how"}
                      />
                    ))}
                  </View>
                </Beat>
              ) : null}

              {lines.length ? (
                // The card's columns: one cell per stat, the label in small caps over the value, handwritten.
                <Beat delay={statDelay(0)} reduced={reduced || !!late} style={[styles.columns, { borderColor: PAGE.rule }]} testID="closed-stats">
                  {lines.map((line, i) => (
                    <Beat key={line.key} delay={statDelay(i)} reduced={reduced || !!late} rise={8} style={[styles.cell, i > 0 && { borderLeftColor: PAGE.rule, borderLeftWidth: 1 }]}>
                      <View style={styles.cellInner} accessible accessibilityLabel={`${line.label}: ${line.value}`} testID={`closed-stat-${line.key}`}>
                        <View style={styles.entryLabel}>
                          {line.key === "time" ? <ClockMark size={L.icon} color={payoff.pageInk} /> : line.key === "hints" ? <TipMark size={L.icon} color={payoff.pageInk} /> : <CrossMark size={L.icon} color={payoff.pageInk} />}
                          <Figure value={line.value} />
                        </View>
                        <Text style={[styles.label, styles.cellLabel, { color: PAGE.muted }]} numberOfLines={1}>{line.label}</Text>
                      </View>
                    </Beat>
                  ))}
                </Beat>
              ) : null}

              {rating && plan ? (
                <Beat delay={since(plan.timeline.rating)} reduced={reduced || !!late} style={styles.rating}>
                  <MagnifierRating
                    rating={rating}
                    label={RATING_LABEL[genre]}
                    mark={RATING_MARK[genre]}
                    color={RATING_MARK[genre] === "moon" ? payoff.pageInk : PAGE.brass}
                    emptyColor={alpha(PAGE.muted, 0.6)}
                    labelColor={PAGE.muted}
                                        size={L.mark}
                    theme={theme}
                    reduced={reduced || !!late}
                    delays={plan.timeline.magnifiers.map(since)}
                    testID="closed-rating"
                  />
                </Beat>
              ) : null}

              {/* Where a screenshot is from: the app, and the library's stamp. */}
              <View style={styles.footer}>
                <Text style={[styles.brand, { color: PAGE.muted }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">ESCAPD</Text>
                <LibraryStamp text={`Solved · ${stampDate()}`} ink={payoff.pageInk} testID="closed-date" />
              </View>
            </View>
            <Twinkle size={16} color={payoff.glow} reduced={reduced} style={styles.twinkleA} />
            <Twinkle size={11} color={payoff.sweet} delay={700} reduced={reduced} style={styles.twinkleB} />
            <Twinkle size={13} color={payoff.foil} delay={1300} reduced={reduced} style={styles.twinkleC} />
          </Animated.View>
        </Beat>
      </ScrollView>
      <Animated.View style={[styles.actions, { paddingBottom: Math.max(insets.bottom + ref.space.ctaBottom, L.bottomMin) }, ctaStyle]} testID="closed-actions">
        {next ? <Text style={[ref.layout.play.type.hint, styles.centre, { color: theme.inkMuted }]}>{next}</Text> : null}
        {actions}
      </Animated.View>
    </View>
  );
}

/** Fades in `delay` ms after it mounts; `rise` also lifts it into place by that many points (not under reduced motion). */
function Beat({ delay, reduced, rise = 0, style, testID, children }: {
  delay: number;
  reduced: boolean;
  rise?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children: ReactNode;
}) {
  const opacity = useSharedValue(0);
  const lift = useSharedValue(rise && !reduced ? rise : 0);
  useEffect(() => {
    const duration = reduced ? motion.reducedFade : C.beat.enter * 1.4;
    opacity.set(withDelay(delay, withTiming(1, { duration })));
    if (rise && !reduced) lift.set(withDelay(delay, withTiming(0, { duration })));
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ translateY: lift.get() }] }));
  return <Animated.View style={[style, animated]} testID={testID}>{children}</Animated.View>;
}

/** One entry on the library card's record: the label in small caps on the left, the value handwritten on the ruled line. */
function Entry({ label, value, first, testID }: {
  label: string;
  value: string;
  first?: boolean;
  testID?: string;
}) {
  return (
    <View style={[styles.entry, { borderBottomColor: PAGE.rule }, first && { borderTopColor: PAGE.rule, borderTopWidth: 1 }]} testID={testID}>
      <Text style={[styles.label, { color: PAGE.muted }]} numberOfLines={1}>{label}</Text>
      <Text style={[handType(L.value, L.row - 2), styles.value, { color: PAGE.ink }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

/** A stat's value, handwritten: its figures lining, its units (min, h) a step down. */
function Figure({ value }: { value: string }) {
  const parts = value.split(/(\d+)/).filter(Boolean);
  return (
    <Text style={[handType(24, 28), L.figure, styles.centre, { color: PAGE.ink }]} numberOfLines={1}>
      {parts.map((part, i) => (/\d/.test(part) ? part : <Text key={i} style={styles.unit}>{part}</Text>))}
    </Text>
  );
}

/** A bookmark ribbon hanging from the page's top edge, its tail notched. */
function Ribbon({ color }: { color: string }) {
  const w = 16;
  const h = 46;
  return (
    <View style={styles.ribbon} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={w} height={h}>
        <Path d={`M0 0 H${w} V${h} L${w / 2} ${h - 7} L0 ${h} Z`} fill={color} />
        <Path d={`M3 0 V${h - 4}`} stroke={LIGHT.white} strokeOpacity={0.25} strokeWidth={1} />
      </Svg>
    </View>
  );
}

/** The mode's soft glow on the ground behind the page (a candle, a desk lamp, the moon), and a blush of its sweet colour low down. */
function Backdrop({ glow, sweet }: { glow: string; sweet: string }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="ccGlow" cx="50%" cy="30%" rx="80%" ry="48%" fx="50%" fy="30%">
            <Stop offset={0} stopColor={glow} stopOpacity={0.22} />
            <Stop offset={1} stopColor={glow} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="ccSweet" cx="12%" cy="88%" rx="60%" ry="35%" fx="12%" fy="88%">
            <Stop offset={0} stopColor={sweet} stopOpacity={0.12} />
            <Stop offset={1} stopColor={sweet} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#ccGlow)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#ccSweet)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: L.edge, paddingVertical: C.pad },
  shelf: { marginBottom: L.shelf.gap },
  leaf: { ...StyleSheet.absoluteFill, borderRadius: L.radius, transform: [{ rotate: "1.2deg" }, { translateY: 5 }], ...ref.curve },
  card: { padding: L.pad, gap: L.gap, borderRadius: L.radius, ...ref.curve },
  ribbon: { position: "absolute", top: 0, right: 26 },
  head: { alignItems: "center", gap: 2, height: L.head },
  hero: { alignSelf: "stretch" },
  polaroid: { position: "absolute", left: 4 },
  seal: { position: "absolute", top: 0 },
  cat: { position: "absolute", right: 2, bottom: 0 },
  words: { alignItems: "center", alignSelf: "stretch", gap: 2, paddingHorizontal: 4 },
  exit: { fontSize: 15, lineHeight: 20 },
  centre: { textAlign: "center" },
  entry: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: L.row, borderBottomWidth: 1, gap: 12 },
  entryLabel: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: "700", letterSpacing: 1.1, textTransform: "uppercase" },
  value: { flexShrink: 1, textAlign: "right" },
  unit: { fontSize: 15 },
  columns: { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1 },
  cell: { flex: 1 },
  cellInner: { alignItems: "center", paddingVertical: 6, paddingHorizontal: 2, gap: 1 },
  cellLabel: { letterSpacing: 0.5 },
  rating: { paddingTop: 0 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: L.footer },
  brand: PAYOFF_TYPE.brand,
  twinkleA: { top: -8, left: 18 },
  twinkleB: { top: 70, right: -6 },
  twinkleC: { bottom: 64, left: -6 },
  // The photo guide's foot: its reading column, the pill to the quiet buttons ref.space.sm apart.
  actions: { paddingTop: C.actions.pad, paddingHorizontal: ref.space.reading, gap: ref.space.sm },
});
