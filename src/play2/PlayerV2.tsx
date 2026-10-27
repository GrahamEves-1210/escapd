// The v2 player (gameplay v2, chunk 2): the room in the dark, a torch to find
// things, close-ups with mechanisms to work them, a casebook for what was
// learned, and the real door as the way out. useRoomV2 runs the room: on the
// device for a v1 room planned into a v2 one, on the server for a v2 room;
// either way each request is async and the casebook (cards, hint rungs) comes
// back rendered. When the planner can't build a v2 room from a v1 one it hands
// back to the v1 player (`onFallback`).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import type { ActionResult, ItemDef, ObjectDef, StateValue } from "@/engine/v2";
import type { Genre } from "@/lib/puzzle-types";
import { ModeScope, useModeTheme } from "@/game/mode";
import { useFeedback } from "@/game/feedback";
import { usePreferences } from "@/game/preferences";
import { useSceneSources } from "@/game/useSceneSources";
import type { SceneSource } from "@/render/SceneView";
import { Toast } from "@/render/Toast";
import { ref } from "@/theme/tokens";
import { Casebook } from "./Casebook";
import { Ending } from "./Ending";
import { InspectView, type FoundCard } from "./InspectView";
import { V2 } from "./layout";
import type { MechanismTarget } from "./mechanisms/types";
import { Stage, type StageObject } from "./Stage";
import { useRoomV2, type RoomV2 } from "./useRoomV2";

export interface PlayerV2Props {
  roomId: string;
  onExit: () => void;
  onComplete: (summary: { title: string; ending: string; genre: Genre }) => void;
  onFallback: (reason: string) => void;
}

