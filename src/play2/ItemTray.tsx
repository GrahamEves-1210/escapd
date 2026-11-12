// What the player holds, as icons on one line (never a scroll, never words):
// each sized to fit however many there are. Everything is done by dragging:
// an item onto something in the room or the close-up uses it there, onto
// another held item fits them together, the UV flashlight onto the flashlight
// switches the light over. A tap says what it is (on the UV flashlight while
// it's on, a tap switches back to the normal light); a hold examines it (once
// it's let go without having moved: a press that pauses and then drags is a
// drag, never a look, so dropping one item on its neighbour is reliable). Picked
// up, the item itself lifts out of its slot (drawn by the player, CarriedItem,
// above everything) and its slot shows a faint ghost until it's back.
//
// The tray is a thing, not a row of tiles: felt-lined wells let into the
// shelf (hud/Shelf.tsx TrayWells, drawn once), each item lying in its own
// with a soft shadow under it. The one tapped lifts a little in a ring of
// brass; the UV light in use glows violet in its well.
import { createElement, type ComponentRef } from "react";
import { useWindowDimensions, StyleSheet, View } from "react-native";
import { GestureDetector, useCompetingGestures, useLongPressGesture, usePanGesture, useSimultaneousGestures, useTapGesture } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { ItemDef } from "@/engine/v2";
import { useFeedback } from "@/game/feedback";
import { ref } from "@/theme/tokens";
import { CarryBody, type Carry } from "./Carry";
import { BRASS, GroundShadow } from "./hud/materials";
import { TrayWells } from "./hud/Shelf";
import { ICON_FILL, ItemIcons, type ItemGlyph } from "./icons/ItemIcons";

/**
 * An icon for a held item, by what it is: a key, a note, the UV flashlight (the set in icons/art.ts). Never
 * specific, always recognisable; anything else is a small wooden box.
 */
export function itemIcon(item: Pick<ItemDef, "name" | "kind" | "archetype"> & { variant?: string }): ItemGlyph {
  const n = item.name.toLowerCase();
  const I = ItemIcons;
  if (item.archetype === "Light" || /flashlight|torch|lamp|\buv\b/.test(n)) return item.variant === "torch" || /\buv\b|ultraviolet|black ?light/.test(n) ? I.uvLight : I.torch;
  if (item.archetype === "Decoder" || item.kind === "decoder" || /wheel|cipher|decoder|dial/.test(n)) return I.wheel;
  // The gadgets' things, by what they are, before a looser word catches them (a music box is never the box, a
  // bar of soap never a note): the balance and its weights, what a key was pressed into, a music box, a ribbon.
  if (item.archetype === "Balance" || /\bbalance\b|\bscales?\b/.test(n)) return I.balance;
  if (/\bweight\b/.test(n)) return I.weight;
  if (/\bsoap\b/.test(n)) return I.soap;
  if (/\bwax\b/.test(n)) return I.wax;
  if (/music ?box/.test(n)) return I.musicBox;
  if (/ribbon/.test(n)) return I.ribbon;
  if (item.kind === "key" || /\bkey\b/.test(n)) return I.key;
  // A torn half: the right one is the left one mirrored, so the two look as if they'd fit.
  if (item.kind === "half" || /\((left|right)\)|\bhalf\b/.test(n)) return /right/.test(n) ? I.tornRight : I.tornLeft;
  // Something pieced together: a whole page, taped across its tear, never the note its halves' paper might share.
  if (item.kind === "assembled" || /^(taped|mended)\b/.test(n)) return I.taped;
  // The things worked by hand on a sheet of their own (tools/Reveal.tsx), before anything a looser word would catch
  // ("Pencil stub" is a pencil, never a ticket stub; "Printed card" is the jumbled card, never a note).
  if (/pencil/.test(n)) return I.pencil;
  if (/\blens\b|\bgel\b/.test(n)) return I.lens;
  if (/note ?pad|\bpad\b/.test(n)) return I.notepad;
  if (/printed card/.test(n)) return I.printed;
  if (/fold-?in/.test(n)) return I.foldIn;
  if (/ticket|stub|\bpass\b/.test(n)) return I.ticket;
  if (/letter|envelope|telegram|\bmail\b/.test(n)) return I.letter;
  if (/photo|picture|postcard|polaroid|snapshot|portrait/.test(n)) return I.photo;
  if (/\bmap\b|chart/.test(n)) return I.map;
  if (/scroll|parchment/.test(n)) return I.scroll;
  if (/\bring\b|necklace|locket|bracelet|earring|brooch|pendant|jewel|\bgem|diamond|pearl/.test(n)) return I.ring;
  if (/match|lighter/.test(n)) return I.matchbook;
  if (/book|diary|journal|ledger|novel|album|almanac|bible|volume/.test(n)) return I.book;
  if (/coin|token|medal|penny|sovereign|doubloon|\bchip\b/.test(n)) return I.coin;
  if (/bottle|vial|potion|perfume|flask|\bjar\b|tincture/.test(n)) return I.bottle;
  if (/watch|clock/.test(n)) return I.watch;
  if (/note|card|slip|paper|page|receipt|memo|statement|list/.test(n)) return I.note;
  if (item.kind === "taken") return I.box;
  if (item.kind === "prop") return I.note;
  return I.box;
}

