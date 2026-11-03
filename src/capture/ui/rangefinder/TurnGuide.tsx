// The turn guide (docs/DESIGN.md 02, the turn dial): over the feed between
// photos taken in turn, two lines the player brings together by turning in
// place.
// - The edge: the last photo, see-through, with a solid white line down its
//   right edge, fixed to the room. Right after the shutter it lies exactly
//   over the feed; as the phone turns right it slides left across the feed
//   by the turn the motion sensor measures (useTurnTracking), placed by the
//   lens's real view (src/capture/turn.ts, edgeX and ghostStrip: a pinhole
//   feed LENS_FOV across, the photo drawn in strips each stretched to its
//   place), so it stays on the same spot of the room. A small arrowhead on
//   the line points the way it moves.
// - The mark: a dashed white line where that edge has to be for the plan's
//   turn (targetX), still on the feed, with a tick top and bottom. Left of it
//   the next photo shares the last one's view: the plan's overlap. When the
//   turn is far enough the mark turns solid.
// Turn until the edge sits on the mark, and shoot: the photos then overlap by
// the plan's share. Without motion (the web, no sensor) the edge waits on the
// mark: the strip of the last photo the next one should share, still, to
// match the room against.
// White with a faint dark casing (src/capture/ui/look.ts) so both lines
// read on any wall. Decorative: the dial carries the words.
import { useEffect } from "react";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import Svg, { Line, Path } from "react-native-svg";
import { edgeX, ghostStrip, targetX } from "@/capture/turn";
import { ref } from "@/theme/tokens";
import { GUIDE } from "../look";

export interface TurnGuideProps {
  /** The last photo (the one the turn is counted from). */
  uri: string;
  /** The feed's size: the photo's frame, so the last photo lies exactly over it before any turn. */
  width: number;
  height: number;
  /** The lens's view across the frame, degrees (LENS_FOV). */
  fov: number;
  /** The plan's turn to the next stop, degrees. */
  step: number;
  /** Degrees turned right since the last photo, live (useTurnTracking). */
  turned: SharedValue<number>;
  /** The turn is being measured; otherwise the edge waits on the mark. */
  tracking: boolean;
  /** The turn is far enough: the mark turns solid. */
  reached: boolean;
}

/** Where the moving edge is drawn: its share of the frame's width, parked just off the frame past either side. */
export function guideEdge(turned: number, fov: number): number {
  "worklet";
  return Math.min(Math.max(edgeX(turned, fov), -GUIDE.park), 1 + GUIDE.park);
}

export function TurnGuide({ uri, width, height, fov, step, turned, tracking, reached }: TurnGuideProps) {
  const mark = targetX(step, fov);
  const markX = mark * width;
  // A shared value, so the guide moves the moment tracking starts, not at the next sample.
  const live = useSharedValue(tracking);
  useEffect(() => live.set(tracking), [tracking, live]);
  // The edge line, on the last photo's right edge: at the mark when the turn isn't measured.
  const slide = useAnimatedStyle(() => {
    const at = live.get() ? guideEdge(turned.get(), fov) : mark;
    return { transform: [{ translateX: (at - 1) * width }] };
  }, [live, mark, width, fov, turned]);
  const edge = width - GUIDE.line / 2;
  const mid = height / 2;
  const tip = width - GUIDE.line - GUIDE.arrow;
  const arrow = `M${tip + GUIDE.arrow} ${mid - GUIDE.arrow}L${tip} ${mid}L${tip + GUIDE.arrow} ${mid + GUIDE.arrow}`;
  const dash = reached ? undefined : [GUIDE.dash, GUIDE.gap];
  const casing = GUIDE.line + GUIDE.casing * 2;
  const ticks = [GUIDE.tickInset, height - GUIDE.tickInset]
    .map((y) => `M${markX - GUIDE.tick / 2} ${y}H${markX + GUIDE.tick / 2}`)
    .join("");
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="turn-guide"
    >
      {Array.from({ length: GUIDE.ghostStrips }, (_, i) => (
        <GhostStrip key={i} index={i} uri={uri} width={width} height={height} fov={fov} step={step} turned={turned} live={live} />
      ))}
      <Animated.View style={[styles.edge, { width, height }, slide]} testID="turn-ghost">
        <Svg width={width} height={height} style={StyleSheet.absoluteFill} testID="turn-guide-edge">
          <Line x1={edge} x2={edge} y1={0} y2={height} stroke={ref.color.void} strokeOpacity={GUIDE.casingOpacity} strokeWidth={casing} />
          <Line x1={edge} x2={edge} y1={0} y2={height} stroke={ref.color.textPrimary} strokeWidth={GUIDE.line} />
          {tracking && !reached ? (
            <>
              <Path d={arrow} stroke={ref.color.void} strokeOpacity={GUIDE.casingOpacity} strokeWidth={casing} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <Path d={arrow} stroke={ref.color.textPrimary} strokeWidth={GUIDE.line} fill="none" strokeLinecap="round" strokeLinejoin="round" testID="turn-guide-arrow" />
            </>
          ) : null}
        </Svg>
      </Animated.View>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} testID="turn-guide-mark">
        <Line x1={markX} x2={markX} y1={0} y2={height} stroke={ref.color.void} strokeOpacity={GUIDE.casingOpacity} strokeWidth={casing} strokeDasharray={dash} />
        <Line
          x1={markX}
          x2={markX}
          y1={0}
          y2={height}
          stroke={ref.color.textPrimary}
          strokeOpacity={reached ? 1 : GUIDE.markOpacity}
          strokeWidth={GUIDE.line}
          strokeDasharray={dash}
          testID={reached ? "turn-guide-mark-reached" : "turn-guide-mark-line"}
        />
        <Path d={ticks} stroke={ref.color.textPrimary} strokeWidth={GUIDE.tickLine} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

/**
 * One strip of the last photo (its `index`th of GUIDE.ghostStrips across),
 * moved and stretched to where that part of the room is on the feed now
 * (ghostStrip): exact at both its sides, so the strips meet with no seam.
 */
function GhostStrip({ index, uri, width, height, fov, step, turned, live }: {
  index: number;
  uri: string;
  width: number;
  height: number;
  fov: number;
  step: number;
  turned: SharedValue<number>;
  live: SharedValue<boolean>;
}) {
  const n = GUIDE.ghostStrips;
  const strip = width / n;
  const place = useAnimatedStyle(() => {
    const at = live.get() ? turned.get() : step;
    const { left, right } = ghostStrip(index / n, (index + 1) / n, at, fov);
    const centre = ((left + right) / 2) * width;
    return { transform: [{ translateX: centre - (index + 1 / 2) * strip }, { scaleX: Math.max(0, ((right - left) * width) / strip) }] };
  }, [live, turned, step, fov, index, n, width, strip]);
  return (
    <Animated.View style={[styles.strip, { left: index * strip, width: strip, height }, place]} testID={`turn-ghost-strip-${index}`}>
      <Image
        source={{ uri }}
        style={[styles.ghostImage, { left: -index * strip, width, height }]}
        contentFit="cover"
        accessible={false}
        transition={0}
        testID={`turn-ghost-photo-${index}`}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // A strip of the last photo, its own share of the picture showing through it; the well clips what's off the feed.
  strip: { position: "absolute", top: 0, overflow: "hidden" },
  ghostImage: { position: "absolute", top: 0, opacity: GUIDE.ghostOpacity },
  edge: { position: "absolute", left: 0, top: 0 },
});
