// 02 · Camera (docs/DESIGN.md 02): the rangefinder, guided capture one plate
// at a time, mounted by /capture once camera access is granted. In Once's
// look (docs/refs/02-camera.png): the flat ref.color.ground; square header
// buttons around the serif plate prompt; the big rounded black viewfinder with
// the live feed; flash, the 0.5 / 1.0 segment and the framing grid; then the
// italic photo counter (Arabic numerals), the glowing shutter with its
// magnifying glass and the last-photo thumbnail. Every photo is re-encoded on
// the phone (EXIF and location dropped) before it is added. Photos keep their
// slots (src/capture/roll.ts): the next shot fills the first open slot, and
// its prompt and counter are that slot's. With ?retake=<slot> it takes
// exactly that slot (replacing its photo in place, or filling it when the
// player removed it) and returns to the review screen ("Photos").
// Inside a mode the screen takes the mode's colours (src/capture/ui/palette.ts):
// its ground, raised buttons and inks, the counter's numeral and the way-on
// ring in the mode's stamp colour, and the last photo in the mode's baked
// treatment. The live feed itself is never treated.
// The player turns all the way round the room, a photo at each stop: the
// lens in use sets how many and how far (the roll's plan, src/capture/roll.ts
// and turn.ts: 5 photos 72 apart on 0.5x, the default where the phone has
// one; 6 60 apart on 1x) and the turn dial on the feed shows the stops and,
// where the phone's motion can be read, how far the player has turned since
// the last photo's shutter. A lens switch mid-roll keeps the photos taken
// where they are and re-spaces the stops still to take for the new lens (the
// count never drops below the photos taken); once every stop is taken a
// switch changes nothing. The turn prompts and the live turn only apply when the next
// photo follows the one the player just took here; otherwise (an open slot, a
// removed last photo, a camera reopened on photos already taken) the prompt
// places the photo by its neighbours and the dial marks its place, static.
// Feedback: the shutter cue (a thud and the shutter's sound) as it fires,
// error on a failed shot, success when the plan's last photo fills the set, tick on
// flash, grid and lens changes and when a turn is far enough, press on the
// square buttons and the thumbnail (inside those components).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  BackHandler,
  Platform,
  StyleSheet,
  View,
  type HostInstance,
  type LayoutChangeEvent,
} from "react-native";
import type { CameraView } from "expo-camera";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { processPhoto } from "@/capture/process-photo";
import { addPlate, firstOpenSlot, getPlates, getRollPlan, getRollPlanState, replacePlate, usePlates, useRollPlan, useSlots } from "@/capture/roll";
import { MIN_PLATES, platePrompts } from "@/capture/slots";
import { LENS_FOV } from "@/capture/turn";
import { useLibraryImport } from "@/capture/useLibraryImport";
import { useShowAfter } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { motion, ref } from "@/theme/tokens";
import { useCapturePalette } from "./palette";
import { ControlRow } from "./rangefinder/ControlRow";
import { COPY, counterCopy, lastPlateLabel, libraryError, promptCopy, shutterLabel, thinkingCopy, turnCopy } from "./rangefinder/copy";
import { Header, type PromptSubtitle } from "./rangefinder/Header";
import { LastPlate } from "./rangefinder/LastPlate";
import { PlateCounter } from "./rangefinder/PlateCounter";
import { Shutter } from "./rangefinder/Shutter";
import { SQUARE_SLOP } from "./rangefinder/SquareButton";
import { TurnDial } from "./rangefinder/TurnDial";
import { useLenses } from "./rangefinder/useLenses";
import { Viewfinder, viewfinderLayout } from "./rangefinder/Viewfinder";
import type { RangefinderProps } from "./types";

const L = ref.layout.camera;

// JPEG quality of the camera's own file; processPhoto then re-encodes it.
const CAPTURE_QUALITY = 0.92;

// Native hit-testing (iOS Fabric and Android) drops touches outside a parent
// that nothing overflows, so each row carries its controls' hit areas inside
// its own box and the bands around it shrink by as much; every visible
// position stays on the reference's.
// - Header: the square buttons' 44 plus SQUARE_SLOP above and below (48).
// - Control row: the glyphs' and lens halves' 48, the 40 track centred in it.
// - Bottom row: the shutter with the room for its drop above it (80.4); the
//   counter and the thumbnail are centred in it.
const CONTROL_PAD = (ref.button.bare.hit - ref.button.segment.height) / 2;
const BOTTOM_ROW = Math.max(ref.button.thumbnail.size, ref.button.shutter.ring + L.shutter.drop * 2);
const BOTTOM_PAD = (BOTTOM_ROW - ref.button.thumbnail.size) / 2;

