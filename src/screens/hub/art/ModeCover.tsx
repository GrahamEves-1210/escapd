// A mode's drawn cover (draw.ts), filling its frame: the default art of
// home's cards and the mode screens' banners until the player has
// photographed a room (src/screens/mode/art.ts). The frame shows the mode's
// surface colour; once it has been laid out, the cover is baked for its size
// (bake.ts) and fades in over it on ref.motion.treatment, as a treated photo
// does (TreatedImage); under reduced motion it is simply there, and a cover
// baked before this mounted shows straight away. When the frame changes size
// the cover it has stays, stretched to cover, until the new size is baked.
// Decorative: hidden from accessibility.
import { useEffect, useRef, useState } from "react";
import { PixelRatio, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import type { SkImage } from "@shopify/react-native-skia";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { timingFor } from "@/components/noir/motion";
import type { Genre } from "@/lib/puzzle-types";
import { useTheme } from "@/theme/ThemeProvider";
import { modeThemes, ref } from "@/theme/tokens";
import { peekCover, useCover, type CoverFrame } from "./bake";

const FADE = timingFor(ref.motion.treatment);

export interface ModeCoverProps {
  genre: Genre;
  /** The frame: size, place, corners. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function ModeCover({ genre, style, testID }: ModeCoverProps) {
  const theme = modeThemes[genre];
  const { reducedMotion } = useTheme();
  const [frame, setFrame] = useState<CoverFrame | null>(null);
  const image = useCover(genre, frame);
  // The cover on show: the last one baked, kept while a new size bakes.
  const [shown, setShown] = useState<SkImage | null>(null);
  if (image && image !== shown) setShown(image);
  const opacity = useSharedValue(0);
  // Its first layout found the cover already baked: no fade from the surface.
  const instant = useRef(false);
  const faded = useRef(false);

  // The first cover fades in; a later size swaps in under the one on show.
  const ready = shown !== null;
  useEffect(() => {
    if (!ready || faded.current) return;
    faded.current = true;
    opacity.set(instant.current || reducedMotion ? 1 : withTiming(1, FADE));
  }, [ready, reducedMotion, opacity]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const next = { w: width, h: height, scale: PixelRatio.get() };
    if (frame && frame.w === next.w && frame.h === next.h && frame.scale === next.scale) return;
    // Baked before: there at once, no fade from the surface.
    if (shown === null && peekCover(genre, next)) {
      instant.current = true;
      opacity.set(1);
    }
    setFrame(next);
  };

  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <View
      style={[styles.frame, { backgroundColor: theme.surface }, style]}
      onLayout={onLayout}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      {/* Mounted from the start, so its opacity is current when the cover arrives. */}
      <Animated.View style={[StyleSheet.absoluteFill, fade]} testID={testID ? `${testID}-cover` : undefined}>
        {shown && frame ? <CoverCanvas image={shown} width={frame.w} height={frame.h} /> : null}
      </Animated.View>
    </View>
  );
}

/**
 * The baked cover on a Skia canvas, scaled to cover the frame. Skia is
 * required here, not imported: a cover only exists once Skia has loaded
 * (on the web, CanvasKit).
 */
function CoverCanvas({ image, width, height }: { image: SkImage; width: number; height: number }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Canvas, Image } = require("@shopify/react-native-skia") as typeof import("@shopify/react-native-skia");
  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Image image={image} x={0} y={0} width={width} height={height} fit="cover" />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden" },
});
