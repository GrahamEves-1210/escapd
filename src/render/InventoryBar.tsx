import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, LinearTransition, withTiming } from "react-native-reanimated";
import { PlusIcon } from "phosphor-react-native/src/icons/Plus";
import type { Id } from "@/lib/puzzle-types";
import type { InventoryItem } from "@/game/selectors";
import { FocusRing, PillButton, useFocusRing } from "@/components/noir";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import { ItemIcon } from "./ItemIcon";
import { Card, WhiteBar } from "./parts";

const P = ref.layout.play;
const T = P.tray;
const SQ = ref.button.square;

/** Item acquired: the tile arrives from above, toward the tray. */
function acquired() {
  "worklet";
  return {
    initialValues: { opacity: 0, transform: [{ translateY: -28 }, { scale: 1.08 }] },
    animations: {
      opacity: withTiming(1, { duration: motion.itemAcquired }),
      transform: [
        { translateY: withTiming(0, { duration: motion.itemAcquired }) },
        { scale: withTiming(1, { duration: motion.itemAcquired }) },
      ],
    },
  };
}

export interface InventoryBarProps {
  items: InventoryItem[];
  selected: Id[];
  onToggle: (id: Id) => void;
  onCombine: () => void;
  onCancel: () => void;
  busy: boolean;
}

/**
 * The tray along the bottom: four tiles across, each 02's square button (a
 * white glyph over the item's name); empty places are void wells. One chosen
 * item enters Use mode (tap a hotspot to use it): its tile is ringed in white
 * and its glyph fills, and a card says what it is. Two open the worktable;
 * Close clasp sends combine. Descriptions are shown only for items the server
 * placed in the inventory.
 */
