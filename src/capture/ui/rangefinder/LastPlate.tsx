// The prints: the photos taken, piling up in the camera's tray (ART.tray, a
// felt-lined well in a brass rim under a brass cover, drawn round the 72
// control). Each photo is a print (Print: ART.print, a sheet of photo paper
// with its picture cut clear, the photo laid behind it, cover-cropped to the
// sheet's 3:4). The newest lies on top; the one before it shows under it,
// leaning; from three photos a third sheet shows under that. Before photo 1
// the tray is empty. In retake mode the tray holds the photo being replaced,
// alone.
// - A photo taken (`count` going up): its print slides out from under the
//   tray's cover onto the pile over CHROME.print.slide, while the print it
//   covers leans aside (that print stays mounted, so its photo never blinks).
//   Reduced motion: it is simply there.
// - The way on: from MIN_PLATES (outside retake mode) a 1 pt ring in the
//   palette's cue colour closes round the well; its label says the case is
//   ready to build.
// - Pressed: ref.button.thumbnail.pressedOpacity 0.75.
// - Disabled before photo 1 (a full-opacity empty tray) and while busy
//   (dimmed, keeping its prints and ring).
// - Focus: the kit's brass ring 2 outside the control, concentric with it.
// - In a mode (src/capture/ui/palette.ts): the way-on ring in its stamp colour
//   and the photos in the mode's baked treatment (TreatedImage, at the review
//   tiles' bake size so one bake serves both): each new photo shows as taken,
//   then its treatment fades in over ref.motion.treatment (at once under
//   reduced motion). The tray and the paper are the same in every mode.
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useFeedback } from "@/game/feedback";
import { Image, type ImageTransition } from "expo-image";
import Animated, { Easing, ReduceMotion, interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { FocusRing, TreatedImage, useFocusRing, useStateProgress } from "@/components/noir";
import type { Genre } from "@/lib/puzzle-types";
import { useTheme } from "@/theme/ThemeProvider";
import { curve, ref } from "@/theme/tokens";
import { ART } from "../art";
import { CHROME } from "../look";
import { useCapturePalette } from "../palette";
import { Dimmable } from "./Dimmable";

const T = ref.button.thumbnail;
const CUE = ref.layout.camera.cue;
const BAKE = ref.layout.review.tile.bake;
const Y = CHROME.tray;
const P = CHROME.print;
// The well the prints lie in, from under the cover down to the tray's foot.
const WELL = { width: T.size - Y.inset * 2, height: T.size - Y.inset - Y.slot };
const SLIDE = { duration: P.slide, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never };

const SWAP: ImageTransition = {
  duration: ref.motion.control.duration,
  timing: ref.motion.control.easing,
  effect: "cross-dissolve",
};

export interface LastPlateProps {
  /** The newest plate (or, in retake mode, the plate being replaced); null for the empty tray. */
  uri: string | null;
  /** The photo before it, lying under it; null when there is none (or in retake mode). */
  under?: string | null;
  /** Photos on the roll: one more slides a new print out; from three a third sheet shows in the pile. */
  count?: number;
  /** The way-on ring: MIN_PLATES or more, outside retake mode. */
  ring: boolean;
  accessibilityLabel: string;
  disabled: boolean;
  /** Busy: the whole control at the disabled opacity. The empty well never dims. */
  dimmed: boolean;
  onPress: () => void;
  testID?: string;
}

export function LastPlate({ uri, under = null, count = 0, ring, accessibilityLabel, disabled, dimmed, onPress, testID }: LastPlateProps) {
  const { reducedMotion } = useTheme();
  const ringOn = useStateProgress(ring);
  const focus = useFocusRing();
  const feedback = useFeedback();
  const palette = useCapturePalette();
  const ringStyle = useAnimatedStyle(() => ({ opacity: ringOn.get() }));
  // The roll just grew: the newest print is one that slides out (state from a prop, so it holds from its first frame).
  const [seen, setSeen] = useState({ count, grew: false });
  if (seen.count !== count) setSeen({ count, grew: count > seen.count });
  const slide = seen.count === count ? seen.grew : count > seen.count;
  // The pile, bottom to top, keyed by the photo's place on the roll: the print that was on top stays mounted as it becomes the one under.
  const pile = uri
    ? [...(under ? [{ uri: under, top: false, key: `${count - 2}:${under}` }] : []), { uri, top: true, key: `${count - 1}:${uri}` }]
    : [];

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
        <Image source={ART.tray} pointerEvents="none" accessible={false} style={styles.tray} testID={testID ? `${testID}-tray` : undefined} />
        {/* The well clips the prints: its top edge is the cover's, so a new print comes out from under it. */}
        <View pointerEvents="none" style={styles.well} testID={testID ? `${testID}-image` : undefined}>
          {pile.length > 1 && count > 2 ? (
            <View style={[styles.print, styles.back]} testID={testID ? `${testID}-pile` : undefined}>
              <Print uri={null} genre={null} />
            </View>
          ) : null}
          {pile.map((print) => (
            <PileSheet key={print.key} top={print.top} slide={slide && !reducedMotion} still={reducedMotion}>
              <Print uri={print.uri} genre={palette.genre} testID={testID ? `${testID}-${print.top ? "photo" : "under"}` : undefined} />
            </PileSheet>
          ))}
        </View>
        <Animated.View
          pointerEvents="none"
          style={[styles.ring, { borderColor: palette.cue }, ringStyle]}
          testID={testID ? `${testID}-ring` : undefined}
        />
        <FocusRing visible={focus.focused} shape="panel" radius={T.radius} />
      </Pressable>
    </Dimmable>
  );
}

