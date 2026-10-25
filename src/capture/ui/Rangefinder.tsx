// 02 · Camera (docs/DESIGN.md 02): the rangefinder, guided capture one plate
// at a time, mounted by /capture once camera access is granted. In the play
// screen's look: soot ground (color.canvas) under the live grain, and no silk,
// so photos are judged on a plain ground. The live feed sits on a film plate in
// a walnut mount with brass brackets and a brass plate label, as /play mounts
// the room it becomes. A Playfair prompt between live IconButtons, walnut and
// brass controls, the brass shutter with its manila core and magnifier, and a
// brass ring on the last-plate thumbnail from 3 plates.
// Every plate is re-encoded on the phone (EXIF and location dropped) before it
// joins the roll. In retake mode it replaces that plate and returns to the
// light table.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  BackHandler,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type HostInstance,
  type LayoutChangeEvent,
} from "react-native";
import type { CameraView } from "expo-camera";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { processPhoto } from "@/capture/process-photo";
import { addPlate, replacePlate, usePlates } from "@/capture/roll";
import { MAX_PLATES, MIN_PLATES } from "@/capture/slots";
import { useLibraryImport } from "@/capture/useLibraryImport";
import { Grain } from "@/components/Grain";
import { useShowAfter } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { color, motion, ref, space } from "@/theme/tokens";
import { ControlRow } from "./rangefinder/ControlRow";
import { COPY, counterCopy, lastPlateLabel, libraryError, plateLabel, promptCopy, shutterLabel, thinkingCopy } from "./rangefinder/copy";
import { SLOP } from "./rangefinder/Dimmable";
import { Header, type PromptSubtitle } from "./rangefinder/Header";
import { LastPlate } from "./rangefinder/LastPlate";
import { PlateCounter } from "./rangefinder/PlateCounter";
import { Shutter } from "./rangefinder/Shutter";
import { useLenses } from "./rangefinder/useLenses";
import { Viewfinder, viewfinderLayout } from "./rangefinder/Viewfinder";
import type { RangefinderProps } from "./types";

const L = ref.layout.camera;

// JPEG quality of the camera's own file; processPhoto then re-encodes it.
const CAPTURE_QUALITY = 0.92;

// Header and control-row buttons are the live IconButton: 48 circles with
// 56 x 56 hit areas (hitSlop 4), and the lens halves are 50 x 48. Native
// hit-testing (iOS Fabric and Android) drops touches outside a parent that
// nothing overflows, so the two rows carry SLOP inside their own boxes
// (padding) and the gaps around them shrink by as much, so every visible
// position stays on the spec.
//
// On 393 x 852 (safe 59 / 34): buttons y 65-113 at x 19-67 / 326-374; the
// mount x 14-379, y 132.5-634.5 around the 351 x 468 plate at x 21-372,
// y 139.5-607.5; the control row's buttons y 654-702; the bottom row
// y 722-798; 20 clear above the safe bottom.

