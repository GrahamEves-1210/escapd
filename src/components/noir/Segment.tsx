import { useState } from "react";
import { Pressable, StyleSheet, View, type Insets, type StyleProp, type ViewStyle } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle } from "react-native-reanimated";
import { ref } from "@/theme/tokens";
import { FocusRing } from "./focus";
import { trackingPad } from "./NoirText";
import { usePressProgress, useStateProgress } from "./motion";

const S = ref.button.segment;

// Each option is a Pressable at least 44 x 44; the 36 track is drawn centred behind them.
const ROW_HEIGHT = Math.max(ref.hit.min, S.height);
const TRACK_TOP = (ROW_HEIGHT - S.height) / 2;

export interface SegmentOption<T extends string> {
  value: T;
  /** Short mono label, e.g. "1×" or "ON" (ref.type.label, uppercase). */
  label: string;
  /** What a screen reader says for this option in radio mode, e.g. "Main lens". Defaults to `label`. */
  accessibilityLabel?: string;
}

export interface SegmentProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** The group's name: the radiogroup label ("Lens") or, in switch mode, the switch's label ("Show interactives"). */
  accessibilityLabel: string;
  /**
   * "radio" (default): a radiogroup whose options are `radio` elements with
   * `selected`. "switch": exactly two options [off, on]; the whole control is
   * one `switch` element with `checked` = the second option is selected.
   */
  mode?: "radio" | "switch";
  /** Width of each option (and its half of the track). At least ref.hit.min. */
  optionWidth: number;
  /** Thumb inset from the track's top, bottom and outer ends. Default ref.space.xs (4). */
  thumbInset?: number;
  /** Space between neighbouring thumbs' inner edges. Default 0: thumbs meet at the boundary. */
  thumbGap?: number;
  /** Whole control at ref.button.disabledOpacity, no press response. */
  disabled?: boolean;
  /** Per option. Keep it inside the parent's bounds (Android does not deliver touches outside them). */
  hitSlop?: number | Insets;
  /** Caps label growth where a screen's spec says so. */
  labelMaxFontSizeMultiplier?: number;
  testID?: string;
  /** Outer layout only (position, margins). */
  style?: StyleProp<ViewStyle>;
}

interface ThumbBox {
  left: number;
  width: number;
}

function thumbBox(index: number, count: number, w: number, inset: number, gap: number): ThumbBox {
  const left = index === 0 ? inset : index * w + gap / 2;
  const right = index === count - 1 ? count * w - inset : (index + 1) * w - gap / 2;
  return { left, width: right - left };
}

/**
 * Noir segment (ref.button.segment). Selecting swaps the label colours, and the
 * thumb fades out under the old option and in under the new one over
 * ref.motion.control. It never slides. Labels are centred on their thumbs.
 * The focus outline goes around the whole track.
 */
export function Segment<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  mode = "radio",
  optionWidth,
  thumbInset = ref.space.xs,
  thumbGap = 0,
  disabled = false,
  hitSlop,
  labelMaxFontSizeMultiplier,
  testID,
  style,
}: SegmentProps<T>) {
  const [focused, setFocused] = useState(false);
  const w = Math.max(optionWidth, ref.hit.min);
  const width = w * options.length;
  const isSwitch = mode === "switch" && options.length === 2;
  const checked = isSwitch && value === options[1].value;

  const focusHandlers = { onFocus: () => setFocused(true), onBlur: () => setFocused(false) };

  const items = options.map((option, i) => (
    <SegmentItem
      key={option.value}
      option={option}
      index={i}
      optionWidth={w}
      thumb={thumbBox(i, options.length, w, thumbInset, thumbGap)}
      thumbInset={thumbInset}
      selected={option.value === value}
      exposed={!isSwitch}
      disabled={disabled}
      hitSlop={hitSlop}
      labelMaxFontSizeMultiplier={labelMaxFontSizeMultiplier}
      onSelect={() => onChange(option.value)}
      {...(isSwitch ? null : focusHandlers)}
    />
  ));

  const frame = [styles.frame, { width }, disabled && styles.disabled, style];
  // The ring sits in its own unbordered box the size of the track, so its -4
  // inset is measured from the track's outer edge.
  const track = (
    <>
      <View pointerEvents="none" style={[styles.track, { width }]} />
      <View pointerEvents="none" style={[styles.trackBox, { width }]}>
        <FocusRing visible={focused} shape="pill" />
      </View>
    </>
  );

  if (isSwitch) {
    const toggle = () => onChange(checked ? options[0].value : options[1].value);
    return (
      <Pressable
        testID={testID}
        accessibilityRole="switch"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ checked, disabled }}
        disabled={disabled}
        onPress={toggle}
        onAccessibilityTap={disabled ? undefined : toggle}
        {...focusHandlers}
        style={frame}
      >
        {track}
        {items}
      </Pressable>
    );
  }

  return (
    <View testID={testID} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={frame}>
      {track}
      {items}
    </View>
  );
}

