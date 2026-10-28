// Looking closer (gameplay v2 §2 "Inspect"): a sheet that rises from the
// bottom of the room, the photo staying where it is above it (the light swings
// onto the object). In the sheet: the object's mechanism (mechanisms/), and
// what it holds lying in it once it's open: a note to tap and read, an item to
// pick up, or "Nothing here." Held items are icons along the foot to drag up
// onto it. Nothing scrolls. Tap above the sheet, Close or Android back to go.
import { createElement, useEffect, useState, type ReactNode } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { NoteIcon, XIcon } from "phosphor-react-native";
import type { FinaleDef, ItemDef, StateValue } from "@/engine/v2";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { capitalise, isUvLight, itemIcon } from "./ItemTray";
import { V2 } from "./layout";
import { Mechanism } from "./mechanisms";
import type { MechanismTarget } from "./mechanisms/types";

export { capitalise };

export interface FoundCard {
  id: string;
  title: string;
  text: string;
}

/** Something the object holds: a note to read, or an item the player hasn't picked up yet. */
export type Content = { kind: "card"; card: FoundCard } | { kind: "item"; item: ItemDef };

export interface InspectViewProps {
  target: MechanismTarget;
  state: Record<string, StateValue>;
  /** What it holds (shown once it's open). */
  contents: Content[];
  /** A line under the title: what changed ("It's locked.", "The drawer slides out."). */
  note: string | null;
  busy: boolean;
  cooldown: number;
  finale?: FinaleDef;
  ritualChoices?: { id: string; label: string }[];
  onSet: (control: string, value: StateValue) => void;
  onSubmit: (value: string[]) => void;
  /** The player moved something without committing it (a wheel, a pick): the last try's note is stale. */
  onChange?: () => void;
  /** A small object the player can pocket: "Take it" (it leaves the photo). */
  onTake?: () => void;
  /** An item lying in the object was picked up (it's in the tray already). */
  onPickUp: (itemId: string) => void;
  onClose: () => void;
  /** Bumped after every action: the mechanism redraws from the engine's state (a refused pull falls back). */
  revision: number;
  /** The held items, as the tray (drag one up onto the sheet to use it here). */
  tray: ReactNode;
  /** The cat, peering over the sheet's top edge while it's up. */
  cat?: ReactNode;
  /** A held item being examined (target.kind "item"): drawn large, with its card or what it's for. */
  item?: ItemDef;
}

export const CONTAINER_KEYS = ["open", "lifted", "tilted", "panel", "on"] as const;

/** Open, lifted, tilted or its panel open: what's inside can be seen. Things with none of these always show theirs. */
function showsInside(state: Record<string, StateValue>): boolean {
  const keys = CONTAINER_KEYS.filter((k) => k in state);
  return keys.length === 0 || keys.some((k) => state[k] === true);
}

