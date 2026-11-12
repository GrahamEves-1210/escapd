// The string lights across the top of home's window (WindowBackdrop lays them
// in front of the frame, under the header): a dark flex drooping in three
// swags from brass cup hooks, small glass bulbs in brass caps hung along it,
// warm white with a few in the modes' colours. Rendered in Blender
// (scripts/blender/props/home_lights.py -> assets/home/lights/): the cord is
// one picture; each bulb is its own, unlit, with the same bulb alight (and its
// halo) laid over it. So they stay alive:
// - each bulb's light breathes on its own, slowly and unevenly (LIGHTS.twinkle:
//   its own period, its own depth, its own moment), never together;
// - the string is a layer of the set's parallax (PARALLAX.depth.lights), and
//   each bulb swings a little from its cap as the phone tilts (LIGHTS.sway);
// - under reduced motion they are steady and still.
// They hang clear of the header: the lowest bulb ends LIGHTS.foot under the
// safe top, above the wordmark and the two corner buttons, the swags rising
// into the status bar's room. Where there is no such room (the web) the swags
// flatten (LIGHTS.flat) so the bulbs still show, along the screen's top edge.
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { Image } from "expo-image";
import SET from "../../../assets/home/lights/lights.json";
import { LIGHTS, PARALLAX, scatter } from "./art/nook";
import { ParallaxLayer } from "./parallax/ParallaxLayer";
import type { TiltValues } from "./parallax/useTilt";

const CORD = require("../../../assets/home/lights/cord.png") as number;
const BULBS = {
  warm: { cold: require("../../../assets/home/lights/bulb-warm.png") as number, lit: require("../../../assets/home/lights/bulb-warm-lit.png") as number },
  noir: { cold: require("../../../assets/home/lights/bulb-noir.png") as number, lit: require("../../../assets/home/lights/bulb-noir-lit.png") as number },
  crime: { cold: require("../../../assets/home/lights/bulb-crime.png") as number, lit: require("../../../assets/home/lights/bulb-crime-lit.png") as number },
  moonlit: { cold: require("../../../assets/home/lights/bulb-moonlit.png") as number, lit: require("../../../assets/home/lights/bulb-moonlit-lit.png") as number },
} as const;
type Colour = keyof typeof BULBS;

/**
 * Where the string lies on a screen `width` wide whose safe top is `top`:
 * its scale, how flat its swags are (1 as rendered), the cord picture's box,
 * and each bulb's hanging point. Pure.
 */
export function stringLayout(width: number, top: number) {
  const k = width / SET.design;
  const pin = Math.min(...SET.bulbs.map((b) => b.y));
  const droop = Math.max(...SET.bulbs.map((b) => b.y)) - pin;
  const bulb = SET.bulb.hang * k;
  // The room for the cord above the lowest bulb: the swags take what there is, between LIGHTS.flat of their droop and all of it.
  const room = top + LIGHTS.foot - bulb - LIGHTS.edge;
  const flat = Math.min(1, Math.max(LIGHTS.flat, (room - pin * k) / (droop * k)));
  const y = (drawn: number) => (pin + (drawn - pin) * flat) * k;
  const cordTop = top + LIGHTS.foot - bulb - y(pin + droop);
  return {
    k,
    flat,
    cord: { left: -SET.bleed * k, top: cordTop + pin * k * (1 - flat), width: SET.cord.width * k, height: SET.cord.height * k * flat },
    bulbs: SET.bulbs.map((b) => ({ x: b.x * k, y: cordTop + y(b.y), colour: b.colour as Colour })),
    /** The lowest any bulb's glass reaches. */
    foot: top + LIGHTS.foot,
  };
}

export function StringLights({ tilt, width, top, still }: { tilt: TiltValues; width: number; top: number; still: boolean }) {
  const at = stringLayout(width, top);
  const w = SET.bulb.width * at.k;
  const h = SET.bulb.height * at.k;
  return (
    <ParallaxLayer tilt={tilt} depth={PARALLAX.depth.lights} style={StyleSheet.absoluteFill} testID="hub-window-string">
      <Image source={CORD} style={[styles.part, at.cord]} contentFit="fill" />
      {at.bulbs.map((b, i) => (
        <Bulb key={i} index={i} colour={b.colour} left={b.x - w * SET.bulb.attach[0]} top={b.y - h * SET.bulb.attach[1]} width={w} height={h} tilt={tilt} still={still} />
      ))}
    </ParallaxLayer>
  );
}

function Bulb({ index, colour, left, top, width, height, tilt, still }: {
  index: number; colour: Colour; left: number; top: number; width: number; height: number; tilt: TiltValues; still: boolean;
}) {
  const T = LIGHTS.twinkle;
  const light = useSharedValue<number>(T.rest);
  useEffect(() => {
    if (still) {
      light.set(T.rest);
      return;
    }
    // Its own pace, its own depth, its own moment: down slowly, a beat, up a little quicker.
    const period = T.period + scatter(index, LIGHTS.trait.pace) * T.spread;
    const low = T.low + scatter(index, LIGHTS.trait.depth) * (T.high - T.low) * T.shallow;
    const ease = Easing.inOut(Easing.sin);
    light.set(withDelay(scatter(index, LIGHTS.trait.moment) * period, withRepeat(withSequence(
      withTiming(low, { duration: period * T.down, easing: ease }),
      withTiming(low + (T.high - low) * T.lift, { duration: period * T.hold, easing: ease }),
      withTiming(T.high, { duration: period * T.up, easing: ease }),
    ), -1, false)));
    return () => cancelAnimation(light);
  }, [still, index, light, T]);
  // It swings from its cap as the phone tilts, each a touch differently.
  const reach = LIGHTS.sway * (1 - LIGHTS.swayVary * scatter(index, LIGHTS.trait.swing));
  const swing = useAnimatedStyle(() => ({ transform: [{ rotate: `${tilt.x.get() * reach}deg` }] }));
  const glow = useAnimatedStyle(() => ({ opacity: light.get() }));
  return (
    <Animated.View style={[styles.part, { left, top, width, height, transformOrigin: `${SET.bulb.attach[0] * LIGHTS.percent}% ${SET.bulb.attach[1] * LIGHTS.percent}%` }, swing]}>
      <Image source={BULBS[colour].cold} style={StyleSheet.absoluteFill} contentFit="fill" />
      <Animated.View style={[StyleSheet.absoluteFill, glow]} testID="hub-window-bulb">
        <Image source={BULBS[colour].lit} style={StyleSheet.absoluteFill} contentFit="fill" />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  part: { position: "absolute" },
});
