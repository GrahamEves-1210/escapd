// What the player holds, as icons on one line (never a scroll, never words):
// each sized to fit however many there are. Everything is done by dragging:
// an item onto something in the room or the close-up uses it there, onto
// another held item fits them together, the UV flashlight onto the flashlight
// switches the light over. A tap says what it is; a hold examines it. Picked
// up, the item itself lifts out of its slot (drawn by the player, CarriedItem,
// above everything) and its slot shows a faint ghost until it's back.
import type { ComponentRef } from "react";
import { useWindowDimensions, StyleSheet, View } from "react-native";
import {
  CompassIcon, CubeIcon, EnvelopeIcon, FileTextIcon, FlashlightIcon, ImageIcon, KeyIcon, NoteIcon, PackageIcon, PuzzlePieceIcon,
  ScrollIcon, TicketIcon, type Icon,
} from "phosphor-react-native";
import { GestureDetector, useCompetingGestures, useLongPressGesture, usePanGesture, useTapGesture } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { ItemDef } from "@/engine/v2";
import { useModeTheme } from "@/game/mode";
import { ref } from "@/theme/tokens";
import { CarryBody, type Carry } from "./Carry";

/** An icon for a held item, by what it is: a key, a note, the UV flashlight. Never specific, always recognisable. */
export function itemIcon(item: Pick<ItemDef, "name" | "kind" | "archetype">): Icon {
  const n = item.name.toLowerCase();
  if (item.archetype === "Light" || /flashlight|torch|lamp|uv/.test(n)) return FlashlightIcon;
  if (item.archetype === "Decoder" || /wheel|cipher|dial/.test(n)) return CompassIcon;
  if (item.kind === "key" || /\bkey\b/.test(n)) return KeyIcon;
  if (item.kind === "half") return PuzzlePieceIcon;
  // Something pieced together: a whole page, never the note icon its halves' paper might share.
  if (item.kind === "assembled") return FileTextIcon;
  if (/ticket|stub|pass/.test(n)) return TicketIcon;
  if (/letter|envelope/.test(n)) return EnvelopeIcon;
  if (/photo|picture|postcard/.test(n)) return ImageIcon;
  if (/map|scroll|page|ledger/.test(n)) return ScrollIcon;
  if (item.kind === "taken") return PackageIcon;
  if (item.kind === "prop" || /note|card|slip|paper/.test(n)) return NoteIcon;
  return CubeIcon;
}

/** A name as shown: its first letter capitalised ("torn half" → "Torn half"). */
export const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const isUvLight = (item: Pick<ItemDef, "archetype" | "variant">) => item.archetype === "Light" && item.variant === "torch";

const MAX = 52;
const GAP = 8;

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
  const hold = holdFor(size);
  const pan = usePanGesture({
    minDistance: 8,
    maxPointers: 1,
    testID: `v2-item-pan-${id}`,
    onActivate: (e) => {
      "worklet";
      dragging.set(true);
      dropped.set(false);
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
    minDuration: 450,
    onActivate: () => {
      "worklet";
      scheduleOnRN(onExamine, id);
    },
  });
  const gesture = useCompetingGestures(pan, press, tap);
  // While it's in hand (or on its way back) its slot holds a faint ghost of it.
  const ghost = useAnimatedStyle(() => ({ opacity: carried.get() === id ? 0.22 : 1 }));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={capitalise(item.name)}
        accessibilityState={{ selected: on }}
        accessibilityHint={isUvLight(item) ? "Drag onto your flashlight to switch it to UV. Hold to examine." : "Drag onto something to use it, or onto another item to fit them together. Hold to examine."}
        accessibilityActions={[{ name: "activate" }, { name: "longpress" }]}
        onAccessibilityAction={(e) => (e.nativeEvent.actionName === "longpress" ? onExamine(id) : onTap(id))}
        testID={`v2-item-${id}`}
        style={ghost}
      >
        <View ref={register} collapsable={false}>
          <ItemFace item={item} size={size} on={on} uv={uv} />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/** An item as the tray draws it: its icon on a raised tile. */
function ItemFace({ item, size, on, uv }: { item: ItemDef; size: number; on: boolean; uv: boolean }) {
  const theme = useModeTheme();
  const Glyph = itemIcon(item);
  return (
    <View
      style={[
        styles.icon,
        {
          width: size, height: size, borderRadius: size * 0.28,
          backgroundColor: uv ? "rgba(140,90,255,0.35)" : theme.raised,
          borderColor: on ? (uv ? "rgb(180,140,255)" : theme.ink) : theme.rim,
          borderWidth: on ? 2 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <Glyph size={size * 0.56} weight={on ? "fill" : "regular"} color={uv ? "rgb(200,170,255)" : theme.ink} />
    </View>
  );
}

/** An empty hotbar slot: recessed, waiting. */
function EmptySlot({ size }: { size: number }) {
  const theme = useModeTheme();
  return (
    <View
      accessible={false}
      style={[styles.icon, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: theme.ground, borderColor: theme.rim, borderWidth: StyleSheet.hairlineWidth }]}
    />
  );
}

/** The item in hand, lifted out of its slot: drawn over everything, following the carry. `origin`: the player's place in the window. */
export function CarriedItem({ item, size, carry, origin, uv }: { item: ItemDef; size: number; carry: Carry; origin: { x: number; y: number }; uv: boolean }) {
  return (
    <CarryBody carry={carry} size={size} origin={origin} style={styles.carried} testID="v2-drag">
      {/* Drawn as its slot draws it, so it settles back in without a change. */}
      <ItemFace item={item} size={size} on={uv} uv={uv} />
    </CarryBody>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", alignItems: "center", flexWrap: "nowrap" },
  icon: { alignItems: "center", justifyContent: "center" },
  carried: { position: "absolute", left: 0, top: 0, zIndex: 200 },
});
