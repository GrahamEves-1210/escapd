// Looking closer (gameplay v2 §2 "Inspect"): the thing is brought to the
// table. A surface of the mode's felt under the lamp (hud/Table.tsx), its
// wooden front edge across the room, grows out of the thing where it stands
// in the photo (which stays above it, the light swung onto it, the room
// dimmed behind) and shrinks back into it when it's put away. The thing's
// name is a card in a brass label holder; a brass stud closes it, the same in
// every close-up. On the table: the object's mechanism (mechanisms/), and
// what it holds: a note to tap and read, an item to pick up, or "Nothing
// here." A drawer, a cushion or a frame has it inside, under or behind it all
// along, uncovered as it's pulled (never popping in once it's open); the others
// show it once they're open. Held items are icons along the foot to drag up
// onto it, in the same felt-lined tray as the room's. Nothing is said about
// it: no line of what just happened, no "Nothing here." (an empty drawer is
// seen to be empty; a screen reader is still told), no caption of what to do.
// If she does nothing for a few seconds in front of a kind of mechanism she
// hasn't met, a ghost fingertip shows the gesture once (hud/Nudge.tsx).
// Nothing scrolls. Tap
// above the table, the stud or Android back to go. Reduced motion: no growing,
// it is simply there.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { BackHandler, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import type { FinaleDef, ItemDef, StateValue } from "@/engine/v2";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { capitalise, ItemIcon } from "./ItemTray";
import { JournalCard, lookOf } from "./journal/JournalCard";
import { handType, journalPalette, UV } from "./journal/palette";
import { softShadow, Tape } from "./journal/Paper";
import { V2 } from "./layout";
import { GroundShadow, useHudMaterials } from "./hud/materials";
import { Nudge, useNudge } from "./hud/Nudge";
import { Press } from "./hud/Press";
import { Shelf, SHELF_LIP } from "./hud/Shelf";
import { CloseStud, NameLabel, PlateButton, TABLE_EDGE, TableTop } from "./hud/Table";
import { Mechanism } from "./mechanisms";
import type { MechanismTarget } from "./mechanisms/types";
import { tapMark } from "./useTapAway";

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
  /** The game (the room's id): a kind of mechanism is nudged once per game (hud/Nudge.tsx). */
  game?: string;
  /** No longer shown: nothing is said about what just happened (kept so older callers compile). */
  note?: string | null;
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
  /** Where the thing is on screen (window points): the table grows out of it and shrinks back into it. None: it comes up from the tray. */
  from?: { x: number; y: number } | null;
}

/** The table's coming and going: it grows out of the thing over `open` ms and shrinks back over `close`, from this scale. */
export const GROW = { open: 380, close: 220, from: 0.3 } as const;
/** How far the room dims behind the table (the mode's ground, at this opacity). */
const DIM = 0.34;

export const CONTAINER_KEYS = ["open", "lifted", "tilted", "panel", "on"] as const;
/** The mechanisms pulled open (mechanisms/kit usePull) with what they hold inside, under or behind them. */
export const PULLS = ["Drawer", "LiftUnder", "FrameTilt"] as const;

/** Open, lifted, tilted or its panel open: what's inside can be seen. Things with none of these always show theirs. */
function showsInside(state: Record<string, StateValue>): boolean {
  const keys = CONTAINER_KEYS.filter((k) => k in state);
  return keys.length === 0 || keys.some((k) => state[k] === true);
}

