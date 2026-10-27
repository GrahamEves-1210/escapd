// The v2 player (gameplay v2, chunk 2): the room in the dark, a flashlight to
// find things, close-ups with mechanisms to work them, a casebook for what was
// learned, and the real door as the way out. useRoomV2 runs the room: on the
// device for a v1 room planned into a v2 one, on the server for a v2 room;
// either way each request is async and the casebook (cards, hint rungs) comes
// back rendered. When the planner can't build a v2 room from a v1 one it hands
// back to the v1 player (`onFallback`).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { CaretLeftIcon, CaretRightIcon, ListIcon, ArrowLeftIcon, MagnifyingGlassIcon } from "phosphor-react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
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
import { PeekingCat } from "./PeekingCat";
import { hitTest, Stage, type StageObject } from "./Stage";
import { useRoomV2, type RoomV2 } from "./useRoomV2";

export interface PlayerV2Props {
  roomId: string;
  onExit: () => void;
  onComplete: (summary: { title: string; ending: string; genre: Genre }) => void;
  onFallback: (reason: string) => void;
}

type Open = { kind: "object"; id: string } | { kind: "item"; id: string };

/** The cat's width on the ledge (points). */
const CAT_W = 104;

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
  const [objectiveOpen, setObjectiveOpen] = useState(false);
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
  const heldItems = useMemo(() => (state ? state.inventory.map((id) => itemById(id)).filter((i): i is ItemDef => !!i) : []), [state, itemById]);
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
          feedback.paper();
          cards.push({ id: e.card, title: e.title, text: e.text });
          if (where === "inspect" && openObject) addContent(openObject, { kind: "card", card: { id: e.card, title: e.title, text: e.text } });
          break;
        case "grant": {
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
    if (busy) return;
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
  const uvItem = state?.inventory.map((id) => itemById(id)).find((i) => i && isUvLight(i));
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
    if (await hint()) feedback.tick();
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
    />
  );

  const selectedItem = selected.length === 1 ? itemById(selected[0]) : undefined;
  const selectedCard = selectedItem?.card ? casebookCards.find((c) => c.id === selectedItem.card) : undefined;

  return (
    <View style={[styles.root, { backgroundColor: "#000000" }]} testID="v2-player">
      {/* The room fills the screen; the controls sit over it. */}
      <View style={StyleSheet.absoluteFill}>
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
            onPage={(dir) => setView((v) => (v + dir + photos) % photos)}
            accessibilityLabel={`View ${view + 1} of ${photos}`}
          />
        ) : null}
      </View>

      <View style={[styles.top, { paddingTop: insets.top + ref.space.xs }]} pointerEvents="box-none">
        <Pressable onPress={onExit} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={styles.glass} testID="v2-back">
          <ArrowLeftIcon size={20} weight="bold" color="#FFFFFF" />
        </Pressable>
        {/* The objective: one quiet line; tap for all of it. */}
        <Pressable onPress={() => setObjectiveOpen((o) => !o)} accessibilityRole="button" accessibilityLabel={`Objective: ${def.objective}`} style={styles.objective} testID="v2-objective">
          <Text style={styles.objectiveText} numberOfLines={objectiveOpen ? undefined : 1}>{def.objective}</Text>
          {def.mode === "paranormal" && progress.total > 0 ? (
            // The presence answers each step the player takes toward the ritual; at the end it is gone.
            <PresenceMeter presence={{ found: progress.solved, total: progress.total }} gone={completed} />
          ) : null}
        </Pressable>
        <Pressable onPress={() => setCasebook(true)} accessibilityRole="button" accessibilityLabel="Casebook" hitSlop={8} style={styles.glass} testID="v2-casebook-open">
          <ListIcon size={20} weight="bold" color="#FFFFFF" />
        </Pressable>
      </View>

      {photos > 1 && !open ? (
        <>
          <Pressable
            onPress={() => { feedback.tick(); setView((v) => (v - 1 + photos) % photos); }}
            accessibilityRole="button"
            accessibilityLabel={`Previous view (${view + 1} of ${photos})`}
            hitSlop={12}
            testID="v2-prev"
            style={[styles.edge, styles.edgeLeft]}
          >
            <CaretLeftIcon size={44} weight="bold" color="#FFFFFF" />
          </Pressable>
          <Pressable
            onPress={() => { feedback.tick(); setView((v) => (v + 1) % photos); }}
            accessibilityRole="button"
            accessibilityLabel={`Next view (${view + 1} of ${photos})`}
            hitSlop={12}
            testID="v2-next"
            style={[styles.edge, styles.edgeRight]}
          >
            <CaretRightIcon size={44} weight="bold" color="#FFFFFF" />
          </Pressable>
        </>
      ) : null}
      <View style={[styles.toasts, { top: insets.top + 64 }]} pointerEvents="none">
        {toasts.length ? <Toast key={`${toasts.length}-${toasts[0]}`} text={toasts[0]} onHide={() => setToasts((t) => t.slice(1))} /> : null}
      </View>

      {!open ? (
        <View style={[styles.foot, { paddingBottom: insets.bottom + ref.space.sm }]} pointerEvents="box-none">
          {/* What the selected item is: a clean card over the tray. */}
          {selectedItem && !dragging ? (
            <View style={[styles.itemCard, { backgroundColor: theme.surface, borderColor: theme.rim }]} testID="v2-item-card">
              <Text style={[ref.type.headline, { color: theme.ink }]}>{selectedItem.name}</Text>
              <Text style={[ref.type.meta, { color: theme.inkMuted }]}>
                {selectedCard?.text || (isUvLight(selectedItem) ? "Tap to switch your light to UV." : "Drag it onto something to use it. Hold to look closer.")}
              </Text>
            </View>
          ) : null}
          {selected.length === 2 ? (
            <Pressable onPress={combine} accessibilityRole="button" accessibilityLabel="Fit together" testID="v2-combine" style={[styles.combine, { backgroundColor: theme.accent }]}>
              <Text style={[ref.type.headline, { color: theme.accentInk }]}>Fit together</Text>
            </Pressable>
          ) : null}
          <View style={[styles.footRow, styles.ledge, { borderTopColor: theme.rim }]} pointerEvents="box-none">
            {/* The cat, peering over the ledge, eyes on your light. */}
            <View style={styles.cat} pointerEvents="none">
              <PeekingCat width={CAT_W} beamX={beam.x} beamY={beam.y} frame={frame} />
            </View>
            <Magnifier drag={drag} onDragStart={() => { feedback.tick(); setDragging(LENS); }} onDrop={(x, y) => drop(LENS, x, y)} />
            <View style={styles.trayWrap}>{heldItems.length ? tray : null}</View>
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

      {dragging === LENS ? <LensGhost drag={drag} /> : dragging && itemById(dragging) ? <DragGhost item={itemById(dragging)!} drag={drag} /> : null}

    </View>
  );
}

