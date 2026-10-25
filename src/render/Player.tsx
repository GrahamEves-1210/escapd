// The immersive player, shared by the tutorial and custom rooms.
//
// It renders schema v1, sends GameActions, and trusts ActionResults. It never
// computes progress: usePlayer replaces state only from a solved result.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Alert, StyleSheet, Switch, View } from "react-native";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ActionResult, GameAction, Hotspot, Id, Puzzle } from "@/lib/puzzle-types";
import { useFeedback } from "@/game/feedback";
import { usePreferences } from "@/game/preferences";
import {
  QUIET_COPY, exploreEntries, gainedItems, hotspotA11yLabel, hotspotById, hotspotName, hotspotsForScene,
  inventoryItems, isHotspotSolved, itemName, quietReason, scenesWithHotspots, tapIntent, type ExploreEntry,
} from "@/game/selectors";
import { usePlayer, type LoadError, type Player as PlayerModel } from "@/game/usePlayer";
import { useSceneSources } from "@/game/useSceneSources";
import { useUiMemory } from "@/game/useUiMemory";
import type { CoachContext, CoachStep } from "@/tutorial/coach";
import { useTheme } from "@/theme/ThemeProvider";
import { color, font, motion, space, z } from "@/theme/tokens";
import { Button } from "@/components/Button";
import { Grain } from "@/components/Grain";
import { IconButton } from "@/components/IconButton";
import { Sheet } from "@/components/Sheet";
import { StateScreen } from "@/components/StateScreen";
import { Text } from "@/components/Text";
import {
  ArrowLeftIcon, DotsThreeIcon, ICON_SIZE, ICON_WEIGHT, ListBulletsIcon, WarningIcon, WifiSlashIcon,
} from "@/components/icons";
import { CodePad, type CodeOutcome } from "./CodePad";
import { CoachCard } from "./CoachCard";
import { ExploreList, type ExploreAction } from "./ExploreList";
import { HotspotLayer, type HotspotRef, type Thread } from "./HotspotLayer";
import { InventoryBar } from "./InventoryBar";
import { ResultSheet, type ResultContent } from "./ResultSheet";
import { SceneStrip } from "./SceneStrip";
import { SceneView, type SceneSource } from "./SceneView";
import { Toast } from "./Toast";

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
        icon={<WarningIcon size={32} weight={ICON_WEIGHT} color={color.warning} />}
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
          icon={<WifiSlashIcon size={32} weight={ICON_WEIGHT} color={color.textSecondary} />}
          primary={{ label: "Try again", onPress: onRetry }}
          secondary={{ label: "Back", onPress: onExit }}
        />
      );
    case "unsupported":
      return (
        <StateScreen
          title="This case can't be opened here"
          body="It was made for a newer version of ESCAPD. Update the app to play it."
          icon={<WarningIcon size={32} weight={ICON_WEIGHT} color={color.warning} />}
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
          icon={<WarningIcon size={32} weight={ICON_WEIGHT} color={color.warning} />}
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
  | { kind: "explore" }
  | { kind: "menu" }
  | null;

const uniq = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);

