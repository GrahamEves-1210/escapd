import { useCallback, useEffect, useRef, type ComponentRef, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { PlusIcon } from "phosphor-react-native/src/icons/Plus";
import type { Id } from "@/lib/puzzle-types";
import type { InventoryItem } from "@/game/selectors";
import { FocusRing, SquashPressable, useFadeIn, useFocusRing } from "@/components/noir";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import { ItemIcon } from "./ItemIcon";
import { ModePill } from "@/capture/ui/ModePill";
import { evidenceMaterial, type EvidenceMaterial } from "./materials";
import { Card } from "./parts";
import { PLAY_COPY, playVoice } from "./voice";

const P = ref.layout.play;
const T = P.tray;
const E = P.evidence;
const PICKUP = P.pickup;
const SQ = ref.button.square;

export type SlotRef = ComponentRef<typeof View>;

export interface InventoryBarProps {
  items: InventoryItem[];
  selected: Id[];
  onToggle: (id: Id) => void;
  onCombine: () => void;
  onCancel: () => void;
  busy: boolean;
  /**
   * Items on their way to the tray (a pickup in flight, or waiting for the
   * clue to be pocketed): their slot is kept, the item not drawn yet. When an
   * id leaves this set the item lands: a small bounce (a fade under reduced motion).
   */
  arriving?: ReadonlySet<Id>;
  /** Each item's slot, so a pickup can fly to it. */
  registerSlot?: (id: Id, node: SlotRef | null) => void;
  /** The right of the tray's lip: the informant's matchbook. */
  lip?: ReactNode;
}

/**
 * The evidence tray along the bottom (GAME_FEEL_PROMPT.md, 4): a leather tray
 * in the mode's material with a stitched seam, its lip stamped EVIDENCE; the
 * items sit in felt wells as objects (a tag: the glyph and the name typed on
 * it), four wells across. One chosen item enters Use mode (tap a hotspot to
 * use it): its tag is ringed in the mode's ink and its glyph fills, and a
 * card says what it is. Two open the worktable; "Fit together" sends combine.
 * Descriptions are shown only for items the server placed in the inventory.
 *
 * No Reanimated layout animations here (`entering`, `exiting`, `layout`):
 * the tray changes in the same commits as a clue's sheet and a pickup's
 * flight, and a layout transition on items in a horizontal ScrollView that
 * mounts at that very moment (the first item) is the riskiest place for one
 * on iOS with Fabric. Cards fade in and items land with shared-value styles
 * only; an item that moves along the tray simply moves.
 */
export function InventoryBar({ items, selected, onToggle, onCombine, onCancel, busy, arriving, registerSlot, lip }: InventoryBarProps) {
  const theme = useModeTheme();
  const material = evidenceMaterial(theme.genre);
  const { width } = useWindowDimensions();
  const picked = selected.map((id) => items.find((i) => i.id === id)).filter((i): i is InventoryItem => !!i);
  const slots = Math.max(T.columns, items.length);
  const inner = width - ref.space.sm * 2 - E.pad * 2;
  const tile = Math.max(T.minTile, (inner - T.gap * (T.columns - 1)) / T.columns);

  return (
    <View style={styles.root}>
      {picked.length === 1 ? (
        <FadeInCard>
          <Card style={styles.useCard} testID="use-card">
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: theme.ink }]}>{picked[0].name}</Text>
              {picked[0].description ? <Text style={[styles.detail, { color: theme.inkMuted }]}>{picked[0].description}</Text> : null}
              <Text style={[styles.instruction, { color: theme.inkMuted }]}>{PLAY_COPY.useOn}</Text>
            </View>
            <ModePill variant="quiet" ground="dark" label="Cancel" onPress={onCancel} padX={ref.space.sm} />
          </Card>
        </FadeInCard>
      ) : null}
      {picked.length === 2 ? (
        <FadeInCard>
          <Card style={styles.mat} testID="worktable">
            <View style={styles.sockets}>
              <Socket label="A" item={picked[0]} material={material} />
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <PlusIcon size={P.card.icon} weight="regular" color={theme.inkMuted} />
              </View>
              <Socket label="B" item={picked[1]} material={material} />
            </View>
            <View style={styles.matActions}>
              <ModePill variant="quiet" ground="dark" label="Cancel" onPress={onCancel} padX={ref.space.sm} />
              <View style={styles.flex}>
                <ModePill variant="ghost" label={PLAY_COPY.combine} onPress={onCombine} busy={busy} spinner haptic={false} testID="combine" />
              </View>
            </View>
          </Card>
        </FadeInCard>
      ) : null}

      <View style={[styles.tray, { backgroundColor: material.leather, borderColor: material.edge }]} testID="evidence-tray">
        <View pointerEvents="none" style={[styles.stitch, { borderColor: material.stitch }]} testID="evidence-stitch" />
        <View style={styles.lip}>
          <Text accessibilityRole="header" style={[styles.lipLabel, { color: theme.inkMuted }]}>Evidence</Text>
          {lip}
        </View>
        {items.length === 0 ? (
          <View style={[styles.emptyTray, { backgroundColor: material.well, borderTopColor: material.wellEdge }]}>
            <Text style={[styles.emptyText, { color: theme.inkMuted }]}>{playVoice(theme.genre).trayEmpty}</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slots}>
            {Array.from({ length: slots }, (_, index) => {
              const item = items[index];
              if (!item) {
                return (
                  <View
                    key={`empty-${index}`}
                    style={[styles.emptySlot, { width: tile, backgroundColor: material.well, borderTopColor: material.wellEdge }]}
                    testID="empty-slot"
                  />
                );
              }
              return (
                <Tile
                  key={item.id}
                  item={item}
                  width={tile}
                  material={material}
                  selected={selected.includes(item.id)}
                  arriving={arriving?.has(item.id) ?? false}
                  onToggle={onToggle}
                  registerSlot={registerSlot}
                />
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

/** The use card or the worktable, fading in as it appears (a shared value, not an `entering` animation). */
function FadeInCard({ children }: { children: ReactNode }) {
  const fade = useFadeIn(motion.reducedFade);
  return (
    <Animated.View accessibilityLiveRegion="polite" style={[styles.edge, fade]}>
      {children}
    </Animated.View>
  );
}

function Tile({ item, width, material, selected, arriving, onToggle, registerSlot }: {
  item: InventoryItem;
  width: number;
  material: EvidenceMaterial;
  selected: boolean;
  arriving: boolean;
  onToggle: (id: Id) => void;
  registerSlot?: (id: Id, node: SlotRef | null) => void;
}) {
  const focus = useFocusRing();
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  const shown = useSharedValue(arriving ? 0 : 1);
  const scale = useSharedValue(1);
  const wasArriving = useRef(arriving);
  // Stable, so the slot isn't unregistered and registered again on every render.
  const slotRef = useCallback((node: SlotRef | null) => registerSlot?.(item.id, node), [registerSlot, item.id]);

  // Landing: the tag drops into its well with a small bounce (a fade under reduced motion).
  useEffect(() => {
    const landed = wasArriving.current && !arriving;
    wasArriving.current = arriving;
    if (arriving) {
      shown.set(0);
      return;
    }
    if (!landed) return;
    if (reducedMotion) {
      shown.set(withTiming(1, { duration: motion.reducedFade }));
      return;
    }
    shown.set(1);
    scale.set(withSequence(
      withTiming(PICKUP.bounce, { duration: PICKUP.bounceUp }),
      withSpring(1, PICKUP.spring),
    ));
  }, [arriving, reducedMotion, shown, scale]);

  const objectStyle = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ scale: scale.get() }] }));

  return (
    <View
      ref={slotRef}
      collapsable={false}
      style={[styles.well, { width, backgroundColor: material.well, borderTopColor: material.wellEdge }]}
      testID={`slot-${item.id}`}
    >
      <Animated.View style={[styles.flex, objectStyle]} testID={arriving ? `item-${item.id}-arriving` : undefined}>
        <SquashPressable
          accessibilityRole="button"
          accessibilityState={{ selected }}
          accessibilityLabel={item.name}
          accessibilityHint={selected ? "Selected. Tap to deselect." : "Select to use or combine."}
          onPress={() => onToggle(item.id)}
          onFocus={focus.onFocus}
          onBlur={focus.onBlur}
          testID={`item-${item.id}`}
          style={({ pressed }) => [styles.tag, { backgroundColor: material.tag }, pressed && styles.pressed]}
        >
          <View pointerEvents="none" style={[styles.hole, { backgroundColor: material.well }]} />
          <ItemIcon name={item.name} size={T.icon} filled={selected} />
          <Text numberOfLines={2} style={[styles.slotLabel, { color: theme.ink }]}>{item.name}</Text>
          {selected ? <View pointerEvents="none" style={[styles.selectedRing, { borderColor: theme.ink }]} testID={`item-${item.id}-selected`} /> : null}
          <FocusRing visible={focus.focused} shape="panel" edge={SQ.borderWidth} radius={E.well.radius} />
        </SquashPressable>
      </Animated.View>
    </View>
  );
}

