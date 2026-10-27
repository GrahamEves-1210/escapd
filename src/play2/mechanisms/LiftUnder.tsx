// LiftUnder: drag the cloth or cushion up to see beneath it. Past COMMIT_AT it
// stays lifted: onSet("lifted", true).
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, { interpolate, useAnimatedStyle } from "react-native-reanimated";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { ref } from "@/theme/tokens";
import { Line, STAGE, Stage, activatable, usePull } from "./kit";
import type { MechanismProps } from "./types";

const RISE = 84;

export function LiftUnder({ target, state, onSet, busy, width, inside }: MechanismProps) {
  const theme = useModeTheme();
  const feedback = useFeedback();
  const lifted = state.lifted === true;
  const onCommit = useCallback(() => {
    feedback.paper();
    onSet("lifted", true);
  }, [feedback, onSet]);
  // Put back: shut, laid down, straightened. The room keeps what was found.
  const onUncommit = useCallback(() => {
    feedback.tick();
    onSet("lifted", false);
  }, [feedback, onSet]);
  const { progress, gesture, commitNow } = usePull({ axis: "up", range: RISE, done: lifted, busy, onCommit, onUncommit });

  const w = Math.min(width - 2 * ref.space.xl, 240);
  const clothStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      transform: [
        { translateY: -p * RISE },
        { perspective: 600 },
        { rotateX: `${p * 38}deg` },
        { scaleX: 1 - p * 0.06 },
      ],
    };
  });
  // The shadow beneath: deep while it lies flat, a soft hollow once lifted.
  const hollowStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [0, 1], [0.35, 1]) }));

  return (
    <Stage width={width}>
      <View style={[styles.room, { height: STAGE }]}>
        <Animated.View style={[styles.hollow, { width: w * 0.8, backgroundColor: theme.ground, borderColor: theme.rim }, hollowStyle]} />
        {/* What was under it, lying in the hollow it left. */}
        {inside ? <View style={[styles.lying, { width: w * 0.8 }]} pointerEvents="box-none">{inside}</View> : null}
        <GestureDetector gesture={gesture}>
          <Animated.View
            {...activatable(lifted ? `${target.label}, lifted` : `Lift the ${target.label}`, "Looks underneath", lifted ? onUncommit : commitNow, busy)}
            testID="mech-lift"
            style={[styles.cloth, { width: w, backgroundColor: theme.raised, borderColor: theme.rim }, clothStyle]}
          >
            {/* Folds: a few soft seams across the fabric. */}
            {[0.3, 0.55, 0.78].map((f) => (
              <View key={f} style={[styles.fold, { top: `${f * 100}%`, borderColor: theme.rim }]} />
            ))}
            <View style={[styles.edge, { backgroundColor: theme.surface }]} />
          </Animated.View>
        </GestureDetector>
      </View>
      <Line text={lifted ? "Lifted" : "Drag it up"} />
    </Stage>
  );
}

const styles = StyleSheet.create({
  room: { justifyContent: "flex-end", alignItems: "center", paddingBottom: ref.space.lg },
  lying: { position: "absolute", bottom: ref.space.xl, height: 56, alignItems: "center", justifyContent: "center" },
  hollow: { position: "absolute", bottom: ref.space.xl, height: 56, borderRadius: ref.radius.round, borderWidth: StyleSheet.hairlineWidth },
  cloth: {
    height: 104,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    ...ref.curve,
  },
  fold: { position: "absolute", left: "12%", right: "12%", borderTopWidth: StyleSheet.hairlineWidth },
  edge: { position: "absolute", left: 0, right: 0, bottom: 0, height: 10, opacity: 0.6 },
});
