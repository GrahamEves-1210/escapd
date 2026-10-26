// The last-plate thumbnail, Once's last photo (ref.button.thumbnail): a 72
// rounded square frame (ref.color.well, radius 24 continuous) 4 thick around
// a 64 image (radius 20, concentric) showing the newest plate in full colour
// (cover), with a 1 pt rimFaint rim drawn over it. No glow. Before plate I
// the image is an empty void well. In retake mode it shows the plate being
// replaced.
// - The way on: from MIN_PLATES (outside retake mode) a 1 pt grey ring
//   (ref.layout.camera.cue) closes over the frame's outer edge, inside the 72
//   box so nothing moves; its label says "Continue to the light table".
// - Pressed: ref.button.thumbnail.pressedOpacity 0.75.
// - A new plate swaps in with a ref.motion.control cross-dissolve.
// - Disabled before plate I (a full-opacity empty well) and while busy
//   (dimmed, keeping its image and ring).
// - Focus: the kit's brass ring 2 outside the frame, concentric with it.
import { Pressable, StyleSheet, View } from "react-native";
import { useFeedback } from "@/game/feedback";
import { Image, type ImageTransition } from "expo-image";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { FocusRing, useFocusRing, useStateProgress } from "@/components/noir";
import { curve, ref } from "@/theme/tokens";
import { Dimmable } from "./Dimmable";

const T = ref.button.thumbnail;
const CUE = ref.layout.camera.cue;

const SWAP: ImageTransition = {
  duration: ref.motion.control.duration,
  timing: ref.motion.control.easing,
  effect: "cross-dissolve",
};

export interface LastPlateProps {
  /** The newest plate (or, in retake mode, the plate being replaced); null for the empty well. */
  uri: string | null;
  /** The way-on ring: MIN_PLATES or more, outside retake mode. */
  ring: boolean;
  accessibilityLabel: string;
  disabled: boolean;
  /** Busy: the whole control at the disabled opacity. The empty well never dims. */
  dimmed: boolean;
  onPress: () => void;
  testID?: string;
}

export function LastPlate({ uri, ring, accessibilityLabel, disabled, dimmed, onPress, testID }: LastPlateProps) {
  const ringOn = useStateProgress(ring);
  const focus = useFocusRing();
  const feedback = useFeedback();
  const ringStyle = useAnimatedStyle(() => ({ opacity: ringOn.get() }));

  return (
    <Dimmable dimmed={dimmed}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        // The light `press` haptic as it is pressed in.
        onPressIn={feedback.press}
        onPress={onPress}
        onFocus={focus.onFocus}
        onBlur={focus.onBlur}
        testID={testID}
        style={({ pressed }) => [styles.frame, pressed ? styles.pressed : null]}
      >
        <View style={styles.image} testID={testID ? `${testID}-image` : undefined}>
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
        <FocusRing visible={focus.focused} shape="panel" radius={T.radius} />
      </Pressable>
    </Dimmable>
  );
}

const styles = StyleSheet.create({
  // The 72 frame carries no border, so the focus ring measures from its outer edge.
  frame: {
    width: T.size,
    height: T.size,
    backgroundColor: T.frameFill,
    borderRadius: T.radius,
    ...curve,
  },
  pressed: { opacity: T.pressedOpacity },
  image: {
    position: "absolute",
    top: T.frameWidth,
    left: T.frameWidth,
    right: T.frameWidth,
    bottom: T.frameWidth,
    overflow: "hidden",
    backgroundColor: ref.color.void,
    borderRadius: T.imageRadius,
    ...curve,
  },
  rim: {
    position: "absolute",
    top: T.frameWidth,
    left: T.frameWidth,
    right: T.frameWidth,
    bottom: T.frameWidth,
    borderWidth: ref.layout.camera.hairline,
    borderColor: T.imageRim,
    borderRadius: T.imageRadius,
    ...curve,
  },
  ring: {
    ...StyleSheet.absoluteFill,
    borderWidth: CUE.width,
    borderColor: CUE.color,
    borderRadius: T.radius,
    ...curve,
  },
});
