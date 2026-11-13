// The casebook (gameplay v2 §2 "Learn"): the detective's own casebook, a real
// book. Cloth-bound in the mode's cloth with a foil-stamped front board and
// brass corners (rendered: journal/Book.tsx, scripts/blender/props/book_*.py),
// it comes up onto the close-ups' table shut, and opens: the board swings
// over on its joint and the book lies open at its ribbon. She writes on the
// right-hand page, in the same world as the case's letters (src/play2/letters).
// Its sections are leaves, each with an index tab standing out of the book's
// head; a tab turns to its leaf, the sheet folding over the gutter with its
// back showing (journal/PageTurn):
//   The case: the series line as its letterhead, clipped like her brief, the
//     objective in her hand, the margin's score (a question mark per lead,
//     ticked as she follows it; a scribble that knows when she's close), and
//     what she's holding as stickers;
//   What I found: taped in and pinned (notes, polaroids, violet UV scraps;
//     journal/JournalCard), red string between the ones that belong together,
//     new ones dropping in with a "new!" star (journal/Board, journal/threads);
//   The usual suspects (crime scene): the evidence board as library cards to
//     strike off;
//   Notes in the margin: the hints, from the cat ("psst —"), a sticker to ask
//     for another; and at the foot of that last leaf, the glints switch and
//     restart.
// Each leaf scrolls within the page. It opens at "What I found" once there is
// anything there, else at the case.
// A UV trace's report is never taped in (quiet.ts): rooms stored before round
// 14 still hand them over, and a report says what a trace means, which is the
// player's to work out. The one card a trace keeps is a writing trace's own
// words, bare.
// Reduced motion: the book is simply open, and a tab simply shows its leaf.
import { createElement, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, BackHandler, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type HostInstance } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import type { ObjectDef } from "@/engine/v2";
import { useTheme } from "@/theme/ThemeProvider";
import { LETTER, LETTER_FONT, LETTER_TEXT, mix } from "@/theme/payoff";
import { z, type ModeTheme } from "@/theme/tokens";
import type { FoundCard } from "./InspectView";
import { withoutTraceReports } from "./quiet";
import { itemIcon } from "./ItemTray";
import { hidden, INK, useHudMaterials } from "./hud/materials";
import { CloseStud, TABLE_EDGE, TableTop } from "./hud/Table";
import { railHeight } from "./hud/TopRail";
import { Board } from "./journal/Board";
import { bookLayout, LandingShade, OpeningSpread, SwingingCover } from "./journal/Book";
import { Arrow, CoffeeRing, Moon, Paw, PressedFlower, Sparkle, Star, Tick, Underline } from "./journal/Doodles";
import { Polaroid } from "./journal/JournalCard";
import { LeadTracker, MarginNote } from "./journal/Margin";
import { EvidenceBoard } from "./journal/LibraryCard";
import { PageTurn, Windowed } from "./journal/PageTurn";
import { handType, journalPalette, type HandType, type JournalPalette } from "./journal/palette";
import { Rules, softShadow } from "./journal/Paper";
import { Letterhead } from "./letters/Letterhead";
import { PaperClip, Sprig } from "./letters/Marks";
import { stringsOf, type ThreadLog } from "./journal/threads";

const GRAIN = require("../../assets/grain.png");

export interface CasebookProps {
  objective: string;
  cards: FoundCard[];
  /** What she holds. `kind` and `archetype` (ItemDef's), when given, pick each sticker's icon. */
  items: { id: string; name: string; examinable: boolean; kind?: string; archetype?: string }[];
  hints: string[];
  /** False when there is nothing more to hint: every step done, or the current step's ladder used up. */
  canHint: boolean;
  /** Crime scene: the accusation's lists, an evidence board the player crosses options off. */
  board?: { title: string; options: { id: string; name: string }[] }[];
  struck?: string[];
  onStrike?: (id: string) => void;
  /** Objects glint in the torch's beam; off is the hard way. */
  glints: boolean;
  onGlints: (on: boolean) => void;
  onHint: () => void;
  onExamine: (itemId: string) => void;
  onRestart: () => void;
  onClose: () => void;
  /** The cat, peering over the table's edge (thinking along when you ask for a hint). */
  cat?: ReactNode;
  /** Steps solved, of all of them: the margin's leads and notes. */
  progress?: { solved: number; total: number };
  /** How many of the last cards are new since the casebook was last opened (they drop in). */
  fresh?: number;
  /** Where and when each card turned up (journal/useCaseThreads): the red string. */
  log?: ThreadLog | null;
  /** The room's objects (a UV trace's card belongs with the thing it marks; a trace's report is never listed). */
  objects?: readonly Pick<ObjectDef, "id" | "trace">[];
  /** What the room has lit up so far (a writing trace's words: the one card a trace keeps is those words, bare). */
  marks?: readonly { object: string; overlay: string; mark?: string }[];
  /** As it closes: the strings it showed taut and the steps it showed ticked. */
  onSeen?: (taut: string[], ticked: number) => void;
}

