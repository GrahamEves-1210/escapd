// Light: a lamp with a pull chain. Pull the bead down past the catch, or tap
// the shade: onSet("on", !on). The uv variant throws a violet light. The UV
// torch (an item) has nothing to work here: it is used on things.
//
// The lamp, rendered (sprites.tsx): a pleated cloth shade trimmed in brass on a
// turned brass stem and foot, standing on the table, a beaded pull chain with
// its fob hanging under the shade. Lit, the picture of it alight fades in over
// the cold one (the shade glowing from inside, the brass under it catching
// it), and its light pools on the table and blooms into the dark.
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
import { Boards, SoftShadow, useMaterials } from "./materials";
import { ART, Sprite } from "./sprites";
import type { MechanismProps } from "./types";

/** Ultraviolet: no mode colour is violet, so the UV lamp carries its own. */
const UV = "#8B6CFF";
/** The chain's drop from under the shade to its fob (the rendered shade's rim sits lower than the drawn one's: the fob hangs where it did). */
const CHAIN = 42;
/** The chain's picture: a bead every 5 points, 88 long. */
const CHAIN_ART = 88;
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
  const genre = theme.genre ?? "noir";
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
    // Switching on: the rocker's click and hum; off, a plain press.
    if (on) feedback.press();
    else feedback.uvSwitch();
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

  // The chain runs down out of the shade and the fob rides its end: both moved by the same pull (the chain is
  // drawn whole and slides in a window under the shade), so its beads never stretch.
  const beadStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pull.get() }] }));
  const chainStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pull.get() - PULL }] }));
  const litStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));
  const poolStyle = useAnimatedStyle(() => ({ opacity: glow.get() * (uv ? 0.75 : 0.6) }));
  const bloomStyle = useAnimatedStyle(() => ({ opacity: glow.get() * (uv ? 0.6 : 0.42) }));

  const mat = useMaterials();
  const w = Math.min(width, 300);
  const lampLeft = (w - LAMP.w) / 2;
  return (
    <Stage width={width}>
      <View style={[styles.room, { width: w, height: STAGE }]}>
        {/* The table it stands on, lost in the dark at its edges. */}
        <View style={[styles.table, { width: w }]} pointerEvents="none">
          <Boards w={w} h={TABLE_H} seed={173} tone={mat.floor} board={TABLE_H} fade={0.3} />
        </View>
        {/* Its light: a bloom into the dark round the shade, a pool on the table. */}
        <Animated.View pointerEvents="none" style={[styles.bloom, { left: w / 2 - 130 }, bloomStyle]}>
          <SoftShadow w={260} h={200} color={light} strength={0.9} />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.pool, { left: w / 2 - 120 }, poolStyle]}>
          <SoftShadow w={240} h={50} color={light} strength={1} />
        </Animated.View>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={uv ? `${target.label}, ultraviolet` : target.label}
          accessibilityState={{ checked: on, disabled: busy }}
          accessibilityHint={on ? "Switches it off" : "Switches it on"}
          onPress={toggle}
          disabled={busy}
          testID="mech-light"
          style={[styles.lamp, { left: lampLeft }]}
        >
          <Sprite source={ART.lamp[genre]} w={LAMP.w} h={LAMP.h} />
          <Animated.View style={[StyleSheet.absoluteFill, litStyle]} pointerEvents="none">
            <Sprite source={ART.lampLit[uv ? "uv" : genre]} w={LAMP.w} h={LAMP.h} />
          </Animated.View>
        </Pressable>
        <View style={[styles.chainAnchor, { left: lampLeft + LAMP.chainX - ref.hit.min / 2 }]}>
          <View style={styles.chainWindow} pointerEvents="none">
            <Animated.View style={chainStyle}><Sprite source={ART.lampChain} w={8} h={CHAIN_ART} style={styles.chainArt} /></Animated.View>
          </View>
          <GestureDetector gesture={pan}>
            <Animated.View style={[styles.beadHit, beadStyle]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Sprite source={ART.lampFob} w={18} h={26} />
            </Animated.View>
          </GestureDetector>
        </View>
      </View>
      <Line text={on ? (uv ? "Ultraviolet on" : "On") : "Pull the chain"} />
    </Stage>
  );
}

/** The lamp's picture (mech_lamp.py): its size, and where the chain comes out from under the shade. */
const LAMP = { w: 170, h: 172, chainX: 114, chainY: 92 };
const TABLE_H = 44;

const styles = StyleSheet.create({
  room: {},
  table: { position: "absolute", left: 0, bottom: 0, height: TABLE_H, overflow: "hidden" },
  bloom: { position: "absolute", top: 0, width: 260, height: 200 },
  pool: { position: "absolute", bottom: 2, width: 240, height: 50 },
  lamp: { position: "absolute", top: STAGE - LAMP.h - 6, width: LAMP.w, height: LAMP.h },
  // Under the shade, toward its right: the chain's window (the chain slides in it) and the fob's touch box.
  chainAnchor: { position: "absolute", top: STAGE - LAMP.h - 6 + LAMP.chainY, alignItems: "center", width: ref.hit.min, height: CHAIN + PULL + ref.hit.min / 2 },
  chainWindow: { position: "absolute", top: 0, left: ref.hit.min / 2 - 4, width: 8, height: CHAIN + PULL, overflow: "hidden" },
  // The chain's picture is longer than its window: its lower end is the one in view.
  chainArt: { marginTop: CHAIN + PULL - CHAIN_ART },
  // Centred on the chain's end (the fob hangs from it).
  beadHit: { position: "absolute", left: 0, top: CHAIN - ref.hit.min / 2 + 10, width: ref.hit.min, height: ref.hit.min, alignItems: "center", justifyContent: "center" },
});