/** A held item's icon, drawn at a size (`lit`: the UV light in use). */
export function ItemIcon({ item, size, lit = false }: { item: Parameters<typeof itemIcon>[0]; size: number; lit?: boolean }) {
  return createElement(itemIcon(item), { size, lit });
}

/** A name as shown: its first letter capitalised ("torn half" → "Torn half"). */
export const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const isUvLight = (item: Pick<ItemDef, "archetype" | "variant">) => item.archetype === "Light" && item.variant === "torch";

const MAX = 52;
const GAP = 8;

/**
 * Telling a drag from a hold. A drag starts once the finger has moved `drag` points, however long it rested
 * first. A hold is `ms` without moving that far; it examines the item only when the finger lifts without a
 * drag having started (holdEnds), and it isn't called off by movement until `slack` points, well past where
 * the drag takes over.
 */
export const HOLD = { ms: 450, drag: 8, slack: 28 } as const;

/** What a hold comes to when it ends: a look closer, unless the item was dragged meanwhile (or it never was a hold). */
export function holdEnds(held: boolean, dragged: boolean): "examine" | "nothing" {
  "worklet";
  return held && !dragged ? "examine" : "nothing";
}

/** How far above the finger a carried item rides (its centre), by its size: high enough to be seen past the finger. */
export const holdFor = (size: number) => size * 0.6 + 10;

/** A held item's slot, for drops on it and the way home. */
export type SlotNode = ComponentRef<typeof View>;