export function Rangefinder({ retakeIndex, onClose }: RangefinderProps) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const plates = usePlates();
  const camera = useRef<CameraView>(null);
  const promptRef = useRef<HostInstance>(null);
  const feedback = useFeedback();
  const library = useLibraryImport({ retakeIndex });
  const lenses = useLenses(camera);
  const [ready, setReady] = useState(false);
  const [mountFailed, setMountFailed] = useState(false);
  const [shooting, setShooting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [held, setHeld] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [grid, setGrid] = useState(false);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const mounted = useRef(true);
  // A capture or an import is running (state lags a same-frame second tap).
  const inFlight = useRef(false);

  const retake = retakeIndex !== null;
  const busy = shooting || library.busy;
  const live = ready && !mountFailed;
  const nextIndex = retakeIndex ?? plates.length;
  const full = !retake && plates.length >= MAX_PLATES;

  // While a capture or an import is busy, the prompt, counter and shutter hold
  // the plate it started on, so they change (and are announced) once, as it ends.
  const at = { index: busy && held !== null ? held : nextIndex, retake };
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
    setHeld(nextIndex);
    setNotice(null);
    try {
      const picture = await view.takePictureAsync({ quality: CAPTURE_QUALITY, exif: false });
      feedback.tap();
      const plate = await processPhoto(picture);
      if (retakeIndex === null) {
        addPlate(plate);
      } else if (mounted.current) {
        // A retake that outlives the screen is dropped: its plate stays as it was.
        replacePlate(retakeIndex, plate);
        router.back();
      }
    } catch {
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
    setHeld(nextIndex);
    try {
      const result = await library.pick();
      if (result && result.failed > 0) setNotice(libraryError(result.failed));
    } finally {
      inFlight.current = false;
      setHeld(null);
    }
  };

  const lastPlate = retakeIndex !== null ? plates[retakeIndex] : plates.at(-1);
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
  // The plate exactly 3:4, its mount fitted into the space left and centred: the viewfinder shrinks before any text does.
  const viewfinder = viewfinderLayout(area, fontScale);

  return (
    <View style={[styles.root, { paddingTop: insets.top + L.buttons.top - SLOP, paddingBottom: insets.bottom + space.gutter }]}>
      {/* The live grain on the soot ground, under the chrome; the mounts are opaque, so it never crosses the feed. */}
      <Grain />
      <Header
        backLabel={retake ? COPY.cancelRetake : COPY.close}
        onBack={close}
        libraryLabel={retake ? COPY.libraryRetake : COPY.library}
        onLibrary={fromLibrary}
        libraryDisabled={busy || full}
        title={headline.title}
        subtitle={subtitle}
        promptLabel={promptLabel}
        promptRef={promptRef}
        style={styles.slopRoom}
      />
      <View style={styles.area} onLayout={onArea} testID="viewfinder">
        {viewfinder.plate.width > 0 ? (
          <Viewfinder
            layout={viewfinder}
            label={plateLabel(at)}
            cameraRef={camera}
            flash={flash ? "on" : "off"}
            selectedLens={lenses.selectedLens}
            settled={ready}
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
        onFlash={() => setFlash((on) => !on)}
        flashDisabled={!live || busy}
        grid={grid}
        onGrid={() => setGrid((on) => !on)}
        gridDisabled={!live}
        showLens={live && lenses.ultraWide !== null}
        lens={lenses.choice}
        onLens={lenses.choose}
        lensDisabled={busy}
        style={styles.slopRoom}
      />
      <View style={styles.bottomRow}>
        <PlateCounter label={counter.label} numeral={counter.numeral} accessibilityLabel={counter.accessibilityLabel} />
        <Shutter accessibilityLabel={shutterLabel(at)} disabled={!live || full} busy={busy} onPress={shoot} testID="shutter" />
        <LastPlate
          uri={lastUri}
          ring={!retake && plates.length >= MIN_PLATES}
          accessibilityLabel={lastPlateLabel(plates.length, retake)}
          disabled={lastUri === null || busy}
          dimmed={lastUri !== null && busy}
          onPress={openLightTable}
          testID="last-plate"
        />
      </View>
    </View>
  );
}

// The counter and the thumbnail align with the plate's edges: the mount's gutter, its hairline and its walnut.
const PLATE_EDGE = space.plate + L.hairline + L.mount.pad;

const styles = StyleSheet.create({
  // Soot ground with the live grain (rendered first). No silk, pool or
  // vignette: the camera stays flat so photos are judged on a plain ground.
  root: { flex: 1, backgroundColor: color.canvas },
  slopRoom: { paddingVertical: SLOP },
  // The viewfinder takes what's left: at least space.lg below the header and
  // above the control row (19.5 on 852, where the mount is centred), the
  // mount space.plate from the sides as /play's.
  area: { flex: 1, marginHorizontal: space.plate, marginVertical: space.lg - SLOP },
  // Counter, shutter and thumbnail on one centre line, with equal gaps,
  // space.gutter below the control row.
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: PLATE_EDGE,
    marginTop: space.gutter - SLOP,
  },
});