export function InventoryBar({ items, selected, onToggle, onCombine, onCancel, busy }: InventoryBarProps) {
  const { reducedMotion } = useTheme();
  const theme = useModeTheme();
  const { width } = useWindowDimensions();
  const picked = selected.map((id) => items.find((i) => i.id === id)).filter((i): i is InventoryItem => !!i);
  const slots = Math.max(T.columns, items.length);
  const tile = Math.max(T.minTile, (width - ref.space.edge * 2 - T.gap * (T.columns - 1)) / T.columns);

  return (
    <View style={styles.root}>
      {picked.length === 1 ? (
        <Animated.View entering={FadeIn.duration(motion.reducedFade)} accessibilityLiveRegion="polite" style={styles.edge}>
          <Card style={styles.useCard} testID="use-card">
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: theme.ink }]}>{picked[0].name}</Text>
              {picked[0].description ? <Text style={[styles.detail, { color: theme.inkMuted }]}>{picked[0].description}</Text> : null}
              <Text style={[styles.instruction, { color: theme.inkMuted }]}>Select an object in the room to use this artifact.</Text>
            </View>
            <PillButton variant="quiet" ground="dark" label="Cancel" onPress={onCancel} padX={ref.space.sm} />
          </Card>
        </Animated.View>
      ) : null}
      {picked.length === 2 ? (
        <Animated.View entering={FadeIn.duration(motion.reducedFade)} accessibilityLiveRegion="polite" style={styles.edge}>
          <Card style={styles.mat} testID="worktable">
            <View style={styles.sockets}>
              <Socket label="A" item={picked[0]} />
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <PlusIcon size={P.card.icon} weight="regular" color={theme.inkMuted} />
              </View>
              <Socket label="B" item={picked[1]} />
            </View>
            <View style={styles.matActions}>
              <PillButton variant="quiet" ground="dark" label="Cancel" onPress={onCancel} padX={ref.space.sm} />
              <View style={styles.flex}>
                <WhiteBar label="Close clasp" onPress={onCombine} busy={busy} haptic={false} testID="combine" />
              </View>
            </View>
          </Card>
        </Animated.View>
      ) : null}

      {items.length === 0 ? (
        <View style={[styles.edge, styles.emptyTray]}>
          <Text style={[styles.emptyText, { color: theme.inkMuted }]}>Items you find appear here.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slots}>
          {Array.from({ length: slots }, (_, index) => {
            const item = items[index];
            if (!item) {
              return <View key={`empty-${index}`} style={[styles.emptySlot, { width: tile }]} testID="empty-slot" />;
            }
            return (
              <Animated.View
                key={item.id}
                entering={reducedMotion ? FadeIn.duration(motion.reducedFade) : acquired}
                layout={reducedMotion ? undefined : LinearTransition.duration(200)}
              >
                <Tile item={item} width={tile} selected={selected.includes(item.id)} onToggle={onToggle} />
              </Animated.View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function Tile({ item, width, selected, onToggle }: { item: InventoryItem; width: number; selected: boolean; onToggle: (id: Id) => void }) {
  const focus = useFocusRing();
  const theme = useModeTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={item.name}
      accessibilityHint={selected ? "Selected. Tap to deselect." : "Select to use or combine."}
      onPress={() => onToggle(item.id)}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      testID={`item-${item.id}`}
      style={({ pressed }) => [styles.slot, { width, backgroundColor: theme.raised }, pressed && styles.pressed]}
    >
      <ItemIcon name={item.name} size={T.icon} filled={selected} />
      <Text numberOfLines={2} style={[styles.slotLabel, { color: theme.ink }]}>{item.name}</Text>
      {selected ? <View pointerEvents="none" style={[styles.selectedRing, { borderColor: theme.ink }]} testID={`item-${item.id}-selected`} /> : null}
      <FocusRing visible={focus.focused} shape="panel" edge={SQ.borderWidth} radius={SQ.radius} />
    </Pressable>
  );
}

function Socket({ label, item }: { label: string; item: InventoryItem }) {
  const theme = useModeTheme();
  return (
    <View style={styles.socket} accessible accessibilityLabel={`Slot ${label}, ${item.name}`}>
      <ItemIcon name={item.name} size={T.icon} />
      <View style={styles.socketText}>
        <Text style={[styles.socketLabel, { color: theme.inkMuted }]}>Slot {label}</Text>
        <Text numberOfLines={2} style={[styles.socketName, { color: theme.ink }]}>{item.name}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: ref.space.sm },
  edge: { marginHorizontal: ref.space.edge },
  flex: { flex: 1 },
  // The tile carries the glyph; the card says what the item is and how to use it.
  useCard: { flexDirection: "row", alignItems: "center", gap: ref.space.sm, paddingVertical: P.card.padY, paddingRight: ref.space.xs },
  cardText: { flex: 1, gap: ref.space.xs },
  cardTitle: { ...P.type.card, color: ref.color.textPrimary },
  detail: { ...P.type.hint, color: ref.color.textSecondary },
  instruction: { ...ref.type.meta, color: ref.color.textSecondary },
  mat: { gap: P.card.gap, paddingVertical: P.card.padY },
  sockets: { flexDirection: "row", alignItems: "center", gap: ref.space.sm },
  // A socket: a void well, the glyph beside its slot letter and the item's name.
  socket: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: ref.space.sm,
    minHeight: ref.button.ghost.height,
    paddingHorizontal: P.tray.padY,
    paddingVertical: ref.space.xs,
    borderRadius: SQ.radius,
    ...ref.curve,
    backgroundColor: ref.color.void,
  },
  socketText: { flex: 1 },
  socketLabel: { ...ref.type.meta, color: ref.color.textSecondary },
  socketName: { ...ref.type.meta, color: ref.color.textPrimary },
  matActions: { flexDirection: "row", alignItems: "center", gap: ref.space.sm },
  emptyTray: {
    minHeight: T.height,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: ref.space.lg,
    borderRadius: SQ.radius,
    ...ref.curve,
    backgroundColor: ref.color.void,
  },
  emptyText: { ...P.type.hint, color: ref.color.textSecondary, textAlign: "center" },
  slots: { paddingHorizontal: ref.space.edge, gap: T.gap },
  slot: {
    minHeight: T.height,
    alignItems: "center",
    justifyContent: "center",
    gap: ref.space.xs,
    paddingHorizontal: T.padX,
    paddingVertical: T.padY,
    borderRadius: SQ.radius,
    ...ref.curve,
    backgroundColor: SQ.fill,
    borderWidth: SQ.borderWidth,
    borderColor: P.squareRim,
  },
  emptySlot: {
    minHeight: T.height,
    borderRadius: SQ.radius,
    ...ref.curve,
    backgroundColor: ref.color.void,
  },
  // Chosen: a white ring on the tile's outer edge, over its rim.
  selectedRing: {
    position: "absolute",
    top: -SQ.borderWidth,
    left: -SQ.borderWidth,
    right: -SQ.borderWidth,
    bottom: -SQ.borderWidth,
    borderRadius: SQ.radius,
    ...ref.curve,
    borderWidth: T.selectedRing,
    borderColor: ref.color.textPrimary,
  },
  slotLabel: { ...ref.type.meta, color: ref.color.textPrimary, textAlign: "center" },
  pressed: { opacity: P.pressedOpacity },
});