export function InspectView(props: InspectViewProps) {
  const { target, state, contents, game = "", busy, cooldown, finale, ritualChoices, onSet, onSubmit, onTake, onPickUp, onClose, revision, tray, cat, item, onChange, from } = props;
  const theme = useModeTheme();
  const feedback = useFeedback();
  const { reducedMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [reading, setReading] = useState<FoundCard | null>(null);
  // The table's height: as laid out (an estimate until then, for where it grows from).
  const [tableH, setTableH] = useState(V2.inspect.mechanismH + 140 + insets.bottom);

  // Brought to the table: it grows out of the thing where it stands in the photo (0: there, small; 1: on the
  // table), the room dimming behind it; put away, it shrinks back into it. Transforms and opacity only.
  const at = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    at.set(withTiming(1, { duration: reducedMotion ? 0 : GROW.open, easing: Easing.out(Easing.cubic) }));
  }, [at, reducedMotion]);
  const dx = (from ? from.x : width / 2) - width / 2;
  const dy = (from ? from.y : height - 40) - (height - tableH / 2);
  const tableStyle = useAnimatedStyle(() => {
    const p = at.get();
    if (p >= 1) return { opacity: 1, transform: [] };
    return { opacity: Math.min(1, p * 2.5), transform: [{ translateX: dx * (1 - p) }, { translateY: dy * (1 - p) }, { scale: GROW.from + (1 - GROW.from) * p }] };
  });
  const dimStyle = useAnimatedStyle(() => ({ opacity: at.get() * DIM }));
  const leaving = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (leaving.current) clearTimeout(leaving.current);
  }, []);
  const close = useCallback(() => {
    if (reducedMotion) {
      onClose();
      return;
    }
    if (leaving.current) return;
    at.set(withTiming(0, { duration: GROW.close, easing: Easing.in(Easing.quad) }));
    leaving.current = setTimeout(onClose, GROW.close);
  }, [at, onClose, reducedMotion]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (reading) setReading(null);
      else close();
      return true;
    });
    return () => sub.remove();
  }, [close, reading]);

  // Scenery (no archetype) and Assemble (worked in the tray) have no mechanism to draw; a held item has one
  // only when it has something to turn (the decoder's ring), never the UV light's (worked from the tray).
  const mechanism = target.kind === "item"
    ? target.controls.length > 0
    : target.archetype !== null && target.archetype !== "Assemble";
  const take = onTake ? <PlateButton label="Take it" onPress={onTake} disabled={busy} testID="v2-take" style={mechanism ? styles.takeCorner : undefined} /> : null;
  // A drawer, a cushion or a frame holds what it holds inside, under or behind it, where it's
  // physically there the whole time: drawn in it at once, uncovered as it's pulled, closed or not.
  const lies = target.archetype !== null && (PULLS as readonly string[]).includes(target.archetype);
  const open = showsInside(state);
  const inside = open || lies ? contents : [];
  // Opened (or there was nothing to open) and nothing in it: that is seen, not said (a screen reader is told).
  const empty = open && contents.length === 0 && (target.archetype === null || CONTAINER_KEYS.some((k) => state[k] === true));
  // Where that goes for a screen reader: in a drawer's or a cushion's own inside, else on the row above.
  const emptyInside = lies && target.archetype !== "FrameTilt";
  // A mechanism she hasn't met, and nothing done for a while: a ghost fingertip shows the gesture, once.
  const worked = CONTAINER_KEYS.some((k) => state[k] === true);
  const nudge = useNudge(game, target, worked || busy || !mechanism);
  const [band, setBand] = useState({ width: 0, height: 0 });

  // What it holds: tap a note to read it, an item to pick it up. A pulled thing lays it in its own inside
  // (and, by itself, lets it be picked up once most of it shows); any other mechanism, on a row above it.
  const found = (withEmpty: boolean) => (inside.length || (empty && withEmpty) ? (
    <>
      {inside.map((c, i) => {
        return (
          <Press
            key={c.kind === "card" ? c.card.id : c.item.id}
            cue="none"
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
            style={styles.found}
            {...tapMark("found")}
          >
            {c.kind === "card" ? <FoundNote card={c.card} index={i} /> : <FoundThing item={c.item} index={i} />}
          </Press>
        );
      })}
      {withEmpty && empty && !inside.length ? <View accessible accessibilityRole="text" accessibilityLabel="Nothing here." style={styles.unsaid} testID="v2-empty" /> : null}
    </>
  ) : null);
  const items = found(true);
  const laid = lies ? found(emptyInside) : null;
  const above = lies ? (!emptyInside && empty && !inside.length ? found(true) : null) : items;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" testID="v2-inspect">
      {/* The room stays in view above, dimmed; a tap there puts the thing back. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Back to the room" testID="v2-inspect-away" />
      <Animated.View style={[StyleSheet.absoluteFill, styles.dim, { backgroundColor: theme.ground }, dimStyle]} pointerEvents="none" />
      <Animated.View
        style={[styles.sheet, { paddingBottom: target.kind === "object" ? 0 : insets.bottom + ref.space.sm }, tableStyle]}
        onLayout={(e) => setTableH(e.nativeEvent.layout.height)}
        // Any touch on the table: she's doing something (the nudge waits, or goes). Never taken: the touch goes on.
        onStartShouldSetResponderCapture={() => {
          nudge.touch();
          return false;
        }}
      >
        <TableTop />
        {cat ? <View style={styles.cat} pointerEvents="box-none">{cat}</View> : null}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <NameLabel name={capitalise(target.label)} />
          </View>
          <CloseStud onPress={close} testID="v2-inspect-close" />
        </View>

        {target.kind === "item" && !mechanism ? (
          // A held item, examined: the thing itself, large, and what's written on it (if anything).
          <ItemDetail name={target.label} item={item} contents={contents} />
        ) : mechanism ? (
          <>
            {/* What a mechanism without an inside of its own (a lock, wheels, a frame) turned up: on its own
                row above it, never over its parts or its status line. */}
            {above ? (
              <View style={styles.contentsRow} pointerEvents="box-none" testID="v2-contents">{above}</View>
            ) : null}
            <View style={[styles.mechanism, { height: V2.inspect.mechanismH }]} {...tapMark("object")} onLayout={(e) => setBand({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
              <Mechanism
                // Redrawn from the engine's state after every action; a pulled thing stays mounted through its
                // own commit (its drag runs on through it) and settles to the state by itself.
                key={lies ? "pull" : revision}
                target={target}
                state={state}
                onSet={(control, value) => {
                  // Worked without being shown: this kind is never nudged.
                  nudge.worked();
                  onSet(control, value);
                }}
                onSubmit={onSubmit}
                onChange={() => {
                  nudge.worked();
                  onChange?.();
                }}
                busy={busy}
                cooldown={cooldown}
                finale={finale}
                ritualChoices={ritualChoices}
                width={width - 2 * ref.space.lg}
                inside={laid ? <View style={styles.lying} pointerEvents="box-none" testID="v2-contents">{laid}</View> : undefined}
              />
              {take}
              {nudge.show && nudge.move ? <Nudge move={nudge.move} width={band.width || width} height={band.height || V2.inspect.mechanismH} onDone={nudge.over} /> : null}
            </View>
          </>
        ) : (
          // Scenery: nothing to work, just what's there (or nothing).
          <View style={styles.scenery}>
            {items ? <View style={styles.lying} pointerEvents="box-none" testID="v2-contents">{items}</View> : null}
            {take}
          </View>
        )}

        {target.kind === "object" ? (
          // The same shelf and tray as the room's, along the table's near edge.
          <View style={[styles.tray, { paddingBottom: insets.bottom + ref.space.sm }]}>
            <Shelf height={V2.tray.height + SHELF_LIP + ref.space.sm * 2 + insets.bottom} cast={false} />
            {tray}
          </View>
        ) : null}
      </Animated.View>

      {/* A note, read: the torn paper taped up over everything, in the hand it was written in. Tap anywhere to put it down. */}
      {reading ? <ReadingNote card={reading} onDone={() => setReading(null)} /> : null}
    </View>
  );
}

