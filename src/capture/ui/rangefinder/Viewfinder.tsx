// The viewfinder: the screen's one window. A 3:4 frame with radius 6 holding
// the live feed in full colour, with no filter, tint or overlay on it. Above
// the feed, in order: the framing grid (when on), the frame's 1 pt hairline
// edge (drawn over the feed, so it never disappears into the photo), the
// corner brackets and the privacy note. The panel fill shows until frames arrive.
import type { RefObject } from "react";
import { StyleSheet, View } from "react-native";
import { CameraView, type AvailableLenses, type CameraMountError, type FlashMode } from "expo-camera";
import Animated, { FadeOut, ReduceMotion, useAnimatedStyle } from "react-native-reanimated";
import { NoirText, Panel, toEasing, useStateProgress } from "@/components/noir";
import { ref } from "@/theme/tokens";
import { Brackets } from "./Brackets";
import { COPY } from "./copy";

const L = ref.layout.camera;

// After plate I the privacy note fades out over ref.motion.control. Opacity, so
// reduced motion keeps it.
const NOTE_EXIT = FadeOut.duration(ref.motion.control.duration)
  .easing(toEasing(ref.motion.control.easing))
  .reduceMotion(ReduceMotion.Never);

// The note clears the bracket arms by ref.space.sm on each side.
const NOTE_SIDE = ref.space.lg + L.bracketArm + ref.space.sm;

export interface ViewfinderBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewfinderProps {
  /** The frame inside the viewfinder area, from containBox. */
  box: ViewfinderBox;
  cameraRef: RefObject<CameraView | null>;
  flash: FlashMode;
  /** iOS deviceType of the chosen lens; undefined for the default main lens. */
  selectedLens: string | undefined;
  /** True once the camera is ready: the brackets settle in. */
  settled: boolean;
  /** The framing grid's toggle. */
  grid: boolean;
  /** The privacy note, shown until plate I and never in retake mode. */
  note: boolean;
  onCameraReady: () => void;
  onMountError: (event: CameraMountError) => void;
  onAvailableLensesChanged: (event: AvailableLenses) => void;
}

export function Viewfinder({
  box,
  cameraRef,
  flash,
  selectedLens,
  settled,
  grid,
  note,
  onCameraReady,
  onMountError,
  onAvailableLensesChanged,
}: ViewfinderProps) {
  return (
    <View style={[styles.frame, { left: box.x, top: box.y, width: box.width, height: box.height }]}>
      {/* The feed is not a stop for screen readers: the viewfinder isn't tappable and the prompt says what to frame. */}
      <View style={StyleSheet.absoluteFill} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode="picture"
          ratio={L.feedRatio}
          flash={flash}
          selectedLens={selectedLens}
          onCameraReady={onCameraReady}
          onMountError={onMountError}
          onAvailableLensesChanged={onAvailableLensesChanged}
          testID="camera"
        />
      </View>
      <FramingGrid visible={grid} width={box.width} height={box.height} />
      <View pointerEvents="none" accessible={false} style={styles.edge} />
      <Brackets settled={settled} />
      {note ? (
        <Animated.View exiting={NOTE_EXIT} style={styles.noteSlot}>
          <Panel style={[styles.note, { maxWidth: box.width - NOTE_SIDE * 2 }]} testID="privacy-note">
            <NoirText variant="meta" tone="read" align="center" lineBreakStrategyIOS="standard" textBreakStrategy="balanced">
              {COPY.privacy}
            </NoirText>
          </Panel>
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * Rule of thirds, edge to edge inside the frame: 1 pt read lines, opaque.
 * Above the feed, below the brackets and the note. It shows and hides over
 * ref.motion.control, the grid toggle's state change.
 */
function FramingGrid({ visible, width, height }: { visible: boolean; width: number; height: number }) {
  const on = useStateProgress(visible);
  const fade = useAnimatedStyle(() => ({ opacity: on.get() }));
  const cuts = Array.from({ length: L.gridDivisions - 1 }, (_, i) => (i + 1) / L.gridDivisions);
  // Each line is centred on its third.
  const half = ref.border.hairline / 2;
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
  frame: {
    position: "absolute",
    overflow: "hidden",
    backgroundColor: ref.panel.fill,
    borderRadius: ref.panel.radius,
    ...ref.curve,
  },
  edge: {
    ...StyleSheet.absoluteFill,
    borderWidth: ref.panel.borderWidth,
    borderColor: ref.panel.border,
    borderRadius: ref.panel.radius,
    ...ref.curve,
  },
  vertical: { position: "absolute", top: 0, bottom: 0, width: ref.border.hairline, backgroundColor: ref.color.read },
  horizontal: { position: "absolute", left: 0, right: 0, height: ref.border.hairline, backgroundColor: ref.color.read },
  // Bottom-centred, its bottom level with the bottom bracket corners.
  noteSlot: { position: "absolute", left: 0, right: 0, bottom: ref.space.lg, alignItems: "center" },
  // Padding 12 / 8 measured from the panel's outer edge, as the layout does
  // (the 1 pt hairline sits inside it): two lines make the 52 tall note.
  note: {
    paddingHorizontal: ref.space.md - ref.panel.borderWidth,
    paddingVertical: ref.space.sm - ref.panel.borderWidth,
  },
});
