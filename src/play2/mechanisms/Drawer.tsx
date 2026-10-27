// Drawer and compartment: pull the front out (a drawer slides toward you, a
// compartment door swings on its left hinge). Past COMMIT_AT it opens:
// onSet("open", true). Locked, it gives a few points and rattles.
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, { interpolate, useAnimatedStyle } from "react-native-reanimated";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { ref } from "@/theme/tokens";
import { Line, STAGE, Stage, activatable, useLockedLine, usePull, useRattle } from "./kit";
import type { MechanismProps } from "./types";

const TRAVEL = 72;

export function Drawer({ target, state, onSet, busy, width }: MechanismProps) {
  const theme = useModeTheme();
  const feedback = useFeedback();
  const swing = target.variant === "compartment";
  const open = state.open === true;
  const locked = state.locked === true;
  const { rattle, style: rattleStyle } = useRattle();
  const { showLocked, markTried } = useLockedLine(locked);

  const onCommit = useCallback(() => {
    feedback.thud();
    onSet("open", true);
  }, [feedback, onSet]);
  const onLocked = useCallback(() => {
    feedback.warning();
    rattle();
    markTried();
  }, [feedback, rattle, markTried]);

  const { progress, gesture, commitNow } = usePull({
    axis: swing ? "x" : "down", range: swing ? 140 : TRAVEL, done: open, locked, busy, onCommit, onLocked,
  });

  const w = Math.min(width - 2 * ref.space.lg, 280);
  const h = swing ? STAGE - ref.space.lg : 96;

  // The drawer: slides down and grows a little as it comes toward you.
  const frontStyle = useAnimatedStyle(() => {
    const p = Math.abs(progress.get());
    if (swing) {
      return {
        transform: [
          { perspective: 700 },
          { translateX: -w / 2 },
          { rotateY: `${-p * 78}deg` },
          { translateX: w / 2 },
        ],
      };
    }
    return { transform: [{ translateY: p * TRAVEL }, { scale: 1 + p * 0.06 }] };
  });
  // The inside's shadow lifts as it opens.
  const insideStyle = useAnimatedStyle(() => ({ opacity: interpolate(Math.abs(progress.get()), [0, 1], [0.2, 1]) }));

  const noun = swing ? "compartment" : "drawer";
  return (
    <Stage width={width}>
      <View style={[styles.room, { height: STAGE }]}>
        <GestureDetector gesture={gesture}>
          <Animated.View
            {...activatable(
              open ? `${target.label}, open` : `Pull the ${noun} open`,
              locked ? "It is locked" : `Opens the ${noun}`,
              commitNow,
              open || busy,
            )}
            testID="mech-drawer"
            style={[
              styles.carcass,
              { width: w, height: swing ? h : h + TRAVEL + ref.space.lg, backgroundColor: theme.surface, borderColor: theme.rim },
              rattleStyle,
            ]}
          >
            {/* The dark inside the front leaves behind. */}
            <Animated.View style={[styles.inside, { height: h, backgroundColor: theme.ground, borderColor: theme.rim }, insideStyle]}>
              <View style={[styles.insideEdge, { borderColor: theme.rim }]} />
            </Animated.View>
            <Animated.View style={[styles.front, { height: h, backgroundColor: theme.raised, borderColor: theme.rim }, frontStyle]}>
              <View style={[styles.bevel, { borderColor: theme.rim }]} />
              {swing ? (
                <View style={[styles.knob, { backgroundColor: theme.accent }]} />
              ) : (
                <View style={[styles.handle, { backgroundColor: theme.accent }]} />
              )}
              {locked ? <View style={[styles.keyhole, { backgroundColor: theme.ground }]} /> : null}
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>
      {showLocked ? <Line text="Locked" tone="stamp" testID="mech-locked" /> : (
        <Line text={open ? "Open" : swing ? "Swing the door open" : "Pull it toward you"} />
      )}
    </Stage>
  );
}

const styles = StyleSheet.create({
  room: { justifyContent: "center", alignItems: "center" },
  carcass: {
    borderRadius: ref.radius.tag,
    borderWidth: StyleSheet.hairlineWidth,
    padding: ref.space.sm,
    ...ref.curve,
  },
  inside: {
    position: "absolute",
    left: ref.space.sm,
    right: ref.space.sm,
    top: ref.space.sm,
    borderRadius: ref.radius.tag / 2,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  insideEdge: { position: "absolute", left: ref.space.lg, right: ref.space.lg, top: ref.space.lg, bottom: 0, borderWidth: StyleSheet.hairlineWidth, borderBottomWidth: 0 },
  front: {
    borderRadius: ref.radius.tag / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    ...ref.curve,
  },
  bevel: { position: "absolute", left: ref.space.sm, right: ref.space.sm, top: ref.space.sm, bottom: ref.space.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: 2 },
  handle: { width: 56, height: 8, borderRadius: ref.radius.round },
  knob: { position: "absolute", right: ref.space.lg, width: 14, height: 14, borderRadius: ref.radius.round },
  keyhole: { position: "absolute", bottom: ref.space.sm, width: 5, height: 10, borderRadius: 2.5 },
});
