// The immersive player, shared by the tutorial and custom rooms.
//
// It renders schema v1, sends GameActions, and trusts ActionResults. It never
// computes progress: usePlayer replaces state only from a solved result.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Alert, StyleSheet, Switch, Text, View } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ActionResult, GameAction, Hotspot, Id, Puzzle } from "@/lib/puzzle-types";
import { useFeedback } from "@/game/feedback";
import { usePreferences } from "@/game/preferences";
import {
  QUIET_COPY, gainedItems, hotspotA11yLabel, hotspotById, hotspotName, hotspotsForScene,
  inventoryItems, isHotspotSolved, itemName, quietReason, scenesWithHotspots, tapIntent,
} from "@/game/selectors";
import { usePlayer, type LoadError, type Player as PlayerModel } from "@/game/usePlayer";
import { useSceneSources } from "@/game/useSceneSources";
import { useUiMemory } from "@/game/useUiMemory";
import type { CoachContext, CoachStep } from "@/tutorial/coach";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref, z } from "@/theme/tokens";
import { DarkSheet, PillButton } from "@/components/noir";
import { StateScreen } from "@/components/StateScreen";
import {
  ArrowLeftIcon, DotsThreeIcon, ICON_WEIGHT, WarningIcon, WifiSlashIcon,
} from "@/components/icons";
import { CodePad, type CodeOutcome } from "./CodePad";
import { CoachCard } from "./CoachCard";
import { HotspotLayer, type HotspotRef, type Thread } from "./HotspotLayer";
import { InventoryBar } from "./InventoryBar";
import { ResultSheet, type ResultContent } from "./ResultSheet";
import { ScenePager } from "./ScenePager";
import { SceneView, type SceneSource } from "./SceneView";
import { Toast } from "./Toast";
import { Card, NoticeLine, OutlinePill, SquareButton } from "./parts";

const P = ref.layout.play;
const SQ = ref.button.square;
// The squares' 2 pt of slop each side, carried inside the header row.
const SLOP = (SQ.hit - SQ.size) / 2;
// A state screen's glyph: grey, as 02's and 03's, with words; no amber.
const STATE_ICON = P.stateIcon;

export interface CompletionSummary {
  message?: string;
  exitMessage?: string | null;
}

export interface PlayerProps {
  roomId: string;
  /** Tutorial coach marks, derived from server state. */
  coach?: (context: CoachContext) => CoachStep | null;
  onExit: () => void;
  onComplete: (summary: CompletionSummary) => void;
}

export function Player({ roomId, coach, onExit, onComplete }: PlayerProps) {
  const player = usePlayer(roomId);
  const sources = useSceneSources(roomId, player.definition);
  const ui = useUiMemory(roomId);

  if (player.phase.kind === "error") {
    return <LoadErrorScreen error={player.phase.error} onRetry={player.reload} onExit={onExit} />;
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
      <LoadErrorScreen error={{ kind: "offline" }} onRetry={player.reload} onExit={onExit} />
    );
  }
  if (player.phase.kind === "loading" || sources.kind === "loading" || !ui.loaded || !player.definition) {
    return <StateScreen loading title="Opening the case" />;
  }
  return (
    <PlayerStage
      player={player}
      sources={sources.sources}
      ui={ui}
      coach={coach}
      onExit={onExit}
      onComplete={onComplete}
    />
  );
}

