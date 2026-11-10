// CombinationLock: its wheels (the submit domain: alphabet and count) and
// "Try it", which calls onSubmit(symbols). Held while busy or cooling down.
// The wheels keep what was dialled; open, they stay on it, stamped Open.
//
// Drawn as the padlock on the thing: a japanned iron body riveted at its
// corners, the brass drums in it, a blued-steel shackle through its top. When
// the code is right the shackle springs: up out of the body and swung aside.
import { memo, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { mix } from "@/theme/payoff";
import { ref } from "@/theme/tokens";
import { Stage, gaveNow, tryKey } from "./kit";
import { BRASS, INK, STEEL, Screw, useGradId } from "./materials";
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
          <Body />
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
      <Bow />
    </Animated.View>
  );
}

const Bow = memo(function Bow() {
  const g = useGradId()("sh");
  const { w, h, bar } = SHACKLE;
  const a = bar / 2 + 2, b = w - bar / 2 - 2;
  const d = `M${a} ${h + 14}V${h * 0.62}C${a} ${-h * 0.2} ${b} ${-h * 0.2} ${b} ${h * 0.62}V${h + 14}`;
  return (
    <Svg width={w} height={h + 14}>
      <Defs>
        <LinearGradient id={g.id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={STEEL.light} />
          <Stop offset="0.4" stopColor={STEEL.mid} />
          <Stop offset="1" stopColor={STEEL.deep} />
        </LinearGradient>
      </Defs>
      <Path d={d} stroke={INK} strokeWidth={bar + 3.6} fill="none" />
      <Path d={d} stroke={g.url} strokeWidth={bar} fill="none" />
      <Path d={d} stroke={STEEL.sheen} strokeOpacity={0.55} strokeWidth={1.6} fill="none" transform="translate(-2.4 -2.2)" />
    </Svg>
  );
});

/** The body: black japanned iron, lighter along its top, a brass line round its face and a rivet in each corner. */
const Body = memo(function Body() {
  const theme = useModeTheme();
  const g = useGradId()("bd");
  const iron = { top: mix("#4A434F", theme.raised, 0.3), mid: mix("#2A252E", theme.raised, 0.25), deep: mix("#141116", theme.ground, 0.3) };
  return (
    <View style={[StyleSheet.absoluteFill, styles.iron, { backgroundColor: iron.mid }]} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={g.id} x1="0" y1="0" x2="0.25" y2="1">
            <Stop offset="0" stopColor={iron.top} />
            <Stop offset="0.3" stopColor={iron.mid} />
            <Stop offset="1" stopColor={iron.deep} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={g.url} />
      </Svg>
      <View style={styles.brassLine} />
      {[styles.tl, styles.tr, styles.bl, styles.br].map((at, i) => (
        <Svg key={i} width={11} height={11} viewBox="0 0 11 11" style={[styles.rivet, at]}>
          <Screw cx={5.5} cy={5.5} r={4} turn={[35, -20, 80, 10][i]} />
        </Svg>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  lock: { alignItems: "center" },
  // Its legs reach down into the body (which is drawn over them).
  shackle: { marginBottom: -16, transformOrigin: "88% 100%" },
  body: { paddingTop: ref.space.plate + 2, paddingBottom: ref.space.xs, paddingHorizontal: ref.space.plate },
  iron: { borderRadius: 20, borderWidth: 2, borderColor: INK, overflow: "hidden" },
  brassLine: { position: "absolute", left: 4, right: 4, top: 4, bottom: 4, borderRadius: 15, borderWidth: 1.2, borderColor: BRASS.mid, opacity: 0.55 },
  rivet: { position: "absolute" },
  tl: { left: 7, top: 7 },
  tr: { right: 7, top: 7 },
  bl: { left: 7, bottom: 7 },
  br: { right: 7, bottom: 7 },
});