/** The magnifier, bottom left of the room: drag it onto something to look closer. */
function Magnifier({ drag, onDragStart, onDrop }: { drag: DragState; onDragStart: () => void; onDrop: (x: number, y: number) => void }) {
  const pan = usePanGesture({
    minDistance: 4,
    maxPointers: 1,
    onActivate: (e) => {
      "worklet";
      drag.x.set(e.absoluteX);
      drag.y.set(e.absoluteY);
      scheduleOnRN(onDragStart);
    },
    onUpdate: (e) => {
      "worklet";
      drag.x.set(e.absoluteX);
      drag.y.set(e.absoluteY);
    },
    onDeactivate: (e) => {
      "worklet";
      scheduleOnRN(onDrop, e.absoluteX, e.absoluteY);
    },
  });
  return (
    <GestureDetector gesture={pan}>
      <View style={styles.lens} accessible accessibilityRole="button" accessibilityLabel="Magnifier: drag onto something to look closer" testID="v2-lens">
        <MagnifyingGlassIcon size={30} weight="bold" color="#FFFFFF" />
      </View>
    </GestureDetector>
  );
}

function LensGhost({ drag }: { drag: DragState }) {
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: drag.x.get() - 36 }, { translateY: drag.y.get() - 36 }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.lensGhost, style]} testID="v2-lens-drag">
      <MagnifyingGlassIcon size={46} weight="bold" color="#FFFFFF" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", gap: ref.space.lg },
  back: { minHeight: ref.hit.min, justifyContent: "center" },
  top: { position: "absolute", left: 0, right: 0, top: 0, flexDirection: "row", alignItems: "flex-start", gap: ref.space.sm, paddingHorizontal: ref.space.lg },
  glass: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)" },
  objective: {
    flex: 1, minHeight: 40, borderRadius: 20, paddingHorizontal: ref.space.lg, paddingVertical: ref.space.sm, justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)", gap: ref.space.xs,
  },
  objectiveText: { ...ref.type.meta, color: "rgba(255,255,255,0.92)", textAlign: "center" },
  toasts: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  edge: {
    position: "absolute", top: "50%", marginTop: -32, width: 52, height: 64, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)", zIndex: 10,
  },
  edgeLeft: { left: 0, borderTopRightRadius: 16, borderBottomRightRadius: 16 },
  edgeRight: { right: 0, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  foot: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: ref.space.lg, gap: ref.space.sm },
  footRow: { flexDirection: "row", alignItems: "center", gap: ref.space.sm },
  ledge: { marginHorizontal: -ref.space.lg, paddingHorizontal: ref.space.lg, paddingTop: ref.space.sm, borderTopWidth: StyleSheet.hairlineWidth, backgroundColor: "rgba(12,12,16,0.82)" },
  cat: { position: "absolute", left: ref.space.lg + 64, bottom: "100%" },
  trayWrap: { flex: 1, paddingRight: 96 },
  lens: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" },
  lensGhost: { position: "absolute", left: 0, top: 0, width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF", backgroundColor: "rgba(255,255,255,0.12)", zIndex: 200 },
  itemCard: { alignSelf: "center", maxWidth: 340, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: ref.space.lg, paddingVertical: ref.space.sm + 2, gap: 2 },
  combine: { minHeight: ref.hit.min, borderRadius: ref.hit.min / 2, alignItems: "center", justifyContent: "center" },
});