/** The book's leaves, in order. */
export type Leaf = "case" | "found" | "board" | "hints";
const LEAVES: Record<Leaf, { tab: string; label: string }> = {
  case: { tab: "Case", label: "The case" },
  found: { tab: "Found", label: "What I found" },
  board: { tab: "Suspects", label: "The usual suspects" },
  hints: { tab: "Hints", label: "Notes in the margin" },
};

/** Chapter titles in the correspondence's faces (theme/payoff LETTER_FONT): typed, printed on the form, set in IM Fell. */
const CHAPTER_TYPE = {
  noir: { fontFamily: LETTER_FONT.typewriter, fontSize: 24, lineHeight: 30 },
  crime_scene: { fontFamily: LETTER_FONT.formHeavy, fontSize: 23, lineHeight: 28, letterSpacing: -0.2 },
  paranormal: { fontFamily: LETTER_FONT.fellItalic, fontSize: 27, lineHeight: 32 },
} as const;
/** What the cat says before each margin note, in turn. */
const PSST = ["psst —", "ooh, and —", "also —", "and —"];

/** The book coming up onto the table, its board swinging over, and the same going back (ms): under 600 either way. */
export const BOOK_MS = { rise: 230, swing: 330, overlap: 40, shut: 250, sink: 190 } as const;
/** A leaf turning. */
export const TURN_MS = 460;
/** The room behind the table, dimmed. */
const DIM = 0.6;
/** Room over the table's edge for the cat to look over it. */
const CAT_ROOM = 46;
/** The book on the table: this far under the table's edge (its tabs stand in the gap). */
const BOOK_TOP = TABLE_EDGE + 14;
/** A swipe that turns a leaf: sideways this far before it counts as one (a scroll never does), and this far to turn. */
const SWIPE = { start: 18, stray: 14, far: 44 } as const;
/** A tab: how far it stands out of the book's head, and how far it is tucked in behind the page. */
const TAB = { out: 28, tucked: 8, gap: 4, max: 86 } as const;