/**
 * A print's place in the pile. On top it lies square; mounted as a photo
 * joins the roll (`slide`) it starts wholly under the cover, from its first
 * frame, and slides out. Once another print covers it, it leans aside.
 */
function PileSheet({ top, slide, still, children }: { top: boolean; slide: boolean; still: boolean; children: ReactNode }) {
  const [emerges] = useState(top && slide);
  const out = useSharedValue(emerges ? 0 : 1);
  const lean = useSharedValue(top ? 0 : 1);
  useEffect(() => {
    if (emerges) out.set(withTiming(1, SLIDE));
  }, [emerges, out]);
  useEffect(() => {
    lean.set(still ? (top ? 0 : 1) : withTiming(top ? 0 : 1, SLIDE));
  }, [top, still, lean]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(out.get(), [0, 1], [-(P.top + P.height + P.margin), 0]) }, { rotate: `${lean.get() * P.lean}deg` }],
  }));
  return <Animated.View style={[styles.print, style]}>{children}</Animated.View>;
}

/** One print: the photo (or bare paper) behind the rendered sheet, whose picture is cut clear. */
function Print({ uri, genre, testID }: { uri: string | null; genre: Genre | null; testID?: string }) {
  return (
    <>
      <View style={styles.photo}>
        {uri && genre ? (
          <TreatedImage source={uri} genre={genre} maxEdge={BAKE} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} testID={testID} />
        ) : uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={SWAP} accessible={false} testID={testID} />
        ) : null}
      </View>
      <Image source={ART.print} pointerEvents="none" accessible={false} style={styles.sheet} />
    </>
  );
}

const styles = StyleSheet.create({
  // The 72 control carries no border, so the focus ring measures from its outer edge.
  frame: {
    width: T.size,
    height: T.size,
    borderRadius: T.radius,
    ...curve,
  },
  pressed: { opacity: T.pressedOpacity },
  // The tray's picture round the control; its cover stands over the control's top.
  tray: {
    position: "absolute",
    left: -Y.side,
    top: -Y.top,
    width: T.size + Y.side * 2,
    height: T.size + Y.top + Y.side,
  },
  well: {
    position: "absolute",
    left: Y.inset,
    top: Y.slot,
    width: WELL.width,
    height: WELL.height,
    overflow: "hidden",
    borderBottomLeftRadius: Y.radius,
    borderBottomRightRadius: Y.radius,
    ...curve,
  },
  // A print's sheet, centred across the well, just out from under the cover.
  print: {
    position: "absolute",
    left: (WELL.width - P.width) / 2,
    top: P.top,
    width: P.width,
    height: P.height,
  },
  back: { transform: [{ rotate: `${P.leanBack}deg` }] },
  // The photo, behind the sheet's cut-out (and paper where there is none).
  photo: {
    position: "absolute",
    left: P.border,
    top: P.border,
    right: P.border,
    bottom: P.border,
    overflow: "hidden",
    backgroundColor: P.paper,
  },
  sheet: {
    position: "absolute",
    left: -P.margin,
    top: -P.margin,
    width: P.width + P.margin * 2,
    height: P.height + P.margin * 2,
  },
  // The way on: a ring round the well, inside the brass.
  ring: {
    position: "absolute",
    left: Y.inset,
    top: Y.inset,
    right: Y.inset,
    bottom: Y.inset,
    borderWidth: CUE.width,
    borderRadius: Y.radius,
    ...curve,
  },
});
