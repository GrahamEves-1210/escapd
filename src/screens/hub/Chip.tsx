// Opal's round header chip (docs/DESIGN.md, 01 · Layout: Header; the How you
// play sheet's Close): a 36 disc in `ground` (near-black) with a 1 pt diagonal
// ring, white 14 % on its top-left and bottom-right arcs and nothing at the
// other two corners (ref.layout.hub.chipRing). No shadow. A Phosphor glyph at
// 18 (ref.icon.chip) in textPrimary. The touch target is the 48 box around
// the disc, so no hitSlop has to reach outside a parent. Pressed opacity 0.75,
// disabled 0.4; the `press` haptic on press-in; the brass focus ring follows the disc. Also here: the How you
// play glyph, ESCAPD's three-rail sliders drawn to Opal's numbers.
import { useId, type ReactNode, type Ref } from "react";
import { StyleSheet, View, type HostInstance } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, Path } from "react-native-svg";
import { FocusRing, gradientStops, useFocusRing, SquashPressable } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { ref } from "@/theme/tokens";

const C = ref.button.chip;
const H = ref.layout.hub;
const MID = C.size / 2;
const S = H.sliders;
const GLYPH = ref.icon.chip;

export interface ChipProps {
  ref?: Ref<HostInstance>;
  accessibilityLabel: string;
  /** The glyph, drawn at ref.icon.chip in ref.color.textPrimary. */
  icon: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

export function Chip({ ref: pressableRef, accessibilityLabel, icon, onPress, disabled = false, testID }: ChipProps) {
  const focus = useFocusRing();
  const feedback = useFeedback();
  const id = `chip${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  return (
    <SquashPressable
      ref={pressableRef}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      // Pressable copies its own `disabled` into accessibilityState.
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => feedback.press()}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      testID={testID}
      style={({ pressed }) => [styles.hit, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <View style={styles.disc}>
        <Svg width={C.size} height={C.size} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            {/* Top right to bottom left: the arcs that project onto the middle (top left, bottom right) are the bright ones. */}
            <LinearGradient id={id} x1={1} y1={0} x2={0} y2={1}>
              {gradientStops(H.chipRing)}
            </LinearGradient>
          </Defs>
          <Circle cx={MID} cy={MID} r={MID - C.ringWidth / 2} fill="none" stroke={`url(#${id})`} strokeWidth={C.ringWidth} />
        </Svg>
        {icon}
        <FocusRing visible={focus.focused} shape="pill" />
      </View>
    </SquashPressable>
  );
}

const styles = StyleSheet.create({
  hit: { width: C.hit, height: C.hit, alignItems: "center", justifyContent: "center" },
  disc: {
    width: C.size,
    height: C.size,
    borderRadius: C.radius,
    backgroundColor: C.fill,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: C.pressedOpacity },
  disabled: { opacity: ref.button.disabledOpacity.icon },
});

/**
 * Three horizontal rails (13 wide, 1.2 stroke, 3.96 apart) with ring knobs
 * 3.8 across at 73 / 41 / 70 % along them, round caps, in the 18 glyph box,
 * textPrimary. Each rail stops under its knob's ring, so the ring stays hollow.
 */
export function SlidersGlyph() {
  const left = (GLYPH - S.width) / 2;
  const ring = (S.knob - S.stroke) / 2;
  // A rail's round cap ends on the ring's centre line, inside its stroke.
  const gap = ring + S.stroke / 2;
  const rails = S.knobs.map((share, i) => {
    const y = GLYPH / 2 + (i - 1) * S.pitch;
    const x = left + share * S.width;
    return { y, x, d: `M${left} ${y}H${x - gap}M${x + gap} ${y}H${left + S.width}` };
  });
  return (
    <Svg width={GLYPH} height={GLYPH} pointerEvents="none">
      <G fill="none" stroke={ref.color.textPrimary} strokeWidth={S.stroke} strokeLinecap="round">
        {rails.map((rail) => (
          <G key={rail.y}>
            <Path d={rail.d} />
            <Circle cx={rail.x} cy={rail.y} r={ring} />
          </G>
        ))}
      </G>
    </Svg>
  );
}