function LoadErrorScreen({ error, onRetry, onExit }: { error: LoadError; onRetry: () => void; onExit: () => void }) {
  switch (error.kind) {
    case "offline":
      return (
        <StateScreen
          title="You're offline"
          body="Your progress is saved. Connect to continue the case."
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
          title="The case didn't open"
          body="Something went wrong on our side. Your progress is safe."
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
  | { kind: "result"; content: ResultContent; returnTo?: Id }
  | { kind: "code"; puzzle: Puzzle; hotspotId: Id }
  | { kind: "menu" }
  | null;

const uniq = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);

function PlayerStage({ player, sources, ui, coach, onExit, onComplete }: {
  player: PlayerModel;
  sources: SceneSource[];
  ui: ReturnType<typeof useUiMemory>;
  coach?: PlayerProps["coach"];
  onExit: () => void;
  onComplete: (summary: CompletionSummary) => void;
}) {
  const def = player.definition!;
  const { state } = player;
  const prefs = usePreferences();
  const feedback = useFeedback();
  const { reducedMotion } = useTheme();
  const insets = useSafeAreaInsets();

  const sceneCount = def.photos.length;
  const sceneIndex = Math.min(Math.max(ui.memory.sceneIndex, 0), sceneCount - 1);
  const [picked, setPicked] = useState<Id[]>([]);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const [flash, setFlash] = useState<{ id: Id; key: number }>();
  const [thread, setThread] = useState<Thread | null>(null);
  const [irisId, setIrisId] = useState<Id | null>(null);
  const [fresh, setFresh] = useState<number[]>([]);
  const [chromeHidden, setChromeHidden] = useState(false);
  const [completing, setCompleting] = useState(false);
  // A finger on a code wheel: the code sheet holds its scroll.
  const [wheelDrag, setWheelDrag] = useState(false);
  const hotspotRefs = useRef(new Map<Id, HotspotRef>());
  // False while the view in view is zoomed, so a pan moves the photo, not the pager.
  const pageable = useSharedValue(true);
  const lastAttempt = useRef<Attempt | null>(null);

  // The server may consume a selected item; a selection only ever shows items still held.
  const selected = useMemo(() => picked.filter((id) => state.inventory.includes(id)), [picked, state.inventory]);

  const items = useMemo(() => inventoryItems(def, state), [def, state]);
  const sceneHotspots = useMemo(() => hotspotsForScene(def, state, sceneIndex), [def, state, sceneIndex]);
  // Every view's visible hotspot rects: the loupe's detents and the crop's limit.
  const targetsByScene = useMemo(
    () => def.photos.map((_, i) => hotspotsForScene(def, state, i).map((hotspot) => hotspot.shape)),
    [def, state],
  );
  const solvedIds = useMemo(() => {
    const ids = new Set<Id>();
    for (const hotspot of sceneHotspots) {
      if (isHotspotSolved(def, state, hotspot.id)) ids.add(hotspot.id);
    }
    return ids;
  }, [def, state, sceneHotspots]);
  const coachStep = coach?.({ state, visitedScenes: ui.memory.visited }) ?? null;
  const coachHighlight = coachStep?.target.kind === "hotspot" && coachStep.target.photoIndex === sceneIndex
    ? coachStep.target.hotspotId : undefined;
  const coachScene = coachStep && coachStep.target.kind !== "inventory" ? coachStep.target.photoIndex : undefined;
  const markedScenes = uniq(coachScene !== undefined ? [...fresh, coachScene] : fresh);
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

  const goToScene = useCallback((index: number) => {
    if (index === sceneIndex) return;
    setThread(null);
    setIrisId(null);
    ui.update({ sceneIndex: index, visited: uniq([...ui.memory.visited, index]) });
    setFresh((f) => f.filter((s) => s !== index));
  }, [sceneIndex, ui]);

  const closeSheet = useCallback(() => {
    const returnTo = sheet?.kind === "result" ? sheet.returnTo : sheet?.kind === "code" ? sheet.hotspotId : undefined;
    setSheet(null);
    setThread(null);
    setIrisId(null);
    if (!returnTo) return;
    // Focus goes back to the hotspot the action came from.
    setTimeout(() => {
      const node = hotspotRefs.current.get(returnTo);
      if (node) AccessibilityInfo.sendAccessibilityEvent(node, "focus");
    }, reducedMotion ? 120 : 360);
  }, [sheet, reducedMotion]);

  const complete = useCallback((result: ActionResult) => {
    setSheet(null);
    setPicked([]);
    setCompleting(true);
    // A replay starts from the first view.
    ui.forget();
    setTimeout(
      () => onComplete({ message: result.message, exitMessage: result.exit_message }),
      reducedMotion ? 300 : motion.completionPullBack + 250,
    );
  }, [onComplete, reducedMotion, ui]);

  /**
   * Presentation for a solved result. Returns null when the room is complete
   * (the completion sequence takes over).
   */
  const afterSolved = useCallback((result: ActionResult, hotspotId?: Id) => {
    const next = result.state ?? state;
    feedback.success();
    if (hotspotId) setFlash({ id: hotspotId, key: Date.now() });
    const gained = gainedItems(def, next, result.gained_items);
    if (gained.length) {
      AccessibilityInfo.announceForAccessibility(`${gained.map((g) => g.name).join(", ")} added to your items.`);
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
      complete(result);
      return null;
    }
    const revealed: ResultContent["revealed"] = revealedScenes.length === 0
      ? "none" : revealedScenes.includes(sceneIndex) ? "here" : "elsewhere";
    return { gained, revealed };
  }, [def, state, sceneIndex, feedback, complete]);

  const act = useCallback(async (action: GameAction, attempt: Attempt) => {
    lastAttempt.current = attempt;
    const outcome = await player.send(action);
    return outcome.kind === "result" ? outcome.result : null;
  }, [player]);

  const inspect = useCallback(async (hotspot: Hotspot) => {
    const result = await act({ type: "inspect", hotspot_id: hotspot.id }, { kind: "inspect", hotspot });
    if (!result) return;
    const title = hotspotName(hotspot);
    if (result.outcome === "solved") {
      const after = afterSolved(result, hotspot.id);
      if (after) {
        setSheet({ kind: "result", returnTo: hotspot.id, content: { title, objectLabel: hotspot.object_label, message: result.message, ...after } });
      }
    } else if (result.outcome === "nothing") {
      setSheet({
        kind: "result",
        returnTo: hotspot.id,
        content: {
          title,
          objectLabel: hotspot.object_label,
          description: hotspot.description,
          quiet: QUIET_COPY[quietReason(def, state, hotspot.id)],
          gained: [],
          revealed: "none",
        },
      });
    } else {
      showToast(result.message ?? "That isn't possible yet.");
    }
  }, [act, afterSolved, def, state, showToast]);

  const applyItem = useCallback(async (itemId: Id, hotspot: Hotspot) => {
    const result = await act({ type: "use_item", item_id: itemId, hotspot_id: hotspot.id }, { kind: "use", itemId, hotspot });
    if (!result) return;
    if (result.outcome === "solved") {
      setPicked([]);
      const after = afterSolved(result, hotspot.id);
      if (after) {
        setSheet({ kind: "result", returnTo: hotspot.id, content: { title: hotspotName(hotspot), objectLabel: hotspot.object_label, message: result.message, ...after } });
      }
    } else if (result.outcome === "nothing") {
      // Stay in Use mode so the player can try somewhere else.
      feedback.warning();
      showToast("That doesn't work here.");
    } else {
      setPicked([]);
      feedback.warning();
      showToast(result.message ?? "You can't do that.");
    }
  }, [act, afterSolved, feedback, showToast]);

  const combineItems = useCallback(async (items: [Id, Id]) => {
    const result = await act({ type: "combine", item_ids: items }, { kind: "combine", items });
    if (!result) return;
    setPicked([]);
    if (result.outcome === "solved") {
      const after = afterSolved(result);
      const title = def.puzzles.find((p) => p.id === result.puzzle_id)?.title ?? "Combined";
      if (after) setSheet({ kind: "result", content: { title, objectLabel: "note", message: result.message, ...after } });
    } else if (result.outcome === "nothing") {
      feedback.warning();
      showToast("These don't fit together.");
    } else {
      feedback.warning();
      showToast(result.message ?? "You can't combine those.");
    }
  }, [act, afterSolved, def, feedback, showToast]);

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
    // The press haptic came on press-in (HotspotLayer's onPressIn).
    if (player.pending || completing) return;
    if (selected.length === 1) {
      applyItem(selected[0], hotspot);
      return;
    }
    if (selected.length === 2) {
      showToast("Combine the two items, or cancel.");
      return;
    }
    const intent = tapIntent(def, state, hotspot.id);
    if (intent.kind === "code") {
      setSheet({ kind: "code", puzzle: intent.puzzle, hotspotId: hotspot.id });
      return;
    }
    inspect(hotspot);
  }, [player.pending, completing, selected, applyItem, showToast, def, state, inspect]);

  const submitCode = useCallback(async (answer: string): Promise<CodeOutcome> => {
    if (sheet?.kind !== "code") return { kind: "invalid", message: "That puzzle is not available." };
    const { puzzle, hotspotId } = sheet;
    const outcome = await player.send({ type: "solve", puzzle_id: puzzle.id, answer });
    if (outcome.kind !== "result") {
      player.dismissFailure();
      return {
        kind: "failed",
        message: outcome.kind === "failed" && outcome.offline
          ? "No connection. Your progress is safe. Try again."
          : "That didn't go through. Try again.",
      };
    }
    const result = outcome.result;
    if (result.outcome === "wrong") {
      feedback.error();
      return { kind: "wrong", message: result.message ?? "Nothing happens." };
    }
    if (result.outcome === "solved") {
      const hotspot = hotspotById(def, hotspotId);
      const after = afterSolved(result, hotspotId);
      if (after) {
        setSheet({
          kind: "result",
          returnTo: hotspotId,
          content: { title: puzzle.title ?? (hotspot ? hotspotName(hotspot) : "Solved"), objectLabel: hotspot?.object_label, message: result.message, ...after },
        });
      }
      return { kind: "solved" };
    }
    return { kind: "invalid", message: result.message ?? "That doesn't work right now." };
  }, [sheet, player, feedback, def, afterSolved]);

  const toggleItem = useCallback((id: Id) => {
    feedback.tick();
    setPicked((raw) => {
      const sel = raw.filter((x) => state.inventory.includes(x));
      if (sel.includes(id)) return sel.filter((x) => x !== id);
      return sel.length >= 2 ? [sel[1], id] : [...sel, id];
    });
  }, [feedback, state.inventory]);

  const confirmRestart = useCallback(() => {
    Alert.alert("Restart this case?", "Your progress in this case will be cleared. You can replay it any time.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Restart",
        style: "destructive",
        onPress: () => {
          setSheet(null);
          ui.reset();
          player.restart().catch(() => showToast("Couldn't restart. Check your connection."));
        },
      },
    ]);
  }, [ui, player, showToast]);

  const labelFor = useCallback((h: Hotspot) => hotspotA11yLabel(
    def, state, h, useItemName ? { kind: "use", itemName: useItemName } : { kind: "default" },
  ), [def, state, useItemName]);

  const modal = sheet !== null;
  const codeHotspot = sheet?.kind === "code" ? hotspotById(def, sheet.hotspotId) : undefined;

  return (
    <View style={styles.root}>
      <Animated.View
        style={[styles.topBar, { paddingTop: insets.top + P.top }, chromeStyle]}
        importantForAccessibility={modal ? "no-hide-descendants" : "auto"}
      >
        <SquareButton icon={ArrowLeftIcon} accessibilityLabel="Back" onPress={onExit} testID="player-back" />
        <View style={styles.prompt}>
          <Text numberOfLines={1} accessibilityRole="header" style={styles.title}>
            {def.title ?? "Untitled case"}
          </Text>
          {/* The photo's own label and the page dots say which view this is. */}
          <Text numberOfLines={1} style={styles.meta} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {`View ${sceneIndex + 1} of ${sceneCount}`}
          </Text>
        </View>
        <SquareButton icon={DotsThreeIcon} accessibilityLabel="Case options" onPress={() => setSheet({ kind: "menu" })} testID="player-options" />
      </Animated.View>

      <View style={styles.scene} importantForAccessibility={modal ? "no-hide-descendants" : "auto"}>
        <ScenePager
          count={sceneCount}
          index={sceneIndex}
          onIndexChange={goToScene}
          marked={markedScenes}
          pageable={pageable}
          disabled={completing}
          overlay={toast ? <Toast key={toast.key} text={toast.text} onHide={hideToast} /> : null}
          renderPage={(i, active, onWindow, pager) => (
            <SceneView
              source={sources[i]}
              accessibilityLabel={`View ${i + 1} of ${sceneCount}`}
              active={active}
              armed={active && selected.length === 1}
              loupeTargets={targetsByScene[i]}
              onInteractionChange={setChromeHidden}
              pulledBack={active && completing}
              pageable={pageable}
              onWindow={onWindow}
              pagerGesture={pager}
            >
              {(stage) => (
                <HotspotLayer
                  hotspots={sceneHotspots}
                  stage={stage}
                  persistent={prefs.hotspotAssist || selected.length === 1}
                  highlightId={coachHighlight}
                  flash={flash}
                  solvedIds={solvedIds}
                  irisId={irisId ?? undefined}
                  thread={thread ?? undefined}
                  labelFor={labelFor}
                  onPress={onHotspotPress}
                  onPressIn={feedback.press}
                  registerRef={registerRef}
                />
              )}
            </SceneView>
          )}
        />
      </View>

      <Animated.View
        style={[styles.bottom, { paddingBottom: insets.bottom + P.band.foot }, bottomStyle]}
        importantForAccessibility={modal ? "no-hide-descendants" : "auto"}
      >
        {player.failed ? (
          <FailureBanner
            offline={player.failed.offline}
            onRetry={retryLastAttempt}
            onDismiss={player.dismissFailure}
          />
        ) : coachStep && selected.length === 0 ? (
          // The use card or the worktable takes the coach's place while an item is chosen,
          // so the photo keeps its height; the coach's target stays highlighted on the photo.
          <CoachCard text={coachStep.text} />
        ) : null}
        <InventoryBar
          items={items}
          selected={selected}
          onToggle={toggleItem}
          onCombine={combine}
          onCancel={() => setPicked([])}
          busy={player.pending?.type === "combine"}
        />
      </Animated.View>

      {sheet?.kind === "result" ? <ResultSheet content={sheet.content} onClose={closeSheet} /> : null}
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

/** 02's error line on 07's card, with 07's outlined pill to retry and a quiet Dismiss. */
function FailureBanner({ offline, onRetry, onDismiss }: { offline: boolean; onRetry: () => void; onDismiss: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(motion.reducedFade)} style={styles.edge} accessibilityLiveRegion="polite">
      <Card style={styles.banner} testID="failure-banner">
        <NoticeLine
          icon={offline ? WifiSlashIcon : WarningIcon}
          text={offline ? "No connection. Your progress is safe." : "That didn't go through. Your progress is safe."}
        />
        <View style={styles.bannerActions}>
          <OutlinePill label="Try again" onPress={onRetry} testID="failure-retry" />
          <PillButton variant="quiet" ground="dark" label="Dismiss" onPress={onDismiss} padX={ref.space.sm} />
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
      <PillButton variant="quiet" ground="dark" label="Restart this case" onPress={onRestart} testID="options-restart" />
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
  // The photo area: full width, from band.photo under the squares.
  scene: { flex: 1, marginTop: P.band.photo - SLOP },
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