type Open = { kind: "object"; id: string } | { kind: "item"; id: string };

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
  const { phase, def, scene, state, cards: casebookCards, hints, canHint, completed, ending, busy, error, act, hint, restart, cooldown } = v2;
  const sources = useSceneSources(roomId, scene);

  const [view, setView] = useState(0);
  const [open, setOpen] = useState<Open | null>(null);
  const [lookCards, setLookCards] = useState<FoundCard[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [toasts, setToasts] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [casebook, setCasebook] = useState(false);
  const [revision, setRevision] = useState(0);
  const [aspects, setAspects] = useState<Record<number, number>>({});
  // Glints: on by default; off is the hard way (nothing catches the light). Show interactives keeps a faint outline on everything.
  const [glints, setGlints] = useState(true);
  const { hotspotAssist } = usePreferences();

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
  const take = (result: ActionResult | null, where: "inspect" | "room"): FoundCard[] => {
    const cards: FoundCard[] = [];
    if (!result) return cards;
    const lines: string[] = [];
    setRevision((r) => r + 1);
    switch (result.outcome) {
      case "nothing":
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
          break;
        case "grant": {
          feedback.pickup();
          lines.push(`Found: ${itemById(e.item)?.name ?? "something"}.`);
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
      if (cards.length) setLookCards((c) => [...c, ...cards.filter((n) => !c.some((x) => x.id === n.id))]);
      // Beats and finds also toast, so they're seen after the close-up closes.
      for (const l of lines) if (l.startsWith("Found") || l === "Something changed in the room.") toast(l);
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
    setLookCards([]);
    setNote(null);
    setOpen({ kind: "object", id: objectId });
    take(await act({ type: "inspect", object: objectId }), "inspect");
  };

  const openItem = (itemId: string) => {
    setCasebook(false);
    // An examined item shows its own card, once it has been found.
    const item = itemById(itemId);
    const card = item?.card ? casebookCards.find((c) => c.id === item.card) : undefined;
    setLookCards(card ? [card] : []);
    setNote(null);
    setOpen({ kind: "item", id: itemId });
  };

  const toggleItem = (id: string) => {
    feedback.tick();
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 2 ? [s[1], id] : [...s, id]));
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

  return (
    <View style={[styles.root, { backgroundColor: theme.ground }]} testID="v2-player">
      <View style={[styles.top, { paddingTop: insets.top + ref.space.xs }]}>
        <Pressable onPress={onExit} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={[styles.square, { backgroundColor: theme.raised }]} testID="v2-back">
          <Text style={[ref.type.headline, { color: theme.ink }]}>‹</Text>
        </Pressable>
        <View style={styles.titles}>
          <Text style={[ref.type.serifTitle, { color: theme.ink }]} numberOfLines={1}>{def.title}</Text>
          <Text style={[ref.type.meta, { color: theme.inkMuted }]} numberOfLines={2} testID="v2-objective">{def.objective}</Text>
        </View>
        <Pressable onPress={() => setCasebook(true)} accessibilityRole="button" accessibilityLabel="Casebook" hitSlop={8} style={[styles.square, { backgroundColor: theme.raised }]} testID="v2-casebook-open">
          <Text style={[ref.type.headline, { color: theme.ink }]}>☰</Text>
        </Pressable>
      </View>

      <View style={styles.stage}>
        {source ? (
          <Stage
            key={view}
            source={source}
            cacheKey={photoKey(view)}
            genre={def.mode}
            objects={stageObjects}
            overlays={overlays}
            glints={glints}
            assist={hotspotAssist}
            onLook={look}
            onPage={(dir) => setView((v) => (v + dir + photos) % photos)}
            accessibilityLabel={`View ${view + 1} of ${photos}`}
          />
        ) : null}
        <View style={styles.toasts} pointerEvents="none">
          {toasts.length ? <Toast key={`${toasts.length}-${toasts[0]}`} text={toasts[0]} onHide={() => setToasts((t) => t.slice(1))} /> : null}
        </View>
      </View>

      <View style={[styles.foot, { paddingBottom: insets.bottom + ref.space.sm }]}>
        <View style={styles.pager}>
          <Pressable onPress={() => { feedback.tick(); setView((v) => (v - 1 + photos) % photos); }} accessibilityRole="button" accessibilityLabel="Previous view" hitSlop={8} testID="v2-prev" style={styles.arrow}>
            <Text style={[ref.type.headline, { color: theme.ink }]}>‹</Text>
          </Pressable>
          <Text style={[ref.type.meta, { color: theme.inkMuted }]} testID="v2-view">{`View ${view + 1} of ${photos}`}</Text>
          <Pressable onPress={() => { feedback.tick(); setView((v) => (v + 1) % photos); }} accessibilityRole="button" accessibilityLabel="Next view" hitSlop={8} testID="v2-next" style={styles.arrow}>
            <Text style={[ref.type.headline, { color: theme.ink }]}>›</Text>
          </Pressable>
        </View>
        {selected.length === 1 ? (
          <Text style={[ref.type.meta, styles.instruction, { color: theme.inkMuted }]}>{`Tap something in the room to use the ${itemById(selected[0])?.name ?? "item"}.`}</Text>
        ) : null}
        {selected.length === 2 ? (
          <Pressable onPress={combine} accessibilityRole="button" accessibilityLabel="Fit together" testID="v2-combine" style={[styles.combine, { backgroundColor: theme.accent }]}>
            <Text style={[ref.type.headline, { color: theme.accentInk }]}>Fit together</Text>
          </Pressable>
        ) : null}
        <View style={styles.tray} testID="v2-tray">
          {heldItems.length ? heldItems.map((item) => {
            const on = selected.includes(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => toggleItem(item.id)}
                onLongPress={() => openItem(item.id)}
                accessibilityRole="button"
                accessibilityLabel={item.name}
                accessibilityState={{ selected: on }}
                accessibilityHint="Select to use or fit together; hold to examine."
                testID={`v2-item-${item.id}`}
                style={[styles.chip, { backgroundColor: theme.raised, borderColor: on ? theme.ink : theme.rim, borderWidth: on ? 2 : StyleSheet.hairlineWidth }]}
              >
                <Text style={[ref.type.meta, { color: theme.ink }]} numberOfLines={1}>{item.name}</Text>
              </Pressable>
            );
          }) : (
            <Text style={[ref.type.meta, { color: theme.inkMuted }]}>Drag to shine the light. Tap what catches it.</Text>
          )}
        </View>
      </View>

      {open && target ? (
        <InspectView
          target={target}
          photo={targetObject && sources.kind === "ready" && aspects[targetObject.photo_index] !== undefined
            ? { source: sources.sources[targetObject.photo_index], cacheKey: photoKey(targetObject.photo_index), box: targetObject.box, aspect: aspects[targetObject.photo_index] }
            : targetObject && sources.kind === "ready"
              ? { source: sources.sources[targetObject.photo_index], cacheKey: photoKey(targetObject.photo_index), box: targetObject.box, aspect: 0.75 }
              : undefined}
          genre={def.mode}
          state={targetState}
          cards={lookCards}
          note={note}
          held={heldItems}
          busy={busy}
          cooldown={cooldown}
          finale={targetObject?.exit ? def.finale : undefined}
          ritualChoices={ritualChoices}
          onSet={async (control, value) => take(await act({ type: "set_control", target: target!.id, control, value }), "inspect")}
          onSubmit={async (value) => take(await act({ type: "submit", object: target!.id, value }), "inspect")}
          onUse={async (itemId) => take(await act({ type: "use_item", item: itemId, object: target!.id }), "inspect")}
          onTake={takeable ? async () => take(await act({ type: "set_control", target: target!.id, control: "taken", value: true }), "inspect") : undefined}
          onClose={() => setOpen(null)}
          revision={revision}
        />
      ) : null}

      {casebook ? (
        <Casebook
          objective={def.objective}
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

      {/* The photos' aspects, for the close-up's crop (measured once each, off screen). */}
      <AspectProbe sources={sources.kind === "ready" ? sources.sources : []} known={aspects} onAspect={(i, a) => setAspects((m) => ({ ...m, [i]: a }))} />
    </View>
  );
}

function AspectProbe({ sources, known, onAspect }: { sources: SceneSource[]; known: Record<number, number>; onAspect: (i: number, a: number) => void }) {
  return (
    <View style={styles.probe} pointerEvents="none">
      {sources.map((s, i) =>
        known[i] !== undefined ? null : (
          <ProbeImage key={i} source={s} onAspect={(a) => onAspect(i, a)} />
        ))}
    </View>
  );
}

function ProbeImage({ source, onAspect }: { source: SceneSource; onAspect: (a: number) => void }) {
  // expo-image reports the source size on load.
  return (
    <Image
      source={source}
      style={styles.probeImage}
      onLoad={(e) => {
        const { width, height } = e.source;
        if (width > 0 && height > 0) onAspect(width / height);
      }}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", gap: ref.space.lg },
  back: { minHeight: ref.hit.min, justifyContent: "center" },
  top: { flexDirection: "row", alignItems: "center", gap: ref.space.sm, paddingHorizontal: ref.space.lg, paddingBottom: ref.space.sm },
  titles: { flex: 1, gap: 2 },
  square: { width: ref.hit.min, height: ref.hit.min, borderRadius: ref.radius.square, alignItems: "center", justifyContent: "center" },
  stage: { flex: 1 },
  toasts: { position: "absolute", top: ref.space.sm, left: 0, right: 0, alignItems: "center" },
  foot: { paddingHorizontal: ref.space.lg, paddingTop: ref.space.sm, gap: ref.space.sm },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: ref.space.lg },
  arrow: { minWidth: ref.hit.min, minHeight: ref.hit.min, alignItems: "center", justifyContent: "center" },
  instruction: { textAlign: "center" },
  combine: { minHeight: ref.hit.min, borderRadius: ref.hit.min / 2, alignItems: "center", justifyContent: "center" },
  tray: { flexDirection: "row", flexWrap: "wrap", gap: ref.space.sm, minHeight: V2.tray.height, alignItems: "center", justifyContent: "center" },
  chip: { minHeight: V2.tray.chip, paddingHorizontal: ref.space.lg, borderRadius: V2.tray.chip / 2, justifyContent: "center", maxWidth: 180 },
  probe: { position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" },
  probeImage: { width: 1, height: 1 },
});
