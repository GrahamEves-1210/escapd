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
// Haptics: thud as the shutter fires, error on a failed shot, success when
// the 6th photo fills the set, tick on flash, grid and lens changes, press
// on the square buttons and the thumbnail (inside those components).
import { useCallback, useEffect, useRef, useState } from "react";
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
import { addPlate, firstOpenSlot, getPlates, replacePlate, usePlates, useSlots } from "@/capture/roll";
import { MAX_PLATES, MIN_PLATES } from "@/capture/slots";
import { useLibraryImport } from "@/capture/useLibraryImport";
import { useShowAfter } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { motion, ref } from "@/theme/tokens";
import { ControlRow } from "./rangefinder/ControlRow";
import { COPY, counterCopy, lastPlateLabel, libraryError, promptCopy, shutterLabel, thinkingCopy } from "./rangefinder/copy";
import { Header, type PromptSubtitle } from "./rangefinder/Header";
import { LastPlate } from "./rangefinder/LastPlate";
import { PlateCounter } from "./rangefinder/PlateCounter";
import { Shutter } from "./rangefinder/Shutter";
import { SQUARE_SLOP } from "./rangefinder/SquareButton";
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
  const library = useLibraryImport({ retakeIndex });
  const lenses = useLenses(camera);
  const [ready, setReady] = useState(false);
  const [mountFailed, setMountFailed] = useState(false);
  const [shooting, setShooting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // The slot and the count a capture or an import started on, held until it ends.
  const [held, setHeld] = useState<{ index: number; taken: number } | null>(null);
  const [flash, setFlash] = useState(false);
  const [grid, setGrid] = useState(false);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const mounted = useRef(true);
  // A capture or an import is running (state lags a same-frame second tap).
  const inFlight = useRef(false);

  const retake = retakeIndex !== null;
  const busy = shooting || library.busy;
  const live = ready && !mountFailed;
  // The slot this shot fills: the retake's, or the first open one (MAX_PLATES once all 6 are filled).
  const nextIndex = retakeIndex ?? firstOpenSlot(slots) ?? MAX_PLATES;
  const full = !retake && plates.length >= MAX_PLATES;
  // Retake mode on a slot the player emptied: a first take of that slot, not a retake.
  const filling = retake && slots[retakeIndex] == null;

  // While a capture or an import is busy, the prompt, counter and shutter hold
  // the plate it started on, so they change (and are announced) once, as it ends.
  const at = busy && held !== null
    ? { index: held.index, retake, filling, taken: held.taken }
    : { index: nextIndex, retake, filling, taken: plates.length };
  const headline = promptCopy(at);
  const counter = counterCopy(at);

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
    setHeld({ index: nextIndex, taken: plates.length });
    setNotice(null);
    try {
      const picture = await view.takePictureAsync({ quality: CAPTURE_QUALITY, exif: false });
      // The shutter firing: the firm, physical moment.
      feedback.thud();
      const plate = await processPhoto(picture);
      if (retakeIndex === null) {
        // The 6th photo fills the set: an outcome the prompt also states.
        if (addPlate(plate) && getPlates().length >= MAX_PLATES) feedback.success();
      } else if (mounted.current) {
        // A retake that outlives the screen is dropped: its photo stays as it was.
        const before = getPlates().length;
        replacePlate(retakeIndex, plate);
        // Filling the last open slot completes the set too.
        if (before < MAX_PLATES && getPlates().length >= MAX_PLATES) feedback.success();
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
    setHeld({ index: nextIndex, taken: plates.length });
    const before = getPlates().length;
    try {
      const result = await library.pick();
      if (result && result.failed > 0) setNotice(libraryError(result.failed));
      // Picks that fill the set to 6: the same outcome haptic as a 6th shot.
      if (!retake && before < MAX_PLATES && getPlates().length >= MAX_PLATES) feedback.success();
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
    <View style={[styles.root, { paddingTop: insets.top + L.top - SQUARE_SLOP, paddingBottom: insets.bottom + L.band.foot - BOTTOM_PAD }]}>
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
        <PlateCounter current={counter.current} solo={counter.solo} accessibilityLabel={counter.accessibilityLabel} />
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
  // Once's flat ground: no grain, glow or vignette, so photos are judged on a plain ground.
  root: { flex: 1, backgroundColor: ref.color.ground },
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
