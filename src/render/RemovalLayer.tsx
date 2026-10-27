// A taken object leaves the room (docs/DESIGN.md, Game feel · 4a): the
// room's filled patch over the object's box, on the stage, so it pans and
// zooms with the photo and shows on its own page whichever page is in view.
// It is derived from state: Player draws it while the object's inspect is
// solved (and its clue pocketed), so a resumed case shows the room as left.
// It fades in over ref.layout.play.removal.fade as the clue is pocketed, or
// over the treatment's fade when the patch is ready only after the solve;
// under reduced motion it is simply there. Never touchable, hidden from
// screen readers.
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { Image } from "expo-image";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import type { Size } from "./geometry";
import type { RemovalPatch } from "./removalPatch";

export interface RemovalLayerProps {
  patch: RemovalPatch;
  /** The image box (stage) it sits in, in points. */
  stage: Size;
  /** Fade over the full removal fade (the take, live); else the treatment's shorter one. */
  live: boolean;
  testID?: string;
}

export function RemovalLayer({ patch, stage, live, testID }: RemovalLayerProps) {
  const { reducedMotion } = useTheme();
  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (reducedMotion) {
      opacity.set(1);
      return;
    }
    const duration = live ? ref.layout.play.removal.fade : ref.motion.treatment.duration;
    opacity.set(withTiming(1, { duration, easing: Easing.out(Easing.quad) }));
    // Once, as it appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  if (stage.width <= 0 || stage.height <= 0) return null;
  const { rect } = patch;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
      style={[
        styles.patch,
        { left: rect.x * stage.width, top: rect.y * stage.height, width: rect.w * stage.width, height: rect.h * stage.height },
        fade,
      ]}
    >
      <Image source={{ uri: patch.uri }} style={StyleSheet.absoluteFill} contentFit="fill" transition={0} accessible={false} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  patch: { position: "absolute" },
});
