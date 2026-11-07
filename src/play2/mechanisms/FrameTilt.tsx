// FrameTilt: push the frame askew on its nail, either way. The moment it gives
// (GIVE_AT) it's tilted: onSet("tilted", true), the finger still on it. The
// unfaded patch of wall shows behind it, and whatever was tucked behind it is
// there all along, slipping out from under its bottom edge as it swings, never
// popping in at the end.
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, { interpolate, useAnimatedStyle } from "react-native-reanimated";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { ref } from "@/theme/tokens";
import { GIVE_AT, Line, STAGE, Stage, activatable, tryKey, usePull } from "./kit";
import type { MechanismProps } from "./types";

const MAX_DEG = 17;
const FRAME_H = 120;
/** The frame's top in the stage: high, so what slips out from under it has room below. */
const FRAME_TOP = 14;
/** What's tucked behind it: its height, and how far it slips down as the frame swings. */
const TUCKED_H = 56;
const SLIP = 58;

export function FrameTilt({ target, state, onSet, busy, width, inside }: MechanismProps) {
  const theme = useModeTheme();
  const feedback = useFeedback();
  const tilted = state.tilted === true;
  const onCommit = useCallback(() => {
    feedback.thud();
    onSet("tilted", true);
  }, [feedback, onSet]);
  // Put back: shut, laid down, straightened. The room keeps what was found.
  const onUncommit = useCallback(() => {
    feedback.tick();
    onSet("tilted", false);
  }, [feedback, onSet]);
  const { progress, gesture, commitNow, reach } = usePull({ axis: "x", range: 110, done: tilted, busy, onCommit, onUncommit, land: tryKey(target), giveAt: GIVE_AT });

  const w = Math.min(width - 2 * ref.space.xxl, 180);
  // Turn about the nail: the frame hangs from its top centre.
  const frameStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -FRAME_H / 2 }, { rotate: `${-progress.get() * MAX_DEG}deg` }, { translateY: FRAME_H / 2 }],
  }));
  const patchStyle = useAnimatedStyle(() => ({ opacity: interpolate(Math.abs(progress.get()), [0, 1], [0, 1]) }));
  // Tucked behind its bottom edge, it slips down as the frame swings (a little askew the way the frame went).
  const tuckedStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return { transform: [{ translateY: Math.abs(p) * SLIP }, { rotate: `${-p * 6}deg` }] };
  });

  return (
    <Stage width={width}>
      <View style={[styles.wall, { height: STAGE }]}>
        <Animated.View style={[styles.patch, { left: (width - w) / 2, width: w, height: FRAME_H, borderColor: theme.rim, backgroundColor: theme.surface }, patchStyle]} />
        {inside ? (
          <Animated.View
            style={[styles.tucked, { top: FRAME_TOP + FRAME_H - TUCKED_H - ref.space.sm }, tuckedStyle]}
            pointerEvents={reach ? "box-none" : "none"}
            testID="mech-inside"
          >
            {inside}
          </Animated.View>
        ) : null}
        <GestureDetector gesture={gesture}>
          <Animated.View
            {...activatable(tilted ? `${target.label}, askew` : `Tilt the ${target.label}`, "Looks behind it", tilted ? onUncommit : commitNow, busy)}
            testID="mech-frame"
            style={[styles.frame, { left: (width - w) / 2, width: w, height: FRAME_H, borderColor: theme.raised, backgroundColor: theme.ground }, frameStyle]}
          >
            <View style={[styles.mat, { borderColor: theme.rim }]} />
          </Animated.View>
        </GestureDetector>
        <View style={[styles.nail, { left: width / 2 - 3, backgroundColor: theme.inkMuted }]} />
      </View>
      <Line text={tilted ? "Askew" : "Push it to one side"} />
    </Stage>
  );
}

const styles = StyleSheet.create({
  wall: { alignSelf: "stretch" },
  patch: { position: "absolute", top: FRAME_TOP, borderWidth: StyleSheet.hairlineWidth, borderRadius: 2 },
  tucked: { position: "absolute", left: 0, right: 0, height: TUCKED_H, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: ref.space.lg },
  frame: { position: "absolute", top: FRAME_TOP, borderWidth: 10, borderRadius: 3, padding: ref.space.sm },
  mat: { flex: 1, borderWidth: StyleSheet.hairlineWidth },
  nail: { position: "absolute", top: FRAME_TOP - 3, width: 6, height: 6, borderRadius: 3 },
});
