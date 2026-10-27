// FrameTilt: push the frame askew on its nail, either way. Past COMMIT_AT it
// stays tilted: onSet("tilted", true). The unfaded patch of wall shows behind it.
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, { interpolate, useAnimatedStyle } from "react-native-reanimated";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { ref } from "@/theme/tokens";
import { Line, STAGE, Stage, activatable, usePull } from "./kit";
import type { MechanismProps } from "./types";

const MAX_DEG = 17;
const FRAME_H = 130;

export function FrameTilt({ target, state, onSet, busy, width }: MechanismProps) {
  const theme = useModeTheme();
  const feedback = useFeedback();
  const tilted = state.tilted === true;
  const onCommit = useCallback(() => {
    feedback.thud();
    onSet("tilted", true);
  }, [feedback, onSet]);
  const { progress, gesture, commitNow } = usePull({ axis: "x", range: 110, done: tilted, busy, onCommit });

  const w = Math.min(width - 2 * ref.space.xxl, 180);
  // Turn about the nail: the frame hangs from its top centre.
  const frameStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -FRAME_H / 2 }, { rotate: `${progress.get() * MAX_DEG}deg` }, { translateY: FRAME_H / 2 }],
  }));
  const patchStyle = useAnimatedStyle(() => ({ opacity: interpolate(Math.abs(progress.get()), [0, 1], [0, 1]) }));

  return (
    <Stage width={width}>
      <View style={[styles.wall, { height: STAGE }]}>
        <Animated.View style={[styles.patch, { width: w, height: FRAME_H, borderColor: theme.rim, backgroundColor: theme.surface }, patchStyle]} />
        <GestureDetector gesture={gesture}>
          <Animated.View
            {...activatable(tilted ? `${target.label}, askew` : `Tilt the ${target.label}`, "Looks behind it", commitNow, tilted || busy)}
            testID="mech-frame"
            style={[styles.frame, { width: w, height: FRAME_H, borderColor: theme.raised, backgroundColor: theme.ground }, frameStyle]}
          >
            <View style={[styles.mat, { borderColor: theme.rim }]} />
          </Animated.View>
        </GestureDetector>
        <View style={[styles.nail, { backgroundColor: theme.inkMuted }]} />
      </View>
      <Line text={tilted ? "Askew" : "Push it to one side"} />
    </Stage>
  );
}

const styles = StyleSheet.create({
  wall: { alignItems: "center", justifyContent: "center" },
  patch: { position: "absolute", borderWidth: StyleSheet.hairlineWidth, borderRadius: 2 },
  frame: { borderWidth: 10, borderRadius: 3, padding: ref.space.sm },
  mat: { flex: 1, borderWidth: StyleSheet.hairlineWidth },
  nail: { position: "absolute", top: (STAGE - FRAME_H) / 2 - 3, width: 6, height: 6, borderRadius: 3 },
});
