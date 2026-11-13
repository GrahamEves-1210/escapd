// "What I found": her clue cards, taped and pinned down the casebook's page,
// with red string between the ones that belong together (journal/threads.ts)
// running down the margins. A card new since she last looked drops onto the
// page and settles with a rustle of paper, a little "new!" star beside it;
// strings to it tie on once it has landed, and a lead the case has moved past
// since pulls taut with a twang. Every card stays wholly readable: strings run
// in the margins and over the cards' padding, never their writing.
// Reduced motion: cards are simply there, strings simply slack or taut.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";
import { useFeedback } from "@/game/feedback";
import { Pin, Star } from "./Doodles";
import { JournalCard, lookOf, type CardLike } from "./JournalCard";
import type { HandType, JournalPalette } from "./palette";
import { rand } from "./palette";
import { RedString, type Point } from "./RedString";
import type { CaseString } from "./threads";

/** When the first new card starts to fall (ms after the casebook opens: the sheet has risen by then). */
export const DROP_START = 420;
/** Between one new card's fall and the next. */
export const DROP_STAGGER = 260;
/** A card's fall, to resting on the page. */
const DROP_LAND = 420;
/** When the first slack string twangs taut (after the cards have landed). */
const TWANG_START = 700;

/** A pin's place on its card (wrapper coordinates): the top corner on its string's side. */
function pinAt(side: "left" | "right", width: number, card: CardLike): Point {
  // A sticky note only reaches 78% across.
  const right = lookOf(card).look === "sticky" ? width * 0.78 - 10 : width - 8;
  return { x: side === "left" ? 8 : right, y: 6 };
}

