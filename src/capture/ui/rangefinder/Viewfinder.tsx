// The viewfinder as a film plate, the way /play mounts the player's room
// (SceneView's Kodachrome mount): a walnut mount (color.surface, 1 pt
// color.hairline, radius.mount) with 6 of walnut around an inner plate
// (color.canvas, radius.image) that holds the live feed in full colour, with
// no filter, tint or overlay on it. Above the feed, in order: the framing grid
// (when on), the plate's 1 pt color.rim edge (drawn over the feed), the brass
// corner brackets and the privacy note. The canvas shows until frames arrive.
// Under the plate, inside the mount, the brass mono plate label
// ("ESCAPD 400  ·  PLATE I"), decorative: the counter carries it.
//
// The plate is exactly 3:4, fitted by containBox into the area the header and
// the control row leave (less the mount's chrome) and centred, so the
// viewfinder shrinks before any text does.
import type { RefObject } from "react";
import { StyleSheet, View } from "react-native";
import { CameraView, type AvailableLenses, type CameraMountError, type FlashMode } from "expo-camera";
import Animated, { FadeIn, FadeOut, LayoutAnimationConfig, ReduceMotion, useAnimatedStyle } from "react-native-reanimated";
import { toEasing, trackingPad, useStateProgress } from "@/components/noir";
import { Text } from "@/components/Text";
import { containBox } from "@/render/geometry";
import { color, curve, radius, ref, space, type as typeScale } from "@/theme/tokens";
import { Brackets } from "./Brackets";
import { COPY } from "./copy";

const L = ref.layout.camera;

const FADE = { duration: ref.motion.control.duration, easing: toEasing(ref.motion.control.easing) };
// After plate I the privacy note fades out; a new plate label fades in. Opacity,
// so reduced motion keeps both.
const NOTE_EXIT = FadeOut.duration(FADE.duration).easing(FADE.easing).reduceMotion(ReduceMotion.Never);
const LABEL_IN = FadeIn.duration(FADE.duration).easing(FADE.easing).reduceMotion(ReduceMotion.Never);

// The mount's edge and walnut padding, on each side of the plate.
const RIM = L.hairline + L.mount.pad;
// The note clears the bracket arms by space.sm on each side.
const NOTE_SIDE = space.lg + L.bracketArm + space.sm;

export interface Size {
  width: number;
  height: number;
}

export interface ViewfinderLayout {
  /** The mount, placed in the viewfinder area. */
  mount: { x: number; y: number; width: number; height: number };
  /** The inner plate: exactly 3:4. */
  plate: Size;
  /** The plate label's line box. */
  label: number;
}

/**
 * Fits the mount into `area`: the plate takes the largest 3:4 box that leaves
 * room for the mount's edges, its walnut and the plate label (one stamp line,
 * capped at labelMaxFontScale), and the mount is centred.
 */
export function viewfinderLayout(area: Size, fontScale: number): ViewfinderLayout {
  const label = typeScale.stamp.lineHeight * Math.min(fontScale, L.labelMaxFontScale);
  const chromeX = RIM * 2;
  const chromeY = RIM * 2 + L.mount.labelGap + label;
  const plate = containBox({ width: area.width - chromeX, height: area.height - chromeY }, L.frameAspect);
  return {
    mount: { x: plate.x, y: plate.y, width: plate.width + chromeX, height: plate.height + chromeY },
    plate: { width: plate.width, height: plate.height },
    label,
  };
}

export interface ViewfinderProps {
  layout: ViewfinderLayout;
  /** The plate label under the plate, from plateLabel(). */
  label: string;
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
  layout,
  label,
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
  const { mount, plate } = layout;
  return (
    <View style={[styles.mount, { left: mount.x, top: mount.y, width: mount.width, height: mount.height }]} testID="viewfinder-mount">
      <View style={[styles.plate, plate]} testID="viewfinder-plate">
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
        <FramingGrid visible={grid} width={plate.width} height={plate.height} />
        <View pointerEvents="none" accessible={false} style={styles.rim} />
        <Brackets settled={settled} />
        {note ? (
          <Animated.View exiting={NOTE_EXIT} style={styles.noteSlot}>
            <View style={[styles.note, { maxWidth: plate.width - NOTE_SIDE * 2 }]} testID="privacy-note">
              <Text variant="caption" tone="secondary" align="center" lineBreakStrategyIOS="standard" textBreakStrategy="balanced">
                {COPY.privacy}
              </Text>
            </View>
          </Animated.View>
        ) : null}
      </View>
      <View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.labelSlot, { height: layout.label }]}
        testID="plate-label"
      >
        {/* The first label appears with the screen; later ones fade in. */}
        <LayoutAnimationConfig skipEntering>
          <Animated.View key={label} entering={LABEL_IN}>
            <Text
              variant="stamp"
              tone="accent"
              align="center"
              numberOfLines={1}
              maxFontSizeMultiplier={L.labelMaxFontScale}
              style={trackingPad(typeScale.stamp)}
            >
              {label}
            </Text>
          </Animated.View>
        </LayoutAnimationConfig>
      </View>
    </View>
  );
}

/**
 * Rule of thirds, edge to edge inside the plate: 1 pt color.textSecondary
 * lines, opaque (quieter than the brass brackets). Above the feed, below the
 * rim, the brackets and the note. It shows and hides over ref.motion.control,
 * the grid toggle's state change.
 */
function FramingGrid({ visible, width, height }: { visible: boolean; width: number; height: number }) {
  const on = useStateProgress(visible);
  const fade = useAnimatedStyle(() => ({ opacity: on.get() }));
  const cuts = Array.from({ length: L.gridDivisions - 1 }, (_, i) => (i + 1) / L.gridDivisions);
  // Each line is centred on its third.
  const half = L.hairline / 2;
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
  // Width and height = plate + its chrome, so the 1 pt edge and the 6 of walnut
  // sit outside the plate on every side and the label slot below it.
  mount: {
    position: "absolute",
    padding: L.mount.pad,
    borderWidth: L.hairline,
    borderColor: color.hairline,
    borderRadius: radius.mount,
    backgroundColor: color.surface,
    ...curve,
  },
  plate: {
    overflow: "hidden",
    backgroundColor: color.canvas,
    borderRadius: radius.image,
    ...curve,
  },
  // The plate's 1 pt rim, over the feed and the grid, as /play's plate and the light table's tiles.
  rim: {
    ...StyleSheet.absoluteFill,
    borderWidth: L.hairline,
    borderColor: color.rim,
    borderRadius: radius.image,
    ...curve,
  },
  vertical: { position: "absolute", top: 0, bottom: 0, width: L.hairline, backgroundColor: color.textSecondary },
  horizontal: { position: "absolute", left: 0, right: 0, height: L.hairline, backgroundColor: color.textSecondary },
  // Bottom-centred, its bottom level with the bottom bracket corners.
  noteSlot: { position: "absolute", left: 0, right: 0, bottom: space.lg, alignItems: "center" },
  // A notice panel, as the case-closed stat panels: walnut, 1 pt brass
  // hairline, radius.control. Padding 12 / 8 measured from its outer edge (the
  // hairline sits inside it): two caption lines make it 52 tall.
  note: {
    backgroundColor: color.surface,
    borderWidth: L.hairline,
    borderColor: color.hairline,
    borderRadius: radius.control,
    ...curve,
    paddingHorizontal: space.md - L.hairline,
    paddingVertical: space.sm - L.hairline,
  },
  labelSlot: { marginTop: L.mount.labelGap, justifyContent: "center" },
});
