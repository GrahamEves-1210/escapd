// The envelope a case's letter arrives in (Brief.tsx's arrival), modelled and
// lit in Blender (scripts/blender/props/moment_open.py): flap side up on the
// desk, seen from a little off straight down so the flap reads as it lifts.
// - noir: a hotel's cream envelope lined in plum tissue, lips in lipstick
//   blotted on the flap;
// - crime scene: a kraft evidence envelope, its flap held by a string wound
//   between two card buttons;
// - paranormal: an old envelope lined in indigo, sealed in plum wax with a
//   crescent moon.
// Each is a sheet of frames (12 fps: the string comes off or the wax cracks
// in two, then the flap lifts and goes over) on one canvas, and the back
// panel alone (`back`, cut from the last frame) to lay over the letter, so
// the letter slides out of the envelope's mouth from under it.
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import type { Genre } from "@/lib/puzzle-types";

/**
 * The frames (moment_open.py prints these): each `width` x `height` points
 * on a sheet `columns` across, `frames` of them at `fps`; and on that canvas,
 * as shares of it, the envelope's mouth (its fold, where the letter comes
 * out), its foot and its sides.
 */
export const ENVELOPE = { width: 336, height: 325, columns: 3, rows: 2, frames: 5, fps: 12, mouth: 0.3613, foot: 0.9123, left: 0.0714, right: 0.9286 } as const;

const ART: Record<Genre, { sheet: number; back: number }> = {
  noir: { sheet: require("../../../assets/moments/open-noir.png") as number, back: require("../../../assets/moments/open-noir-back.png") as number },
  crime_scene: { sheet: require("../../../assets/moments/open-crime.png") as number, back: require("../../../assets/moments/open-crime-back.png") as number },
  paranormal: { sheet: require("../../../assets/moments/open-moon.png") as number, back: require("../../../assets/moments/open-moon-back.png") as number },
};

const SHOWN = { contentFit: "fill", cachePolicy: "memory-disk", transition: 0, accessible: false } as const;

/** The envelope at `frame` (0 shut .. ENVELOPE.frames - 1 open), its canvas `k` times its size in points. */
export const EnvelopeFrames = memo(function EnvelopeFrames({ genre, frame, k, onLoad }: { genre: Genre; frame: SharedValue<number>; k: number; onLoad?: () => void }) {
  const w = ENVELOPE.width * k, h = ENVELOPE.height * k;
  const strip = useAnimatedStyle(() => {
    const n = Math.max(0, Math.min(ENVELOPE.frames - 1, Math.round(frame.get())));
    return { transform: [{ translateX: -(n % ENVELOPE.columns) * w }, { translateY: -Math.floor(n / ENVELOPE.columns) * h }] };
  });
  return (
    <View style={[styles.frame, { width: w, height: h }]} pointerEvents="none" testID="brief-envelope-art">
      <Animated.View style={[{ width: w * ENVELOPE.columns, height: h * ENVELOPE.rows }, strip]}>
        <Image source={ART[genre].sheet} style={{ width: w * ENVELOPE.columns, height: h * ENVELOPE.rows }} onLoad={onLoad} onError={onLoad} {...SHOWN} />
      </Animated.View>
    </View>
  );
});

/** The open envelope's back panel on the same canvas: over the letter, so the letter comes out from under it. */
export const EnvelopeBack = memo(function EnvelopeBack({ genre, k }: { genre: Genre; k: number }) {
  return <Image source={ART[genre].back} style={{ width: ENVELOPE.width * k, height: ENVELOPE.height * k }} pointerEvents="none" {...SHOWN} />;
});

const styles = StyleSheet.create({
  frame: { overflow: "hidden" },
});