export function Casebook({ objective, cards: found, items, hints, canHint, board, struck = [], onStrike, glints, onGlints, onHint, onExamine, onRestart, onClose, cat, progress, fresh = 0, log, objects, marks, onSeen }: CasebookProps) {
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  const feedback = useFeedback();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const m = useHudMaterials();
  const p = journalPalette(theme);
  const genre = theme.genre ?? "noir";
  const hand = handType(theme);
  const solved = progress?.solved ?? 0;
  // What she found, less any UV trace's report (old rooms'): never listed, never counted.
  const cards = useMemo(() => withoutTraceReports(found, objects ? { objects } : null, log ?? null, marks), [found, objects, log, marks]);
  // What the log said as the casebook opened: the strings, which twang, which ticks are new (fixed while it's open).
  const [opened] = useState(() => ({ log, fresh }));
  const strings = useMemo(() => (opened.log ? stringsOf(cards, opened.log, solved, objects) : []), [opened.log, cards, solved, objects]);
  const ticked = opened.log ? Math.min(opened.log.ticked, solved) : solved;
  // As it closes, the log learns what it has shown.
  const seenRef = useRef<() => void>(() => {});
  useEffect(() => {
    seenRef.current = () => onSeen?.(strings.filter((x) => x.taut).map((x) => x.key), solved);
  });
  useEffect(() => () => seenRef.current(), []);
  // Restarting wipes the case: the first tap asks, a second within a few seconds does it.
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), RESTART_CONFIRM_MS);
    return () => clearTimeout(t);
  }, [confirming]);

  // ---- The table and the book on it.
  const tableTop = insets.top + railHeight(genre) + CAT_ROOM;
  const tableH = Math.max(280, height - tableTop);
  const bookH = tableH - BOOK_TOP - Math.max(2, insets.bottom - 30);
  const book = useMemo(() => bookLayout(width, bookH), [width, bookH]);
  const shade = useMemo(() => mix(m.shadow, "#000000", 0.2), [m.shadow]);

  // ---- Opening and closing: the table comes up with the book shut on it, then the board swings over.
  const rise = useSharedValue(reducedMotion ? 1 : 0);
  const swing = useSharedValue(reducedMotion ? 1 : 0);
  const [phase, setPhase] = useState<"opening" | "open" | "closing">(reducedMotion ? "open" : "opening");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (reducedMotion) return;
    // Once the book and its page are laid out (two frames on): nothing is still being made while it moves.
    const cancel = afterFrames(2, () => {
      feedback.paper();
      rise.set(withTiming(1, { duration: BOOK_MS.rise, easing: Easing.out(Easing.cubic) }));
      swing.set(withDelay(BOOK_MS.rise - BOOK_MS.overlap, withTiming(1, { duration: BOOK_MS.swing, easing: Easing.inOut(Easing.quad) })));
      timer.current = setTimeout(() => setPhase("open"), BOOK_MS.rise - BOOK_MS.overlap + BOOK_MS.swing + 20);
    });
    return () => {
      cancel();
      if (timer.current) clearTimeout(timer.current);
    };
    // Once, as it comes up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const close = useCallback(() => {
    if (reducedMotion || phase === "closing") {
      if (timer.current) clearTimeout(timer.current);
      onClose();
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setPhase("closing");
    swing.set(withTiming(0, { duration: BOOK_MS.shut, easing: Easing.inOut(Easing.quad) }));
    rise.set(withDelay(BOOK_MS.shut - BOOK_MS.overlap, withTiming(0, { duration: BOOK_MS.sink, easing: Easing.in(Easing.quad) })));
    timer.current = setTimeout(onClose, BOOK_MS.shut - BOOK_MS.overlap + BOOK_MS.sink);
  }, [onClose, phase, reducedMotion, rise, swing]);
  /** A touch while it opens: open at once. While it closes: gone at once. */
  const skip = () => {
    if (phase === "closing") {
      close();
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    cancelAnimation(rise);
    cancelAnimation(swing);
    rise.set(1);
    swing.set(1);
    setPhase("open");
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);
  // A screen reader lands on the book's name once it lies open.
  const nameRef = useRef<HostInstance>(null);
  useEffect(() => {
    if (phase !== "open" || Platform.OS === "web" || !nameRef.current) return;
    // Presentation only: a failure here must never reach the screen.
    try {
      AccessibilityInfo.sendAccessibilityEvent(nameRef.current, "focus");
    } catch {}
  }, [phase]);
  const tableStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - rise.get()) * tableH }] }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: rise.get() * DIM }));

  // ---- The leaves, and turning between them.
  const order = useMemo<Leaf[]>(() => (board ? ["case", "found", "board", "hints"] : ["case", "found", "hints"]), [board]);
  const [leaf, setLeaf] = useState<Leaf>(() => (cards.length ? "found" : "case"));
  const [visited, setVisited] = useState<Leaf[]>(() => [leaf]);
  // A turn under way: the earlier leaf folds over (or back down onto) the later one.
  const [turn, setTurn] = useState<{ over: Leaf; under: Leaf; forward: boolean; n: number } | null>(null);
  const fold = useSharedValue(1);
  const still = useSharedValue(0);
  const overShift = useDerivedValue(() => fold.get() - 1);
  const underShift = useDerivedValue(() => fold.get());
  const turnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turns = useRef(0);
  const turnTo = (to: Leaf) => {
    if (to === leaf || !order.includes(to)) return;
    feedback.paper();
    if (!visited.includes(to)) setVisited((v) => [...v, to]);
    if (reducedMotion) {
      setLeaf(to);
      return;
    }
    const forward = order.indexOf(to) > order.indexOf(leaf);
    cancelAnimation(fold);
    fold.set(forward ? 1 : 0);
    setTurn({ over: forward ? leaf : to, under: forward ? to : leaf, forward, n: ++turns.current });
    setLeaf(to);
  };
  // A leaf can be turned by hand as well: a swipe across the page, toward the gutter for the next, away from it for the last.
  const flip = (by: 1 | -1) => {
    const to = order[order.indexOf(leaf) + by];
    if (to && !turn) turnTo(to);
  };
  const swipe = usePanGesture({
    enabled: phase === "open",
    testID: "v2-casebook-swipe",
    maxPointers: 1,
    activeOffsetX: [-SWIPE.start, SWIPE.start],
    failOffsetY: [-SWIPE.stray, SWIPE.stray],
    onDeactivate: (e) => {
      "worklet";
      if (Math.abs(e.translationX) >= SWIPE.far) scheduleOnRN(flip, e.translationX < 0 ? 1 : -1);
    },
  });
  // The turn itself starts once the leaf turned to is on the page (two frames on), so it never stalls half over.
  useEffect(() => {
    if (!turn) return;
    const cancel = afterFrames(2, () => {
      fold.set(withTiming(turn.forward ? 0 : 1, { duration: TURN_MS, easing: Easing.inOut(Easing.quad) }));
      turnTimer.current = setTimeout(() => setTurn(null), TURN_MS + 30);
    });
    return () => {
      cancel();
      if (turnTimer.current) clearTimeout(turnTimer.current);
    };
  }, [turn, fold]);
  // Once the book lies open, the other leaves are written up behind the one showing: a turn to any of them is at once.
  useEffect(() => {
    if (phase !== "open") return;
    const t = setTimeout(() => setVisited((v) => [...v, ...order.filter((id) => !v.includes(id))]), 400);
    return () => clearTimeout(t);
  }, [phase, order]);

  const pageW = book.page.width, pageH = book.page.height;
  const boardStart = visited[0] === "found" ? (reducedMotion ? 0 : BOOK_MS.rise + BOOK_MS.swing - 160) : TURN_MS - 220;
  const chapter = (title: string) => <Text style={[CHAPTER_TYPE[genre], styles.chapterHead, { color: p.ink }]} accessibilityRole="header">{title}</Text>;

  const content: Record<Leaf, () => ReactNode> = {
    case: () => (
      <>
        <CornerDoodles genre={theme.genre} palette={p} />
        {/* Clipped to the page as her brief was (src/play2/letters): noir's and the file's paper clip, the moonlit letter's pressed sprig. */}
        {genre === "paranormal"
          ? <Sprig flower={LETTER.paranormal.sprig} stem={LETTER.paranormal.stem} seed="casebook" width={38} rotate={28} style={styles.clip} />
          : <PaperClip color={genre === "noir" ? LETTER.noir.clip : LETTER.crime_scene.clip} size={54} rotate={8} style={styles.clip} />}
        {/* The series line as the correspondence's letterhead, left, over its rule. */}
        <Letterhead genre={genre} text={p.series} style={styles.letterhead} testID="v2-casebook-series" />
        <View style={styles.chapter}>
          {chapter(LEAVES.case.label)}
          <Text style={[hand.lead, { color: p.ink }]} testID="v2-casebook-objective">{objective}</Text>
          <Underline color={p.pen} width={150} seed={objective} />
          {progress && progress.total > 0 ? (
            <>
              <LeadTracker solved={solved} total={progress.total} ticked={ticked} genre={theme.genre} palette={p} hand={hand} reduced={reducedMotion} />
              <MarginNote solved={solved} total={progress.total} genre={theme.genre} palette={p} hand={hand} />
            </>
          ) : null}
        </View>
        {items.length ? (
          <View style={styles.chapter}>
            {chapter("In my pockets")}
            <View style={styles.stickers}>
              {items.map((item, i) => <Sticker key={item.id} item={item} index={i} palette={p} hand={hand} onExamine={onExamine} />)}
            </View>
          </View>
        ) : null}
      </>
    ),
    found: () => (
      <View style={styles.chapter}>
        <CoffeeRing color={p.ring} size={116} rotate={18} style={styles.ring} />
        {chapter(LEAVES.found.label)}
        {opened.fresh > 0 && cards.length > 2 ? (
          <View style={styles.freshNote} testID="v2-casebook-fresh">
            <Text style={[hand.small, { color: p.pen }]}>{`${Math.min(opened.fresh, cards.length)} new`}</Text>
            <Arrow color={p.pen} size={30} rotate={70} />
          </View>
        ) : null}
        {cards.length ? (
          <Board cards={cards} strings={strings} fresh={opened.fresh} palette={p} hand={hand} reduced={reducedMotion} startAt={boardStart} />
        ) : (
          <View style={styles.empty}>
            <Polaroid subject="photo" palette={p} hand={hand} rotate={-4} tape={p.tape[0]} pattern="dots" small />
            <Text style={[hand.body, styles.flex, { color: p.inkSoft }]} testID="v2-casebook-empty">Nothing yet.</Text>
          </View>
        )}
      </View>
    ),
    board: () => (board ? (
      <View style={styles.chapter} testID="v2-board">
        {chapter(LEAVES.board.label)}
        <Text style={[hand.body, { color: p.pen }]}>Cross off what the evidence rules out.</Text>
        <EvidenceBoard lists={board} struck={struck} onStrike={onStrike} palette={p} hand={hand} />
      </View>
    ) : null),
    hints: () => (
      <>
        <View style={styles.chapter}>
          {chapter(LEAVES.hints.label)}
          {hints.map((h, i) => (
            <View key={i} style={styles.hint}>
              <Paw color={p.pen} size={18} rotate={i % 2 ? 14 : -12} style={styles.paw} />
              <Text style={[hand.body, styles.flex, { color: p.pen }]}>
                {`${PSST[i % PSST.length]} `}
                <Text style={{ color: p.ink }}>{h}</Text>
              </Text>
            </View>
          ))}
          {canHint ? (
            <Pressable
              onPress={onHint}
              accessibilityRole="button"
              accessibilityLabel={hints.length ? "Another hint" : "Get a hint"}
              testID="v2-hint"
              style={({ pressed }) => [styles.sticker, { backgroundColor: p.sweet, borderColor: p.polaroid }, softShadow(p.shadow), pressed && styles.stickerPressed]}
            >
              <Paw color={p.ink} size={20} />
              <Text style={[hand.title, { color: p.ink }]}>{hints.length ? "Another hint" : "Get a hint"}</Text>
              <Sparkle color={p.polaroid} size={12} style={styles.stickerSparkle} />
            </Pressable>
          ) : hints.length ? (
            <Text style={[hand.body, { color: p.inkSoft }]} testID="v2-hints-spent">{"That's every hint for this step."}</Text>
          ) : null}
        </View>
        {/* The last leaf's foot: how she plays, and starting over. */}
        <View style={[styles.settings, { borderTopColor: p.margin }]}>
          {/* Glints: a box she ticks, in her own pen. */}
          <Pressable
            onPress={() => onGlints(!glints)}
            accessibilityRole="switch"
            accessibilityLabel="Glints"
            accessibilityState={{ checked: glints }}
            testID="v2-glints"
            style={styles.row}
          >
            <View style={styles.tickBox} {...hidden}>
              <Svg width={30} height={30} viewBox="0 0 30 30">
                <Path d="M5.4 5.8 C11 5 19 5 24.6 5.6 C25.2 11 25.2 19 24.8 24.6 C19 25.2 11 25.2 5.2 24.6 C4.8 19 4.8 11 5.4 5.8 Z" fill={p.note} stroke={p.ink} strokeWidth={1.6} strokeLinejoin="round" />
              </Svg>
              {glints ? <Tick color={p.pen} size={30} style={styles.tickMark} /> : null}
            </View>
            <View style={styles.flex}>
              <Text style={[hand.body, { color: p.ink }]}>Glints</Text>
              <Text style={[hand.small, { color: p.inkSoft }]}>Things catch the light as you sweep. Off is harder.</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => {
              if (confirming) {
                setConfirming(false);
                onRestart();
              } else setConfirming(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={confirming ? "Tap again to restart. Your progress in this case will be lost." : "Restart this case"}
            testID="v2-restart"
            style={styles.restart}
          >
            <Text style={[hand.body, styles.restartText, { color: confirming ? p.marker : p.inkSoft }]}>
              {confirming ? "Tap again to restart. Progress will be lost." : "Restart this case"}
            </Text>
          </Pressable>
        </View>
      </>
    ),
  };

  // The tabs: across the book's head, from just right of the gutter, clear of the stud.
  const tabsLeft = book.page.x + 10;
  const tabW = Math.min(TAB.max, (width - 58 - tabsLeft - TAB.gap * (order.length - 1)) / order.length);
  const tabTop = book.page.y - TAB.out;
  const tab = (id: Leaf, front: boolean) => {
    const i = order.indexOf(id);
    const news = id === "found" && opened.fresh > 0 && cards.length > 0 && !visited.includes("found");
    return (
      <IndexTab
        key={id}
        id={id}
        label={LEAVES[id].tab}
        says={news ? `${LEAVES[id].label}, ${Math.min(opened.fresh, cards.length)} new` : LEAVES[id].label}
        selected={leaf === id}
        front={front}
        news={news}
        left={tabsLeft + i * (tabW + TAB.gap)}
        top={tabTop}
        width={tabW}
        fill={front ? p.paper : mix(m.book.tab, m.shadow, i < order.indexOf(leaf) ? 0.34 : 0.14)}
        ink={front ? p.ink : m.book.tabInk}
        pen={p.pen}
        sweet={p.foil[0]}
        hand={hand}
        onPress={() => turnTo(id)}
      />
    );
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]} pointerEvents="box-none">
      {/* The room stays in view above, dimmed; a tap there shuts the book. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Back to the room" testID="v2-casebook-away" />
      <Animated.View style={[StyleSheet.absoluteFill, styles.dim, { backgroundColor: theme.ground }, dimStyle]} pointerEvents="none" />
      <Animated.View style={[styles.table, { top: tableTop, height: tableH }, tableStyle]} accessibilityViewIsModal testID="v2-casebook">
        <TableTop />
        {cat ? <View style={styles.cat} pointerEvents="box-none">{cat}</View> : null}
        <View ref={nameRef} accessible accessibilityRole="header" accessibilityLabel="Casebook" style={styles.unsaid} />
        <View style={[styles.book, { top: BOOK_TOP, width, height: bookH }]}>
          {/* The other leaves' tabs, standing out from behind the page. */}
          {order.filter((id) => id !== leaf).map((id) => tab(id, false))}
          <OpeningSpread genre={genre} width={width} height={bookH} swing={swing} />
          {/* The page: each leaf visited stays where it was left; only the one open (and, mid-turn, the one under it) shows. */}
          <GestureDetector gesture={swipe}>
          <View style={[styles.page, { left: book.page.x, top: book.page.y, width: pageW, height: pageH }]}>
            {order.map((id) => {
              if (!visited.includes(id)) return null;
              const over = turn?.over === id, under = turn?.under === id;
              const on = turn ? over || under : leaf === id;
              return (
                <View
                  key={id}
                  style={[StyleSheet.absoluteFill, on ? null : styles.off, { zIndex: over ? 2 : 1 }]}
                  pointerEvents={leaf === id && !turn ? "auto" : "none"}
                  accessibilityElementsHidden={leaf !== id}
                  importantForAccessibility={leaf === id ? "auto" : "no-hide-descendants"}
                >
                  <Windowed shift={over ? overShift : under ? underShift : still} width={pageW} height={pageH}>
                    <ScrollView
                      style={{ width: pageW, height: pageH }}
                      contentContainerStyle={[styles.leaf, { minHeight: pageH }]}
                      bounces={false}
                      showsVerticalScrollIndicator={false}
                      testID={`v2-casebook-leaf-${id}`}
                    >
                      <View style={StyleSheet.absoluteFill} pointerEvents="none">
                        <Rules color={p.rule} gap={30} top={64} />
                        <View style={[styles.margin, { backgroundColor: p.margin }]} />
                        <Image source={GRAIN} resizeMode="repeat" style={[StyleSheet.absoluteFill, styles.grain]} />
                      </View>
                      {content[id]()}
                      <Text style={[styles.folio, LETTER_TEXT[genre].body, styles.folioSize, { color: p.inkSoft }]} accessibilityElementsHidden importantForAccessibility="no">{`— ${order.indexOf(id) + 1} —`}</Text>
                    </ScrollView>
                  </Windowed>
                </View>
              );
            })}
            {/* What scrolls goes out under the page's own head and foot, not off a hard edge. */}
            <PageFade color={p.paper} width={pageW} at="head" />
            <PageFade color={p.paper} width={pageW} at="foot" />
            {turn ? <PageTurn fold={fold} width={pageW} height={pageH} paper={p.paper} back={mix(p.paper, "#000000", 0.05)} ink={INK} shade={`${shade}99`} /> : null}
          </View>
          </GestureDetector>
          {/* The open leaf's own tab: part of the page. */}
          {tab(leaf, true)}
          {phase !== "open" ? (
            <>
              <LandingShade width={width} height={bookH} swing={swing} shade={shade} />
              <SwingingCover genre={genre} width={width} height={bookH} swing={swing} shade={shade} />
            </>
          ) : null}
        </View>
        <View style={styles.stud}>
          <CloseStud onPress={close} testID="v2-casebook-close" />
        </View>
      </Animated.View>
      {/* While it opens or shuts, any touch finishes it. */}
      {phase !== "open" ? <Pressable style={[StyleSheet.absoluteFill, styles.skip]} onPress={skip} accessible={false} importantForAccessibility="no" testID="v2-casebook-skip" /> : null}
    </View>
  );
}

