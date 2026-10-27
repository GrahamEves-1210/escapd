// What the player holds, as icons on one line (never a scroll, never words):
// each sized to fit however many there are. Drag one onto something to use
// it there (the room's photo, or the close-up); tap the UV flashlight to
// switch the light over; tap two others to fit them together; hold one to
// examine it. The dragged icon is drawn by the player (DragGhost) above
// everything, following the finger.
import { useWindowDimensions, StyleSheet, View } from "react-native";
import {
  CompassIcon, CubeIcon, EnvelopeIcon, FlashlightIcon, ImageIcon, KeyIcon, NoteIcon, PackageIcon, PuzzlePieceIcon,
  ScrollIcon, TicketIcon, type Icon,
} from "phosphor-react-native";
import { GestureDetector, useCompetingGestures, useLongPressGesture, usePanGesture, useTapGesture } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { ItemDef } from "@/engine/v2";
import { useModeTheme } from "@/game/mode";
import { ref } from "@/theme/tokens";

/** An icon for a held item, by what it is: a key, a note, the UV flashlight. Never specific, always recognisable. */
export function itemIcon(item: Pick<ItemDef, "name" | "kind" | "archetype">): Icon {
  const n = item.name.toLowerCase();
  if (item.archetype === "Light" || /flashlight|torch|lamp|uv/.test(n)) return FlashlightIcon;
  if (item.archetype === "Decoder" || /wheel|cipher|dial/.test(n)) return CompassIcon;
  if (item.kind === "key" || /\bkey\b/.test(n)) return KeyIcon;
  if (item.kind === "half") return PuzzlePieceIcon;
  if (/ticket|stub|pass/.test(n)) return TicketIcon;
  if (/letter|envelope/.test(n)) return EnvelopeIcon;
  if (/photo|picture|postcard/.test(n)) return ImageIcon;
  if (/map|scroll|page|ledger/.test(n)) return ScrollIcon;
  if (item.kind === "taken") return PackageIcon;
  if (item.kind === "assembled" || item.kind === "prop" || /note|card|slip|paper/.test(n)) return NoteIcon;
  return CubeIcon;
}

export const isUvLight = (item: Pick<ItemDef, "archetype" | "variant">) => item.archetype === "Light" && item.variant === "torch";

const MAX = 52;
const GAP = 8;

export interface DragState {
  x: SharedValue<number>;
  y: SharedValue<number>;
}

export function ItemTray({ items, selected, equipped, drag, width, onTap, onExamine, onDragStart, onDrop }: {
  items: ItemDef[];
  selected: string[];
  /** The UV flashlight is switched on. */
  equipped: boolean;
  drag: DragState;
  /** The tray's width (defaults to the window's, less the gutters). */
  width?: number;
  onTap: (id: string) => void;
  onExamine: (id: string) => void;
  onDragStart: (id: string) => void;
  /** Where it was let go, in window points. */
  onDrop: (id: string, x: number, y: number) => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const room = (width ?? windowWidth - 2 * ref.space.lg);
  const size = Math.max(28, Math.min(MAX, Math.floor((room - GAP * Math.max(0, items.length - 1)) / Math.max(1, items.length))));
  return (
    <View style={[styles.row, { gap: GAP, minHeight: MAX }]} testID="v2-tray">
      {items.map((item) => (
        <TrayIcon
          key={item.id}
          item={item}
          size={size}
          on={selected.includes(item.id) || (equipped && isUvLight(item))}
          uv={equipped && isUvLight(item)}
          drag={drag}
          onTap={onTap}
          onExamine={onExamine}
          onDragStart={onDragStart}
          onDrop={onDrop}
        />
      ))}
    </View>
  );
}

function TrayIcon({ item, size, on, uv, drag, onTap, onExamine, onDragStart, onDrop }: {
  item: ItemDef; size: number; on: boolean; uv: boolean; drag: DragState;
  onTap: (id: string) => void; onExamine: (id: string) => void; onDragStart: (id: string) => void; onDrop: (id: string, x: number, y: number) => void;
}) {
  const theme = useModeTheme();
  const Glyph = itemIcon(item);
  const id = item.id;
  const pan = usePanGesture({
    minDistance: 8,
    maxPointers: 1,
    onActivate: (e) => {
      "worklet";
      drag.x.set(e.absoluteX);
      drag.y.set(e.absoluteY);
      scheduleOnRN(onDragStart, id);
    },
    onUpdate: (e) => {
      "worklet";
      drag.x.set(e.absoluteX);
      drag.y.set(e.absoluteY);
    },
    onDeactivate: (e) => {
      "worklet";
      scheduleOnRN(onDrop, id, e.absoluteX, e.absoluteY);
    },
  });
  const tap = useTapGesture({
    onActivate: () => {
      "worklet";
      scheduleOnRN(onTap, id);
    },
  });
  const hold = useLongPressGesture({
    minDuration: 450,
    onActivate: () => {
      "worklet";
      scheduleOnRN(onExamine, id);
    },
  });
  const gesture = useCompetingGestures(pan, hold, tap);
  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={item.name}
        accessibilityState={{ selected: on }}
        accessibilityHint={isUvLight(item) ? "Switches your light to UV." : "Drag onto something to use it. Hold to examine."}
        accessibilityActions={[{ name: "activate" }, { name: "longpress" }]}
        onAccessibilityAction={(e) => (e.nativeEvent.actionName === "longpress" ? onExamine(id) : onTap(id))}
        testID={`v2-item-${id}`}
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
    </GestureDetector>
  );
}

/** The icon under the finger while it's dragged. */
export function DragGhost({ item, drag }: { item: ItemDef; drag: DragState }) {
  const theme = useModeTheme();
  const Glyph = itemIcon(item);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: drag.x.get() - 30 }, { translateY: drag.y.get() - 44 }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.ghost, { backgroundColor: theme.raised, borderColor: theme.ink }, style]} testID="v2-drag">
      <Glyph size={32} weight="fill" color={theme.ink} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", alignItems: "center", flexWrap: "nowrap" },
  icon: { alignItems: "center", justifyContent: "center" },
  ghost: {
    position: "absolute", left: 0, top: 0, width: 60, height: 60, borderRadius: 18, borderWidth: 2,
    alignItems: "center", justifyContent: "center", zIndex: 200, opacity: 0.92,
  },
});
