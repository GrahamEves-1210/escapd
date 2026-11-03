// The viewfinder, Once's: one big rounded black well (ref.color.void,
// ref.radius.viewfinder 40 continuous) holding the live feed, with no border,
// shadow or overlay, a hard edge against the ground. The box is exactly the
// lens's photo frame (frameFor: 3:4 on 1x, as the phone's Camera app; tall
// 9:16 on 0.5x, the photo centre-cropped to it), fitted by containBox into
// the space the header and the control row leave, so it shrinks before any
// text does. The CameraView is keyed by its lens (cameraKey): a lens switch
// mounts a fresh camera on the new lens with its own frame and feed ratio
// from the start, rather than swapping the device (and the ratio) under a
// running one, which crashed on 0.5 to 1.0. Over the feed, ESCAPD's own: the framing
// grid (when on), the turn guide and dial (`overlay`, TurnDial.tsx) and at
// the foot the privacy note (until photo 1), a see-through black pill.
import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CameraView, type AvailableLenses, type CameraMountError, type CameraRatio, type FlashMode } from "expo-camera";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { toEasing, useStateProgress } from "@/components/noir";
import { containBox, type Box } from "@/render/geometry";
import { curve, ref } from "@/theme/tokens";
import { useCapturePalette } from "../palette";
import { COPY } from "./copy";
import { cameraKey, type LensChoice } from "./useLenses";

const L = ref.layout.camera;

/**
 * The photo's frame on `lens`: its aspect (width / height, upright; the
 * viewfinder's box and the crop) and the feed's ratio (CameraView `ratio`,
 * Android). 1x the sensor's own 3:4; 0.5x tall, 9:16.
 */
export function frameFor(lens: LensChoice): { aspect: number; ratio: CameraRatio } {
  return lens === "wide" ? { aspect: L.frameAspectWide, ratio: L.feedRatioWide } : { aspect: L.frameAspect, ratio: L.feedRatio };
}

/**
 * A note over the feed that shows at once and fades out before it unmounts
 * (after photo 1 the privacy note goes). A shared-value fade, not a
 * Reanimated `exiting` layout animation: those crashed the app (Fabric's
 * layout animation proxy). Opacity, so reduced motion keeps it.
 */