/** Runs `then` `n` animation frames from now; returns a cancel. */
function afterFrames(n: number, then: () => void): () => void {
  let id = 0, live = true;
  const step = (left: number) => {
    id = requestAnimationFrame(() => {
      if (!live) return;
      if (left <= 1) then();
      else step(left - 1);
    });
  };
  step(n);
  return () => {
    live = false;
    cancelAnimationFrame(id);
  };
}

/** An index tab standing out of the book's head: paper, the pen's line round it, its leaf's name in her hand. */
function IndexTab({ id, label, says, selected, front, news, left, top, width, fill, ink, pen, sweet, hand, onPress }: {
  id: Leaf; label: string; says: string; selected: boolean; front: boolean; news: boolean; left: number; top: number; width: number;
  fill: string; ink: string; pen: string; sweet: string; hand: HandType; onPress: () => void;
}) {
  const h = TAB.out + TAB.tucked + (front ? 0 : -3);
  const w = width, r = 6;
  // Up one side, round the top, down the other; open at the foot (the page it belongs to).
  const d = `M0.8 ${h} L0.8 ${r + 0.8} Q0.8 0.8 ${r + 0.8} 0.8 L${w - r - 0.8} 0.8 Q${w - 0.8} 0.8 ${w - 0.8} ${r + 0.8} L${w - 0.8} ${h}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={says}
      accessibilityState={{ selected }}
      hitSlop={{ top: 12, bottom: 4, left: 2, right: 2 }}
      testID={`v2-casebook-tab-${id}`}
      style={[styles.tab, { left, top: top + (front ? 0 : 3), width: w, height: h }]}
    >
      <View style={StyleSheet.absoluteFill} {...hidden}>
        <Svg width={w} height={h}>
          <Path d={`${d} Z`} fill={fill} />
          <Path d={d} fill="none" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
          {front ? null : <Rect x={1.5} y={h - 9} width={w - 3} height={9} fill={INK} opacity={0.16} />}
        </Svg>
      </View>
      <Text style={[hand.small, styles.tabText, { color: ink }]} numberOfLines={1} allowFontScaling={false}>{label}</Text>
      {news ? <Star color={pen} fill={sweet} size={13} rotate={-10} style={styles.tabStar} /> : null}
    </Pressable>
  );
}

const FADE_STEP = 6, FADE_FROM = 70;
const FADE_IN = Array.from({ length: 8 }, (_, i) => FADE_FROM - (8 - i) * FADE_STEP);

/** The page's paper closing over what scrolls, at its head or its foot. */
function PageFade({ color, width, at }: { color: string; width: number; at: "head" | "foot" }) {
  const h = at === "head" ? 12 : 16;
  return (
    <View style={[styles.fade, at === "head" ? styles.fadeHead : styles.fadeFoot, { width, height: h }]} {...hidden}>
      <Svg width={width} height={h}>
        <Defs>
          <LinearGradient id={`fade-${at}`} x1={0} y1={at === "head" ? 0 : 1} x2={0} y2={at === "head" ? 1 : 0}>
            <Stop offset={0} stopColor={color} stopOpacity={1} />
            <Stop offset={1} stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {/* Thinner toward the gutter: the fold's own shadow lies there, and flat paper over it would show. */}
        {FADE_IN.map((x, i) => <Rect key={x} x={x} y={0} width={FADE_STEP + 0.3} height={h} fill={`url(#fade-${at})`} opacity={(i + 1) / (FADE_IN.length + 1)} />)}
        <Rect x={FADE_FROM} y={0} width={width - FADE_FROM} height={h} fill={`url(#fade-${at})`} />
      </Svg>
    </View>
  );
}

