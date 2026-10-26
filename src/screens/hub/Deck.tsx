// The three game cards (docs/DESIGN.md, 01 · Layout: Fan container and cards;
// States: Focus, Large text / narrow screens). Rendered in reading order:
// THE STUDY, YOUR ROOM, YOUR CASE. In the fan the centre card is stacked on
// top with zIndex, not render order, so screen readers and keyboards still
// go left to right.
import { useState } from "react";
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { ref } from "@/theme/tokens";
import {
  GameCard,
  cardRing,
  type CoveredSide,
  type GameCardProps,
} from "./GameCard";
import type { CardId } from "./caseStatus";

const C = ref.layout.hub.card;
const F = ref.layout.hub.fan;

export type DeckCard = Omit<
  GameCardProps,
  "layout" | "style" | "onFocusChange" | "covers" | "covered"
>;

// Opal deals two cards at +/-5 degrees; ESCAPD deals three into the same
// band like a hand: the centre card upright in front, the side cards 93.2 out
// from the axis, 10 lower, tilted -/+6 degrees about their own centres and
// tucked behind it (it covers 29.9 of a side card's inner edge at its top,
// 63.5 at its foot), each showing about 85-105 beyond its edges.
const SLOTS: Record<
  CardId,
  { dx: number; dy: number; tilt: number; covered?: CoveredSide }
> = {
  study: { dx: -F.sideOffset, dy: F.sideDrop, tilt: -F.tilt, covered: "right" },
  room: { dx: 0, dy: 0, tilt: 0 },
  case: { dx: F.sideOffset, dy: F.sideDrop, tilt: F.tilt, covered: "left" },
};

/** A card's box in the fan, from the fan's width (its axis is width / 2). */
function slotStyle(id: CardId, width: number): ViewStyle {
  const slot = SLOTS[id];
  return {
    left: width / 2 + slot.dx - C.width / 2,
    top: slot.dy,
    transform: [{ rotate: `${slot.tilt}deg` }],
  };
}

/**
 * The three-card fan, 335 tall, centred on the screen's axis (visual extent
 * x 19.3-373.7 on 393, Opal's band). At `scale` below 1 the whole hand
 * shrinks about the axis, its top kept, and the container shrinks with it.
 * Nothing clips, so the focus ring and the tilted corners can overhang.
 */
export function Fan({
  cards,
  scale = 1,
  style,
}: {
  cards: readonly DeckCard[];
  scale?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [focused, setFocused] = useState<CardId | null>(null);
  // The fan spans the column, which spans the window.
  const { width } = useWindowDimensions();
  // Scaling is about the box's centre: lift it back so its top stays put.
  const scaled = {
    transform: [{ translateY: (-F.height * (1 - scale)) / 2 }, { scale }],
  };
  return (
    <View style={[styles.fan, { height: F.height * scale }, style]}>
      <View style={[styles.hand, scaled]} testID="hub-fan-hand">
        {cards.map((card) => (
          <GameCard
            key={card.id}
            {...card}
            layout="fan"
            covers={card.id === "room"}
            covered={SLOTS[card.id].covered}
            onFocusChange={(on) =>
              setFocused((current) =>
                on ? card.id : current === card.id ? null : current,
              )
            }
            style={[
              styles.slot,
              slotStyle(card.id, width),
              card.id === "room" && styles.onTop,
            ]}
          />
        ))}
        {/*
        One focus ring above the fan, not drawn by the card: a side card's own
        ring would be half hidden under the centre card. Same box, centre and
        rotation as the focused card; RN outline props draw the kit's 2 pt ring
        at the 2 pt offset around its continuous corners.
      */}
        {focused ? (
          <View
            pointerEvents="none"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.slot, slotStyle(focused, width), styles.ring]}
          />
        ) : null}
      </View>
    </View>
  );
}

/** Upright full-width cards with a 16 gap: the fallback for large text and screens too small for the fan at 0.75. */
export function CardStack({
  cards,
  style,
}: {
  cards: readonly DeckCard[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.stack, style]}>
      {cards.map((card) => (
        <GameCard key={card.id} {...card} layout="stack" />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fan: { alignSelf: "stretch" },
  hand: { position: "absolute", top: 0, left: 0, right: 0, height: F.height },
  slot: { position: "absolute", width: C.width, height: C.height },
  onTop: { zIndex: 1 },
  ring: { zIndex: 2, ...cardRing },
  stack: {
    alignSelf: "stretch",
    paddingHorizontal: ref.space.edge,
    gap: ref.space.lg,
  },
});
