// The lens control (docs/DESIGN.md 02), in the play screen's brass: a 100 x 36
// walnut track (color.surface, 1 pt color.hairline, radius.control) with a
// brass thumb (color.accent, 46 x 28, inset space.xs, radius.control - xs so
// the corners stay concentric) under the selected half, as the live primary
// Button and /play's switch track are brass. Labels are the live mono stamp:
// color.onAccent on the thumb, color.textSecondary off it. Each half is a
// 50 x 48 target and offers the iOS large-content viewer.
// - Selecting swaps the label colours, and the thumb fades out under the old
//   half and in under the new one over ref.motion.control. It never slides.
// - Pressed: the inactive half's label eases textSecondary to text.
// - Labels cap at ref.layout.camera.lensMaxFontScale, so "0.5×" fits its 46
//   thumb; at accessibility text sizes a long press shows them in the iOS
//   large-content viewer.
// - Focus: one brass ring around the whole track (the kit's "control" shape,
//   concentric with the 8 pt track) while either half has keyboard or switch
//   focus.
// - VoiceOver and TalkBack: a radiogroup "Lens" holding two radios.
// - Disabled sets the state and blocks presses; the Dimmable around it eases
//   the dim.
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle } from "react-native-reanimated";
import { FocusRing, trackingPad, usePressProgress, useStateProgress } from "@/components/noir";
import { color, curve, hit, radius, ref, space, type as typeScale } from "@/theme/tokens";
import { COPY } from "./copy";
import type { LensChoice } from "./useLenses";

const L = ref.layout.camera;

interface LensOption {
  value: LensChoice;
  /** The mono label; the "×" always shows, so nothing reflows when the lens changes. */
  label: string;
  accessibilityLabel: string;
}

const OPTIONS: readonly LensOption[] = [
  { value: "wide", label: COPY.ultraWideLabel, accessibilityLabel: COPY.ultraWide },
  { value: "main", label: COPY.mainLensLabel, accessibilityLabel: COPY.mainLens },
];

// Each half is a 50 x 48 Pressable (hit.min tall). The track and its thumbs
// are drawn centred behind them, with pointerEvents none.
const HALF = L.lensOptionWidth;
const WIDTH = HALF * OPTIONS.length;
const HEIGHT = hit.min;
const TRACK = L.lensTrack;
const TRACK_TOP = (HEIGHT - TRACK) / 2;
const INSET = space.xs;

/** A thumb is inset from the track's top, bottom and outer ends; neighbouring thumbs meet at the boundary. */
function thumbFor(index: number) {
  const left = index === 0 ? INSET : index * HALF;
  const right = index === OPTIONS.length - 1 ? WIDTH - INSET : (index + 1) * HALF;
  return { left, width: right - left };
}

export interface LensSegmentProps {
  value: LensChoice;
  onChange: (value: LensChoice) => void;
  disabled: boolean;
  testID?: string;
}

export function LensSegment({ value, onChange, disabled, testID }: LensSegmentProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View testID={testID} accessibilityRole="radiogroup" accessibilityLabel={COPY.lens} style={styles.frame}>
      <View pointerEvents="none" style={styles.track} />
      {/* The ring sits in an unbordered box the size of the track, so its inset measures from the track's outer edge. */}
      <View pointerEvents="none" style={styles.trackBox}>
        <FocusRing visible={focused} shape="control" />
      </View>
      {OPTIONS.map((option, i) => (
        <LensHalf
          key={option.value}
          option={option}
          index={i}
          selected={option.value === value}
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
  disabled,
  onSelect,
  onFocus,
  onBlur,
}: {
  option: LensOption;
  index: number;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const press = usePressProgress();
  const on = useStateProgress(selected);
  const thumbStyle = useAnimatedStyle(() => ({ opacity: on.get() }));
  const labelStyle = useAnimatedStyle(() => {
    // Off the thumb: secondary, text while pressed. On the thumb: onAccent.
    const inactive = interpolateColor(press.progress.get(), [0, 1], [color.textSecondary, color.text]);
    return { color: interpolateColor(on.get(), [0, 1], [inactive, color.onAccent]) };
  });
  const thumb = thumbFor(index);

  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.thumb, thumb, thumbStyle]} />
      <View pointerEvents="none" style={[styles.labelBox, thumb]}>
        <Animated.Text
          style={[typeScale.stamp, trackingPad(typeScale.stamp), labelStyle]}
          maxFontSizeMultiplier={L.lensMaxFontScale}
          accessible={false}
          importantForAccessibility="no"
        >
          {option.label}
        </Animated.Text>
      </View>
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel={option.accessibilityLabel}
        accessibilityState={{ selected, disabled }}
        accessibilityShowsLargeContentViewer
        accessibilityLargeContentTitle={option.label}
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
  frame: { width: WIDTH, height: HEIGHT },
  track: {
    position: "absolute",
    left: 0,
    top: TRACK_TOP,
    width: WIDTH,
    height: TRACK,
    borderRadius: radius.control,
    borderWidth: L.hairline,
    borderColor: color.hairline,
    backgroundColor: color.surface,
    ...curve,
  },
  trackBox: { position: "absolute", left: 0, top: TRACK_TOP, width: WIDTH, height: TRACK },
  thumb: {
    position: "absolute",
    top: TRACK_TOP + INSET,
    height: TRACK - INSET * 2,
    borderRadius: radius.control - INSET,
    backgroundColor: color.accent,
    ...curve,
  },
  labelBox: { position: "absolute", top: TRACK_TOP, height: TRACK, alignItems: "center", justifyContent: "center" },
  option: { position: "absolute", top: 0, width: HALF, height: HEIGHT },
});
