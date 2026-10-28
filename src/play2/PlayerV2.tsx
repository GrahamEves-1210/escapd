// The v2 player (gameplay v2, chunk 2): the room in the dark, a flashlight to
// find things, close-ups with mechanisms to work them, a casebook for what was
// learned, and the real door as the way out. useRoomV2 runs the room: on the
// device for a v1 room planned into a v2 one, on the server for a v2 room;
// either way each request is async and the casebook (cards, hint rungs) comes
// back rendered. When the planner can't build a v2 room from a v1 one it hands
// back to the v1 player (`onFallback`).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { CaretLeftIcon, CaretRightIcon, NotebookIcon, ArrowLeftIcon } from "phosphor-react-native";
import { useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ActionResult, ItemDef, ObjectDef, StateValue } from "@/engine/v2";
import type { Genre } from "@/lib/puzzle-types";
import { ModeScope, useModeTheme } from "@/game/mode";
import { useFeedback } from "@/game/feedback";
import { useSceneSources } from "@/game/useSceneSources";
import { useBoxPatch } from "@/render/removalPatch";
import { PresenceMeter } from "@/render/PresenceMeter";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SceneSource } from "@/render/SceneView";
import { Toast } from "@/render/Toast";
import { ref } from "@/theme/tokens";
import { Casebook } from "./Casebook";
import { Ending } from "./Ending";
import { InspectView, type Content } from "./InspectView";
import { DragGhost, ItemTray, isUvLight, type DragState } from "./ItemTray";
import { V2 } from "./layout";
import type { MechanismTarget } from "./mechanisms/types";
import { PeekingCat, type CatReaction } from "./PeekingCat";
import { Flashlight, Magnifier, TOOL } from "./Tools";
import { itemIcon } from "./ItemTray";
import { hitTest, Stage, type StageObject } from "./Stage";
import { useRoomV2, type RoomV2 } from "./useRoomV2";

export interface PlayerV2Props {
  roomId: string;
  onExit: () => void;
  onComplete: (summary: { title: string; ending: string; genre: Genre }) => void;
  onFallback: (reason: string) => void;
}

type Open = { kind: "object"; id: string } | { kind: "item"; id: string };

