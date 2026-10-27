// The immersive player for every room.
//
// It renders schema v1, sends GameActions, and trusts ActionResults. It never
// computes progress: usePlayer replaces state only from a solved result.
//
// Modes (docs/DESIGN.md, Modes): the case's genre comes from its definition
// (absent means noir) and sets the active mode, so every part takes the
// mode's ground, ink, accent and stamp, and the photos show in its baked
// treatment. Crime scene adds the Suspects sheet and the Accuse screen;
// paranormal adds the hotspot effects and the presence meter, and on case
// closed the room snaps back to its own colours.
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { AccessibilityInfo, Alert, Platform, StyleSheet, Switch, Text, View } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UsersThreeIcon } from "phosphor-react-native/src/icons/UsersThree";
import type { ActionResult, Genre, GameAction, HintProgress, Hotspot, Id, Puzzle } from "@/lib/puzzle-types";
import { useFeedback } from "@/game/feedback";
import { genreOf, setMode, themeFor, useMode } from "@/game/mode";
import { usePreferences } from "@/game/preferences";
import {
  accusePuzzle, canAccuse, gainedItems, hotspotA11yLabel, hotspotById, hotspotName, hotspotsForScene,
  inventoryItems, isHotspotSolved, itemName, newlyContradicted, presence as presenceOf, quietReason,
  scenesWithHotspots, suspectCards, tapIntent, type SuspectCard,
} from "@/game/selectors";
import { usePlayer, type LoadError, type Player as PlayerModel } from "@/game/usePlayer";
import { useSceneSources } from "@/game/useSceneSources";
import { useUiMemory } from "@/game/useUiMemory";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref, z } from "@/theme/tokens";
import { DarkSheet, TreatedImage, useFadeIn } from "@/components/noir";
import { ModePill } from "@/capture/ui/ModePill";
import { StateScreen } from "@/components/StateScreen";
import {
  ArrowLeftIcon, DotsThreeIcon, ICON_WEIGHT, WarningIcon, WifiSlashIcon,
} from "@/components/icons";
import { AccuseScreen, type Accusation, type AccuseOutcome } from "./AccuseScreen";
import { CaseClock } from "./CaseClock";
import type { Snapshot } from "./ClueObjects";
import { NOT_ENOUGH_TO_ACCUSE, WRONG_ACCUSATION } from "./accuse";
import { stashClosedCase } from "./closedCase";
import { CodePad, type CodeOutcome } from "./CodePad";
import { EffectLayer } from "./EffectLayer";
import { HotspotLayer, type HotspotRef, type Thread } from "./HotspotLayer";
import { glintTargets, useIdle } from "./idle";
import { InformantSheet, Matchbook } from "./Informant";
import { ladderFrom, type Ladder } from "./informantLadder";
import { InventoryBar, type SlotRef } from "./InventoryBar";
import { PickupFlight, flightRects, measureInWindow, type Flight } from "./PickupFlight";
import { PresenceMeter } from "./PresenceMeter";
import { RemovalLayer } from "./RemovalLayer";
import { useRoomRemoval } from "./removalPatch";
import { ResultSheet, type ResultContent } from "./ResultSheet";
import { ScenePager } from "./ScenePager";
import { SceneView, type SceneSource } from "./SceneView";
import { SuspectsSheet } from "./SuspectsSheet";
import { Toast } from "./Toast";
import { PLAY_COPY, failedLine, playVoice, type PlayVoice } from "./voice";
import { Card, NoticeLine, SquareButton } from "./parts";

const P = ref.layout.play;
const SQ = ref.button.square;
// The squares' 2 pt of slop each side, carried inside the header row.
const SLOP = (SQ.hit - SQ.size) / 2;
// A state screen's glyph: grey, as 02's and 03's, with words; no amber.
const STATE_ICON = P.stateIcon;

export interface CompletionSummary {
  message?: string;
  exitMessage?: string | null;
  /** The case's mode (its definition's genre; noir when it has none). */
  genre: Genre;
  title?: string;
  /** Crime scene: the suspect the player accused. */
  accused?: Id;
}

export interface PlayerProps {
  roomId: string;
  onExit: () => void;
  onComplete: (summary: CompletionSummary) => void;
}

export function Player({ roomId, onExit, onComplete }: PlayerProps) {
  const player = usePlayer(roomId);
  const sources = useSceneSources(roomId, player.definition);
  const ui = useUiMemory(roomId);
  // Before the definition says the case's mode, the screen it was opened from does (noir outside a mode).
  const voice = playVoice(useMode());

  if (player.phase.kind === "error") {
    return <LoadErrorScreen error={player.phase.error} voice={voice} onRetry={player.reload} onExit={onExit} />;
  }
  if (sources.kind === "error") {
    return sources.reason === "missing_asset" ? (
      <StateScreen
        title="This case needs an update"
        body="Update ESCAPD to open it."
        icon={<WarningIcon size={STATE_ICON} weight={ICON_WEIGHT} color={ref.color.textSecondary} />}
        primary={{ label: "Back", onPress: onExit }}
      />
    ) : (
      <LoadErrorScreen error={{ kind: "offline" }} voice={voice} onRetry={player.reload} onExit={onExit} />
    );
  }
  if (player.phase.kind === "loading" || sources.kind === "loading" || !ui.loaded || !player.definition) {
    return <StateScreen loading title={voice.loading} />;
  }
  return (
    <PlayerStage
      roomId={roomId}
      player={player}
      sources={sources.sources}
      ui={ui}
      onExit={onExit}
      onComplete={onComplete}
    />
  );
}