function FadingNote({ shown, children }: { shown: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(shown);
  // Shown again: mounted in this same render (state from a prop, not an effect).
  if (shown && !mounted) setMounted(true);
  const opacity = useSharedValue(shown ? 1 : 0);
  useEffect(() => {
    if (shown) {
      opacity.set(1);
      return;
    }
    opacity.set(withTiming(0, { duration: ref.motion.control.duration, easing: toEasing(ref.motion.control.easing), reduceMotion: ReduceMotion.Never }, (done) => {
      if (done) scheduleOnRN(setMounted, false);
    }));
  }, [shown, opacity]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return mounted ? <Animated.View style={fade}>{children}</Animated.View> : null;
}

export interface Size {
  width: number;
  height: number;
}

/** The viewfinder: the largest box of the photo's frame in `area` (3:4 unless told), centred. */
export function viewfinderLayout(area: Size, aspect: number = L.frameAspect): Box {
  return containBox(area, aspect);
}

export interface ViewfinderProps {
  layout: Box;
  cameraRef: RefObject<CameraView | null>;
  flash: FlashMode;
  /** iOS deviceType of the chosen lens; undefined for the default back camera (1x). */
  selectedLens: string | undefined;
  /** The feed's ratio for the lens's frame (frameFor). */
  ratio: CameraRatio;
  /** The framing grid's toggle. */
  grid: boolean;
  /** The privacy note, shown until plate I and never in retake mode. */
  note: boolean;
  /** Drawn over the feed and the grid, before the note: the turn guide and dial. */
  overlay?: ReactNode;
  /** The camera for this lens (its cameraKey) is ready. */
  onCameraReady: (key: string) => void;
  onMountError: (event: CameraMountError) => void;
  onAvailableLensesChanged: (event: AvailableLenses) => void;
}

export function Viewfinder({
  layout,
  cameraRef,
  flash,
  selectedLens,
  ratio,
  grid,
  note,
  overlay,
  onCameraReady,
  onMountError,
  onAvailableLensesChanged,
}: ViewfinderProps) {
  const palette = useCapturePalette();
  const key = cameraKey(selectedLens);
  return (
    <View
      style={[styles.well, { backgroundColor: palette.well, left: layout.x, top: layout.y, width: layout.width, height: layout.height }]}
      testID="viewfinder-well"
    >
      {/* The feed is not a stop for screen readers: the viewfinder isn't tappable and the prompt says what to frame. */}
      <View style={StyleSheet.absoluteFill} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <CameraView
          // A fresh camera per lens: its session starts on that lens.
          key={key}
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode="picture"
          ratio={ratio}
          flash={flash}
          selectedLens={selectedLens}
          onCameraReady={() => onCameraReady(key)}
          onMountError={onMountError}
          onAvailableLensesChanged={onAvailableLensesChanged}
          testID="camera"
        />
      </View>
      <FramingGrid visible={grid} width={layout.width} height={layout.height} />
      {overlay}
      <View pointerEvents="none" style={styles.noteSlot}>
        <FadingNote shown={note}>
          <View style={[styles.note, { maxWidth: layout.width - L.note.inset * 2 }]} testID="privacy-note">
            <View pointerEvents="none" style={styles.noteFill} testID="privacy-note-fill" />
            <Text style={styles.noteText} lineBreakStrategyIOS="standard" textBreakStrategy="balanced">
              {COPY.privacy}
            </Text>
          </View>
        </FadingNote>
      </View>
    </View>
  );
}

/**
 * Rule of thirds, edge to edge in the well: 1 pt white lines at
 * ref.layout.camera.grid.opacity, as a camera's own grid, above the feed and
 * under the note. It shows and hides over ref.motion.control.
 */
function FramingGrid({ visible, width, height }: { visible: boolean; width: number; height: number }) {
  const on = useStateProgress(visible);
  const fade = useAnimatedStyle(() => ({ opacity: on.get() * L.grid.opacity }));
  const cuts = Array.from({ length: L.grid.divisions - 1 }, (_, i) => (i + 1) / L.grid.divisions);
  // Each line is centred on its third.
  const half = L.grid.line / 2;
  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, fade]}
      testID="framing-grid"
    >
      {cuts.map((t) => (
        <View key={`v${t}`} style={[styles.vertical, { left: width * t - half }]} />
      ))}
      {cuts.map((t) => (
        <View key={`h${t}`} style={[styles.horizontal, { top: height * t - half }]} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  well: {
    position: "absolute",
    overflow: "hidden",
    borderRadius: ref.radius.viewfinder,
    ...curve,
  },
  vertical: { position: "absolute", top: 0, bottom: 0, width: L.grid.line, backgroundColor: ref.color.textPrimary },
  horizontal: { position: "absolute", left: 0, right: 0, height: L.grid.line, backgroundColor: ref.color.textPrimary },
  // Bottom-centred on the feed.
  noteSlot: { position: "absolute", left: 0, right: 0, bottom: L.note.inset, alignItems: "center", gap: ref.space.sm },
  // A black pill in Once's void (its wells: the track, the counter), see-through
  // so the feed still reads under it; white meta text.
  note: {
    overflow: "hidden",
    borderRadius: ref.radius.round,
    paddingHorizontal: L.note.padX,
    paddingVertical: L.note.padY,
    ...curve,
  },
  noteFill: { ...StyleSheet.absoluteFill, backgroundColor: ref.color.void, opacity: L.note.fillOpacity },
  noteText: { ...ref.type.meta, color: ref.color.textPrimary, textAlign: "center" },
});
