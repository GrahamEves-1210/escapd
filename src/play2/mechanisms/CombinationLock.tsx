// CombinationLock: its wheels (the submit domain: alphabet and count) and
// "Try it", which calls onSubmit(symbols). Held while busy or cooling down.
// The wheels keep what was dialled; open, they stay on it, stamped Open.
//
// The padlock on the thing: a japanned iron body riveted at its corners and a
// blued-steel shackle through its top, both rendered (sprites.tsx), the brass
// drums in it drawn live. When the code is right the shackle springs: up out
// of the body and swung aside.
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { Stage, gaveNow, tryKey } from "./kit";
import { ART, NineSlice, Sprite } from "./sprites";
import { CLICK, WheelBank } from "./Wheels";
import type { MechanismProps } from "./types";

const SHACKLE = { w: 132, h: 46, bar: 13 };

export function CombinationLock({ target, state, onSubmit, onChange, busy, cooldown, width }: MechanismProps) {
  const domain = target.submit?.kind === "wheels" ? target.submit : { alphabet: "digits" as const, count: 3 };
  const open = state.open === true || state.locked === false;
  // Just opened (mounted afresh with the answer): the shackle springs once the last drum has seated.
  const [gave] = useState(() => open && gaveNow(tryKey(target)));
  return (
    <Stage width={width}>
      <View style={styles.lock}>
        <Shackle open={open} springAt={gave ? CLICK.firstMs + domain.count * CLICK.staggerMs + 120 : null} />
        <View style={styles.body}>
          {/* The body: japanned iron, riveted, a brass line let into its face (stretched to fit its wheels). */}
          <NineSlice source={ART.lockBody} size={120} cap={40} />
          <WheelBank
            alphabet={domain.alphabet}
            count={domain.count}
            width={width - 2 * ref.space.lg - 2 * ref.space.plate}
            busy={busy}
            cooldown={cooldown}
            done={open}
            submitLabel="Try it"
            onSubmit={onSubmit}
            onChange={onChange}
            keep={target}
          />
        </View>
      </View>
    </Stage>
  );
}

/** The shackle: a bow of blued steel, a line of light along it. Shut, its legs are in the body; open, it has jumped and swung on its long leg. */
function Shackle({ open, springAt }: { open: boolean; springAt: number | null }) {
  const { reducedMotion } = useTheme();
  const k = useSharedValue(open && (springAt === null || reducedMotion) ? 1 : 0);
  useEffect(() => {
    if (!open) {
      k.set(0);
      return;
    }
    if (springAt === null || reducedMotion) {
      k.set(1);
      return;
    }
    k.set(withDelay(springAt, withSequence(
      withTiming(1.12, { duration: 110, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }),
      withSpring(1, { mass: 0.6, damping: 8, stiffness: 380, reduceMotion: ReduceMotion.Never }),
    )));
  }, [open, springAt, reducedMotion, k]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -k.get() * 10 }, { rotate: `${k.get() * 13}deg` }] }));
  return (
    <Animated.View style={[styles.shackle, style]} pointerEvents="none" testID={open ? "mech-shackle-open" : "mech-shackle"}>
      <Sprite source={ART.lockShackle} w={BOW.w} h={BOW.h} />
    </Animated.View>
  );
}

/** The shackle's picture (mech_lock.py): the app's old box and the bow's crown above it. */
const BOW = { w: SHACKLE.w, h: SHACKLE.h + 14 + 8, crown: 8 };

const styles = StyleSheet.create({
  lock: { alignItems: "center" },
  // Its legs reach down into the body (which is drawn over them); its crown stands above its old box.
  shackle: { marginTop: -BOW.crown, marginBottom: -16, transformOrigin: "88% 100%" },
  body: { paddingTop: ref.space.plate + 2, paddingBottom: ref.space.xs, paddingHorizontal: ref.space.plate },
});
