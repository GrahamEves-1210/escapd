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
import { XIcon } from "phosphor-react-native";
import type { FinaleDef, ItemDef, StateValue } from "@/engine/v2";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { capitalise, isUvLight, itemIcon } from "./ItemTray";
import { JournalCard, lookOf } from "./journal/JournalCard";
import { handType, journalPalette, UV } from "./journal/palette";
import { softShadow, Tape } from "./journal/Paper";
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
      {inside.map((c, i) => {
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
            style={({ pressed }) => [styles.found, pressed && styles.foundPressed]}
          >
            {c.kind === "card" ? <FoundNote card={c.card} index={i} /> : <FoundSticker item={c.item} index={i} />}
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

      {/* A note, read: the torn paper taped up over everything, in the hand it was written in. Tap anywhere to put it down. */}
      {reading ? <ReadingNote card={reading} onDone={() => setReading(null)} /> : null}
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
          <JournalCard card={card} palette={journalPalette(theme)} hand={handType(theme)} index={0} />
        </View>
      ) : (
        // No card: its name is the sheet's title already; one line on what it's for, no empty paper.
        <Text style={[ref.type.body, styles.detailText, { color: theme.inkMuted }]}>{purpose(kind, item)}</Text>
      )}
    </View>
  );
}

/** A note, read up close: the room dims (in the mode's ground), the note is taped up, tilted, at reading size. */
function ReadingNote({ card, onDone }: { card: FoundCard; onDone: () => void }) {
  const theme = useModeTheme();
  const p = journalPalette(theme);
  const hand = handType(theme);
  return (
    <View style={styles.reading} testID="v2-reading-layer">
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: theme.ground }, styles.readingScrim]} onPress={onDone} accessibilityRole="button" accessibilityLabel="Put the note down" testID="v2-reading" />
      <View style={styles.readingPaper} pointerEvents="none">
        <JournalCard card={card} palette={p} hand={hand} index={0} large />
      </View>
      <Text style={[hand.small, styles.readingHint, { color: theme.inkMuted }]} pointerEvents="none">tap anywhere to put it down</Text>
    </View>
  );
}

/** A note lying in an object: a little folded scrap with a scribble and a strip of tape (a UV finding, violet). */
function FoundNote({ card, index }: { card: FoundCard; index: number }) {
  const theme = useModeTheme();
  const p = journalPalette(theme);
  const uv = lookOf(card).look === "uv";
  const ink = uv ? UV.ink : p.inkSoft;
  return (
    <View style={[styles.mini, { backgroundColor: uv ? UV.paper : p.note, transform: [{ rotate: `${index % 2 ? 5 : -6}deg` }] }, softShadow(theme.ground)]}>
      <View style={[styles.miniLine, { backgroundColor: ink, width: 30 }]} />
      <View style={[styles.miniLine, { backgroundColor: ink, width: 24 }]} />
      <View style={[styles.miniLine, { backgroundColor: ink, width: 28 }]} />
      <View style={[styles.miniFold, { borderTopColor: theme.surface, borderRightColor: uv ? UV.edge : p.rule }]} />
      <Tape color={p.tape[index % 3]} width={26} height={10} rotate={-8} pattern="plain" style={styles.miniTape} />
    </View>
  );
}

/** An item lying in an object: a die-cut sticker of it, to pick up. */
function FoundSticker({ item, index }: { item: ItemDef; index: number }) {
  const theme = useModeTheme();
  const p = journalPalette(theme);
  return (
    <View style={[styles.sticker, { backgroundColor: p.photo, borderColor: p.polaroid, transform: [{ rotate: `${index % 2 ? 4 : -4}deg` }] }, softShadow(theme.ground)]}>
      {createElement(itemIcon(item), { size: 28, weight: "duotone", color: p.chalk })}
    </View>
  );
}

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
  detailPaper: { alignSelf: "stretch" },
  detailText: { textAlign: "center", maxWidth: 320 },
  lying: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: ref.space.lg },
  found: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  foundPressed: { transform: [{ scale: 0.94 }] },
  mini: { width: 44, height: 52, borderRadius: 2, paddingTop: 14, paddingLeft: 7, gap: 6 },
  miniLine: { height: 2, borderRadius: 1, opacity: 0.7 },
  miniFold: { position: "absolute", top: 0, right: 0, width: 0, height: 0, borderTopWidth: 11, borderRightWidth: 11, borderLeftColor: "transparent", borderBottomColor: "transparent" },
  miniTape: { position: "absolute", top: -5, left: 9 },
  sticker: { width: 54, height: 54, borderRadius: 16, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  empty: { fontStyle: "italic" },
  take: { minHeight: 40, paddingHorizontal: ref.space.lg, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  takeCorner: { position: "absolute", top: ref.space.sm, right: ref.space.lg },
  tray: { paddingHorizontal: ref.space.lg, paddingTop: ref.space.sm },
  reading: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", padding: ref.space.xl, zIndex: 60 },
  readingScrim: { opacity: 0.86 },
  readingPaper: { maxWidth: 360, width: "100%", transform: [{ rotate: "-1.5deg" }] },
  readingHint: { position: "absolute", bottom: 56, alignSelf: "center" },
});