/** A held item, examined: the thing itself large, and its card (read in full) if it has one. Never what it's for. */
function ItemDetail({ name, item, contents }: { name: string; item?: ItemDef; contents: Content[] }) {
  const theme = useModeTheme();
  const m = useHudMaterials();
  const card = contents.find((c): c is Extract<Content, { kind: "card" }> => c.kind === "card")?.card;
  const kind = item?.kind ?? "prop";

  return (
    <View style={styles.detail} testID="v2-item-detail">
      {/* The thing itself, lying on the felt under the lamp. */}
      <View style={styles.detailGlyph}>
        <GroundShadow width={104} height={26} color={m.shadow} opacity={0.9} style={styles.detailShadow} />
        <ItemIcon item={item ?? { name, kind }} size={104} />
      </View>
      {card ? (
        <View style={styles.detailPaper} testID={`v2-item-card-${card.id}`}>
          <JournalCard card={card} palette={journalPalette(theme)} hand={handType(theme)} index={0} />
        </View>
      ) : null}
    </View>
  );
}

/** A note, read up close: the room dims (in the mode's ground), the note is taped up, tilted, at reading size. */
function ReadingNote({ card, onDone }: { card: FoundCard; onDone: () => void }) {
  const theme = useModeTheme();
  const p = journalPalette(theme);
  const hand = handType(theme);
  // (No "tap anywhere to put it down" under it: a tap anywhere does.)
  return (
    <View style={styles.reading} testID="v2-reading-layer">
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: theme.ground }, styles.readingScrim]} onPress={onDone} accessibilityRole="button" accessibilityLabel="Put the note down" testID="v2-reading" />
      <View style={styles.readingPaper} pointerEvents="none">
        <JournalCard card={card} palette={p} hand={hand} index={0} large />
      </View>
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