function Socket({ label, item, material }: { label: string; item: InventoryItem; material: EvidenceMaterial }) {
  const theme = useModeTheme();
  return (
    <View style={[styles.socket, { backgroundColor: material.well }]} accessible accessibilityLabel={`Slot ${label}, ${item.name}`}>
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
  // A socket: a felt well, the glyph beside its slot letter and the item's name.
  socket: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: ref.space.sm,
    minHeight: ref.button.ghost.height,
    paddingHorizontal: P.tray.padY,
    paddingVertical: ref.space.xs,
    borderRadius: E.well.radius,
    ...ref.curve,
    backgroundColor: ref.color.void,
  },
  socketText: { flex: 1 },
  socketLabel: { ...ref.type.meta, color: ref.color.textSecondary },
  socketName: { ...ref.type.meta, color: ref.color.textPrimary },
  matActions: { flexDirection: "row", alignItems: "center", gap: ref.space.sm },
  // The tray: leather, its darker edge, the stitched seam just inside it.
  tray: {
    marginHorizontal: ref.space.sm,
    paddingHorizontal: 0,
    paddingBottom: E.pad,
    borderRadius: E.radius,
    ...ref.curve,
    borderWidth: E.stitch,
  },
  stitch: {
    position: "absolute",
    top: E.stitchInset,
    left: E.stitchInset,
    right: E.stitchInset,
    bottom: E.stitchInset,
    borderRadius: E.radius - E.stitchInset,
    borderWidth: E.stitch,
    borderStyle: "dashed",
  },
  lip: {
    minHeight: E.lip,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: ref.space.sm,
    paddingHorizontal: E.pad + ref.space.xs,
    paddingTop: E.stitchInset + ref.space.xs,
    paddingBottom: ref.space.xs,
  },
  lipLabel: { ...P.type.plate },
  emptyTray: {
    minHeight: T.height,
    marginHorizontal: E.pad,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: ref.space.lg,
    borderRadius: E.well.radius,
    ...ref.curve,
    borderTopWidth: E.well.edge,
  },
  emptyText: { ...P.type.noteSmall, color: ref.color.textSecondary, textAlign: "center" },
  slots: { paddingHorizontal: E.pad, gap: T.gap },
  // A felt well: recessed (a darker lip along its top), the item sits in it.
  well: {
    minHeight: T.height,
    padding: ref.space.xs,
    borderRadius: E.well.radius,
    ...ref.curve,
    borderTopWidth: E.well.edge,
  },
  emptySlot: {
    minHeight: T.height,
    borderRadius: E.well.radius,
    ...ref.curve,
    borderTopWidth: E.well.edge,
  },
  // The item as an object: a tag, its string hole at the top left, the glyph over its typed name.
  tag: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: ref.space.xs,
    paddingHorizontal: T.padX,
    paddingVertical: T.padY,
    borderRadius: E.well.radius - ref.space.xs / 2,
    ...ref.curve,
  },
  hole: {
    position: "absolute",
    top: E.holeInset,
    left: E.holeInset,
    width: E.hole,
    height: E.hole,
    borderRadius: E.hole / 2,
  },
  // Chosen: a ring in the mode's ink on the tag's outer edge.
  selectedRing: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: E.well.radius - ref.space.xs / 2,
    ...ref.curve,
    borderWidth: T.selectedRing,
    borderColor: ref.color.textPrimary,
  },
  slotLabel: { ...P.type.tag, color: ref.color.textPrimary, textAlign: "center" },
  pressed: { opacity: P.pressedOpacity },
});