/** A held item as a die-cut sticker: its icon and name on the mode's dark, a white edge. Tap to examine. */
function Sticker({ item, index, palette: p, hand, onExamine }: { item: CasebookProps["items"][number]; index: number; palette: JournalPalette; hand: HandType; onExamine: (id: string) => void }) {
  const n = item.name.toLowerCase();
  const kind = (item.kind ?? (/\((left|right)\)|half/.test(n) ? "half" : /^(taped|mended)/.test(n) ? "assembled" : "prop")) as Parameters<typeof itemIcon>[0]["kind"];
  const glyph = itemIcon({ name: item.name, kind, archetype: item.archetype as Parameters<typeof itemIcon>[0]["archetype"] });
  const face = (
    <View style={[styles.stickerFace, { backgroundColor: p.photo, borderColor: p.polaroid, transform: [{ rotate: `${index % 2 ? 3 : -3}deg` }] }, softShadow(p.shadow)]}>
      <Sparkle color={p.sweet} size={10} style={styles.faceSparkle} />
      {createElement(glyph, { size: 36, weight: "duotone", color: p.chalk })}
      <Text style={[hand.small, styles.stickerName, { color: p.chalk }]} numberOfLines={2}>{item.name}</Text>
    </View>
  );
  if (!item.examinable) return <View style={styles.stickerSlot}>{face}</View>;
  return (
    <Pressable
      onPress={() => onExamine(item.id)}
      accessibilityRole="button"
      accessibilityLabel={`Examine ${item.name}`}
      testID={`v2-examine-${item.id}`}
      style={({ pressed }) => [styles.stickerSlot, pressed && styles.stickerPressed]}
    >
      {face}
    </Pressable>
  );
}

