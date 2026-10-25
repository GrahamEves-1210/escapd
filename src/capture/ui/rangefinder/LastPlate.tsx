// The last-plate thumbnail: the newest plate in full colour in a 72 window
// (radius 6, cover), with a 1 pt hairline edge drawn over the photo. From 3
// plates the edge becomes the screen's one signal mark, a 2 pt ring drawn
// inside the window so the photo never moves: the case can proceed. Before
// plate I it is an empty panel well. In retake mode it shows the plate being
// replaced, without a ring.
// - Pressed: the hairline eases to read, or the ring to signalPressed. The
//   photo itself never changes.
// - A new plate swaps in with a ref.motion.control cross-dissolve.
// - Disabled before plate I (a full-opacity empty well) and while busy (dimmed,
//   keeping its image and ring).
// - Focus: a radius-6 outline 2 outside the window.
import { Pressable, StyleSheet, View } from "react-native";
import { Image, type ImageTransition } from "expo-image";
import Animated, { interpolateColor, useAnimatedStyle } from "react-native-reanimated";
import { FocusRing, useFocusRing, usePressProgress, useStateProgress } from "@/components/noir";
import { ref } from "@/theme/tokens";
import { Dimmable } from "./Dimmable";

const L = ref.layout.camera;

const SWAP: ImageTransition = {
  duration: ref.motion.control.duration,
  timing: ref.motion.control.easing,
  effect: "cross-dissolve",
};

export interface LastPlateProps {
  /** The newest plate (or, in retake mode, the plate being replaced); null for the empty well. */
  uri: string | null;
  /** The 2 pt signal ring: 3 plates or more, outside retake mode. */
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

  const edgeStyle = useAnimatedStyle(() => ({
    opacity: 1 - ringOn.get(),
    borderColor: interpolateColor(press.progress.get(), [0, 1], [ref.color.hairline, ref.color.read]),
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOn.get(),
    borderColor: interpolateColor(press.progress.get(), [0, 1], [ref.color.signal, ref.color.signalPressed]),
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
        <View style={styles.well}>
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
        <Animated.View pointerEvents="none" style={[styles.edge, edgeStyle]} />
        <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
        <FocusRing visible={focus.focused} shape="panel" />
      </Pressable>
    </Dimmable>
  );
}

const styles = StyleSheet.create({
  window: { width: L.plateBox, height: L.plateBox },
  well: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
    backgroundColor: ref.panel.fill,
    borderRadius: ref.panel.radius,
    ...ref.curve,
  },
  edge: {
    ...StyleSheet.absoluteFill,
    borderWidth: ref.panel.borderWidth,
    borderRadius: ref.panel.radius,
    ...ref.curve,
  },
  ring: {
    ...StyleSheet.absoluteFill,
    borderWidth: L.ringWidth,
    borderRadius: ref.panel.radius,
    ...ref.curve,
  },
});
