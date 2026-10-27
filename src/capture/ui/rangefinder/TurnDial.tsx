// The turn dial (docs/DESIGN.md 02): how far round the room the player is,
// on the feed at the top of the viewfinder. The privacy note's see-through
// black pill (void at note.fillOpacity, radius.round) holding a small dial
// and "Photo 2 of 5" in the meta style, white. The dial is a compass seen
// from above: a thin textTertiary ring with a stop for each photo in the
// roll's plan, photo 1 at the top and the rest clockwise at their stops
// (src/capture/turn.ts: 5 72 apart on 0.5x, 6 60 apart on 1x; after a lens
// switch mid-roll the stops still to take re-space). Taken
// photos are white dots, the next a white ring, the rest small grey dots.
// While the phone's motion is tracked (useTurnTracking) a white arc grows
// along the ring from the last stop toward the next; once the turn is far
// enough the next stop fills and the light tick plays (onReached). The turn
// is measured against the gap to the target from the stop before it.
// - Static wherever tracking isn't: the web, no motion sensor, the first
//   photo, retake mode, a busy or stopped camera, every photo taken, and any photo
//   that doesn't follow the one the player just took (an open slot left by a
//   removed photo, a camera reopened on photos already taken): the target
//   ring still marks that photo's place round the circle.
// - Reduce Motion: the arc steps in quarters instead of following the turn.
// - Neutral instrument greys and white in every mode, as the privacy note.
// - Screen readers: one element, "Photo 2 of 5.", and "Far enough. Take the
//   photo." added (and announced once) when the turn is far enough.
import { useCallback } from "react";
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { arcPath, dialPoint, turnStep } from "@/capture/turn";
import { useTheme } from "@/theme/ThemeProvider";
import { curve, ref } from "@/theme/tokens";
import { COPY } from "./copy";
import { useTurnTracking } from "./useTurnTracking";

const L = ref.layout.camera;
const T = L.turn;
const C = T.dial / 2;
const R = C - T.ring;

export interface TurnDialProps {
  /** Each photo's stop, degrees clockwise from photo 1 (the roll plan's stops). */
  stops: readonly number[];
  /** Which stops hold a photo. */
  taken: readonly boolean[];
  /** The next stop (the photo about to be taken), or null once all are taken. */
  target: number | null;
  /** Keep counting the turn (the camera is live and taking photos in turn), shown or not. */
  listening: boolean;
  /** Show the turn live (the next photo follows the one the turn is counted from, and the camera can take it). */
  active: boolean;
  /** Changes the moment a photo is taken: the turn restarts from there. */
  resetKey: string;
  line: string;
  /** The label without the "far enough" sentence; the dial adds it. */
  accessibilityLabel: (reached: boolean) => string;
  /** The light tick. */
  onReached: () => void;
}

export function TurnDial({ stops, taken, target, listening, active, resetKey, line, accessibilityLabel, onReached }: TurnDialProps) {
  const { reducedMotion } = useTheme();
  const reachedNow = useCallback(() => {
    onReached();
    AccessibilityInfo.announceForAccessibility(COPY.turnReached);
  }, [onReached]);
  const shots = stops.length;
  // The turn to the target: from the stop before it.
  const step = target === null ? turnStep(stops, shots - 1) : turnStep(stops, target);
  const turn = useTurnTracking({ listening, active, step, resetKey, reducedMotion, onReached: reachedNow });
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
