// Drawer and compartment: pull the front out (a drawer slides toward you, a
// compartment door swings on its left hinge). The moment it gives (GIVE_AT) it
// opens: onSet("open", true), the finger still on it, so what's inside lies
// there under the front and is uncovered as it comes, never popping in at the
// end. Locked, it gives a few points and rattles.
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, { interpolate, useAnimatedStyle } from "react-native-reanimated";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { ref } from "@/theme/tokens";
import { GIVE_AT, Glint, LANDING, Line, STAGE, Stage, activatable, tryKey, useLockedLine, usePull, useRattle } from "./kit";
import type { MechanismProps } from "./types";

const TRAVEL = 72;
/** How far a compartment's door swings open (degrees). */
const SWING = 78;

export function Drawer({ target, state, onSet, busy, width, inside }: MechanismProps) {
  const theme = useModeTheme();
  const feedback = useFeedback();
  const swing = target.variant === "compartment";
  const open = state.open === true;
  const locked = state.locked === true;
  const { rattle, style: rattleStyle } = useRattle();
  const { showLocked, markTried } = useLockedLine(locked);

  const onCommit = useCallback(() => {
    feedback.drawer();
    onSet("open", true);
  }, [feedback, onSet]);
  // Put back: shut, laid down, straightened. The room keeps what was found.
  const onUncommit = useCallback(() => {
    feedback.tick();
    onSet("open", false);
  }, [feedback, onSet]);
  const onLocked = useCallback(() => {
    feedback.warning();
    rattle();
    markTried();
  }, [feedback, rattle, markTried]);

  const { progress, gesture, commitNow, landed, reach } = usePull({
    axis: swing ? "x" : "down", range: swing ? 140 : TRAVEL, done: open, locked, busy, onCommit, onLocked, onUncommit, land: tryKey(target), giveAt: GIVE_AT,
  });

  const w = Math.min(width - 2 * ref.space.lg, 280);
  const h = swing ? STAGE - ref.space.lg : 96;
  // A compartment's door fills the carcass inside its lip and swings on its left edge.
  const door = { w: w - 2 * ref.space.sm, h: h - 2 * ref.space.sm };
  // Swung toward you its free edge comes nearer and draws taller; the
  // perspective is far enough that, fully open, it stays inside the carcass.
  const depth = door.w * Math.sin((SWING * Math.PI) / 180) * (h / (h - door.h));

  // The drawer: slides down and grows a little as it comes toward you.
  const frontStyle = useAnimatedStyle(() => {
    const p = Math.abs(progress.get());
    if (swing) {
      return {
        transform: [
          { perspective: depth },
          { translateX: -door.w / 2 },
          { rotateY: `${-p * SWING}deg` },
          { translateX: door.w / 2 },
        ],
      };
    }
    return { transform: [{ translateY: p * TRAVEL }, { scale: 1 + p * 0.06 }] };
  });
  // The front's shadow over the inside lifts as it opens (what's in it is never dimmed out of sight).
  const shadeStyle = useAnimatedStyle(() => ({ opacity: interpolate(Math.abs(progress.get()), [0, 0.45], [0.42, 0], "clamp") }));

  // What the front is called, and the verbs, the same for the screen reader as on the line under it.
  const say = swing
    ? { open: "Swing the door open", shut: "Swing the door shut", opens: "Opens the compartment", closes: "Closes the compartment" }
    : { open: "Pull the drawer open", shut: "Push the drawer shut", opens: "Opens the drawer", closes: "Closes the drawer" };
  return (
    <Stage width={width}>
      <View style={[styles.room, { height: STAGE }]}>
        <GestureDetector gesture={gesture}>
          <Animated.View
            testID="mech-drawer"
            style={[
              styles.carcass,
              { width: w, height: swing ? h : h + TRAVEL + ref.space.lg, backgroundColor: theme.surface, borderColor: theme.rim },
              rattleStyle,
            ]}
          >
            {/* The dark inside the front leaves behind. */}
            <View style={[styles.inside, { height: swing ? door.h : h, backgroundColor: theme.ground, borderColor: theme.rim }]}>
              <View style={[styles.insideEdge, { borderColor: theme.rim }]} />
              {/* What's in it, there all along: lying in the part the front slides off (by the free edge, for a
                  door), uncovered as it opens; it can be picked up once most of it shows. */}
              {inside ? (
                <View
                  style={[styles.lying, swing ? styles.byEdge : null, { height: swing ? door.h : TRAVEL - ref.space.sm }]}
                  pointerEvents={reach ? "box-none" : "none"}
                  testID="mech-inside"
                >
                  {inside}
                </View>
              ) : null}
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.shade, shadeStyle]} />
            </View>
            {/* The front is the control for assistive tech (what's inside stays reachable on its own). */}
            <Animated.View
              {...activatable(
                open ? say.shut : say.open,
                locked ? "It is locked" : open ? say.closes : say.opens,
                open ? onUncommit : commitNow,
                busy,
              )}
              style={[styles.front, swing ? { width: door.w, height: door.h } : { height: h }, { backgroundColor: theme.raised, borderColor: theme.rim }, frontStyle]}
            >
              <View style={[styles.bevel, { borderColor: theme.rim }]} />
              {swing ? (
                <View style={[styles.knob, { backgroundColor: theme.accent }]} />
              ) : (
                <View style={[styles.handle, { backgroundColor: theme.accent }]} />
              )}
              {locked ? <View style={[styles.keyhole, { backgroundColor: theme.ground }]} /> : null}
              {/* Just pulled open: the light catches its front as it lands at the stop. */}
              {landed ? <Glint key={landed} delay={LANDING.delayMs + LANDING.inMs} radius={ref.radius.tag / 2} /> : null}
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>
      {showLocked ? <Line text="Locked" tone="stamp" testID="mech-locked" /> : (
        <Line text={open ? "Open" : swing ? say.open : "Pull it toward you"} />
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
  lying: { position: "absolute", left: 0, right: 0, top: 0, alignItems: "center", justifyContent: "center" },
  // Behind a door: by its free edge, the side that opens first.
  byEdge: { alignItems: "flex-end", paddingRight: ref.space.sm },
  shade: { backgroundColor: "#000000" },
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