function LoadErrorScreen({ error, voice, onRetry, onExit }: { error: LoadError; voice: PlayVoice; onRetry: () => void; onExit: () => void }) {
  switch (error.kind) {
    case "offline":
      return (
        <StateScreen
          title={voice.offlineTitle}
          body={PLAY_COPY.offlineBody}
          icon={<WifiSlashIcon size={STATE_ICON} weight={ICON_WEIGHT} color={ref.color.textSecondary} />}
          primary={{ label: "Try again", onPress: onRetry }}
          secondary={{ label: "Back", onPress: onExit }}
        />
      );
    case "unsupported":
      return (
        <StateScreen
          title="This case can't be opened here"
          body="It was made for a newer version of ESCAPD. Update the app to play it."
          icon={<WarningIcon size={STATE_ICON} weight={ICON_WEIGHT} color={ref.color.textSecondary} />}
          primary={{ label: "Back", onPress: onExit }}
        />
      );
    case "not_found":
    case "not_ready":
      return (
        <StateScreen
          title="This case isn't ready"
          body="It may still be building, or it was deleted."
          primary={{ label: "Back", onPress: onExit }}
        />
      );
    default:
      return (
        <StateScreen
          title={voice.failedTitle}
          body={PLAY_COPY.failedBody}
          icon={<WarningIcon size={STATE_ICON} weight={ICON_WEIGHT} color={ref.color.textSecondary} />}
          primary={{ label: "Try again", onPress: onRetry }}
          secondary={{ label: "Back", onPress: onExit }}
        />
      );
  }
}

/** The last action sent, so a failed request can be retried exactly. */
type Attempt =
  | { kind: "inspect"; hotspot: Hotspot }
  | { kind: "use"; itemId: Id; hotspot: Hotspot }
  | { kind: "combine"; items: [Id, Id] };

type SheetState =
  // `solved`: it opens on a solve's success haptic, so its paper cue waits a beat.
  // `key`: each result is its own sheet, never one still sliding away with new content.
  | { kind: "result"; content: ResultContent; returnTo?: Id; solved?: boolean; key?: number }
  | { kind: "code"; puzzle: Puzzle; hotspotId: Id }
  | { kind: "menu" }
  | { kind: "informant" }
  | { kind: "suspects" }
  // Opened from the Suspects sheet (closing goes back to it) or from a case-board hotspot.
  | { kind: "accuse"; puzzle: Puzzle; from: "suspects" | { hotspotId: Id } }
  | null;

const uniq = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);

/** The sheet up, and a count that gives each result sheet its own key. */
function nextSheet(prev: { sheet: SheetState; seq: number }, next: SheetState): { sheet: SheetState; seq: number } {
  if (next === null && prev.sheet === null) return prev;
  const seq = prev.seq + 1;
  return { sheet: next?.kind === "result" ? { ...next, key: seq } : next, seq };
}

/** Items a solve gave up, held off the tray until its clue is pocketed, and the object they came out of. */
interface PendingPickup {
  ids: Id[];
  hotspotId?: Id;
}