function SegmentItem<T extends string>({
  option,
  index,
  optionWidth,
  thumb,
  thumbInset,
  selected,
  exposed,
  disabled,
  hitSlop,
  labelMaxFontSizeMultiplier,
  onSelect,
  onFocus,
  onBlur,
}: {
  option: SegmentOption<T>;
  index: number;
  optionWidth: number;
  thumb: ThumbBox;
  thumbInset: number;
  selected: boolean;
  exposed: boolean;
  disabled: boolean;
  hitSlop?: number | Insets;
  labelMaxFontSizeMultiplier?: number;
  onSelect: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const press = usePressProgress();
  const on = useStateProgress(selected);
  const thumbStyle = useAnimatedStyle(() => ({ opacity: on.get() }));
  const labelStyle = useAnimatedStyle(() => {
    // Inactive: meta, read while pressed. Active: bright.
    const inactive = interpolateColor(press.progress.get(), [0, 1], [S.inactive, ref.color.read]);
    return { color: interpolateColor(on.get(), [0, 1], [inactive, S.active]) };
  });
  const thumbFrame = { left: thumb.left, width: thumb.width, top: TRACK_TOP + thumbInset, height: S.height - thumbInset * 2 };
  const labelFrame = { left: thumb.left, width: thumb.width, top: TRACK_TOP, height: S.height };

  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.thumb, thumbFrame, thumbStyle]} />
      <View pointerEvents="none" style={[styles.labelBox, labelFrame]}>
        <Animated.Text
          style={[ref.type.label, trackingPad(ref.type.label), labelStyle]}
          maxFontSizeMultiplier={labelMaxFontSizeMultiplier}
          accessible={false}
          importantForAccessibility="no"
        >
          {option.label}
        </Animated.Text>
      </View>
      <Pressable
        accessible={exposed}
        importantForAccessibility={exposed ? "auto" : "no"}
        focusable={exposed}
        accessibilityRole={exposed ? "radio" : undefined}
        accessibilityLabel={exposed ? option.accessibilityLabel ?? option.label : undefined}
        accessibilityState={exposed ? { selected, disabled } : undefined}
        disabled={disabled}
        hitSlop={hitSlop}
        onPress={onSelect}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onFocus={onFocus}
        onBlur={onBlur}
        style={[styles.option, { left: index * optionWidth, width: optionWidth }]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  frame: { height: ROW_HEIGHT },
  track: {
    position: "absolute",
    left: 0,
    top: TRACK_TOP,
    height: S.height,
    borderRadius: S.radius,
    borderWidth: S.borderWidth,
    borderColor: S.border,
    backgroundColor: S.fill,
    ...ref.curve,
  },
  trackBox: { position: "absolute", left: 0, top: TRACK_TOP, height: S.height },
  thumb: { position: "absolute", borderRadius: S.radius, backgroundColor: S.thumbFill, ...ref.curve },
  labelBox: { position: "absolute", alignItems: "center", justifyContent: "center" },
  option: { position: "absolute", top: 0, height: ROW_HEIGHT },
  disabled: { opacity: ref.button.disabledOpacity },
});