/** A theme colour (#RRGGBB) at an opacity. */
function tint(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})` : hex;
}

/** The hotbar's slots: held items fill them from the left, the rest show empty. */
const HOTBAR_SLOTS = 6;

/** The cat's width on the ledge (points). */
const CAT_W = 58;

/** The magnifier's id while it is dragged (never an item id: those are minted "prop_…", "key_…"). */
const LENS = "__lens__";

const TOAST = {
  nothing: "Nothing happens.",
  wrong: "Not that.",
  locked: "It's locked.",
  cooldown: "Give it a moment.",
} as const;

export function PlayerV2(props: PlayerV2Props) {
  const v2 = useRoomV2(props.roomId);
  const genre = v2.def?.mode ?? null;
  return (
    <ModeScope genre={genre}>
      <Body {...props} v2={v2} />
    </ModeScope>
  );
}

function Body({ roomId, onExit, onComplete, onFallback, v2 }: PlayerV2Props & { v2: RoomV2 }) {
  const theme = useModeTheme();
  const feedback = useFeedback();
  const insets = useSafeAreaInsets();
  const { phase, def, scene, state, cards: casebookCards, hints, canHint, progress, completed, ending, busy, error, act, hint, restart, cooldown } = v2;
  const sources = useSceneSources(roomId, scene);

  const [view, setView] = useState(0);
  // Which way the player last turned (the next view slides in from that side).
  const [turnDir, setTurnDir] = useState<1 | -1 | 0>(0);
  const [open, setOpen] = useState<Open | null>(null);
  // What each object turned out to hold (notes to read, items not yet picked up), shown in it when it's open.
  const [contents, setContents] = useState<Record<string, Content[]>>({});
  // The UV flashlight switched on, the objects already checked under it, the photo's frame for drops, a drag.
  const [uvOn, setUvOn] = useState(false);
  const [uvChecked, setUvChecked] = useState<string[]>([]);
  const [frame, setFrame] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const drag = { x: useSharedValue(0), y: useSharedValue(0) };
  // The beam (photo fractions), shared by the room and the cat watching it.
  const beam = { x: useSharedValue<number>(V2.torch.rest.x), y: useSharedValue<number>(V2.torch.rest.y) };
  const { height: windowHeight } = useWindowDimensions();
  const [note, setNote] = useState<string | null>(null);
  const [toasts, setToasts] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [casebook, setCasebook] = useState(false);
  const [revision, setRevision] = useState(0);
  const [bandH, setBandH] = useState<number | null>(null);
  // What the cat last reacted to (a find, a wrong answer).
  const [catReaction, setCatReaction] = useState<CatReaction>(null);
  // Clues read in the casebook (the badge counts the ones since), and where the ledge starts (the hand sits above it).
  const [cluesRead, setCluesRead] = useState(0);
  const [ledgeTop, setLedgeTop] = useState<number | null>(null);
  const { width: screenW } = useWindowDimensions();
  // Glints: on by default; off is the hard way (nothing catches the light). Show interactives keeps a faint outline on everything.
  const [glints, setGlints] = useState(true);

  // Crime scene: the evidence board's crossed-out options, the player's own notes, kept per room on the device.
  const [struck, setStruck] = useState<string[]>([]);
  const boardKey = `escapd.v2.board.${roomId}`;
  useEffect(() => {
    AsyncStorage.getItem(boardKey).then((raw) => raw && setStruck(JSON.parse(raw) as string[])).catch(() => {});
  }, [boardKey]);
  const strike = (id: string) => {
    feedback.tick();
    setStruck((list) => {
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      AsyncStorage.setItem(boardKey, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  // The removable object's fill, baked in idle moments once its photo is up; drawn once it's taken.
  const removable = def?.objects.find((o) => o.removable);
  const removablePhoto = removable ? scene?.photos[removable.photo_index] : undefined;
  const patch = useBoxPatch(
    removable && sources.kind === "ready" && sources.sources[removable.photo_index] !== undefined
      ? {
        id: removable.id,
        source: sources.sources[removable.photo_index],
        cacheKey: removablePhoto && "photo_id" in removablePhoto ? removablePhoto.photo_id : undefined,
        box: removable.box,
      }
      : null,
    def?.mode,
  );

  const fallback = phase.kind === "fallback" ? phase.reason : null;
  useEffect(() => {
    if (fallback !== null) onFallback(fallback);
  }, [fallback, onFallback]);

  const photos = def ? Math.max(1, ...def.objects.map((o) => o.photo_index + 1)) : 1;
  const toast = useCallback((text: string) => setToasts((t) => [...t.slice(-2), text]), []);

  // A request that didn't go through (a room played on the server).
  useEffect(() => {
    if (error) toast(error.offline ? "No connection. Try again." : "That didn't go through. Try again.");
  }, [error, toast]);

  const itemById = useCallback((id: string) => def?.items.find((i) => i.id === id), [def]);
  const objectById = useCallback((id: string) => def?.objects.find((o) => o.id === id), [def]);
  // Found items lying where they were found (a drawer, under a cloth) aren't in hand until picked up.
  const lying = useMemo(() => new Set(Object.values(contents).flat().flatMap((c) => (c.kind === "item" ? [c.item.id] : []))), [contents]);
  const heldItems = useMemo(
    () => (state ? state.inventory.filter((id) => !lying.has(id)).map((id) => itemById(id)).filter((i): i is ItemDef => !!i) : []),
    [state, itemById, lying],
  );
  /** Feedback and notes for one result (none when it didn't go through); returns the cards it showed. */
  const openObject = open?.kind === "object" ? open.id : null;
  const addContent = (objectId: string, c: Content) =>
    setContents((all) => {
      const list = all[objectId] ?? [];
      const key = (x: Content) => (x.kind === "card" ? `c:${x.card.id}` : `i:${x.item.id}`);
      return list.some((x) => key(x) === key(c)) ? all : { ...all, [objectId]: [...list, c] };
    });
  const pickUp = (objectId: string, itemId: string) => {
    setContents((all) => ({ ...all, [objectId]: (all[objectId] ?? []).filter((x) => !(x.kind === "item" && x.item.id === itemId)) }));
    toast(`${itemById(itemId)?.name ?? "It"}: in your hands.`);
  };
  const take = (result: ActionResult | null, where: "inspect" | "room", quiet = false): { title: string; text: string; id: string }[] => {
    const cards: { title: string; text: string; id: string }[] = [];
    if (!result) return cards;
    const lines: string[] = [];
    setRevision((r) => r + 1);
    switch (result.outcome) {
      case "nothing":
        if (quiet) return cards;
        feedback.tap();
        if (where === "room") lines.push(TOAST.nothing);
        break;
      case "wrong":
        setCatReaction({ kind: "wrong", at: Date.now() });
        feedback.wrongCode();
        lines.push(TOAST.wrong);
        break;
      case "locked":
        feedback.warning();
        lines.push(TOAST.locked);
        break;
      case "invalid":
        if (result.reason === "cooldown") lines.push(TOAST.cooldown);
        break;
      case "ok":
        break;
    }
    for (const e of result.effects) {
      switch (e.do) {
        case "show_card":
          setCatReaction({ kind: "found", at: Date.now() });
          feedback.paper();
          cards.push({ id: e.card, title: e.title, text: e.text });
          if (where === "inspect" && openObject) addContent(openObject, { kind: "card", card: { id: e.card, title: e.title, text: e.text } });
          break;
        case "grant": {
          setCatReaction({ kind: "found", at: Date.now() });
          const item = itemById(e.item);
          if (where === "inspect" && openObject && item) addContent(openObject, { kind: "item", item });
          else {
            feedback.pickup();
            lines.push(`Found: ${item?.name ?? "something"}.`);
          }
          break;
        }
        case "open":
          feedback.unlock();
          break;
        case "reveal": {
          const o = objectById(e.object);
          if (o && o.photo_index !== view) lines.push("Something changed in the room.");
          break;
        }
        case "beat":
          lines.push(e.text);
          break;
        case "solved":
          setCatReaction({ kind: "found", at: Date.now() });
          feedback.success();
          break;
        default:
          break;
      }
    }
    if (where === "inspect") {
      setNote(lines.length ? lines.join(" ") : null);
      for (const l of lines) if (l === "Something changed in the room.") toast(l);
    } else {
      for (const l of lines) toast(l);
    }
    return cards;
  };

  const look = async (objectId: string | null) => {
    if (!objectId || !def || busy) {
      return;
    }
    // Holding one item: use it on what was tapped.
    if (selected.length === 1) {
      const item = selected[0];
      setSelected([]);
      take(await act({ type: "use_item", item, object: objectId }), "room");
      return;
    }
    feedback.press();
    setNote(null);
    setOpen({ kind: "object", id: objectId });
    // The look runs with the close-up open, so what it turns up lands in the object.
    const result = await act({ type: "inspect", object: objectId });
    takeAt(objectId, result);
  };

  /** A result for an object's close-up, wherever the close-up is now (the request may land after it moved on). */
  const takeAt = (objectId: string, result: ActionResult | null) => {
    if (!result) return;
    setRevision((r) => r + 1);
    for (const e of result.effects) {
      if (e.do === "show_card") addContent(objectId, { kind: "card", card: { id: e.card, title: e.title, text: e.text } });
      if (e.do === "grant") {
        const item = itemById(e.item);
        if (item) addContent(objectId, { kind: "item", item });
      }
    }
    take({ ...result, effects: result.effects.filter((e) => e.do !== "show_card" && e.do !== "grant") }, "inspect");
    if (result.effects.some((e) => e.do === "show_card")) feedback.paper();
  };

  const openItem = (itemId: string) => {
    setCasebook(false);
    // An examined item shows its own card, once it has been found.
    const item = itemById(itemId);
    const card = item?.card ? casebookCards.find((c) => c.id === item.card) : undefined;
    setContents((all) => ({ ...all, [`item:${itemId}`]: card ? [{ kind: "card", card }] : [] }));
    setNote(null);
    setOpen({ kind: "item", id: itemId });
  };

  const toggleItem = (id: string) => {
    feedback.tick();
    const item = itemById(id);
    // The UV flashlight: tap to switch the light over, tap again to switch back.
    if (item && isUvLight(item)) {
      setUvOn((on) => !on);
      return;
    }
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 2 ? [s[1], id] : [...s, id]));
  };

  // The current view's objects, set each render (drops are hit-tested against them).
  let stageObjectsNow: StageObject[] = [];
  /** Let go of a dragged item: on the close-up, use it there; on the room's photo, on what's under the finger. */
  const drop = async (itemId: string, x: number, y: number) => {
    setDragging(null);
    // A cancelled drag (x < 0) uses nothing.
    if (busy || x < 0) return;
    const trayTop = windowHeight - insets.bottom - V2.tray.height - ref.space.lg * 2;
    if (y > trayTop) return;
    let objectId: string | null = null;
    if (open?.kind === "object") objectId = open.id;
    else if (frame && x >= frame.x && x <= frame.x + frame.width && y >= frame.y && y <= frame.y + frame.height) {
      objectId = hitTest(stageObjectsNow, (x - frame.x) / frame.width, (y - frame.y) / frame.height);
    }
    if (!objectId) return;
    // The magnifier: look closer at what it was dropped on.
    if (itemId === LENS) {
      look(objectId);
      return;
    }
    feedback.press();
    const result = await act({ type: "use_item", item: itemId, object: objectId });
    if (open?.kind === "object") takeAt(objectId, result);
    else take(result, "room");
  };

  // The UV flashlight held over something for a moment checks it: invisible ink shows if there's any.
  const uvItem = heldItems.find((i) => isUvLight(i));
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onHover = (objectId: string | null) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (!uvOn || !uvItem || !objectId || uvChecked.includes(objectId)) return;
    hoverTimer.current = setTimeout(async () => {
      setUvChecked((list) => [...list, objectId]);
      take(await act({ type: "use_item", item: uvItem.id, object: objectId }), "room", true);
    }, 400);
  };

  const combine = async () => {
    if (selected.length !== 2) return;
    const items: [string, string] = [selected[0], selected[1]];
    setSelected([]);
    take(await act({ type: "combine", items }), "room");
  };

  const askHint = async () => {
    if (await hint()) {
      feedback.tick();
      // The cat's had an idea.
      setCatReaction({ kind: "found", at: Date.now() });
    }
  };

  if (phase.kind === "loading" || phase.kind === "fallback" || !def || !state || !scene) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: theme.ground }]} testID="v2-loading">
        {phase.kind === "error" ? (
          <>
            <Text style={[ref.type.body, { color: theme.ink }]}>{phase.offline ? "No connection." : "Something went wrong."}</Text>
            <Pressable onPress={onExit} accessibilityRole="button" style={styles.back}>
              <Text style={[ref.type.headline, { color: theme.ink }]}>Back</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    );
  }

  const objectState = (id: string) => state.objects[id] ?? {};
  const visible = (o: ObjectDef) => !objectState(o.id).hidden && !objectState(o.id).removed;
  const stageObjects: StageObject[] = def.objects
    .filter((o) => o.photo_index === view && visible(o))
    .map((o) => ({ id: o.id, label: o.label, box: o.box, seen: state.seen.includes(o.id) }));
  stageObjectsNow = stageObjects;
  const marks = state.overlays
    .filter((ov) => ov.overlay === "glow_mark" && ov.mark)
    .map((ov) => ({ ov, o: objectById(ov.object) }))
    .filter(({ o }) => o && o.photo_index === view)
    .map(({ ov, o }) => ({ object: ov.object, box: o!.box, text: ov.mark! }));
  const overlays = state.overlays
    .map((ov) => ({ ...ov, o: objectById(ov.object) }))
    .filter((ov) => ov.o && ov.o.photo_index === view)
    .map((ov) => ({ object: ov.object, overlay: ov.overlay, box: ov.o!.box }));

  const source = sources.kind === "ready" ? sources.sources[view] : null;
  const photoKey = (i: number) => {
    const p = scene.photos[i];
    return p && "photo_id" in p ? p.photo_id : undefined;
  };

  // The close-up's target.
  let target: MechanismTarget | null = null;
  let targetState: Record<string, StateValue> = {};
  let targetObject: ObjectDef | undefined;
  if (open?.kind === "object") {
    targetObject = objectById(open.id);
    if (targetObject) {
      target = { kind: "object", id: targetObject.id, label: targetObject.label, archetype: targetObject.archetype, variant: targetObject.variant, controls: targetObject.controls, submit: targetObject.submit };
      targetState = objectState(targetObject.id);
    }
  } else if (open?.kind === "item") {
    const item = itemById(open.id);
    if (item) {
      target = { kind: "item", id: item.id, label: item.name, archetype: item.archetype ?? null, variant: item.variant, controls: item.controls ?? [] };
      const initial = Object.fromEntries((item.controls ?? []).map((c) => [c.id, c.domain.kind === "offset" ? "1" : ""]));
      targetState = { ...initial, ...(state.items[item.id] ?? {}) };
    }
  }
  const takeable = targetObject && !targetObject.archetype && targetObject.controls.some((c) => c.id === "taken") && !objectState(targetObject.id).taken;
  const ritualChoices = def.finale.kind === "ritual"
    ? def.objects.filter((o) => !o.exit && state.seen.includes(o.id)).map((o) => ({ id: o.id, label: o.label }))
    : undefined;

  const exitObject = def.objects.find((o) => o.exit);
  const cat = <PeekingCat width={CAT_W} beamX={beam.x} beamY={beam.y} frame={frame} reaction={catReaction} mood={busy ? "thinking" : "idle"} />;
  const tray = (
    <ItemTray
      items={heldItems}
      selected={selected}
      equipped={uvOn}
      drag={drag}
      onTap={toggleItem}
      onExamine={openItem}
      onDragStart={(id) => { feedback.tick(); setDragging(id); }}
      onDrop={drop}
      slots={HOTBAR_SLOTS}
    />
  );

  const selectedItem = selected.length === 1 ? itemById(selected[0]) : undefined;
  const SelectedGlyph = selectedItem ? itemIcon(selectedItem) : null;
  const unread = Math.max(0, casebookCards.length - cluesRead);
  const glass = { backgroundColor: theme.raised, borderColor: theme.rim };
  // The top HUD band's height: under the status bar, one row of controls.
  // The top band: at least one row of controls, taller when the case's line runs on (it's always shown in full).
  const hudTop = Math.max(insets.top + 58, bandH ?? 0);
  const middle = frame ? frame.y + frame.height / 2 : null;
  const toolTop = frame ? Math.min(frame.y + frame.height, ledgeTop ?? windowHeight) - TOOL - ref.space.sm : 0;
  const selectedCard = selectedItem?.card ? casebookCards.find((c) => c.id === selectedItem.card) : undefined;

  return (
    <View style={[styles.root, { backgroundColor: "#000000" }]} testID="v2-player">
      {/* The game view: the room, between the HUD's top band and its hotbar. */}
      <View style={[styles.view, { top: hudTop, bottom: ledgeTop !== null ? windowHeight - ledgeTop : 112 }]}>
        {source ? (
          <Stage
            key={view}
            source={source}
            cacheKey={photoKey(view)}
            genre={def.mode}
            objects={stageObjects}
            overlays={overlays}
            patch={patch && removable && removable.photo_index === view && objectState(removable.id).removed ? patch : null}
            glints={glints}
            assist={false}
            uv={uvOn}
            marks={marks}
            focus={targetObject && targetObject.photo_index === view ? targetObject.box : null}
            beam={beam}
            onHover={onHover}
            onFrame={setFrame}
            onLook={look}
            onPage={(dir) => { setTurnDir(dir); setView((v) => (v + dir + photos) % photos); }}
            enter={turnDir}
            accessibilityLabel={`View ${view + 1} of ${photos}`}
          />
        ) : null}
      </View>

      <View
        style={[styles.top, styles.band, { minHeight: insets.top + 58, paddingTop: insets.top + ref.space.xs, paddingBottom: ref.space.xs, backgroundColor: theme.ground, borderBottomColor: tint(theme.ink, 0.12) }]}
        pointerEvents="box-none"
        onLayout={(e) => setBandH(e.nativeEvent.layout.height)}
      >
        <Pressable onPress={onExit} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={[styles.glass, glass]} testID="v2-back">
          <ArrowLeftIcon size={20} weight="bold" color={theme.ink} />
        </Pressable>
        {/* The case: a label in the mode's display face over the whole objective. */}
        <View accessible accessibilityLabel={`Objective: ${def.objective}`} style={styles.objective} testID="v2-objective">
          <Text style={[styles.caseLabel, { color: theme.stamp, fontFamily: theme.display.fontFamily }]}>The case</Text>
          <Text style={[styles.objectiveText, { color: theme.ink }]}>{def.objective}</Text>
          {def.mode === "paranormal" && progress.total > 0 ? (
            // The presence answers each step the player takes toward the ritual; at the end it is gone.
            <PresenceMeter presence={{ found: progress.solved, total: progress.total }} gone={completed} />
          ) : null}
        </View>
        <Pressable
          onPress={() => { setCasebook(true); setCluesRead(casebookCards.length); }}
          accessibilityRole="button"
          accessibilityLabel={unread ? `Casebook, ${unread} new` : "Casebook"}
          hitSlop={8}
          style={[styles.glass, glass]}
          testID="v2-casebook-open"
        >
          <NotebookIcon size={21} weight="bold" color={theme.ink} />
          {unread ? (
            <View style={[styles.badge, { backgroundColor: theme.accent }]} testID="v2-casebook-badge">
              <Text style={[styles.badgeText, { color: theme.accentInk }]}>{unread}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {photos > 1 && !open ? (
        <>
          <Pressable
            onPress={() => { feedback.tick(); setTurnDir(-1); setView((v) => (v - 1 + photos) % photos); }}
            accessibilityRole="button"
            accessibilityLabel={`Previous view (${view + 1} of ${photos})`}
            hitSlop={12}
            testID="v2-prev"
            style={[styles.edge, styles.edgeLeft, middle !== null ? { top: middle - 26, marginTop: 0 } : null]}
          >
            <Chevron Icon={CaretLeftIcon} />
          </Pressable>
          <Pressable
            onPress={() => { feedback.tick(); setTurnDir(1); setView((v) => (v + 1) % photos); }}
            accessibilityRole="button"
            accessibilityLabel={`Next view (${view + 1} of ${photos})`}
            hitSlop={12}
            testID="v2-next"
            style={[styles.edge, styles.edgeRight, middle !== null ? { top: middle - 26, marginTop: 0 } : null]}
          >
            <Chevron Icon={CaretRightIcon} />
          </Pressable>
        </>
      ) : null}
      <View style={[styles.toasts, { top: hudTop + ref.space.sm }]} pointerEvents="none">
        {toasts.length ? <Toast key={`${toasts.length}-${toasts[0]}`} text={toasts[0]} onHide={() => setToasts((t) => t.slice(1))} /> : null}
      </View>


      {/* The tools, on the photo's bottom corners (kept above the ledge). */}
      {!open && frame ? (
        <>
          <Magnifier
            at={{ left: Math.max(0, frame.x) + ref.space.sm, top: toolTop }}
            drag={drag}
            onDragStart={() => { feedback.tick(); setDragging(LENS); }}
            onDrop={(x, y) => drop(LENS, x, y)}
          />
          <Flashlight at={{ left: Math.min(screenW, frame.x + frame.width) - TOOL - ref.space.sm, top: toolTop }} beamX={beam.x} beamY={beam.y} frame={frame} uv={uvOn} />
        </>
      ) : null}

      {!open ? (
        <View style={styles.foot} pointerEvents="box-none">
          {/* What the selected item is: a clean card over the tray. */}
          {selectedItem && !dragging ? (
            <View style={[styles.itemCard, { backgroundColor: theme.surface, borderColor: theme.rim }]} testID="v2-item-card">
              {SelectedGlyph ? (
                <View style={[styles.itemGlyph, { backgroundColor: theme.raised }]}>
                  <SelectedGlyph size={24} weight="fill" color={theme.ink} />
                </View>
              ) : null}
              <View style={styles.itemText}>
                <Text style={[styles.caseLabel, { color: theme.stamp, fontFamily: theme.display.fontFamily }]}>Evidence</Text>
                <Text style={[ref.type.headline, { color: theme.ink }]}>{selectedItem.name}</Text>
                <Text style={[ref.type.meta, { color: theme.inkMuted }]}>
                  {selectedCard?.text || (isUvLight(selectedItem) ? "Tap to switch your light to UV." : "Drag it onto something to use it. Hold to look closer.")}
                </Text>
              </View>
            </View>
          ) : null}
          {selected.length === 2 ? (
            <Pressable onPress={combine} accessibilityRole="button" accessibilityLabel="Fit together" testID="v2-combine" style={[styles.combine, { backgroundColor: theme.accent }]}>
              <Text style={[ref.type.headline, { color: theme.accentInk }]}>Fit together</Text>
            </Pressable>
          ) : null}
          <View
            style={[styles.footRow, styles.ledge, { backgroundColor: theme.ground, borderTopColor: tint(theme.ink, 0.12), paddingBottom: insets.bottom + ref.space.sm }]}
            pointerEvents="box-none"
            onLayout={(e) => setLedgeTop(windowHeight - e.nativeEvent.layout.height)}
          >
            {/* The cat, peering over the ledge, eyes on your light (over the close-up's sheet while that's up). */}
            {open || casebook ? null : <View style={styles.cat} pointerEvents="box-none">{cat}</View>}
            <View style={styles.trayWrap}>{tray}</View>
          </View>
        </View>
      ) : null}

      {open && target ? (
        <InspectView
          target={target}
          state={targetState}
          contents={contents[open.kind === "object" ? open.id : `item:${open.id}`] ?? []}
          note={note}
          onPickUp={(itemId) => pickUp(open.kind === "object" ? open.id : `item:${open.id}`, itemId)}
          tray={tray}
          cat={cat}
          busy={busy}
          cooldown={cooldown}
          finale={targetObject?.exit ? def.finale : undefined}
          ritualChoices={ritualChoices}
          onSet={async (control, value) => takeAt(target!.id, await act({ type: "set_control", target: target!.id, control, value }))}
          onSubmit={async (value) => takeAt(target!.id, await act({ type: "submit", object: target!.id, value }))}
          onTake={takeable ? async () => take(await act({ type: "set_control", target: target!.id, control: "taken", value: true }), "room") : undefined}
          onClose={() => setOpen(null)}
          revision={revision}
        />
      ) : null}

      {casebook ? (
        <Casebook
          cat={cat}
          objective={def.objective}
          board={def.finale.kind === "accusation"
            ? [
              { title: "Who", options: def.finale.suspects },
              { title: "Why", options: def.finale.motives },
              { title: "How", options: def.finale.methods },
            ]
            : undefined}
          struck={struck}
          onStrike={strike}
          cards={casebookCards}
          items={heldItems.map((i) => ({ id: i.id, name: i.name, examinable: !!(i.card || i.archetype === "Decoder") }))}
          hints={hints}
          canHint={canHint}
          glints={glints}
          onGlints={setGlints}
          onHint={askHint}
          onExamine={openItem}
          onRestart={() => {
            setSelected([]);
            setCasebook(false);
            setOpen(null);
            restart().then((ok) => {
              if (!ok) toast("Couldn't restart. Check your connection.");
            });
          }}
          onClose={() => setCasebook(false)}
        />
      ) : null}

      {completed ? (
        <Ending
          text={ending ?? ""}
          door={exitObject && sources.kind === "ready" ? { source: sources.sources[exitObject.photo_index], cacheKey: photoKey(exitObject.photo_index), box: exitObject.box } : undefined}
          genre={def.mode}
          onDone={() => onComplete({ title: def.title, ending: ending ?? "", genre: def.mode })}
        />
      ) : null}

      {dragging && dragging !== LENS && itemById(dragging) ? <DragGhost item={itemById(dragging)!} drag={drag} /> : null}

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", gap: ref.space.lg },
  back: { minHeight: ref.hit.min, justifyContent: "center" },
  top: { position: "absolute", left: 0, right: 0, top: 0, flexDirection: "row", alignItems: "center", gap: ref.space.sm, paddingHorizontal: ref.space.lg },
  band: { borderBottomWidth: 1, zIndex: 20 },
  view: { position: "absolute", left: 0, right: 0, overflow: "hidden" },
  glass: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth },
  objective: { flex: 1, minHeight: 42, paddingHorizontal: ref.space.sm, justifyContent: "center", gap: 1 },
  caseLabel: { fontSize: 10, lineHeight: 12, letterSpacing: 1.6, textTransform: "uppercase", textAlign: "center" },
  objectiveText: { ...ref.type.meta, textAlign: "center" },
  badge: { position: "absolute", top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 11, lineHeight: 13, fontWeight: "700" },
  toasts: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  edge: {
    position: "absolute", top: "50%", marginTop: -26, width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center",
    zIndex: 10,
  },
  chevronShade: { position: "absolute", transform: [{ translateX: 1 }, { translateY: 2 }] },
  edgeLeft: { left: ref.space.sm },
  edgeRight: { right: ref.space.sm },
  foot: { position: "absolute", left: 0, right: 0, bottom: 0, gap: ref.space.sm },
  footRow: { flexDirection: "row", alignItems: "center", gap: ref.space.sm },
  ledge: { paddingHorizontal: ref.space.lg, paddingTop: ref.space.sm, borderTopWidth: 1 },
  // Just right of the magnifier (bottom-left of the photo), clear of it.
  cat: { position: "absolute", left: ref.space.sm + TOOL + ref.space.sm, bottom: "100%" },
  trayWrap: { flex: 1 },
  itemCard: {
    alignSelf: "center", maxWidth: 360, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: ref.space.sm + 2,
    flexDirection: "row", alignItems: "center", gap: ref.space.sm, marginHorizontal: ref.space.lg,
  },
  itemGlyph: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  itemText: { flexShrink: 1, gap: 1 },
  combine: { minHeight: ref.hit.min, borderRadius: ref.hit.min / 2, alignItems: "center", justifyContent: "center", marginHorizontal: ref.space.xl },
});

/** A turn arrow: a clear, thick chevron, white over a soft dark copy so it reads on any photo. */
function Chevron({ Icon }: { Icon: typeof CaretLeftIcon }) {
  return (
    <>
      <Icon size={42} weight="bold" color="rgba(0,0,0,0.55)" style={styles.chevronShade} />
      <Icon size={42} weight="bold" color="#FFFFFF" />
    </>
  );
}
