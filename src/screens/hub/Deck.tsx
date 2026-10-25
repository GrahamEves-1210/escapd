// The three case files (docs/DESIGN.md, 01 Layout: Fan container and cards;
// States: Focus, Large text / narrow screens). Rendered in reading order:
// THE STUDY, YOUR ROOM, YOUR CASE. In the fan the centre card is stacked on
// top with zIndex, not render order, so screen readers and keyboards still
// go left to right.
import { useState } from "react";
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { ref } from "@/theme/tokens";
import { GameCard, type GameCardProps } from "./GameCard";
import type { CardId } from "./caseStatus";

const G = ref.gameCard;
const F = ref.layout.hub.fan;

export type DeckCard = Omit<GameCardProps, "layout" | "style" | "onFocusChange" | "covers">;

// Centre upright on top; the side cards 105 out from the axis, 10 lower,
// tilted -/+6 degrees about their own centres, overlapping it by 17.
const SLOTS: Record<CardId, { dx: number; dy: number; tilt: number }> = {
  study: { dx: -F.sideOffset, dy: F.sideDrop, tilt: -G.fanTilt },
  room: { dx: 0, dy: 0, tilt: 0 },
  case: { dx: F.sideOffset, dy: F.sideDrop, tilt: G.fanTilt },
};

/** A card's box in the fan, from the fan's width (its axis is width / 2). */
function slotStyle(id: CardId, width: number): ViewStyle {
  const slot = SLOTS[id];
  return { left: width / 2 + slot.dx - G.width / 2, top: slot.dy, transform: [{ rotate: `${slot.tilt}deg` }] };
}

/**
 * The three-card fan, 226 tall, centred on the screen's axis (visual width
 * 352). The container never clips, so the focus ring and the tilted corners
 * can overhang it.
 */
export function Fan({ cards, style }: { cards: readonly DeckCard[]; style?: StyleProp<ViewStyle> }) {
  const [focused, setFocused] = useState<CardId | null>(null);
  // The fan spans the column, which spans the window.
  const { width } = useWindowDimensions();
  return (
    <View style={[styles.fan, style]}>
      {cards.map((card) => (
        <GameCard
          key={card.id}
          {...card}
          layout="fan"
          covers={card.id === "room"}
          onFocusChange={(on) => setFocused((current) => (on ? card.id : current === card.id ? null : current))}
          style={[styles.slot, slotStyle(card.id, width), card.id === "room" && styles.onTop]}
        />
      ))}
      {/*
        One focus ring above the fan, not drawn by the card: a side card's own
        ring would be half hidden under the centre card. Same box, centre and
        rotation as the focused card; RN outline props draw the 2 pt ring at
        the 2 pt offset around its radius-6 corners.
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
  );
}

/** Upright full-width cards with a 16 gap: the fallback for large text and screens under 375 wide. */
export function CardStack({ cards, style }: { cards: readonly DeckCard[]; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.stack, style]}>
      {cards.map((card) => (
        <GameCard key={card.id} {...card} layout="stack" />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fan: { alignSelf: "stretch", height: F.height },
  slot: { position: "absolute", width: G.width, height: G.height },
  onTop: { zIndex: 1 },
  ring: {
    zIndex: 2,
    borderRadius: ref.radius.panel,
    ...ref.curve,
    outlineStyle: "solid",
    outlineWidth: ref.focus.width,
    outlineOffset: ref.focus.offset,
    outlineColor: ref.focus.color,
  },
  stack: { alignSelf: "stretch", paddingHorizontal: ref.space.edge, gap: ref.space.lg },
});
