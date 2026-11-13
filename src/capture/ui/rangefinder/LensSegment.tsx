// The lens selector: a slide switch. A 100 x 40 slot in a rendered brass rim
// (ART.lensTrack; the slot itself in the palette's well colour, radius 16)
// and a rendered cursor, a brass frame round a black plate (ART.lensThumb,
// 45 x 32) inset 4, that slides to the chosen lens over
// ref.motion.segmentSlide. Labels are the system semibold label style
// (ref.type.label 13/16), both the same size: the palette's ink in the
// cursor, textTertiary off it, and the chosen one is followed by a thin
// xmark ("1.0 ×": Phosphor X, bold, at ref.layout.camera.lensMark). Each half
// is a 50 x 48 target and offers the iOS large-content viewer.
// - Pressed: the other half's label eases textTertiary to textSecondary.
// - Reduced motion: the cursor fades out and back in at the new half over
//   motion.reducedFade instead of sliding.
// - Labels cap at ref.layout.camera.lensMaxFontScale, so "0.5 ×" stays inside
//   the cursor.
// - Focus: one brass ring around the whole track while either half has
//   keyboard or switch focus.
// - VoiceOver and TalkBack: a radiogroup "Lens" holding two radios.
// - Disabled sets the state and blocks presses; the Dimmable around it eases
//   the dim.
// - In a mode: the slot in the mode's well, the chosen label and its mark in
//   the mode's ink (src/capture/ui/palette.ts); the brass is the same.
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import Animated, { ReduceMotion, interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { FocusRing, timingFor, usePressProgress, useStateProgress } from "@/components/noir";
import { XIcon } from "@/components/icons";
import { useTheme } from "@/theme/ThemeProvider";
import { curve, motion, ref } from "@/theme/tokens";
import { ART } from "../art";
import { CHROME } from "../look";
import { useCapturePalette } from "../palette";
import { COPY } from "./copy";
import type { LensChoice } from "./useLenses";

const L = ref.layout.camera;
const G = ref.button.segment;

interface LensOption {
  value: LensChoice;
  label: string;
  accessibilityLabel: string;
}

const OPTIONS: readonly LensOption[] = [
  { value: "wide", label: COPY.ultraWideLabel, accessibilityLabel: COPY.ultraWide },
  { value: "main", label: COPY.mainLensLabel, accessibilityLabel: COPY.mainLens },
];

// Each half is a 50 x 48 Pressable (ref.hit.comfortable). The track, the thumb and
// the labels are drawn centred behind them, with pointerEvents none.
const HALF = G.width / OPTIONS.length;
const HEIGHT = ref.hit.comfortable;
const TRACK_TOP = (HEIGHT - G.height) / 2;
// The thumb's two stops: inset from the track's outer ends (4 and 51).
const SLOTS = [G.inset, G.width - G.inset - G.thumbWidth] as const;
const SLIDE = timingFor(ref.motion.segmentSlide);
const REDUCED = { duration: motion.reducedFade, reduceMotion: ReduceMotion.Never };

export interface LensSegmentProps {
  value: LensChoice;
  onChange: (value: LensChoice) => void;
  disabled: boolean;
  testID?: string;
}

export function LensSegment({ value, onChange, disabled, testID }: LensSegmentProps) {
  const { reducedMotion } = useTheme();
  const palette = useCapturePalette();
  const [focused, setFocused] = useState(false);
  const index = OPTIONS.findIndex((option) => option.value === value);
  const pos = useSharedValue(index);
  useEffect(() => {
    pos.set(withTiming(index, reducedMotion ? REDUCED : SLIDE));
  }, [index, reducedMotion, pos]);

  const thumbStyle = useAnimatedStyle(() => {
    const p = pos.get();
    if (!reducedMotion) return { opacity: 1, transform: [{ translateX: interpolate(p, [0, 1], SLOTS) }] };
    // Out under the old half, in under the new one; it jumps halfway, unseen.
    const half = Math.round(p);
    return { opacity: 1 - 2 * Math.abs(p - half), transform: [{ translateX: SLOTS[half] }] };
  });

  return (
    <View testID={testID} accessibilityRole="radiogroup" accessibilityLabel={COPY.lens} style={styles.frame}>
      <View pointerEvents="none" style={[styles.track, { backgroundColor: palette.well }]} testID={testID ? `${testID}-track` : undefined}>
        <Image source={ART.lensTrack} accessible={false} style={styles.trackArt} testID={testID ? `${testID}-track-art` : undefined} />
        <Animated.View style={[styles.thumb, thumbStyle]} testID={testID ? `${testID}-thumb` : undefined}>
          <Image source={ART.lensThumb} accessible={false} style={styles.thumbArt} />
        </Animated.View>
        <FocusRing visible={focused} shape="panel" radius={G.radius} />
      </View>
      {OPTIONS.map((option, i) => (
        <LensHalf
          key={option.value}
          option={option}
          index={i}
          selected={i === index}
          active={palette.ink}
          disabled={disabled}
          onSelect={() => onChange(option.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      ))}
    </View>
  );
}

function LensHalf({
  option,
  index,
  selected,
  active,
  disabled,
  onSelect,
  onFocus,
  onBlur,
}: {
  option: LensOption;
  index: number;
  selected: boolean;
  /** The chosen label's and mark's colour. */
  active: string;
  disabled: boolean;
  onSelect: () => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const press = usePressProgress();
  const on = useStateProgress(selected);
  const labelStyle = useAnimatedStyle(() => {
    const inactive = interpolateColor(press.progress.get(), [0, 1], [G.inactive, ref.color.textSecondary]);
    return { color: interpolateColor(on.get(), [0, 1], [inactive, active]) };
  });
  // The large-content viewer shows the label as Once writes it, "1.0 ×".
  const title = selected ? `${option.label}${COPY.lensMark}` : option.label;

  return (
    <>
      <View pointerEvents="none" style={[styles.labelBox, { left: SLOTS[index] }]}>
        <Animated.Text
          style={[styles.label, labelStyle]}
          numberOfLines={1}
          maxFontSizeMultiplier={L.lensMaxFontScale}
          accessible={false}
          importantForAccessibility="no"
        >
          {option.label}
        </Animated.Text>
        {selected ? (
          <View style={styles.mark}>
            <XIcon size={L.lensMark.size} color={active} weight="bold" testID="lens-mark" />
          </View>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel={option.accessibilityLabel}
        accessibilityState={{ selected, disabled }}
        accessibilityShowsLargeContentViewer
        accessibilityLargeContentTitle={title}
        disabled={disabled}
        onPress={onSelect}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onFocus={onFocus}
        onBlur={onBlur}
        style={[styles.option, { left: index * HALF }]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  frame: { width: G.width, height: HEIGHT },
  track: {
    position: "absolute",
    left: 0,
    top: TRACK_TOP,
    width: G.width,
    height: G.height,
    borderRadius: G.radius,
    ...curve,
  },
  thumb: {
    position: "absolute",
    left: 0,
    top: G.inset,
    width: G.thumbWidth,
    height: G.thumbHeight,
    borderRadius: G.thumbRadius,
    ...curve,
  },
  // The label (and the chosen one's mark) centred on its thumb's stop.
  // The rim's and the cursor's pictures, each centred on its box.
  trackArt: {
    position: "absolute",
    left: -CHROME.lens.track,
    top: -CHROME.lens.track,
    width: G.width + CHROME.lens.track * 2,
    height: G.height + CHROME.lens.track * 2,
  },
  thumbArt: {
    position: "absolute",
    left: -CHROME.lens.thumb,
    top: -CHROME.lens.thumb,
    width: G.thumbWidth + CHROME.lens.thumb * 2,
    height: G.thumbHeight + CHROME.lens.thumb * 2,
  },
  labelBox: {
    position: "absolute",
    top: TRACK_TOP + G.inset,
    width: G.thumbWidth,
    height: G.thumbHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  mark: { marginLeft: L.lensMark.gap },
  label: { ...ref.type.label },
  option: { position: "absolute", top: 0, width: HALF, height: HEIGHT },
});