/** A new card's fall onto the page: from a little above, tilted, then a springy settle. */
function Drop({ fresh, delay, reduced, children }: { fresh: boolean; delay: number; reduced: boolean; children: ReactNode }) {
  const t = useSharedValue(fresh ? 0 : 1);
  const spin = useRef((rand(String(delay), 1) - 0.5) * 10).current;
  useEffect(() => {
    if (!fresh) return;
    t.set(withDelay(delay, reduced ? withTiming(1, { duration: 260 }) : withSpring(1, { damping: 9, stiffness: 150, mass: 0.8 })));
    // Once, as the casebook opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => {
    const v = t.get();
    if (reduced) return { opacity: v };
    return {
      opacity: Math.min(1, v * 3),
      transform: [{ translateY: (1 - v) * -70 }, { rotate: `${(1 - v) * spin}deg` }, { scale: 1 + (1 - v) * 0.08 }],
    };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** The little "new!" a fresh card gets: a hand-drawn star and the word, beside its top corner. */
function NewMark({ side, palette: p, hand, delay, reduced }: { side: "left" | "right"; palette: JournalPalette; hand: HandType; delay: number; reduced: boolean }) {
  const t = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) t.set(withDelay(delay, withTiming(1, { duration: 260, easing: Easing.out(Easing.back(2)) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: t.get(), transform: [{ scale: 0.6 + t.get() * 0.4 }, { rotate: side === "right" ? "8deg" : "-8deg" }] }));
  return (
    <Animated.View style={[styles.newMark, side === "right" ? styles.newRight : styles.newLeft, style]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Star color={p.pen} fill={p.sweet} size={18} />
      <Text style={[hand.small, { color: p.pen }]}>new!</Text>
    </Animated.View>
  );
}

/** A push pin; with a delay it is pressed in then (a little bigger, then home). */
function PushPin({ color, x, y, delay, reduced }: { color: string; x: number; y: number; delay: number; reduced: boolean }) {
  const t = useSharedValue(delay && !reduced ? 0 : 1);
  useEffect(() => {
    if (delay && !reduced) t.set(withDelay(delay, withSpring(1, { damping: 8, stiffness: 260 })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, t.get() * 2), transform: [{ scale: 1.7 - t.get() * 0.7 }] }));
  return (
    <Animated.View style={[styles.pin, { left: x - 12, top: y - 11 }, style]} pointerEvents="none">
      <Pin color={color} size={24} />
    </Animated.View>
  );
}

interface Box {
  y: number;
  width: number;
}

export function Board({ cards, strings, fresh, palette: p, hand, reduced, startAt = 0 }: {
  cards: CardLike[];
  strings: CaseString[];
  /** How many of the last cards are new since she last looked. */
  fresh: number;
  palette: JournalPalette;
  hand: HandType;
  reduced: boolean;
  /** How long before anything moves (ms): the book is still opening, or the leaf still turning. */
  startAt?: number;
}) {
  const feedback = useFeedback();
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const firstNew = cards.length - Math.min(fresh, cards.length);
  const dropDelay = (i: number) => startAt + DROP_START + (i - firstNew) * DROP_STAGGER;

  // The side (and lead) each card is pinned on, from the strings it ties to.
  const pins = useMemo(() => {
    const out: Record<string, { side: "left" | "right"; lead: number }> = {};
    for (const s of strings) {
      out[s.from] ??= { side: s.side, lead: s.lead };
      out[s.to] ??= { side: s.side, lead: s.lead };
    }
    return out;
  }, [strings]);

  const landedBy = startAt + DROP_START + Math.max(0, cards.length - firstNew - 1) * DROP_STAGGER + DROP_LAND;
  const twangAt = (k: number) => (cards.length > firstNew ? landedBy : startAt) + TWANG_START + k * 240;

  // A rustle of paper as each new card lands (the first few), a twang as the first string pulls taut.
  const twangs = strings.filter((s) => s.twang).length;
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const landing = Math.min(3, cards.length - firstNew);
    for (let k = 0; k < landing; k++) timers.push(setTimeout(() => feedback.paper(), reduced ? 120 : startAt + DROP_START + k * DROP_STAGGER + DROP_LAND * 0.55));
    if (twangs && !reduced) timers.push(setTimeout(() => feedback.detent(), twangAt(0)));
    return () => timers.forEach(clearTimeout);
    // Once, as the casebook opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLayout = (id: string) => (e: LayoutChangeEvent) => {
    const { y, width } = e.nativeEvent.layout;
    setBoxes((b) => (b[id] && b[id].y === y && b[id].width === width ? b : { ...b, [id]: { y, width } }));
  };

  const byId = new Map(cards.map((c, i) => [c.id, { card: c, index: i }]));
  let twangIndex = 0;
  return (
    <View style={styles.cards}>
      {cards.map((c, i) => {
        const isNew = i >= firstNew;
        const pin = pins[c.id];
        return (
          <View key={c.id} onLayout={onLayout(c.id)} testID={`v2-casebook-card-${c.id}`}>
            <Drop fresh={isNew} delay={dropDelay(i)} reduced={reduced}>
              <JournalCard card={c} palette={p} hand={hand} index={i} />
              {isNew ? <NewMark side={pin?.side === "right" ? "left" : "right"} palette={p} hand={hand} delay={dropDelay(i) + DROP_LAND * 0.7} reduced={reduced} /> : null}
            </Drop>
          </View>
        );
      })}
      {strings.map((s) => {
        const a = byId.get(s.from), b = byId.get(s.to);
        const ba = boxes[s.from], bb = boxes[s.to];
        if (!a || !b || !ba || !bb) return null;
        const pa = pinAt(s.side, ba.width, a.card), pb = pinAt(s.side, bb.width, b.card);
        const newest = Math.max(a.index, b.index);
        const appear = newest >= firstNew ? dropDelay(newest) + DROP_LAND : 0;
        const delay = s.twang ? twangAt(twangIndex++) : 0;
        return (
          <RedString
            key={s.key}
            testID={`v2-casebook-string-${s.key}`}
            a={{ x: pa.x, y: ba.y + pa.y }}
            b={{ x: pb.x, y: bb.y + pb.y }}
            side={s.side}
            color={p.string}
            shadow={p.shadow}
            taut={s.taut}
            twang={s.twang}
            delay={delay}
            appear={appear}
            reduced={reduced}
          />
        );
      })}
      {/* The pins, over the strings (each string ties under its pin's head); a new card's is pushed in once it has landed. */}
      {cards.map((c, i) => {
        const pin = pins[c.id];
        const box = boxes[c.id];
        if (!pin || !box) return null;
        const at = pinAt(pin.side, box.width, c);
        return <PushPin key={`pin-${c.id}`} color={p.pins[pin.lead % 3]} x={at.x} y={box.y + at.y} delay={i >= firstNew ? dropDelay(i) + DROP_LAND * 0.8 : 0} reduced={reduced} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  cards: { gap: 26, paddingTop: 8 },
  pin: { position: "absolute" },
  newMark: { position: "absolute", top: -20, flexDirection: "row", alignItems: "center", gap: 2 },
  newRight: { right: 6 },
  newLeft: { left: 6 },
});