function PlayerStage({ roomId, player, sources, ui, onExit, onComplete }: {
  roomId: string;
  player: PlayerModel;
  sources: SceneSource[];
  ui: ReturnType<typeof useUiMemory>;
  onExit: () => void;
  onComplete: (summary: CompletionSummary) => void;
}) {
  const def = player.definition!;
  const { state } = player;
  // The newest state, for async work (a pickup measuring) that outlives the render it started in.
  const latestState = useRef(state);
  const prefs = usePreferences();
  const feedback = useFeedback();
  const { reducedMotion } = useTheme();
  const insets = useSafeAreaInsets();

  // The case's mode. Set before paint, so no part ever draws in the last mode's colours.
  const genre = genreOf(def);
  const theme = themeFor(genre);
  const voice = playVoice(genre);
  useLayoutEffect(() => setMode(genre), [genre]);

  const sceneCount = def.photos.length;
  const sceneIndex = Math.min(Math.max(ui.memory.sceneIndex, 0), sceneCount - 1);
  // The view in view, for async work to see whether it changed under it.
  const sceneRef = useRef(sceneIndex);
  const [picked, setPicked] = useState<Id[]>([]);
  // Every result opens as a new sheet (its own key), so one never takes over a sheet still sliding away.
  const [{ sheet }, setSheet] = useReducer(nextSheet, { sheet: null, seq: 0 });

  // Taken objects leave the room (docs/DESIGN.md, Game feel · 4a): the room's
  // one removable object, once its patch is baked, is gone while its inspect
  // is solved, from the moment its clue is pocketed (the sheet closes, as the
  // items fly out of it). Derived from state, so a resumed case shows it gone.
  const removal = useRoomRemoval(def, sources, genre);
  const taken = removal && state.solved.includes(removal.puzzleId) ? removal : null;
  const goneId = taken && !(sheet?.kind === "result" && sheet.returnTo === taken.hotspotId) ? taken.hotspotId : null;
  const goneIds = useMemo<ReadonlySet<Id>>(() => new Set(goneId ? [goneId] : []), [goneId]);
  // Taken on this visit, with the patch ready: it fades out on the full removal fade.
  const [takenLive, setTakenLive] = useState(false);
  const removalRef = useRef(removal);
  const takenRef = useRef<Id | null>(null);
  useLayoutEffect(() => {
    latestState.current = state;
    sceneRef.current = sceneIndex;
    removalRef.current = removal;
    takenRef.current = taken?.hotspotId ?? null;
  });
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const [flash, setFlash] = useState<{ id: Id; key: number }>();
  const [thread, setThread] = useState<Thread | null>(null);
  const [irisId, setIrisId] = useState<Id | null>(null);
  const [fresh, setFresh] = useState<number[]>([]);
  const [chromeHidden, setChromeHidden] = useState(false);
  const [completing, setCompleting] = useState(false);
  // Crime scene: the accusation held; the accused card comes forward under GUILTY.
  const [revealed, setRevealed] = useState<SuspectCard | null>(null);
  // Paranormal: the presence is gone; the room shows in its own colours.
  const [cleared, setCleared] = useState(false);
  // A finger on a code wheel: the code sheet holds its scroll.
  const [wheelDrag, setWheelDrag] = useState(false);
  const hotspotRefs = useRef(new Map<Id, HotspotRef>());
  // The evidence tray's slots and the player's root, for the pickup's flight.
  const slotRefs = useRef(new Map<Id, SlotRef>());
  const rootRef = useRef<HotspotRef>(null);
  // Items granted but not in the tray yet: they land when the clue is pocketed (the sheet closes).
  const [arriving, setArriving] = useState<ReadonlySet<Id>>(() => new Set());
  // What each solve gave up, by the object it came out of, until the clue is pocketed.
  const pendingPickup = useRef<PendingPickup[]>([]);
  // The flights in the air: state to draw them, mirrored in a ref so a landing
  // is read and removed outside any state updater (a landing reported twice
  // lands once, and its cue never runs inside React's render).
  const [flights, setFlightState] = useState<Flight[]>([]);
  const flightsRef = useRef<Flight[]>([]);
  const setFlights = useCallback((next: Flight[]) => {
    flightsRef.current = next;
    setFlightState(next);
  }, []);
  const flightSeq = useRef(0);
  // Bumped by a restart and on unmount: a pickup still measuring when it changes is dropped.
  const pickupEpoch = useRef(0);
  const alive = useRef(true);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      pickupEpoch.current += 1;
      if (focusTimer.current) clearTimeout(focusTimer.current);
    };
  }, []);
  // Hotspots tapped on this visit: the idle glint passes over them.
  const [tapped, setTapped] = useState<ReadonlySet<Id>>(() => new Set());
  // The informant's tips so far, from the session row until he is asked (then from his answers).
  const [ladderState, setLadderState] = useState<{ sessionId: string; ladder: Ladder } | null>(null);
  const sessionId = player.session?.id ?? null;
  const ladder = ladderState && ladderState.sessionId === sessionId
    ? ladderState.ladder
    : ladderFrom(player.session?.hint_progress as HintProgress | undefined);
  // False while the view in view is zoomed, so a pan moves the photo, not the pager.
  const pageable = useSharedValue(true);
  const lastAttempt = useRef<Attempt | null>(null);

  // The server may consume a selected item; a selection only ever shows items still held.
  const selected = useMemo(() => picked.filter((id) => state.inventory.includes(id)), [picked, state.inventory]);

  const items = useMemo(() => inventoryItems(def, state), [def, state]);
  const sceneHotspots = useMemo(() => hotspotsForScene(def, state, sceneIndex), [def, state, sceneIndex]);
  // Every view's visible hotspot rects: the loupe's detents and the crop's limit.
  const targetsByScene = useMemo(
    () => def.photos.map((_, i) => hotspotsForScene(def, state, i).filter((h) => h.id !== goneId).map((hotspot) => hotspot.shape)),
    [def, state, goneId],
  );
  const solvedIds = useMemo(() => {
    const ids = new Set<Id>();
    for (const hotspot of sceneHotspots) {
      if (isHotspotSolved(def, state, hotspot.id)) ids.add(hotspot.id);
    }
    return ids;
  }, [def, state, sceneHotspots]);
  const accuse = useMemo(() => accusePuzzle(def), [def]);
  const suspects = useMemo(() => suspectCards(def, state), [def, state]);
  const accuseOpen = canAccuse(def, state);
  const broken = suspects.filter((s) => s.contradicted).length;
  const presence = useMemo(() => presenceOf(def, state), [def, state]);
  const useItemName = selected.length === 1 ? itemName(def, state, selected[0]) : undefined;

  const chromeOpacity = useSharedValue(1);
  useEffect(() => {
    chromeOpacity.set(withTiming(chromeHidden || completing ? 0 : 1, { duration: reducedMotion ? motion.reducedFade : 220 }));
  }, [chromeHidden, completing, reducedMotion, chromeOpacity]);
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chromeOpacity.get() }));
  const bottomOpacity = useSharedValue(1);
  useEffect(() => {
    bottomOpacity.set(withTiming(completing ? 0 : 1, { duration: reducedMotion ? motion.reducedFade : 300 }));
  }, [completing, reducedMotion, bottomOpacity]);
  const bottomStyle = useAnimatedStyle(() => ({ opacity: bottomOpacity.get() }));

  const showToast = useCallback((text: string) => setToast({ text, key: Date.now() }), []);
  const hideToast = useCallback(() => setToast(null), []);

  const registerRef = useCallback((id: Id, node: HotspotRef | null) => {
    if (node) hotspotRefs.current.set(id, node);
    else hotspotRefs.current.delete(id);
  }, []);

  const registerSlot = useCallback((id: Id, node: SlotRef | null) => {
    if (node) slotRefs.current.set(id, node);
    else slotRefs.current.delete(id);
  }, []);

  /** Items reach the tray: their tiles bounce in, with the pickup cue (`cue` false: a group's cue already came). */
  const land = useCallback((ids: Id[], cue = true) => {
    if (!ids.length || !alive.current) return;
    if (cue) feedback.pickup();
    setArriving((prev) => {
      if (!ids.some((id) => prev.has(id))) return prev;
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, [feedback]);

  /** A flight has landed. Once per key: a second report, or one after a restart, does nothing. */
  const onLanded = useCallback((key: number) => {
    const all = flightsRef.current;
    const done = all.find((f) => f.key === key);
    if (!done) return;
    const rest = all.filter((f) => f.key !== key);
    setFlights(rest);
    // Items pocketed together land together: one cue, from the last of them.
    land([done.item.id], !rest.some((f) => f.group === done.group));
  }, [land, setFlights]);

  /**
   * The pocketed items fly from the object into their tray slots. Under
   * reduced motion, or when a position can't be measured, they simply land.
   * Measuring is async: if the player restarted or left meanwhile, nothing
   * flies; if the view changed or the object went, the items land.
   */
  const launchPickup = useCallback(async () => {
    const groups = pendingPickup.current;
    pendingPickup.current = [];
    for (const pending of groups) {
      const source = pending.hotspotId ? hotspotRefs.current.get(pending.hotspotId) : undefined;
      if (reducedMotion || !source) {
        land(pending.ids);
        continue;
      }
      const epoch = pickupEpoch.current;
      const scene = sceneRef.current;
      const [root, from, ...slots] = await Promise.all([
        measureInWindow(rootRef.current),
        measureInWindow(source),
        ...pending.ids.map((id) => measureInWindow(slotRefs.current.get(id))),
      ]);
      if (!alive.current || epoch !== pickupEpoch.current) return;
      const moved = scene !== sceneRef.current || hotspotRefs.current.get(pending.hotspotId!) !== source;
      const items = inventoryItems(def, latestState.current);
      const group = (flightSeq.current += 1);
      const launched: Flight[] = [];
      const grounded: Id[] = [];
      pending.ids.forEach((id, i) => {
        const rects = moved ? null : flightRects(root, from, slots[i] ?? null);
        const item = items.find((it) => it.id === id);
        // An item no longer held (used or combined meanwhile) has nothing to land.
        if (!item) return;
        if (!rects || !slotRefs.current.get(id)) {
          grounded.push(id);
          return;
        }
        launched.push({ key: (flightSeq.current += 1), group, item, ...rects });
      });
      // Gone from the inventory: no longer on its way to the tray.
      const gone = pending.ids.filter((id) => !items.some((it) => it.id === id));
      if (gone.length) land(gone, false);
      land(grounded);
      if (launched.length) setFlights([...flightsRef.current, ...launched]);
    }
  }, [reducedMotion, land, def, setFlights]);

  const goToScene = useCallback((index: number) => {
    if (index === sceneIndex) return;
    setThread(null);
    setIrisId(null);
    ui.update({ sceneIndex: index, visited: uniq([...ui.memory.visited, index]) });
    setFresh((f) => f.filter((s) => s !== index));
  }, [sceneIndex, ui]);

  const closeSheet = useCallback(() => {
    if (sheet?.kind === "accuse" && sheet.from === "suspects") {
      setSheet({ kind: "suspects" });
      return;
    }
    const returnTo = sheet?.kind === "result" ? sheet.returnTo
      : sheet?.kind === "code" ? sheet.hotspotId
        : sheet?.kind === "accuse" && sheet.from !== "suspects" ? sheet.from.hotspotId : undefined;
    setSheet(null);
    setThread(null);
    setIrisId(null);
    // Pocketing the clue: what it gave up goes into the tray.
    launchPickup();
    // A taken object has left the room: there is nothing to go back to.
    if (!returnTo || returnTo === takenRef.current) return;
    // Focus goes back to the hotspot the action came from, if it is still on screen then.
    if (focusTimer.current) clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => {
      focusTimer.current = null;
      if (!alive.current) return;
      const node = hotspotRefs.current.get(returnTo);
      // The web has no sendAccessibilityEvent.
      if (!node || Platform.OS === "web") return;
      try {
        AccessibilityInfo.sendAccessibilityEvent(node, "focus");
      } catch {}
    }, reducedMotion ? 120 : 360);
  }, [sheet, reducedMotion, launchPickup]);

  /**
   * The case is closed. Noir pulls the photo back and hands off; crime scene
   * holds the reveal (the accused under GUILTY) first; paranormal snaps the
   * room back to its own colours and holds "The presence is gone." first.
   */
  const complete = useCallback((result: ActionResult, accused?: SuspectCard) => {
    if (!accused) setSheet(null);
    setPicked([]);
    setCompleting(true);
    if (genre === "paranormal") {
      setCleared(true);
      AccessibilityInfo.announceForAccessibility("The presence is gone.");
    }
    // A replay starts from the first view.
    ui.forget();
    stashClosedCase({
      roomId,
      genre,
      title: def.title,
      accused: accused
        ? { id: accused.id, name: accused.name, role: accused.role, alibi: accused.alibi, contradicted: accused.contradicted }
        : undefined,
      photo: sources[0],
    });
    const hold = accused
      ? (reducedMotion ? P.reveal.holdReduced : P.reveal.hold)
      : genre === "paranormal"
        ? (reducedMotion ? P.gone.holdReduced : P.gone.hold)
        : (reducedMotion ? 300 : motion.completionPullBack + 250);
    setTimeout(
      () => onComplete({ message: result.message, exitMessage: result.exit_message, genre, title: def.title, accused: accused?.id }),
      hold,
    );
  }, [genre, ui, roomId, def.title, sources, reducedMotion, onComplete]);

  /**
   * Presentation for a solved result. Returns null when the room is complete
   * (the completion sequence takes over).
   */
  const afterSolved = useCallback((result: ActionResult, hotspotId?: Id, accused?: SuspectCard) => {
    const next = result.state ?? state;
    feedback.success();
    if (hotspotId) setFlash({ id: hotspotId, key: Date.now() });
    if (result.puzzle_id && result.puzzle_id === removalRef.current?.puzzleId) setTakenLive(true);
    const gained = gainedItems(def, next, result.gained_items);
    if (gained.length) {
      AccessibilityInfo.announceForAccessibility(`${gained.map((g) => g.name).join(", ")} added to your evidence.`);
      if (!result.completed) {
        // Held off the tray until the clue is pocketed; then they fly in from the object.
        const ids = gained.map((g) => g.id);
        pendingPickup.current = [...pendingPickup.current, { ids, hotspotId }];
        setArriving((prev) => new Set([...prev, ...ids]));
      }
    }
    const revealedScenes = scenesWithHotspots(def, result.revealed_hotspots);
    const revealedId = result.revealed_hotspots?.[0];
    if (hotspotId && revealedId) {
      const source = hotspotById(def, hotspotId);
      const target = hotspotById(def, revealedId);
      if (source && target && source.photo_index === target.photo_index) {
        setIrisId(revealedId);
        setThread({
          x1: source.shape.x + source.shape.w / 2,
          y1: source.shape.y + source.shape.h / 2,
          x2: target.shape.x + target.shape.w / 2,
          y2: target.shape.y + target.shape.h / 2,
        });
      }
    }
    const elsewhere = revealedScenes.filter((s) => s !== sceneIndex);
    if (elsewhere.length) setFresh((f) => uniq([...f, ...elsewhere]));
    if (result.completed) {
      complete(result, accused);
      return null;
    }
    const revealed: ResultContent["revealed"] = revealedScenes.length === 0
      ? "none" : revealedScenes.includes(sceneIndex) ? "here" : "elsewhere";
    const contradicted = newlyContradicted(def, state, next).map((s) => s.name);
    const presenceRose = presenceOf(def, next).found > presenceOf(def, state).found;
    const accuseReady = !canAccuse(def, state) && canAccuse(def, next);
    return { gained, revealed, contradicted, presenceRose, accuseReady };
  }, [def, state, sceneIndex, feedback, complete]);

  const act = useCallback(async (action: GameAction, attempt: Attempt) => {
    lastAttempt.current = attempt;
    const outcome = await player.send(action);
    return outcome.kind === "result" ? outcome.result : null;
  }, [player]);

  /** The object as a polaroid on its clue: the room photo cropped to it, in the mode's treatment. */
  const snapshotOf = useCallback((hotspot: Hotspot): Snapshot | undefined => {
    const source = sources[hotspot.photo_index];
    if (source === undefined) return undefined;
    return {
      source,
      cacheKey: photoKey(def.photos[hotspot.photo_index]),
      genre,
      treated: !cleared,
      shape: hotspot.shape,
      caption: hotspotName(hotspot),
    };
  }, [sources, def, genre, cleared]);

  const inspect = useCallback(async (hotspot: Hotspot) => {
    const result = await act({ type: "inspect", hotspot_id: hotspot.id }, { kind: "inspect", hotspot });
    if (!result) return;
    const title = hotspotName(hotspot);
    const snapshot = snapshotOf(hotspot);
    if (result.outcome === "solved") {
      const after = afterSolved(result, hotspot.id);
      if (after) {
        setSheet({ kind: "result", solved: true, returnTo: hotspot.id, content: { title, objectLabel: hotspot.object_label, message: result.message, snapshot, ...after } });
      }
    } else if (result.outcome === "nothing") {
      setSheet({
        kind: "result",
        returnTo: hotspot.id,
        content: {
          title,
          objectLabel: hotspot.object_label,
          description: hotspot.description,
          quiet: voice.quiet[quietReason(def, state, hotspot.id)],
          gained: [],
          revealed: "none",
          snapshot,
        },
      });
    } else {
      showToast(result.message ?? PLAY_COPY.notYet);
    }
  }, [act, afterSolved, def, state, showToast, snapshotOf, voice]);

  const applyItem = useCallback(async (itemId: Id, hotspot: Hotspot) => {
    const result = await act({ type: "use_item", item_id: itemId, hotspot_id: hotspot.id }, { kind: "use", itemId, hotspot });
    if (!result) return;
    if (result.outcome === "solved") {
      setPicked([]);
      const after = afterSolved(result, hotspot.id);
      if (after) {
        setSheet({
          kind: "result",
          solved: true,
          returnTo: hotspot.id,
          content: { title: hotspotName(hotspot), objectLabel: hotspot.object_label, message: result.message, snapshot: snapshotOf(hotspot), ...after },
        });
      }
    } else if (result.outcome === "nothing") {
      // Stay in Use mode so the player can try somewhere else.
      feedback.warning();
      showToast(voice.useNothing);
    } else {
      setPicked([]);
      feedback.warning();
      showToast(result.message ?? PLAY_COPY.wontWork);
    }
  }, [act, afterSolved, feedback, showToast, snapshotOf, voice]);

  const combineItems = useCallback(async (items: [Id, Id]) => {
    const result = await act({ type: "combine", item_ids: items }, { kind: "combine", items });
    if (!result) return;
    setPicked([]);
    if (result.outcome === "solved") {
      const after = afterSolved(result);
      const title = def.puzzles.find((p) => p.id === result.puzzle_id)?.title ?? "Combined";
      if (after) setSheet({ kind: "result", solved: true, content: { title, objectLabel: "note", message: result.message, ...after } });
    } else if (result.outcome === "nothing") {
      feedback.warning();
      showToast(voice.combineNothing);
    } else {
      feedback.warning();
      showToast(result.message ?? PLAY_COPY.wontCombine);
    }
  }, [act, afterSolved, def, feedback, showToast, voice]);

  const combine = useCallback(() => {
    if (selected.length === 2) combineItems([selected[0], selected[1]]);
  }, [selected, combineItems]);

  /** Re-runs the exact attempt that failed to reach the server. */
  const retryLastAttempt = useCallback(() => {
    const attempt = lastAttempt.current;
    if (attempt?.kind === "inspect") inspect(attempt.hotspot);
    else if (attempt?.kind === "use") applyItem(attempt.itemId, attempt.hotspot);
    else if (attempt?.kind === "combine") combineItems(attempt.items);
  }, [inspect, applyItem, combineItems]);

  const onHotspotPress = useCallback((hotspot: Hotspot) => {
    // The tick came on press-in (HotspotLayer's onPressIn); the outcome brings its own.
    // Never while a sheet is up or still sliding away (it lets touches through as it goes):
    // a result arriving then would land in the sheet that is leaving.
    if (player.pending || completing || sheet !== null) return;
    setTapped((prev) => (prev.has(hotspot.id) ? prev : new Set([...prev, hotspot.id])));
    if (selected.length === 1) {
      applyItem(selected[0], hotspot);
      return;
    }
    if (selected.length === 2) {
      showToast(PLAY_COPY.twoPicked);
      return;
    }
    const intent = tapIntent(def, state, hotspot.id);
    if (intent.kind === "code") {
      setSheet({ kind: "code", puzzle: intent.puzzle, hotspotId: hotspot.id });
      return;
    }
    if (intent.kind === "accuse") {
      setSheet({ kind: "accuse", puzzle: intent.puzzle, from: { hotspotId: hotspot.id } });
      return;
    }
    inspect(hotspot);
  }, [player.pending, completing, sheet, selected, applyItem, showToast, def, state, inspect]);

  const submitCode = useCallback(async (answer: string): Promise<CodeOutcome> => {
    if (sheet?.kind !== "code") return { kind: "invalid", message: PLAY_COPY.notYet };
    const { puzzle, hotspotId } = sheet;
    const outcome = await player.send({ type: "solve", puzzle_id: puzzle.id, answer });
    if (outcome.kind !== "result") {
      player.dismissFailure();
      return { kind: "failed", message: failedLine(voice, outcome.kind === "failed" && outcome.offline, "retry") };
    }
    const result = outcome.result;
    if (result.outcome === "wrong") {
      // CodePad gives the wrongCode cue (the thud and the buzz) itself.
      return { kind: "wrong", message: result.message ?? voice.codeWrong };
    }
    if (result.outcome === "solved") {
      // CodePad plays its unlock latch first, then runs this (the success haptic, the result, the scene change).
      return {
        kind: "solved",
        proceed: () => {
          const hotspot = hotspotById(def, hotspotId);
          const after = afterSolved(result, hotspotId);
          if (after) {
            setSheet({
              kind: "result",
              solved: true,
              returnTo: hotspotId,
              content: {
                title: puzzle.title ?? (hotspot ? hotspotName(hotspot) : "Solved"),
                objectLabel: hotspot?.object_label,
                message: result.message,
                snapshot: hotspot ? snapshotOf(hotspot) : undefined,
                ...after,
              },
            });
          }
        },
      };
    }
    return { kind: "invalid", message: result.message ?? PLAY_COPY.notYet };
  }, [sheet, player, def, afterSolved, snapshotOf, voice]);

  /** Crime scene's accusation, as submitCode: failures stay inline on the Accuse screen. */
  const submitAccuse = useCallback(async ({ suspect, motive, method }: Accusation): Promise<AccuseOutcome> => {
    if (sheet?.kind !== "accuse") return { kind: "invalid", message: NOT_ENOUGH_TO_ACCUSE };
    const { puzzle } = sheet;
    const outcome = await player.send({ type: "accuse", puzzle_id: puzzle.id, suspect_id: suspect, motive_id: motive, method_id: method });
    if (outcome.kind !== "result") {
      player.dismissFailure();
      return { kind: "failed", message: failedLine(voice, outcome.kind === "failed" && outcome.offline, "retry") };
    }
    const result = outcome.result;
    if (result.outcome === "wrong") {
      feedback.error();
      // Never the server's wording: a wrong accusation never says which part was wrong.
      return { kind: "wrong", message: WRONG_ACCUSATION, retryAfter: result.retry_after };
    }
    if (result.outcome === "invalid" && result.reason === "cooldown") {
      feedback.warning();
      return { kind: "cooldown", retryAfter: result.retry_after };
    }
    if (result.outcome === "solved") {
      const accused = suspects.find((s) => s.id === suspect);
      if (result.completed && accused) setRevealed(accused);
      const after = afterSolved(result, undefined, accused);
      if (after) {
        setSheet({ kind: "result", solved: true, content: { title: puzzle.title ?? "The accusation", message: result.message, ...after } });
      }
      return { kind: "solved" };
    }
    return { kind: "invalid", message: result.message ?? NOT_ENOUGH_TO_ACCUSE };
  }, [sheet, player, feedback, suspects, afterSolved, voice]);

  const toggleItem = useCallback((id: Id) => {
    feedback.tick();
    setPicked((raw) => {
      const sel = raw.filter((x) => state.inventory.includes(x));
      if (sel.includes(id)) return sel.filter((x) => x !== id);
      return sel.length >= 2 ? [sel[1], id] : [...sel, id];
    });
  }, [feedback, state.inventory]);

  const confirmRestart = useCallback(() => {
    Alert.alert(PLAY_COPY.restartTitle, PLAY_COPY.restartBody, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Restart",
        style: "destructive",
        onPress: () => {
          setSheet(null);
          pickupEpoch.current += 1;
          pendingPickup.current = [];
          setArriving(new Set());
          setFlights([]);
          setTapped(new Set());
          ui.reset();
          player.restart().catch(() => showToast("Couldn't restart. Check your connection."));
        },
      },
    ]);
  }, [ui, player, showToast, setFlights]);

  const labelFor = useCallback((h: Hotspot) => hotspotA11yLabel(
    def, state, h, useItemName ? { kind: "use", itemName: useItemName } : { kind: "default" },
  ), [def, state, useItemName]);

  const modal = sheet !== null;
  // The idle glint: after a quiet spell, the visible objects still to find catch the light once.
  const idle = useIdle(P.glint.idle, !modal && !completing && !player.pending);
  const glint = idle.idleKey !== null ? { key: idle.idleKey, ids: glintTargets(goneId ? sceneHotspots.filter((h) => h.id !== goneId) : sceneHotspots, solvedIds, tapped) } : undefined;
  const idleTouch = idle.touch;
  const idleCapture = useCallback(() => {
    idleTouch();
    return false;
  }, [idleTouch]);
  const startedAt = player.session?.started_at ? Date.parse(player.session.started_at) : NaN;
  const openInformant = useCallback(() => {
    feedback.paper();
    setSheet({ kind: "informant" });
  }, [feedback]);
  const codeHotspot = sheet?.kind === "code" ? hotspotById(def, sheet.hotspotId) : undefined;
  const suspectsLabel = [
    "Suspects",
    broken > 0 ? `, ${broken} ${broken === 1 ? "alibi" : "alibis"} broken` : "",
    accuseOpen ? ". You can accuse" : "",
  ].join("");

  return (
    <View
      ref={rootRef}
      collapsable={false}
      // Any touch (a mouse press on the web) restarts the idle glint's wait; it never takes the touch.
      onTouchStart={idle.touch}
      onStartShouldSetResponderCapture={idleCapture}
      style={[styles.root, { backgroundColor: theme.ground }]} testID={`player-${genre}`}>
      <Animated.View
        style={[styles.topBar, { paddingTop: insets.top + P.top, backgroundColor: theme.ground }, chromeStyle]}
        importantForAccessibility={modal ? "no-hide-descendants" : "auto"}
      >
        <SquareButton icon={ArrowLeftIcon} accessibilityLabel="Back" onPress={onExit} testID="player-back" />
        <View style={styles.prompt}>
          <Text numberOfLines={1} accessibilityRole="header" style={[styles.title, { color: theme.ink }]}>
            {def.title ?? "Untitled case"}
          </Text>
          <View style={styles.metaRow}>
            {genre === "paranormal" && presence.total > 0 ? (
              // The presence takes the view line's place: the thumbnail wheel already says which view this is.
              <PresenceMeter presence={presence} gone={cleared} />
            ) : (
              // The photo's own label and the thumbnail wheel say which view this is.
              <Text numberOfLines={1} style={[styles.meta, { color: theme.inkMuted }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {`View ${sceneIndex + 1} of ${sceneCount}`}
              </Text>
            )}
            {/* The case clock: its own component, so its tick re-renders only itself. */}
            {prefs.caseClock && Number.isFinite(startedAt) ? <CaseClock since={startedAt} /> : null}
          </View>
        </View>
        {accuse ? (
          <View style={styles.squares}>
            <SquareButton
              icon={UsersThreeIcon}
              caption="Suspects"
              accessibilityLabel={suspectsLabel}
              accessibilityHint="Opens the suspects, their alibis, and the accusation."
              badge={broken > 0 ? String(broken) : undefined}
              onPress={() => setSheet({ kind: "suspects" })}
              testID="player-suspects"
            />
            <SquareButton icon={DotsThreeIcon} accessibilityLabel="Case options" onPress={() => setSheet({ kind: "menu" })} testID="player-options" />
          </View>
        ) : (
          <SquareButton icon={DotsThreeIcon} accessibilityLabel="Case options" onPress={() => setSheet({ kind: "menu" })} testID="player-options" />
        )}
      </Animated.View>

      <View style={styles.scene} importantForAccessibility={modal ? "no-hide-descendants" : "auto"}>
        <ScenePager
          count={sceneCount}
          index={sceneIndex}
          onIndexChange={goToScene}
          marked={fresh}
          pageable={pageable}
          disabled={completing}
          overlay={toast ? <Toast key={toast.key} text={toast.text} onHide={hideToast} /> : null}
          renderThumb={(i) => (
            // The wheel's thumbnail: the same treatment, baked once small.
            <TreatedImage
              source={sources[i]}
              genre={genre}
              original={cleared}
              cacheKey={photoKey(def.photos[i])}
              maxEdge={P.wheel.bake}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessible={false}
            />
          )}
          renderPage={(i, active, onWindow, pager) => (
            <SceneView
              source={sources[i]}
              genre={genre}
              treated={!cleared}
              cacheKey={photoKey(def.photos[i])}
              accessibilityLabel={`View ${i + 1} of ${sceneCount}`}
              active={active}
              armed={active && selected.length === 1}
              loupeTargets={targetsByScene[i]}
              onInteractionChange={setChromeHidden}
              pulledBack={active && completing}
              pageable={pageable}
              onWindow={onWindow}
              pagerGesture={pager}
              backdrop={removal && goneId && !cleared && removal.photoIndex === i ? (stage, inLoupe) => (
                <RemovalLayer patch={removal} stage={stage} live={takenLive} testID={inLoupe ? undefined : `removed-${removal.hotspotId}`} />
              ) : undefined}
            >
              {(stage) => (
                <>
                  <EffectLayer hotspots={sceneHotspots} stage={stage} gone={cleared} />
                  <HotspotLayer
                    hotspots={sceneHotspots}
                    stage={stage}
                    persistent={prefs.hotspotAssist || selected.length === 1}
                    flash={flash}
                    solvedIds={solvedIds}
                    goneIds={goneIds}
                    irisId={irisId ?? undefined}
                    thread={thread ?? undefined}
                    labelFor={labelFor}
                    onPress={onHotspotPress}
                    onPressIn={feedback.tick}
                    registerRef={registerRef}
                    glint={glint}
                  />
                </>
              )}
            </SceneView>
          )}
        />
        {cleared ? <PresenceGone /> : null}
      </View>

      <Animated.View
        style={[styles.bottom, { paddingBottom: insets.bottom + P.band.foot, backgroundColor: theme.ground }, bottomStyle]}
        importantForAccessibility={modal ? "no-hide-descendants" : "auto"}
      >
        {player.failed ? (
          <FailureBanner
            text={failedLine(voice, player.failed.offline, "safe")}
            offline={player.failed.offline}
            onRetry={retryLastAttempt}
            onDismiss={player.dismissFailure}
          />
        ) : null}
        <InventoryBar
          items={items}
          selected={selected}
          onToggle={toggleItem}
          onCombine={combine}
          onCancel={() => setPicked([])}
          busy={player.pending?.type === "combine"}
          arriving={arriving}
          registerSlot={registerSlot}
          lip={prefs.hints_enabled && sessionId ? <Matchbook genre={genre} onPress={openInformant} /> : null}
        />
      </Animated.View>

      {flights.map((flight) => <PickupFlight key={flight.key} flight={flight} onLanded={onLanded} />)}

      {sheet?.kind === "result" ? (
        <ResultSheet key={sheet.key} content={sheet.content} onClose={closeSheet} paperDelay={sheet.solved ? P.clue.paperDelay : 0} />
      ) : null}
      {sheet?.kind === "informant" ? (
        <InformantSheet
          genre={genre}
          sessionId={sessionId}
          solved={state.solved}
          ladder={ladder}
          onLadder={(next) => sessionId && setLadderState({ sessionId, ladder: next })}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet?.kind === "code" ? (
        <DarkSheet
          title={sheet.puzzle.title ?? (codeHotspot ? hotspotName(codeHotspot) : "Enter the code")}
          titleStyle="serif"
          meta={codeHotspot ? hotspotName(codeHotspot) : undefined}
          onClose={closeSheet}
          maxHeight="90%"
          testID="code-sheet"
          scrollEnabled={!wheelDrag}
        >
          <CodePad puzzle={sheet.puzzle} items={items} onSubmit={submitCode} onWheelDrag={setWheelDrag} />
        </DarkSheet>
      ) : null}
      {sheet?.kind === "suspects" && accuse ? (
        <SuspectsSheet
          suspects={suspects}
          motives={accuse.motives ?? []}
          methods={accuse.methods ?? []}
          canAccuse={accuseOpen}
          onAccuse={() => setSheet({ kind: "accuse", puzzle: accuse, from: "suspects" })}
          onClose={closeSheet}
        />
      ) : null}
      {sheet?.kind === "accuse" ? (
        <AccuseScreen
          puzzle={sheet.puzzle}
          suspects={suspects}
          items={items}
          onSubmit={submitAccuse}
          onClose={closeSheet}
          revealed={revealed}
        />
      ) : null}
      {sheet?.kind === "menu" ? (
        <CaseOptions
          hotspotAssist={prefs.hotspotAssist}
          onHotspotAssist={(on) => {
            feedback.tick();
            prefs.setHotspotAssist(on);
          }}
          onRestart={confirmRestart}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </View>
  );
}

/** A stable id for a photo whose signed URL changes: its photo id. Bundled photos need none. */
function photoKey(photo: { photo_id: string } | { asset_key: string }) {
  return "photo_id" in photo ? `photo:${photo.photo_id}` : undefined;
}

/** Paranormal's case closed, over the room as it snaps back to its own colours. */
function PresenceGone() {
  const { reducedMotion } = useTheme();
  const theme = themeFor("paranormal");
  const G = P.gone;
  return (
    <View style={styles.goneSlot} pointerEvents="none">
      <Animated.View
        entering={FadeIn.duration(reducedMotion ? motion.reducedFade : ref.motion.treatment.duration * 2).delay(reducedMotion ? 0 : ref.motion.treatment.duration)}
        style={styles.gone}
        testID="presence-gone"
      >
        <View style={[StyleSheet.absoluteFill, styles.goneFill, { backgroundColor: theme.ground, opacity: G.fillOpacity }]} />
        <Text style={[P.type.gone, { color: theme.ink }]}>The presence is gone.</Text>
      </Animated.View>
    </View>
  );
}

/**
 * 02's error line on 07's card, with the guide's pill (the mode's accent, hugging its label) to retry and a quiet Dismiss.
 * It fades in on a shared value, not an `entering` layout animation: it shares the tray's column (see InventoryBar).
 */
function FailureBanner({ text, offline, onRetry, onDismiss }: { text: string; offline: boolean; onRetry: () => void; onDismiss: () => void }) {
  const fade = useFadeIn(motion.reducedFade);
  return (
    <Animated.View style={[styles.edge, fade]} accessibilityLiveRegion="polite">
      <Card style={styles.banner} testID="failure-banner">
        <NoticeLine
          icon={offline ? WifiSlashIcon : WarningIcon}
          text={text}
        />
        <View style={styles.bannerActions}>
          <ModePill variant="ghost" fullWidth={false} label="Try again" onPress={onRetry} testID="failure-retry" />
          <ModePill variant="quiet" ground="dark" label="Dismiss" onPress={onDismiss} padX={ref.space.sm} />
        </View>
      </Card>
    </Animated.View>
  );
}

/** The kit's dark sheet: Show interactives (the hub sheet's switch) and Restart (quiet). */
function CaseOptions({ hotspotAssist, onHotspotAssist, onRestart, onClose }: {
  hotspotAssist: boolean;
  onHotspotAssist: (on: boolean) => void;
  onRestart: () => void;
  onClose: () => void;
}) {
  const sw = ref.layout.hub.sheet.switch;
  return (
    <DarkSheet title="Case options" onClose={onClose} testID="case-options">
      <View style={styles.optionRow}>
        <View style={styles.optionText}>
          {/* The switch carries this label, so screen readers don't hear it twice. */}
          <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.optionLabel}>Show interactives</Text>
          <Text style={styles.optionDetail}>Keep the marks on objects you can use visible.</Text>
        </View>
        <Switch
          value={hotspotAssist}
          onValueChange={onHotspotAssist}
          accessibilityLabel="Show interactives"
          trackColor={{ true: sw.on, false: sw.off }}
          thumbColor={sw.thumb}
          ios_backgroundColor={sw.off}
          testID="options-show-interactives"
        />
      </View>
      <ModePill variant="quiet" ground="dark" label="Restart this case" onPress={onRestart} testID="options-restart" />
    </DarkSheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ref.color.ground },
  // 02's header row: squares `edge` from the screen edges, their slop inside the row.
  topBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: P.edge,
    paddingBottom: SLOP,
    zIndex: z.chrome,
    backgroundColor: ref.color.ground,
  },
  prompt: { flex: 1, marginHorizontal: ref.space.sm, paddingTop: P.promptTop, alignItems: "center", gap: P.metaGap },
  title: { ...ref.type.serifTitle, color: ref.color.textPrimary, textAlign: "center" },
  meta: { ...ref.type.meta, color: ref.color.textSecondary, textAlign: "center" },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: P.clock.gap },
  // Crime scene: Suspects, then Case options, the squares' slop apart.
  squares: { flexDirection: "row", gap: ref.space.sm },
  // The photo area: full width, from band.photo under the squares.
  scene: { flex: 1, marginTop: P.band.photo - SLOP },
  goneSlot: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", zIndex: z.toast },
  gone: { paddingHorizontal: P.gone.padX, paddingVertical: P.gone.padY, borderRadius: ref.radius.round, overflow: "hidden", ...ref.curve },
  goneFill: { borderRadius: ref.radius.round },
  bottom: {
    gap: P.band.row,
    paddingTop: P.band.tray,
    backgroundColor: ref.color.ground,
    zIndex: z.tray,
  },
  edge: { marginHorizontal: ref.space.edge },
  banner: { gap: ref.space.sm, paddingVertical: P.card.padY },
  bannerActions: { flexDirection: "row", alignItems: "center", gap: ref.space.sm },
  optionRow: { flexDirection: "row", alignItems: "center", gap: ref.space.lg },
  optionText: { flex: 1, gap: ref.space.xs },
  optionLabel: { ...ref.type.body, color: ref.color.textPrimary },
  optionDetail: { ...ref.type.meta, color: ref.color.textSecondary },
});