// On 393 x 852 (safe 59 / 34): square buttons y 67-111 at x 21-65 / 328-372;
// the viewfinder x 14-379, y 140-626.7 (365 x 486.7, exactly 3:4); the zoom
// track y 656.4-696.4; the thumbnail y 720.4-792.4, the counter's pill centred
// on it (y 730.2-782.7), the shutter's ring y 721.6-796.6 (centre 2.7 lower).

export function Rangefinder({ retakeIndex, onClose }: RangefinderProps) {
  const insets = useSafeAreaInsets();
  const plates = usePlates();
  const slots = useSlots();
  const camera = useRef<CameraView>(null);
  const promptRef = useRef<HostInstance>(null);
  const feedback = useFeedback();
  const palette = useCapturePalette();
  const library = useLibraryImport({ retakeIndex });
  // The camera opens on the lens the roll is being taken on, so reopening it mid-roll keeps the plan.
  const lenses = useLenses(camera, getRollPlanState().lens);
  const [ready, setReady] = useState(false);
  const [mountFailed, setMountFailed] = useState(false);
  const [shooting, setShooting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // The slot, the count and the prompt's footing a capture or an import started on, held until it ends.
  const [held, setHeld] = useState<{ index: number; taken: number; inTurn: boolean } | null>(null);
  // The last photo the player took here, from the moment its shutter fired:
  // where they stand, and what the turn is counted from (`key` restarts it).
  const [anchor, setAnchor] = useState<{ slot: number; key: string } | null>(null);
  const shutterCount = useRef(0);
  const [flash, setFlash] = useState(false);
  const [grid, setGrid] = useState(false);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const mounted = useRef(true);
  // A capture or an import is running (state lags a same-frame second tap).
  const inFlight = useRef(false);

  const retake = retakeIndex !== null;
  const busy = shooting || library.busy;
  const live = ready && !mountFailed;
  // The 360 for the lens in use, live: a lens switch changes the plan, its
  // stops and its words at once. Until the phone's lenses are known (iOS
  // reads them once the camera is ready) the roll's lens stands, or on a new
  // roll the ultra-wide most iPhones have, so the count doesn't change as the
  // camera starts (a phone without one re-plans for 1x once it says so).
  const plan = useRollPlan(lenses.settled ? lenses.choice : (getRollPlanState().lens ?? "wide"));
  const prompts = useMemo(() => platePrompts(plan.stops), [plan.stops]);
  // The slot this shot fills: the retake's, or the first open one (the plan's count once every photo is in).
  const nextIndex = retakeIndex ?? firstOpenSlot(slots, plan.shots) ?? plan.shots;
  const full = !retake && plates.length >= plan.shots;
  // Retake mode on a slot the player emptied: a first take of that slot, not a retake.
  const filling = retake && slots[retakeIndex] == null;
  const filled = Array.from({ length: plan.shots }, (_, i) => slots[i] != null);
  // The next photo follows the one the player just took here (still kept), so
  // they stand one stop back from it: the turn prompts and the live turn apply.
  const followsLast = anchor !== null && nextIndex > 0 && anchor.slot === nextIndex - 1 && filled[anchor.slot];
  // Photo 1 of an empty roll starts the turn; anything else out of turn is placed by its neighbours.
  const inTurn = !retake && (nextIndex === 0 ? plates.length === 0 : followsLast);

  // While a capture or an import is busy, the prompt, counter and shutter hold
  // the plate it started on, so they change (and are announced) once, as it ends.
  const at = {
    ...(busy && held !== null ? held : { index: nextIndex, taken: plates.length, inTurn }),
    prompts,
    retake,
    filling,
    filled,
    edgeToEdge: !plan.overlaps,
  };
  const headline = promptCopy(at);
  const counter = counterCopy(at);

  // The turn is counted from each shutter while the camera is live (through
  // the busy wait), and shown only between photos taken in turn: not before
  // photo 1, in retake mode, while busy, once full or out of turn.
  const turnTarget = full ? null : Math.min(at.index, plan.shots - 1);
  const turnListening = live && !retake && !full;
  const turnActive = turnListening && !busy && followsLast;
  const onTurned = feedback.tick;
  // On 1x where the phone has 0.5: say the photos only just meet, and point to 0.5.
  const lensNote = live && !full && lenses.ultraWide !== null && lenses.choice === "main" && !plan.overlaps ? COPY.lensNote : null;

  // Waits under ~1 s show nothing more; past it the thinking line takes the subtitle slot.
  const showThinking = useShowAfter(busy, L.thinkingDelay);
  const thinking = showThinking ? thinkingCopy(library.progress, counter.numeral) : null;
  const errorLine = notice ?? (mountFailed ? COPY.mountError : null);
  const subtitle: PromptSubtitle = thinking
    ? { kind: "thinking", line: thinking.line, sizeTo: thinking.sizeTo }
    : errorLine
      ? { kind: "notice", text: errorLine }
      : { kind: "detail", text: headline.detail };
  const status = thinking?.accessibilityLabel ?? errorLine;
  const promptLabel = `${headline.title}. ${status ?? headline.detail}`;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Screen readers start on the prompt once the rangefinder has faded in.
  useEffect(() => {
    const id = setTimeout(() => {
      if (promptRef.current) AccessibilityInfo.sendAccessibilityEvent(promptRef.current, "focus");
    }, motion.sceneCrossfade);
    return () => clearTimeout(id);
  }, []);

  // On Android the prompt is a polite live region. iOS has none, so a new
  // prompt, an error line or a status is announced here: once each, never a
  // count or a rotation.
  const promptKey = `${headline.title}\n${headline.detail}`;
  const spoken = useRef({ promptKey, status });
  useEffect(() => {
    const before = spoken.current;
    spoken.current = { promptKey, status };
    if (Platform.OS !== "ios") return;
    if (promptKey !== before.promptKey) AccessibilityInfo.announceForAccessibility(promptLabel);
    else if (status !== null && status !== before.status) AccessibilityInfo.announceForAccessibility(status);
  }, [promptKey, status, promptLabel]);

  // Back, Android back and the retake thumbnail close the camera. While a
  // retake is being processed back is ignored until it settles, so a late
  // result never meets a second router.back().
  const backBlocked = retake && busy;
  const close = useCallback(() => {
    if (!backBlocked) onClose();
  }, [backBlocked, onClose]);
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        close();
        return true;
      });
      return () => subscription.remove();
    }, [close]),
  );

  const shoot = async () => {
    const view = camera.current;
    if (!view || inFlight.current || busy || full || !live) return;
    inFlight.current = true;
    setShooting(true);
    setHeld({ index: nextIndex, taken: plates.length, inTurn });
    setNotice(null);
    try {
      const picture = await view.takePictureAsync({ quality: CAPTURE_QUALITY, exif: false });
      // The shutter firing: the firm, physical moment, and its sound.
      feedback.shutter();
      // The player stands at this photo's place now: the next turn is counted
      // from here, including while the photo is prepared.
      if (retakeIndex === null) {
        shutterCount.current += 1;
        setAnchor({ slot: nextIndex, key: `shot-${shutterCount.current}` });
      }
      const plate = await processPhoto(picture);
      if (retakeIndex === null) {
        // The plan's last photo fills the set: an outcome the prompt also states.
        if (addPlate(plate) && getPlates().length >= getRollPlan().shots) feedback.success();
      } else if (mounted.current) {
        // A retake that outlives the screen is dropped: its photo stays as it was.
        const before = getPlates().length;
        const target = getRollPlan().shots;
        replacePlate(retakeIndex, plate);
        // Filling the last open slot completes the set too.
        if (before < target && getPlates().length >= target) feedback.success();
        router.back();
      }
    } catch {
      feedback.error();
      setNotice(COPY.captureError);
    } finally {
      inFlight.current = false;
      setShooting(false);
      setHeld(null);
    }
  };

  const fromLibrary = async () => {
    if (inFlight.current || busy || full) return;
    inFlight.current = true;
    setNotice(null);
    setHeld({ index: nextIndex, taken: plates.length, inTurn });
    const before = getPlates().length;
    try {
      const result = await library.pick();
      if (result && result.failed > 0) setNotice(libraryError(result.failed));
      // Picks that fill the set: the same outcome haptic as its last shot.
      const target = getRollPlan().shots;
      if (!retake && before < target && getPlates().length >= target) feedback.success();
    } finally {
      inFlight.current = false;
      setHeld(null);
    }
  };

  const lastPlate = retakeIndex !== null ? slots[retakeIndex] : plates.at(-1);
  const lastUri = lastPlate?.uri ?? null;
  const openLightTable = () => {
    if (busy) return;
    if (retake) close();
    else router.push("/capture/review");
  };

  const onCameraReady = () => {
    if (ready) return;
    setReady(true);
    lenses.read();
  };

  const onArea = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };
  // The viewfinder exactly 3:4, fitted into the space left and centred: it shrinks before any text does.
  const viewfinder = viewfinderLayout(area);

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: palette.page, paddingTop: insets.top + L.top - SQUARE_SLOP, paddingBottom: insets.bottom + L.band.foot - BOTTOM_PAD },
      ]}
      testID="rangefinder-root"
    >
      <Header
        backLabel={filling ? COPY.cancelFill : retake ? COPY.cancelRetake : COPY.close}
        onBack={close}
        libraryLabel={retake ? COPY.libraryRetake : COPY.library}
        onLibrary={fromLibrary}
        libraryDisabled={busy || full}
        title={headline.title}
        subtitle={subtitle}
        promptLabel={promptLabel}
        promptRef={promptRef}
        style={styles.headerRow}
      />
      <View style={styles.area} onLayout={onArea} testID="viewfinder">
        {viewfinder.width > 0 ? (
          <Viewfinder
            layout={viewfinder}
            cameraRef={camera}
            flash={flash ? "on" : "off"}
            selectedLens={lenses.selectedLens}
            grid={grid}
            note={!retake && plates.length === 0}
            lensNote={lensNote}
            overlay={
              <TurnDial
                stops={plan.stops}
                taken={filled}
                target={turnTarget}
                listening={turnListening}
                active={turnActive}
                resetKey={anchor?.key ?? "none"}
                ghost={turnActive && anchor && slots[anchor.slot]?.uri
                  ? { uri: slots[anchor.slot]!.uri, fov: LENS_FOV[lenses.choice], width: viewfinder.width, height: viewfinder.height }
                  : null}
                line={turnCopy(at, false).line}
                accessibilityLabel={(reached) => turnCopy(at, reached).accessibilityLabel}
                onReached={onTurned}
              />
            }
            onCameraReady={onCameraReady}
            onMountError={() => setMountFailed(true)}
            onAvailableLensesChanged={lenses.onChanged}
          />
        ) : null}
      </View>
      <ControlRow
        flash={flash}
        onFlash={() => {
          feedback.tick();
          setFlash((on) => !on);
        }}
        flashDisabled={!live || busy}
        grid={grid}
        onGrid={() => {
          feedback.tick();
          setGrid((on) => !on);
        }}
        gridDisabled={!live}
        showLens={live && lenses.ultraWide !== null}
        lens={lenses.choice}
        onLens={(choice) => {
          if (choice !== lenses.choice) feedback.tick();
          lenses.choose(choice);
        }}
        lensDisabled={busy}
      />
      <View style={styles.bottomRow}>
        <PlateCounter current={counter.current} count={plan.shots} solo={counter.solo} accessibilityLabel={counter.accessibilityLabel} />
        <Shutter accessibilityLabel={shutterLabel(at)} disabled={!live || full} busy={busy} onPress={shoot} testID="shutter" />
        <LastPlate
          uri={lastUri}
          ring={!retake && plates.length >= MIN_PLATES}
          accessibilityLabel={lastPlateLabel(plates.length, retake, filling)}
          disabled={lastUri === null || busy}
          dimmed={lastUri !== null && busy}
          onPress={openLightTable}
          testID="last-plate"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Once's flat ground (the palette's page): no grain, glow or vignette, so photos are judged on a plain ground.
  root: { flex: 1 },
  headerRow: { paddingVertical: SQUARE_SLOP },
  // The viewfinder takes what's left between the header and the control row,
  // space.plate from the sides; on 852 that is exactly its 3:4 box.
  area: {
    flex: 1,
    marginHorizontal: ref.space.plate,
    marginTop: L.band.viewfinder - SQUARE_SLOP,
    marginBottom: L.band.controls - CONTROL_PAD,
  },
  // Counter, shutter and thumbnail on one centre line, edge from the sides,
  // space-between (65.5 gaps on 393).
  bottomRow: {
    height: BOTTOM_ROW,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: L.edge,
    marginTop: L.band.bottom - CONTROL_PAD - BOTTOM_PAD,
  },
});