/** The page's corner doodles, by mode: a moon and stars, a star and a pressed flower, a gold star and sparkles. */
function CornerDoodles({ genre, palette: p }: { genre: ModeTheme["genre"]; palette: JournalPalette }) {
  if (genre === "paranormal") {
    return (
      <>
        <Moon color={p.ink} fill={p.foil[0]} size={30} rotate={-12} style={styles.cornerA} />
        <Star color={p.pen} size={12} style={styles.cornerB} />
        <Sparkle color={p.foil[2]} size={10} style={styles.cornerC} />
        <PressedFlower color={p.pen} fill={p.sweet} size={52} rotate={-24} style={styles.cornerFoot} />
      </>
    );
  }
  if (genre === "crime_scene") {
    return (
      <>
        <Star color={p.pen} fill={p.sweet} size={22} rotate={-10} style={styles.cornerA} />
        <Sparkle color={p.foil[2]} size={10} style={styles.cornerC} />
        <PressedFlower color={p.pen} fill={p.sweet} size={48} rotate={-24} style={styles.cornerFoot} />
      </>
    );
  }
  return (
    <>
      <Star color={p.pen} fill={p.foil[0]} size={22} rotate={-12} style={styles.cornerA} />
      <Sparkle color={p.foil[2]} size={12} style={styles.cornerB} />
      <Sparkle color={p.pen} size={8} style={styles.cornerC} />
      <PressedFlower color={p.pen} fill={p.sweet} size={48} rotate={-24} style={styles.cornerFoot} />
    </>
  );
}