/** An item lying in an object: the thing itself, a little askew, its shadow under it, to pick up. */
function FoundThing({ item, index }: { item: ItemDef; index: number }) {
  const m = useHudMaterials();
  return (
    <View style={[styles.thing, { transform: [{ rotate: `${index % 2 ? 5 : -5}deg` }] }]}>
      <GroundShadow width={46} height={13} color={m.shadow} opacity={0.9} style={styles.thingShadow} />
      <ItemIcon item={item} size={50} />
    </View>
  );
}

const styles = StyleSheet.create({
  // The table: square to the screen (a desk, not a card), its wooden front edge along the top.
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: TABLE_EDGE + ref.space.sm, zIndex: 50 },
  // The room behind the table, dimmed while something is on it.
  dim: { zIndex: 49 },
  // On the table's front edge: pinned to the top and lifted by its own height (not a percentage bottom inset, which iOS drops).
  cat: { position: "absolute", left: ref.space.xl, top: 0, transform: [{ translateY: "-100%" }] },
  header: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: ref.space.lg, gap: ref.space.sm, minHeight: 48 },
  headerText: { flex: 1, gap: 3 },
  // Not said on screen (an empty drawer is seen to be empty): a point for a screen reader to land on.
  unsaid: { width: 1, height: 1 },
  mechanism: { alignItems: "center", justifyContent: "center" },
  contentsRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: ref.space.lg, paddingTop: ref.space.sm, minHeight: 56 + ref.space.sm },
  scenery: { minHeight: 140, alignItems: "center", justifyContent: "center", gap: ref.space.lg, paddingVertical: ref.space.lg },
  detail: { alignItems: "center", gap: ref.space.lg, paddingHorizontal: ref.space.lg, paddingTop: ref.space.lg, paddingBottom: ref.space.xl },
  detailGlyph: { width: 120, height: 112, alignItems: "center", justifyContent: "center" },
  detailShadow: { bottom: 0 },
  detailPaper: { alignSelf: "stretch" },
  lying: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: ref.space.lg },
  found: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  mini: { width: 44, height: 52, borderRadius: 2, paddingTop: 14, paddingLeft: 7, gap: 6 },
  miniLine: { height: 2, borderRadius: 1, opacity: 0.7 },
  miniFold: { position: "absolute", top: 0, right: 0, width: 0, height: 0, borderTopWidth: 11, borderRightWidth: 11, borderLeftColor: "transparent", borderBottomColor: "transparent" },
  miniTape: { position: "absolute", top: -5, left: 9 },
  thing: { width: 54, height: 54, alignItems: "center", justifyContent: "center" },
  thingShadow: { bottom: 0 },
  takeCorner: { position: "absolute", top: ref.space.sm, right: ref.space.lg },
  tray: { paddingHorizontal: ref.space.lg, paddingTop: ref.space.sm + SHELF_LIP, marginTop: ref.space.sm },
  reading: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", padding: ref.space.xl, zIndex: 60 },
  readingScrim: { opacity: 0.86 },
  readingPaper: { maxWidth: 360, width: "100%", transform: [{ rotate: "-1.5deg" }] },
});
