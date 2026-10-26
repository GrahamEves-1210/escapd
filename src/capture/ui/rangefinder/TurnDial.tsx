// The turn dial (docs/DESIGN.md 02): how far round the room the player is,
// on the feed at the top of the viewfinder. The privacy note's see-through
// black pill (void at note.fillOpacity, radius.round) holding a small dial
// and "Photo 2 of 6" in the meta style, white. The dial is a compass seen
// from above: a thin textTertiary ring with a stop for each photo, photo 1 at
// the top and the rest clockwise, `step` apart (src/capture/turn.ts). Taken
// photos are white dots, the next a white ring, the rest small grey dots.
// While the phone's motion is tracked (useTurnTracking) a white arc grows
// along the ring from the last stop toward the next; once the turn is far
// enough the next stop fills and the light tick plays (onReached).
// - Static wherever tracking isn't: the web, no motion sensor, the first
//   photo, retake mode, a busy or stopped camera, all 6 taken.
// - Reduce Motion: the arc steps in quarters instead of following the turn.
// - Neutral instrument greys and white in every mode, as the privacy note.
// - Screen readers: one element, "Photo 2 of 6.", and "Far enough. Take the
//   photo." added (and announced once) when the turn is far enough.
import { useCallback } from "react";
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { arcPath, dialPoint, dialStops } from "@/capture/turn";
import { useTheme } from "@/theme/ThemeProvider";
import { curve, ref } from "@/theme/tokens";
import { COPY } from "./copy";
import { useTurnTracking } from "./useTurnTracking";

const L = ref.layout.camera;
const T = L.turn;
const C = T.dial / 2;
const R = C - T.ring;

export interface TurnDialProps {
  /** Photos all the way round (turnPlan's shots). */
  shots: number;
  /** Degrees between them (turnPlan's step). */
  step: number;
  /** Which stops hold a photo. */
  taken: readonly boolean[];
  /** The next stop (the photo about to be taken), or null once all are taken. */
  target: number | null;
  /** Track the turn live (the next photo follows a turn and the camera can take it). */
  active: boolean;
  /** Changes with every photo: the turn restarts. */
  resetKey: string;
  line: string;
  /** The label without the "far enough" sentence; the dial adds it. */
  accessibilityLabel: (reached: boolean) => string;
  /** The light tick. */
  onReached: () => void;
}

export function TurnDial({ shots, step, taken, target, active, resetKey, line, accessibilityLabel, onReached }: TurnDialProps) {
  const { reducedMotion } = useTheme();
  const reachedNow = useCallback(() => {
    onReached();
    AccessibilityInfo.announceForAccessibility(COPY.turnReached);
  }, [onReached]);
  const turn = useTurnTracking({ active, step, resetKey, reducedMotion, onReached: reachedNow });
  const stops = dialStops(shots, step);
  // The arc runs from the stop before the target, clockwise.
  const from = target === null ? 0 : stops[(target - 1 + shots) % shots];
  const arc = turn.tracking && target !== null ? arcPath(C, C, R, from, turn.progress * step) : "";

  return (
    <View
      style={styles.slot}
      pointerEvents="none"
      // One screen-reader element that is never a keyboard stop (as the counter).
      accessible={Platform.OS === "ios"}
      screenReaderFocusable
      accessibilityLabel={accessibilityLabel(turn.reached)}
      testID="turn-dial"
    >
      <View style={styles.pill}>
        <View style={styles.fill} testID="turn-dial-fill" />
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Svg width={T.dial} height={T.dial} viewBox={`0 0 ${T.dial} ${T.dial}`} testID="turn-dial-face">
            <Circle cx={C} cy={C} r={R} stroke={ref.color.textTertiary} strokeWidth={T.ringWidth} fill="none" />
            {arc ? (
              <Path d={arc} stroke={ref.color.textPrimary} strokeWidth={T.arc} strokeLinecap="round" fill="none" testID="turn-dial-arc" />
            ) : null}
            {stops.map((deg, i) => {
              const p = dialPoint(C, C, R, deg);
              if (i === target) {
                const filled = turn.reached;
                return (
                  <Circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={T.target}
                    stroke={ref.color.textPrimary}
                    strokeWidth={T.targetLine}
                    fill={filled ? ref.color.textPrimary : ref.color.void}
                    testID={filled ? "turn-dial-target-reached" : "turn-dial-target"}
                  />
                );
              }
              return taken[i] ? (
                <Circle key={i} cx={p.x} cy={p.y} r={T.taken} fill={ref.color.textPrimary} testID="turn-dial-taken" />
              ) : (
                <Circle key={i} cx={p.x} cy={p.y} r={T.rest} fill={ref.color.textSecondary} testID="turn-dial-rest" />
              );
            })}
          </Svg>
        </View>
        <Text style={styles.line} numberOfLines={1} accessibilityElementsHidden importantForAccessibility="no">
          {line}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Top-centred on the feed.
  slot: { position: "absolute", left: 0, right: 0, top: T.inset, alignItems: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: T.gap,
    overflow: "hidden",
    borderRadius: ref.radius.round,
    paddingLeft: T.padLeft,
    paddingRight: T.padRight,
    paddingVertical: T.padY,
    ...curve,
  },
  fill: { ...StyleSheet.absoluteFill, backgroundColor: ref.color.void, opacity: L.note.fillOpacity },
  line: { ...ref.type.meta, color: ref.color.textPrimary },
});