function sceneEntering(direction: number, reduced: boolean) {
  if (reduced) return FadeIn.duration(motion.reducedFade);
  return () => {
    "worklet";
    return {
      initialValues: { opacity: 0, transform: [{ translateX: direction * motion.sceneDrift }] },
      animations: {
        opacity: withTiming(1, { duration: motion.sceneCrossfade }),
        transform: [{ translateX: withTiming(0, { duration: motion.sceneCrossfade }) }],
      },
    };
  };
}

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
  const [direction, setDirection] = useState(1);
  const [picked, setPicked] = useState<Id[]>([]);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const [flash, setFlash] = useState<{ id: Id; key: number }>();
  const [thread, setThread] = useState<Thread | null>(null);
  const [irisId, setIrisId] = useState<Id | null>(null);
  const [fresh, setFresh] = useState<number[]>([]);
  const [chromeHidden, setChromeHidden] = useState(false);
  const [completing, setCompleting] = useState(false);
  const hotspotRefs = useRef(new Map<Id, HotspotRef>());
  const lastAttempt = useRef<Attempt | null>(null);

  // The server may consume a selected item; a selection only ever shows items still held.
  const selected = useMemo(() => picked.filter((id) => state.inventory.includes(id)), [picked, state.inventory]);

  const items = useMemo(() => inventoryItems(def, state), [def, state]);
  const sceneHotspots = useMemo(() => hotspotsForScene(def, state, sceneIndex), [def, state, sceneIndex]);
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
    setDirection(index > sceneIndex ? 1 : -1);
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
      showToast("That doesn't work here.");
    } else {
      setPicked([]);
      showToast(result.message ?? "You can't do that.");
    }
  }, [act, afterSolved, showToast]);

  const combineItems = useCallback(async (items: [Id, Id]) => {
    const result = await act({ type: "combine", item_ids: items }, { kind: "combine", items });
    if (!result) return;
    setPicked([]);
    if (result.outcome === "solved") {
      const after = afterSolved(result);
      const title = def.puzzles.find((p) => p.id === result.puzzle_id)?.title ?? "Combined";
      if (after) setSheet({ kind: "result", content: { title, objectLabel: "note", message: result.message, ...after } });
    } else if (result.outcome === "nothing") {
      showToast("These don't fit together.");
    } else {
      showToast(result.message ?? "You can't combine those.");
    }
  }, [act, afterSolved, def, showToast]);

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
    if (player.pending || completing) return;
    feedback.tap();
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
  }, [player.pending, completing, feedback, selected, applyItem, showToast, def, state, inspect]);

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
      feedback.warning();
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
    feedback.tap();
    setPicked((raw) => {
      const sel = raw.filter((x) => state.inventory.includes(x));
      if (sel.includes(id)) return sel.filter((x) => x !== id);
      return sel.length >= 2 ? [sel[1], id] : [...sel, id];
    });
  }, [feedback, state.inventory]);

  const onExploreAction = useCallback((entry: ExploreEntry, action: ExploreAction) => {
    setSheet(null);
    goToScene(entry.photoIndex);
    setTimeout(() => {
      if (action === "use" && selected.length === 1) applyItem(selected[0], entry.hotspot);
      else if (action === "code" && entry.intent.kind === "code") {
        setSheet({ kind: "code", puzzle: entry.intent.puzzle, hotspotId: entry.hotspot.id });
      } else inspect(entry.hotspot);
    }, reducedMotion ? 60 : 260);
  }, [goToScene, selected, applyItem, inspect, reducedMotion]);

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
        style={[styles.topBar, { paddingTop: insets.top + space.xs }, chromeStyle]}
        importantForAccessibility={modal ? "no-hide-descendants" : "auto"}
      >
        <IconButton
          accessibilityLabel="Back"
          onPress={onExit}
          icon={<ArrowLeftIcon size={ICON_SIZE} weight={ICON_WEIGHT} color={color.text} />}
        />
        <Text variant="sectionTitle" numberOfLines={1} accessibilityRole="header" style={styles.title}>
          {def.title ?? "Untitled case"}
        </Text>
        <IconButton
          accessibilityLabel="Explore as list"
          onPress={() => setSheet({ kind: "explore" })}
          icon={<ListBulletsIcon size={ICON_SIZE} weight={ICON_WEIGHT} color={color.text} />}
        />
        <IconButton
          accessibilityLabel="Case options"
          onPress={() => setSheet({ kind: "menu" })}
          icon={<DotsThreeIcon size={ICON_SIZE} weight="bold" color={color.text} />}
        />
      </Animated.View>

      <View style={styles.scene} importantForAccessibility={modal ? "no-hide-descendants" : "auto"}>
        <Animated.View
          key={sceneIndex}
          entering={sceneEntering(direction, reducedMotion)}
          exiting={FadeOut.duration(reducedMotion ? motion.reducedFade : motion.sceneCrossfade)}
          style={StyleSheet.absoluteFill}
        >
          <SceneView
            source={sources[sceneIndex]}
            accessibilityLabel={`Plate ${sceneIndex + 1} of ${sceneCount}`}
            plateIndex={sceneIndex}
            plateCount={sceneCount}
            armed={selected.length === 1}
            loupeTargets={sceneHotspots.map((hotspot) => hotspot.shape)}
            onInteractionChange={setChromeHidden}
            pulledBack={completing}
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
                registerRef={registerRef}
              />
            )}
          </SceneView>
        </Animated.View>
        {toast ? <Toast key={toast.key} text={toast.text} onHide={hideToast} /> : null}
      </View>

      <Animated.View
        style={[styles.bottom, { paddingBottom: insets.bottom + space.sm }, bottomStyle]}
        importantForAccessibility={modal ? "no-hide-descendants" : "auto"}
      >
        <Grain />
        {player.failed ? (
          <FailureBanner
            offline={player.failed.offline}
            onRetry={retryLastAttempt}
            onDismiss={player.dismissFailure}
          />
        ) : coachStep ? (
          <CoachCard text={coachStep.text} />
        ) : null}
        <SceneStrip sources={sources} index={sceneIndex} marked={markedScenes} onSelect={goToScene} />
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
        <Sheet
          title={sheet.puzzle.title ?? (codeHotspot ? hotspotName(codeHotspot) : "Enter the code")}
          eyebrow={codeHotspot ? hotspotName(codeHotspot) : undefined}
          onClose={closeSheet}
          maxHeight="90%"
          testID="code-sheet"
        >
          <CodePad puzzle={sheet.puzzle} items={items} onSubmit={submitCode} />
        </Sheet>
      ) : null}
      {sheet?.kind === "explore" ? (
        <ExploreList
          entries={exploreEntries(def, state)}
          sceneCount={sceneCount}
          useItemName={useItemName}
          onAction={onExploreAction}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet?.kind === "menu" ? (
        <CaseOptions
          hotspotAssist={prefs.hotspotAssist}
          onHotspotAssist={prefs.setHotspotAssist}
          onExplore={() => setSheet({ kind: "explore" })}
          onRestart={confirmRestart}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </View>
  );
}

function FailureBanner({ offline, onRetry, onDismiss }: { offline: boolean; onRetry: () => void; onDismiss: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(motion.reducedFade)} style={styles.banner} accessibilityLiveRegion="polite">
      <WifiSlashIcon size={18} weight={ICON_WEIGHT} color={color.warning} />
      <Text variant="caption" style={styles.bannerText}>
        {offline ? "No connection. Your progress is safe." : "That didn't go through. Your progress is safe."}
      </Text>
      <Button label="Try again" variant="secondary" onPress={onRetry} />
      <Button label="Dismiss" variant="quiet" onPress={onDismiss} />
    </Animated.View>
  );
}