export function InspectView(props: InspectViewProps) {
  const { target, state, contents, note, busy, cooldown, finale, ritualChoices, onSet, onSubmit, onTake, onPickUp, onClose, revision, tray, cat, item, onChange } = props;
  const theme = useModeTheme();
  const feedback = useFeedback();
  const { reducedMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [reading, setReading] = useState<FoundCard | null>(null);
  const sheetH = V2.inspect.mechanismH + 140 + insets.bottom;

  const rise = useSharedValue(reducedMotion ? 0 : 1);
  useEffect(() => {
    rise.set(withTiming(0, { duration: reducedMotion ? 0 : 320, easing: Easing.out(Easing.cubic) }));
  }, [rise, reducedMotion]);
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: rise.get() * sheetH }] }));

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (reading) setReading(null);
      else onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose, reading]);

  // Scenery (no archetype) and Assemble (worked in the tray) have no mechanism to draw; a held item has one
  // only when it has something to turn (the decoder's ring), never the UV light's (worked from the tray).
  const mechanism = target.kind === "item"
    ? target.controls.length > 0
    : target.archetype !== null && target.archetype !== "Assemble";
  const take = onTake ? (
    <Pressable
      onPress={onTake}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Take it"
      testID="v2-take"
      style={[styles.take, mechanism ? styles.takeCorner : null, { backgroundColor: theme.accent }]}
    >
      <Text style={[ref.type.headline, { color: theme.accentInk }]}>Take it</Text>
    </Pressable>
  ) : null;
  const open = showsInside(state);
  const inside = open ? contents : [];
  // Opened (or there was nothing to open) and nothing in it: say so.
  const empty = open && contents.length === 0 && (target.archetype === null || CONTAINER_KEYS.some((k) => state[k] === true));

  // What it holds: tap a note to read it, an item to pick it up. A drawer or a
  // cloth lays it in its own inside; any other mechanism, on a row above it.
  const lies = target.archetype === "Drawer" || target.archetype === "LiftUnder";
  const items = inside.length || empty ? (
    <>
      {inside.map((c) => {
        const Glyph = c.kind === "card" ? NoteIcon : itemIcon(c.item);
        return (
          <Pressable
            key={c.kind === "card" ? c.card.id : c.item.id}
            onPress={() => {
              if (c.kind === "card") {
                feedback.paper();
                setReading(c.card);
              } else {
                feedback.pickup();
                onPickUp(c.item.id);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={c.kind === "card" ? `Read: ${c.card.title}` : `Pick up ${capitalise(c.item.name)}`}
            testID={c.kind === "card" ? `v2-note-${c.card.id}` : `v2-found-${c.item.id}`}
            style={[styles.found, c.kind === "card" ? styles.paperFound : { backgroundColor: theme.raised, borderColor: theme.ink }]}
          >
            <Glyph size={30} weight="fill" color={c.kind === "card" ? PAPER_INK : theme.ink} />
          </Pressable>
        );
      })}
      {empty && !inside.length ? <Text style={[ref.type.body, styles.empty, { color: theme.inkMuted }]} testID="v2-empty">Nothing here.</Text> : null}
    </>
  ) : null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" testID="v2-inspect">
      {/* The room stays in view above; a tap there puts the sheet away. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Back to the room" testID="v2-inspect-away" />
      <Animated.View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.rim, paddingBottom: insets.bottom + ref.space.sm }, sheetStyle]}>
        {cat ? <View style={styles.cat} pointerEvents="box-none">{cat}</View> : null}
        <View style={[styles.grabber, { backgroundColor: theme.rim }]} />
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[ref.type.headline, { color: theme.ink }]} accessibilityRole="header" numberOfLines={1}>{capitalise(target.label)}</Text>
            {note ? <Text style={[ref.type.meta, { color: theme.inkMuted }]} numberOfLines={2} testID="v2-inspect-note">{note}</Text> : null}
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} testID="v2-inspect-close" style={[styles.close, { backgroundColor: theme.raised }]}>
            <XIcon size={20} weight="bold" color={theme.ink} />
          </Pressable>
        </View>

        {target.kind === "item" && !mechanism ? (
          // A held item, examined: the thing itself, large, and what it says or what it's for.
          <ItemDetail name={target.label} item={item} contents={contents} />
        ) : mechanism ? (
          <>
            {/* What a mechanism without an inside of its own (a lock, wheels, a frame) turned up: on its own
                row above it, never over its parts or its status line. */}
            {!lies && items ? (
              <View style={styles.contentsRow} pointerEvents="box-none" testID="v2-contents">{items}</View>
            ) : null}
            <View style={[styles.mechanism, { height: V2.inspect.mechanismH }]}>
              <Mechanism
                key={revision}
                target={target}
                state={state}
                onSet={onSet}
                onSubmit={onSubmit}
                onChange={onChange}
                busy={busy}
                cooldown={cooldown}
                finale={finale}
                ritualChoices={ritualChoices}
                width={width - 2 * ref.space.lg}
                inside={lies && items ? <View style={styles.lying} pointerEvents="box-none" testID="v2-contents">{items}</View> : undefined}
              />
              {take}
            </View>
          </>
        ) : (
          // Scenery: nothing to work, just what's there (or "Nothing here.").
          <View style={styles.scenery}>
            {items ? <View style={styles.lying} pointerEvents="box-none" testID="v2-contents">{items}</View> : null}
            {take}
          </View>
        )}

        {target.kind === "object" ? <View style={styles.tray}>{tray}</View> : null}
      </Animated.View>

      {/* A note, read: paper over everything. Tap anywhere to put it down. */}
      {reading ? (
        <Pressable style={styles.readingScrim} onPress={() => setReading(null)} accessibilityRole="button" accessibilityLabel="Put the note down" testID="v2-reading">
          <View style={styles.paper}>
            <Text style={[ref.type.headline, styles.paperInk]}>{reading.title}</Text>
            <Text style={[ref.type.body, styles.paperInk]}>{reading.text}</Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

/** What a held item is for, when it has no card of its own to show: one short line. */
function purpose(kind: ItemDef["kind"], item?: ItemDef): string {
  if (item && isUvLight(item)) return "A UV light. Tap it in your hands to switch your light over.";
  switch (kind) {
    case "key": return "A key. Drag it onto what it opens.";
    case "half": return "Half of something. Find what it fits, then fit them together.";
    case "assembled": return "Pieced back together. Drag it onto where it's needed.";
    case "taken": return "Taken from the room. Drag it onto where it belongs.";
    case "decoder": return "Turn it to read what's hidden.";
    default: return "Drag it onto something to use it.";
  }
}

/** A held item, examined: its icon large, and its card (read in full) or what it's for. */
function ItemDetail({ name, item, contents }: { name: string; item?: ItemDef; contents: Content[] }) {
  const theme = useModeTheme();
  const card = contents.find((c): c is Extract<Content, { kind: "card" }> => c.kind === "card")?.card;
  const kind = item?.kind ?? "prop";

  return (
    <View style={styles.detail} testID="v2-item-detail">
      <View style={[styles.detailGlyph, { backgroundColor: theme.raised, borderColor: theme.rim }]}>
        {createElement(itemIcon(item ?? { name, kind }), { size: 56, weight: "fill", color: theme.ink })}
      </View>
      {card ? (
        <View style={styles.detailPaper} testID={`v2-item-card-${card.id}`}>
          <Text style={[ref.type.headline, styles.paperInk]}>{card.title}</Text>
          <Text style={[ref.type.body, styles.paperInk]}>{card.text}</Text>
        </View>
      ) : (
        // No card: its name is the sheet's title already; one line on what it's for, no empty paper.
        <Text style={[ref.type.body, styles.detailText, { color: theme.inkMuted }]}>{purpose(kind, item)}</Text>
      )}
    </View>
  );
}

const PAPER = "rgb(236,228,210)";
const PAPER_INK = "rgb(52,44,34)";

const styles = StyleSheet.create({
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth, paddingTop: ref.space.sm, zIndex: 50,
  },
  cat: { position: "absolute", left: ref.space.xl, bottom: "100%" },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: ref.space.sm },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: ref.space.lg, gap: ref.space.sm, minHeight: 44 },
  headerText: { flex: 1, gap: 2 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  mechanism: { alignItems: "center", justifyContent: "center" },
  contentsRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: ref.space.lg, paddingTop: ref.space.sm, minHeight: 56 + ref.space.sm },
  scenery: { minHeight: 140, alignItems: "center", justifyContent: "center", gap: ref.space.lg, paddingVertical: ref.space.lg },
  detail: { alignItems: "center", gap: ref.space.lg, paddingHorizontal: ref.space.lg, paddingTop: ref.space.lg, paddingBottom: ref.space.xl },
  detailGlyph: { width: 112, height: 112, borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  detailPaper: { backgroundColor: "rgb(236,228,210)", borderRadius: 4, padding: ref.space.lg, gap: ref.space.xs, alignSelf: "stretch", transform: [{ rotate: "-0.8deg" }] },
  detailText: { textAlign: "center", maxWidth: 320 },
  lying: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: ref.space.lg },
  found: { width: 56, height: 56, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  paperFound: { backgroundColor: PAPER, borderColor: "rgba(0,0,0,0.25)", transform: [{ rotate: "-4deg" }] },
  empty: { fontStyle: "italic" },
  take: { minHeight: 40, paddingHorizontal: ref.space.lg, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  takeCorner: { position: "absolute", top: ref.space.sm, right: ref.space.lg },
  tray: { paddingHorizontal: ref.space.lg, paddingTop: ref.space.sm },
  readingScrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: ref.space.xl, zIndex: 60 },
  paper: { backgroundColor: PAPER, borderRadius: 4, padding: ref.space.xl, gap: ref.space.sm, maxWidth: 360, width: "100%", transform: [{ rotate: "-1.5deg" }] },
  paperInk: { color: PAPER_INK },
});