/** How long "Tap again to restart" waits for the second tap (ms). */
const RESTART_CONFIRM_MS = 4000;

const styles = StyleSheet.create({
  // The table: square to the screen, as a close-up's (InspectView), up to just under the rail.
  layer: { zIndex: z.sheet },
  table: { position: "absolute", left: 0, right: 0, zIndex: 2 },
  dim: { zIndex: 1 },
  skip: { zIndex: 3 },
  // On the table's front edge: pinned to the top and lifted by its own height (not a percentage bottom inset, which iOS drops).
  cat: { position: "absolute", left: 24, top: 0, transform: [{ translateY: "-100%" }] },
  // Not said on screen (the book's cover says it): a heading for a screen reader to land on.
  unsaid: { position: "absolute", left: 0, top: 0, width: 1, height: 1 },
  book: { position: "absolute", left: 0 },
  stud: { position: "absolute", right: 8, top: TABLE_EDGE + 3 },
  page: { position: "absolute", overflow: "hidden" },
  off: { opacity: 0 },
  // A leaf: the page's own margins (the gutter's side a little wider: the fold's shadow lies there).
  leaf: { paddingLeft: 22, paddingRight: 13, paddingTop: 20, paddingBottom: 22, gap: 26 },
  margin: { position: "absolute", left: 13, top: 0, bottom: 0, width: 1.5 },
  grain: { opacity: 0.05 },
  fade: { position: "absolute", left: 0, zIndex: 3 },
  fadeHead: { top: 0 },
  fadeFoot: { bottom: 0 },
  tab: { position: "absolute", alignItems: "center", paddingTop: 5 },
  tabText: { fontSize: 16, lineHeight: 20 },
  tabStar: { position: "absolute", top: -6, right: -3 },
  clip: { position: "absolute", top: 2, right: 22, zIndex: 3 },
  letterhead: { marginLeft: 26, marginRight: 52, marginBottom: -8 },
  chapter: { gap: 8 },
  chapterHead: { marginBottom: 2 },
  ring: { position: "absolute", top: -34, right: -44 },
  freshNote: { position: "absolute", top: 2, right: 8, flexDirection: "row", alignItems: "center", gap: 2, transform: [{ rotate: "-4deg" }] },
  empty: { flexDirection: "row", alignItems: "center", gap: 18, paddingVertical: 6 },
  stickers: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingTop: 4 },
  stickerSlot: { width: 92 },
  stickerFace: { borderWidth: 3, borderRadius: 18, alignItems: "center", justifyContent: "center", paddingVertical: 10, paddingHorizontal: 6, gap: 4, minHeight: 92 },
  faceSparkle: { position: "absolute", top: 7, right: 8 },
  stickerName: { textAlign: "center" },
  hint: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  paw: { marginTop: 3 },
  sticker: {
    flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", minHeight: 48, paddingHorizontal: 20,
    borderRadius: 999, borderWidth: 3, marginTop: 6, transform: [{ rotate: "-2deg" }],
  },
  stickerSparkle: { position: "absolute", top: 4, right: 10 },
  stickerPressed: { transform: [{ scale: 0.96 }, { rotate: "-2deg" }] },
  folio: { textAlign: "right", marginTop: "auto" },
  folioSize: { fontSize: 15, lineHeight: 20 },
  cornerA: { position: "absolute", top: 12, left: 10 },
  cornerB: { position: "absolute", top: 40, left: 36 },
  cornerC: { position: "absolute", top: 46, left: 12 },
  cornerFoot: { position: "absolute", bottom: 8, right: 10 },
  settings: { gap: 4, borderTopWidth: 1.5, paddingTop: 12 },
  row: { flexDirection: "row", alignItems: "center", minHeight: 48, gap: 10 },
  tickBox: { width: 30, height: 30 },
  tickMark: { position: "absolute", left: 3, top: -5 },
  flex: { flex: 1 },
  restart: { alignSelf: "flex-start", minHeight: 48, justifyContent: "center" },
  restartText: { textDecorationLine: "underline" },
});
