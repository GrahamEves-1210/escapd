import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, LinearTransition, withTiming } from "react-native-reanimated";
import type { Id } from "@/lib/puzzle-types";
import type { InventoryItem } from "@/game/selectors";
import { useTheme } from "@/theme/ThemeProvider";
import { color, curve, hit, motion, radius, space } from "@/theme/tokens";
import { Button } from "@/components/Button";
import { Text } from "@/components/Text";
import { ItemIcon } from "./ItemIcon";

/** Item acquired: the chip arrives from above, toward the tray. */
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

const SLOT_COUNT = 4;

/**
 * Leather satchel along the bottom. One selected item enters Use mode (tap a
 * hotspot to use it). Two items open the worktable; Close clasp sends combine.
 * Descriptions are shown only for items the server placed in the inventory.
 */
export function InventoryBar({ items, selected, onToggle, onCombine, onCancel, busy }: InventoryBarProps) {
  const { reducedMotion } = useTheme();
  const picked = selected.map((id) => items.find((i) => i.id === id)).filter((i): i is InventoryItem => !!i);
  const slots = Math.max(SLOT_COUNT, items.length);

  return (
    <View style={styles.root}>
      {picked.length === 1 ? (
        <Animated.View entering={FadeIn.duration(motion.reducedFade)} style={styles.card} accessibilityLiveRegion="polite">
          <View style={styles.cardText}>
            <Text variant="stamp" tone="ink">ARTIFACT</Text>
            <Text variant="control" tone="ink">{picked[0].name}</Text>
            {picked[0].description ? <Text variant="slip" tone="ink">{picked[0].description}</Text> : null}
            <Text variant="caption" tone="ink">Select an object in the room to use this artifact.</Text>
          </View>
          <Button label="Cancel" variant="quiet" labelTone="ink" onPress={onCancel} />
        </Animated.View>
      ) : null}
      {picked.length === 2 ? (
        <Animated.View entering={FadeIn.duration(motion.reducedFade)} style={styles.mat} accessibilityLiveRegion="polite">
          <Text variant="stamp" tone="accent">WORKTABLE</Text>
          <View style={styles.sockets}>
            <Socket label="A" item={picked[0]} />
            <View style={styles.clasp} />
            <Socket label="B" item={picked[1]} />
          </View>
          <View style={styles.matActions}>
            <Button label="Cancel" variant="quiet" onPress={onCancel} />
            <Button label="Close clasp" onPress={onCombine} loading={busy} />
          </View>
        </Animated.View>
      ) : null}

      {items.length === 0 ? (
        <Text variant="caption" tone="secondary" style={styles.empty}>Items you find appear here.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slots}>
          {Array.from({ length: slots }, (_, index) => {
            const item = items[index];
            if (!item) {
              return (
                <View key={`empty-${index}`} style={styles.emptySlot}>
                  <Text variant="stamp" tone="secondary">{String(index + 1).padStart(2, "0")}</Text>
                </View>
              );
            }
            const isSelected = selected.includes(item.id);
            return (
              <Animated.View
                key={item.id}
                entering={reducedMotion ? FadeIn.duration(motion.reducedFade) : acquired}
                layout={reducedMotion ? undefined : LinearTransition.duration(200)}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={item.name}
                  accessibilityHint={isSelected ? "Selected. Tap to deselect." : "Select to use or combine."}
                  onPress={() => onToggle(item.id)}
                  testID={`item-${item.id}`}
                  style={({ pressed }) => [styles.slot, isSelected && styles.slotSelected, pressed && styles.pressed]}
                >
                  <Text variant="stamp" tone={isSelected ? "accent" : "secondary"}>{String(index + 1).padStart(2, "0")}</Text>
                  <ItemIcon name={item.name} tint={isSelected ? color.accent : color.text} />
                  <Text variant="caption" numberOfLines={2} style={styles.slotLabel}>{item.name}</Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function Socket({ label, item }: { label: string; item: InventoryItem }) {
  return (
    <View style={styles.socket} accessible accessibilityLabel={`Slot ${label}, ${item.name}`}>
      <Text variant="stamp" tone="accent">SLOT {label}</Text>
      <ItemIcon name={item.name} tint={color.accent} />
      <Text variant="caption" numberOfLines={2} align="center">{item.name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    marginHorizontal: space.gutter,
    padding: space.md,
    borderRadius: radius.slip,
    ...curve,
    backgroundColor: color.manila,
  },
  cardText: { flex: 1, gap: space.xs },
  mat: {
    gap: space.sm,
    marginHorizontal: space.gutter,
    padding: space.md,
    borderRadius: radius.slip,
    backgroundColor: "#1A2822",
    borderWidth: 1,
    borderColor: color.hairline,
  },
  sockets: { flexDirection: "row", alignItems: "center", gap: space.sm },
  socket: {
    flex: 1,
    minHeight: 88,
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    padding: space.sm,
    borderRadius: radius.control,
    backgroundColor: color.raised,
    borderWidth: 1,
    borderColor: color.accent,
  },
  clasp: { width: 18, height: 8, borderRadius: 2, backgroundColor: color.accent },
  matActions: { flexDirection: "row", justifyContent: "flex-end", gap: space.xs },
  empty: { paddingHorizontal: space.gutter, paddingVertical: space.md, textAlign: "center" },
  slots: { paddingHorizontal: space.gutter, gap: space.sm },
  slot: {
    width: 92,
    minHeight: hit.min + 28,
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderRadius: radius.control,
    backgroundColor: color.raised,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  emptySlot: {
    width: 92,
    minHeight: hit.min + 28,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: color.hairline,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.55,
  },
  slotSelected: { borderColor: color.accent, backgroundColor: color.accentMuted },
  slotLabel: { color: color.text },
  pressed: { opacity: 0.8 },
});
