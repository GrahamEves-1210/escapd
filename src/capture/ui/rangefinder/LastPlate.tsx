// The last-plate thumbnail: a small film plate, as the hub's cards and the
// light table's tiles. A 72 x 72 walnut mount (color.surface, 1 pt
// color.hairline, radius.thumbRing) around a 64 x 64 inner plate 4 in
// (color.canvas, radius.thumb, so the corners are concentric) holding the
// newest plate in full colour (cover), with a 1 pt color.rim edge drawn over
// the photo. From 3 plates a 2 pt brass ring (color.accent) closes over the
// mount's edge, drawn inside the 72 box so nothing moves: the case can
// proceed. Before plate I the plate is an empty canvas well. In retake mode it
// shows the plate being replaced, without a ring.
// - Pressed: the mount eases surface to raised and its hairline to accent, or
//   the ring to accentPressed, over ref.motion.control, as the hub's cards.
//   The photo itself never changes.
// - A new plate swaps in with a ref.motion.control cross-dissolve.
// - Disabled before plate I (a full-opacity empty well) and while busy (dimmed,
//   keeping its image and ring).
// - Focus: the kit's brass ring 2 outside the mount, concentric with it.
import { Pressable, StyleSheet, View } from "react-native";
import { Image, type ImageTransition } from "expo-image";
import Animated, { interpolateColor, useAnimatedStyle } from "react-native-reanimated";
import { focusRingStyle, useFocusRing, usePressProgress, useStateProgress } from "@/components/noir";
import { color, curve, radius, ref } from "@/theme/tokens";
import { Dimmable } from "./Dimmable";

const L = ref.layout.camera;

/** The mount's walnut ring around the plate: 18 - 14 = 4, so mount and plate corners are concentric. */
export const MOUNT_PAD = radius.thumbRing - radius.thumb;

const SWAP: ImageTransition = {
  duration: ref.motion.control.duration,
  timing: ref.motion.control.easing,
  effect: "cross-dissolve",
};

export interface LastPlateProps {
  /** The newest plate (or, in retake mode, the plate being replaced); null for the empty well. */
  uri: string | null;
  /** The 2 pt brass ring: 3 plates or more, outside retake mode. */
  ring: boolean;
  accessibilityLabel: string;
  disabled: boolean;
  /** Busy: the whole control at disabledOpacity. The empty well never dims. */
  dimmed: boolean;
  onPress: () => void;
  testID?: string;
}

export function LastPlate({ uri, ring, accessibilityLabel, disabled, dimmed, onPress, testID }: LastPlateProps) {
  const press = usePressProgress();
  const ringOn = useStateProgress(ring);
  const focus = useFocusRing();

  const mountStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(press.progress.get(), [0, 1], [color.surface, color.raised]),
    borderColor: interpolateColor(press.progress.get(), [0, 1], [color.hairline, color.accent]),
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOn.get(),
    borderColor: interpolateColor(press.progress.get(), [0, 1], [color.accent, color.accentPressed]),
  }));

  return (
    <Dimmable dimmed={dimmed}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onFocus={focus.onFocus}
        onBlur={focus.onBlur}
        testID={testID}
        style={styles.window}
      >
        <Animated.View pointerEvents="none" style={[styles.mount, mountStyle]} testID={testID ? `${testID}-mount` : undefined} />
        <View style={styles.plate}>
          {uri ? (
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={SWAP}
              accessible={false}
              testID={testID ? `${testID}-photo` : undefined}
            />
          ) : null}
        </View>
        <View pointerEvents="none" style={styles.rim} />
        <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} testID={testID ? `${testID}-ring` : undefined} />
        {focus.focused ? (
          <View
            pointerEvents="none"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.focusRing}
          />
        ) : null}
      </Pressable>
    </Dimmable>
  );
}

// The kit's ring sits ref.focus.offset + width outside the box; its radius grows by as much, so it stays concentric.
const RING_OUT = ref.focus.offset + ref.focus.width;

const styles = StyleSheet.create({
  // The 72 box carries no border, so the focus ring's inset measures from its outer edge.
  window: { width: L.plateBox, height: L.plateBox },
  mount: {
    ...StyleSheet.absoluteFill,
    borderWidth: L.hairline,
    borderRadius: radius.thumbRing,
    ...curve,
  },
  plate: {
    position: "absolute",
    top: MOUNT_PAD,
    left: MOUNT_PAD,
    right: MOUNT_PAD,
    bottom: MOUNT_PAD,
    overflow: "hidden",
    backgroundColor: color.canvas,
    borderRadius: radius.thumb,
    ...curve,
  },
  rim: {
    position: "absolute",
    top: MOUNT_PAD,
    left: MOUNT_PAD,
    right: MOUNT_PAD,
    bottom: MOUNT_PAD,
    borderWidth: L.hairline,
    borderColor: color.rim,
    borderRadius: radius.thumb,
    ...curve,
  },
  ring: {
    ...StyleSheet.absoluteFill,
    borderWidth: L.ringWidth,
    borderRadius: radius.thumbRing,
    ...curve,
  },
  focusRing: { ...focusRingStyle("panel"), borderRadius: radius.thumbRing + RING_OUT },
});