function CaseOptions({ hotspotAssist, onHotspotAssist, onExplore, onRestart, onClose }: {
  hotspotAssist: boolean;
  onHotspotAssist: (on: boolean) => void;
  onExplore: () => void;
  onRestart: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="Case options" titleStyle="utility" onClose={onClose} testID="case-options">
      <View style={styles.optionRow}>
        <View style={styles.optionText}>
          <Text variant="control">Show interactives</Text>
          <Text variant="caption" tone="secondary">Keep the marks on objects you can use visible.</Text>
        </View>
        <Switch
          value={hotspotAssist}
          onValueChange={onHotspotAssist}
          accessibilityLabel="Show interactives"
          trackColor={{ true: color.accent, false: color.hairline }}
          thumbColor={color.text}
        />
      </View>
      <Button label="Explore as list" variant="secondary" onPress={onExplore} />
      <Button label="Restart this case" variant="destructive" onPress={onRestart} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.canvas },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingBottom: space.xs,
    zIndex: z.chrome,
    backgroundColor: color.canvas,
  },
  title: { flex: 1, textAlign: "center", fontFamily: font.display },
  scene: { flex: 1 },
  bottom: {
    gap: space.md,
    paddingTop: space.md,
    backgroundColor: "#100E0C",
    borderTopWidth: 1,
    borderTopColor: color.hairline,
    zIndex: z.tray,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: space.sm,
    marginHorizontal: space.gutter,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: 10,
    backgroundColor: color.raised,
    borderLeftWidth: 2,
    borderLeftColor: color.warning,
  },
  bannerText: { flex: 1, minWidth: 140, color: color.text },
  optionRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  optionText: { flex: 1, gap: space.xxs },
});
