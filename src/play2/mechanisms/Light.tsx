// Light: a lamp with a pull chain. Pull the bead down past the catch, or tap
// the shade: onSet("on", !on). The uv variant throws a violet light. The UV
// torch (an item) has nothing to work here: it is used on things.
import { useCallback, useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { Line, STAGE, Stage, clamp, settle } from "./kit";
import type { MechanismProps } from "./types";

/** Ultraviolet: no mode colour is violet, so the UV lamp carries its own. */
const UV = "#8B6CFF";
const CHAIN = 54;
const PULL = 34;
const CATCH = 22;

export function Light(props: MechanismProps) {
  if (props.target.variant === "torch") return null;
  return <Lamp {...props} />;
}

function Lamp({ target, state, onSet, busy, width }: MechanismProps) {
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  const feedback = useFeedback();
  const on = state.on === true;
  const uv = target.variant === "uv";
  const light = uv ? UV : theme.glow ?? theme.accent;

  const glow = useSharedValue(on ? 1 : 0);
  const pull = useSharedValue(0);
  const enabled = useSharedValue(!busy);
  const reduced = useSharedValue(reducedMotion);
  useEffect(() => {
    enabled.set(!busy);
    reduced.set(reducedMotion);
  }, [busy, reducedMotion, enabled, reduced]);
  useEffect(() => {
    glow.set(withTiming(on ? 1 : 0, settle(reducedMotion, 260)));
  }, [on, reducedMotion, glow]);

  const toggle = useCallback(() => {
    if (busy) return;
    feedback.press();
    onSet("on", !on);
  }, [busy, feedback, onSet, on]);
  const caught = useCallback(() => feedback.tick(), [feedback]);

  const pan = usePanGesture({
    enabled,
    maxPointers: 1,
    activeOffsetY: 4,
    onUpdate: (e) => {
      "worklet";
      const before = pull.get();
      const next = clamp(e.translationY, 0, PULL);
      if (before < CATCH && next >= CATCH) scheduleOnRN(caught);
      pull.set(next);
    },
    onDeactivate: () => {
      "worklet";
      const pulled = pull.get() >= CATCH;
      pull.set(withTiming(0, { duration: reduced.get() ? 0 : 180 }));
      if (pulled) scheduleOnRN(toggle);
    },
  });

  const beadStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pull.get() }] }));
  const chainStyle = useAnimatedStyle(() => ({ height: CHAIN + pull.get() }));
  const poolStyle = useAnimatedStyle(() => ({ opacity: glow.get() * (uv ? 0.42 : 0.3) }));
  const bulbStyle = useAnimatedStyle(() => ({ opacity: 0.25 + glow.get() * 0.75 }));

  const w = Math.min(width, 300);
  return (
    <Stage width={width}>
      <View style={[styles.room, { width: w, height: STAGE }]}>
        {/* The pool of light the lamp throws, and the tint over the close-up. */}
        <Animated.View pointerEvents="none" style={[styles.pool, { width: w * 0.9, height: STAGE * 0.8, borderRadius: w, backgroundColor: light }, poolStyle]} />
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={uv ? `${target.label}, ultraviolet` : target.label}
          accessibilityState={{ checked: on, disabled: busy }}
          accessibilityHint={on ? "Switches it off" : "Switches it on"}
          onPress={toggle}
          disabled={busy}
          testID="mech-light"
          style={styles.lamp}
        >
          <View style={[styles.shade, { borderBottomColor: theme.raised }]} />
          <Animated.View style={[styles.bulb, { backgroundColor: light }, bulbStyle]} />
        </Pressable>
        <View style={styles.chainAnchor}>
          <Animated.View style={[styles.chain, { backgroundColor: theme.inkMuted }, chainStyle]} />
          <GestureDetector gesture={pan}>
            <Animated.View style={[styles.beadHit, beadStyle]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={[styles.bead, { backgroundColor: theme.accent, borderColor: theme.rim }]} />
            </Animated.View>
          </GestureDetector>
        </View>
      </View>
      <Line text={on ? (uv ? "Ultraviolet on" : "On") : "Pull the chain"} />
    </Stage>
  );
}

const SHADE_W = 120;
const styles = StyleSheet.create({
  room: { alignItems: "center", paddingTop: ref.space.lg },
  pool: { position: "absolute", top: STAGE * 0.2 },
  lamp: { alignItems: "center", minHeight: ref.hit.min },
  // A trapezoid shade: a bottom border with slanted, clear sides.
  shade: {
    width: SHADE_W,
    height: 0,
    borderBottomWidth: 56,
    borderLeftWidth: 26,
    borderRightWidth: 26,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  bulb: { width: 34, height: 14, borderBottomLeftRadius: 17, borderBottomRightRadius: 17 },
  chainAnchor: { position: "absolute", top: ref.space.lg + 40, left: "50%", marginLeft: SHADE_W / 2 - 34, alignItems: "center", width: ref.hit.min },
  chain: { width: 1.5 },
  beadHit: { width: ref.hit.min, height: ref.hit.min, alignItems: "center", justifyContent: "center", marginTop: -ref.hit.min / 2 + 7 },
  bead: { width: 14, height: 14, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth },
});