export function ItemTray({ items, shown, equipped, carry, width, onTap, onExamine, onDragStart, onDrop, register, slots = 0 }: {
  items: ItemDef[];
  /** The item whose card is up (tapped). */
  shown: string | null;
  /** The UV flashlight is switched on. */
  equipped: boolean;
  /** The carried item's physics (the player's; one item in hand at a time). */
  carry: Carry;
  /** The tray's width (defaults to the window's, less the gutters). */
  width?: number;
  onTap: (id: string) => void;
  onExamine: (id: string) => void;
  /** Picked up: its slot's size (the carried item is drawn the same). */
  onDragStart: (id: string, size: number) => void;
  /** Let go: where the carried item's centre was (window points; the finger is `below` under it), or (-1, -1) for a cancelled drag. */
  onDrop: (id: string, x: number, y: number, below: number) => void;
  /** Each slot's view, as it mounts and unmounts (the player measures them in window points). */
  register: (id: string, node: SlotNode | null) => void;
  /** A game hotbar: this many slots, the empty ones shown recessed. */
  slots?: number;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const room = (width ?? windowWidth - 2 * ref.space.lg);
  const count = Math.max(items.length, slots);
  const size = Math.max(28, Math.min(MAX, Math.floor((room - GAP * Math.max(0, count - 1)) / Math.max(1, count))));
  return (
    <View style={[styles.row, { gap: GAP, minHeight: MAX }]} testID="v2-tray">
      <TrayWells count={count} size={size} gap={GAP} />
      {items.map((item) => (
        <TrayIcon
          key={item.id}
          item={item}
          size={size}
          on={shown === item.id || (equipped && isUvLight(item))}
          uv={equipped && isUvLight(item)}
          carry={carry}
          onTap={onTap}
          onExamine={onExamine}
          onDragStart={onDragStart}
          onDrop={onDrop}
          register={(node) => register(item.id, node)}
        />
      ))}
      {Array.from({ length: Math.max(0, slots - items.length) }, (_, i) => (
        <EmptySlot key={`empty-${i}`} size={size} />
      ))}
    </View>
  );
}

function TrayIcon({ item, size, on, uv, carry, onTap, onExamine, onDragStart, onDrop, register }: {
  item: ItemDef; size: number; on: boolean; uv: boolean; carry: Carry;
  onTap: (id: string) => void; onExamine: (id: string) => void; onDragStart: (id: string, size: number) => void;
  onDrop: (id: string, x: number, y: number, below: number) => void;
  register: (node: SlotNode | null) => void;
}) {
  const id = item.id;
  // Only the worklets and shared values go to the UI thread.
  const { grab, move, release, tx, ty, id: carried } = carry;
  const dragging = useSharedValue(false);
  const dropped = useSharedValue(false);
  // This touch: held still long enough to be a hold, and whether it became a drag (both reset as a finger lands).
  const held = useSharedValue(false);
  const dragged = useSharedValue(false);
  // Held: the item lifts in its well (let go, it's looked at; moved, it comes away in the hand).
  const lift = useSharedValue(0);
  const feedback = useFeedback();
  const hold = holdFor(size);
  const pan = usePanGesture({
    minDistance: HOLD.drag,
    maxPointers: 1,
    testID: `v2-item-pan-${id}`,
    onActivate: (e) => {
      "worklet";
      dragging.set(true);
      dragged.set(true);
      dropped.set(false);
      lift.set(withTiming(0, { duration: 90 }));
      // Out of its slot (where the touch landed in it tells where the slot is), up above the finger.
      grab(id, e.absoluteX - e.x + size / 2, e.absoluteY - e.y + size / 2, e.absoluteX, e.absoluteY, 0, -hold);
      scheduleOnRN(onDragStart, id, size);
    },
    onUpdate: (e) => {
      "worklet";
      move(e.absoluteX, e.absoluteY);
    },
    onDeactivate: () => {
      "worklet";
      dropped.set(true);
      release();
      scheduleOnRN(onDrop, id, tx.get(), ty.get(), hold);
    },
    onFinalize: () => {
      "worklet";
      // Cancelled mid-drag: still end it, so the item always goes home.
      if (dragging.get() && !dropped.get()) {
        release();
        scheduleOnRN(onDrop, id, -1, -1, 0);
      }
      dragging.set(false);
    },
  });
  const tap = useTapGesture({
    onActivate: () => {
      "worklet";
      scheduleOnRN(onTap, id);
    },
  });
  const press = useLongPressGesture({
    minDuration: HOLD.ms,
    maxDistance: HOLD.slack,
    testID: `v2-item-hold-${id}`,
    onBegin: () => {
      "worklet";
      held.set(false);
      dragged.set(false);
    },
    onActivate: () => {
      "worklet";
      if (dragged.get()) return;
      held.set(true);
      lift.set(withSpring(1, { mass: 0.5, damping: 10, stiffness: 320 }));
      scheduleOnRN(feedback.tick);
    },
    onFinalize: () => {
      "worklet";
      if (holdEnds(held.get(), dragged.get()) === "examine") scheduleOnRN(onExamine, id);
      held.set(false);
      lift.set(withTiming(0, { duration: 120 }));
    },
  });
  // The drag and the hold run side by side (a hold never calls a drag off); a tap is whichever of them didn't happen.
  const moving = useSimultaneousGestures(pan, press);
  const gesture = useCompetingGestures(moving, tap);
  const lifted = useAnimatedStyle(() => ({ transform: [{ translateY: -3 * lift.get() }, { scale: 1 + 0.1 * lift.get() }] }));
  // While it's in hand (or on its way back) its slot holds a faint ghost of it.
  const ghost = useAnimatedStyle(() => ({ opacity: carried.get() === id ? 0.22 : 1 }));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={capitalise(item.name)}
        accessibilityState={{ selected: on }}
        accessibilityValue={isUvLight(item) ? { text: uv ? "On" : "Off" } : undefined}
        accessibilityHint={isUvLight(item)
          ? uv ? "In use. Tap to switch back to your normal light." : "Drag onto your flashlight to switch it to UV. Hold to examine."
          : "Drag onto something to use it, or onto another item to fit them together. Hold to examine."}
        accessibilityActions={[{ name: "activate" }, { name: "longpress" }]}
        onAccessibilityAction={(e) => (e.nativeEvent.actionName === "longpress" ? onExamine(id) : onTap(id))}
        testID={`v2-item-${id}`}
        style={ghost}
      >
        <View ref={register} collapsable={false}>
          <Animated.View style={lifted}>
            <ItemFace item={item} size={size} on={on} uv={uv} />
          </Animated.View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/** The UV light in use: its well lit violet, glowing, a lit pip in its corner. */
const UV_ON = { tile: "rgba(126,84,255,0.38)", edge: "rgb(196,168,255)", glow: "rgb(150,110,255)", pip: "rgb(236,226,255)" };

/**
 * An item as the tray draws it: the thing itself lying in its well, a soft shadow under it. Tapped (`on`), it
 * lifts a little in a ring of brass; the UV light in use: its well lit violet, its beam out. `loose`: in hand,
 * out of its well (no ring, no well's shadow).
 */
function ItemFace({ item, size, on, uv, loose = false }: { item: ItemDef; size: number; on: boolean; uv: boolean; loose?: boolean }) {
  const r = Math.min(10, size * 0.2);
  return (
    <View testID={uv ? "v2-item-in-use" : undefined} style={[styles.icon, { width: size, height: size }]}>
      {uv ? (
        <View
          style={[
            styles.ring,
            { borderRadius: r, backgroundColor: UV_ON.tile, borderColor: UV_ON.edge, shadowColor: UV_ON.glow, shadowOpacity: 0.9, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
          ]}
        />
      ) : on && !loose ? (
        <View style={[styles.ring, { borderRadius: r, borderColor: BRASS.sheen, backgroundColor: "rgba(247, 230, 184, 0.12)" }]} />
      ) : null}
      {loose ? null : <GroundShadow width={size * 0.66} height={size * 0.2} style={{ bottom: size * 0.07 }} />}
      <View style={on && !loose && !uv ? { transform: [{ translateY: -size * 0.06 }, { scale: 1.06 }] } : null}>
        <ItemIcon item={item} size={size * ICON_FILL} lit={uv} />
      </View>
      {uv ? <View style={[styles.pip, { backgroundColor: UV_ON.pip, shadowColor: UV_ON.glow }]} /> : null}
    </View>
  );
}

/** An empty hotbar slot: its well, waiting (the wells are drawn behind the row). */
function EmptySlot({ size }: { size: number }) {
  return <View accessible={false} style={{ width: size, height: size }} />;
}

/** The item in hand, lifted out of its slot: drawn over everything, following the carry. `origin`: the player's place in the window. */
export function CarriedItem({ item, size, carry, origin, uv }: { item: ItemDef; size: number; carry: Carry; origin: { x: number; y: number }; uv: boolean }) {
  return (
    <CarryBody carry={carry} size={size} origin={origin} style={styles.carried} testID="v2-drag">
      {/* Drawn as its slot draws it, so it settles back in without a change. */}
      <ItemFace item={item} size={size} on={uv} uv={uv} loose={!uv} />
    </CarryBody>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", alignItems: "center", flexWrap: "nowrap" },
  icon: { alignItems: "center", justifyContent: "center" },
  ring: { ...StyleSheet.absoluteFill, borderWidth: 2 },
  pip: {
    position: "absolute", top: 4, right: 4, width: 6, height: 6, borderRadius: 3,
    shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 0 },
  },
  carried: { position: "absolute", left: 0, top: 0, zIndex: 200 },
});
