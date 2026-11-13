// The viewfinder: the camera's finder window. One rounded well (the palette's
// well colour; its corner CHROME.finder.radius of its width) holding the live
// feed, in a rendered brass frame (ART.finder, per lens) that lies wholly
// outside it: the picture is scaled with the well, so its opening is the
// preview on every screen. On the glass, still and faint: a slight darkening
// into the corners (ART.glass) and an etched mark at the middle of each side;
// and as a photo is taken the shutter blinks across it (`blink`). The box is exactly the
// lens's photo frame (frameFor: 3:4 on 1x, as the phone's Camera app; tall
// 9:16 on 0.5x, the photo centre-cropped to it), fitted by containBox into
// the space the header and the control row leave, so it shrinks before any
// text does. The CameraView is keyed by its lens (cameraKey): a lens switch
// mounts a fresh camera on the new lens with its own frame and feed ratio
// from the start, rather than swapping the device (and the ratio) under a
// running one, which crashed on 0.5 to 1.0. Over the feed, ESCAPD's own: the framing
// grid (when on), the turn guide and dial (`overlay`, TurnDial.tsx) and at
// the foot the privacy note (until photo 1), a see-through black pill.
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CameraView, type AvailableLenses, type CameraMountError, type CameraRatio, type FlashMode } from "expo-camera";
import { Image } from "expo-image";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { toEasing, useStateProgress } from "@/components/noir";
import { containBox, type Box } from "@/render/geometry";
import { useTheme } from "@/theme/ThemeProvider";
import { curve, ref } from "@/theme/tokens";
import { ART } from "../art";
import { CHROME } from "../look";
import { useCapturePalette } from "../palette";
import { COPY } from "./copy";
import { cameraKey, type LensChoice } from "./useLenses";

const L = ref.layout.camera;
const F = CHROME.finder;

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
  /** The 0.5x frame (tall): its own brass frame. */
  wide?: boolean;
  /** A photo is being taken: as it turns true the shutter blinks across the glass. */
  blink?: boolean;
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
  wide = false,
  blink = false,
  overlay,
  onCameraReady,
  onMountError,
  onAvailableLensesChanged,
}: ViewfinderProps) {
  const palette = useCapturePalette();
  const key = cameraKey(selectedLens);
  // The frame's picture, scaled with the well from the width it was drawn for.
  const scale = layout.width / (wide ? F.drawn.wide : F.drawn.main);
  const rim = F.margin * scale;
  return (
    <>
    <View
      style={[
        styles.well,
        { backgroundColor: palette.well, left: layout.x, top: layout.y, width: layout.width, height: layout.height, borderRadius: F.radius * layout.width },
      ]}
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
      <Glass width={layout.width} height={layout.height} />
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
      <Blink on={blink} />
    </View>
    <Image
      source={wide ? ART.finderWide : ART.finder}
      pointerEvents="none"
      accessible={false}
      contentFit="fill"
      style={[styles.frame, { left: layout.x - rim, top: layout.y - rim, width: layout.width + rim * 2, height: layout.height + rim * 2 }]}
      testID="viewfinder-frame"
    />
    </>
  );
}

/**
 * The finder's glass, still: the corners a little darker (one soft picture
 * stretched over the well) and four etched marks, one in from the middle of
 * each side. Above the feed, under the grid, the guide and the notes.
 */
function Glass({ width, height }: { width: number; height: number }) {
  const half = F.tick.line / 2;
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="viewfinder-glass"
    >
      <Image source={ART.glass} style={StyleSheet.absoluteFill} contentFit="fill" accessible={false} />
      <View style={[styles.tickV, { left: width / 2 - half, top: 0 }]} />
      <View style={[styles.tickV, { left: width / 2 - half, bottom: 0 }]} />
      <View style={[styles.tickH, { top: height / 2 - half, left: 0 }]} />
      <View style={[styles.tickH, { top: height / 2 - half, right: 0 }]} />
    </View>
  );
}

/**
 * The shutter's blink: the glass goes dark for an instant as a photo is taken
 * (`on` turning true) and clears again. Opacity only, on the UI thread; not
 * played under reduced motion.
 */
function Blink({ on }: { on: boolean }) {
  const { reducedMotion } = useTheme();
  const dark = useSharedValue(0);
  const was = useRef(on);
  useEffect(() => {
    const before = was.current;
    was.current = on;
    if (!on || before || reducedMotion) return;
    dark.set(withSequence(
      withTiming(F.blink.opacity, { duration: F.blink.close, reduceMotion: ReduceMotion.Never }),
      withTiming(0, { duration: F.blink.open, reduceMotion: ReduceMotion.Never }),
    ));
  }, [on, reducedMotion, dark]);
  const style = useAnimatedStyle(() => ({ opacity: dark.get() }));
  return <Animated.View pointerEvents="none" style={[styles.blink, style]} testID="shutter-blink" />;
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
    ...curve,
  },
  frame: { position: "absolute" },
  tickV: { position: "absolute", width: F.tick.line, height: F.tick.length, backgroundColor: ref.color.textPrimary, opacity: F.tick.opacity },
  tickH: { position: "absolute", height: F.tick.line, width: F.tick.length, backgroundColor: ref.color.textPrimary, opacity: F.tick.opacity },
  blink: { ...StyleSheet.absoluteFill, backgroundColor: ref.color.void },
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
