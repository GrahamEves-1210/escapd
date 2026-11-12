// The charms, as objects (round 13: rendered in Blender, scripts/blender/props/
// charms_*.py; docs/ART_DIRECTION.md: made by hand, spooky-cute). Nine tiny
// badges, three per mode. Mystery things, not sweets: a skeleton key, a fedora,
// a struck matchbook; a magnifier, a fingerprint, an evidence tag; a sleepy
// moon, a planchette, a candle. Each comes as
// - a hard-enamel pin in gold or silver: raised polished lines, glossy enamel
//   sunk between them in its mode's colours, a slight dome, its own shadow;
// - a paper sticker (the plain finish): die-cut with a white border, a matte
//   print of the same design, one corner curling up;
// - not earned yet: its shape pressed into the board's velvet (an overlay of
//   shade and light, so it sits on whatever is under it);
// - the turn case closed plays before a pin is pressed on (TURN): ten frames
//   of it swinging round through the light to face you.
// Every picture is the same 64 box, so they all register with each other.
// Also here: the cat's outfits as the things themselves (the cats draw them on
// themselves; these only show the choice) and a locked outfit's padlock.
import { Image, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import type { Accessory, AccessoryChoice, CharmKind, Finish } from "@/game/collection/charms";

type Art = Record<Finish | "hollow", number>;

/** The stills (assets/charms/<kind>-<finish>.png, @2x, @3x). */
export const CHARM_ART: Record<CharmKind, Art> = {
  key: {
    gold: require("../../../assets/charms/key-gold.png") as number,
    silver: require("../../../assets/charms/key-silver.png") as number,
    sticker: require("../../../assets/charms/key-sticker.png") as number,
    hollow: require("../../../assets/charms/key-hollow.png") as number,
  },
  fedora: {
    gold: require("../../../assets/charms/fedora-gold.png") as number,
    silver: require("../../../assets/charms/fedora-silver.png") as number,
    sticker: require("../../../assets/charms/fedora-sticker.png") as number,
    hollow: require("../../../assets/charms/fedora-hollow.png") as number,
  },
  matchbook: {
    gold: require("../../../assets/charms/matchbook-gold.png") as number,
    silver: require("../../../assets/charms/matchbook-silver.png") as number,
    sticker: require("../../../assets/charms/matchbook-sticker.png") as number,
    hollow: require("../../../assets/charms/matchbook-hollow.png") as number,
  },
  magnifier: {
    gold: require("../../../assets/charms/magnifier-gold.png") as number,
    silver: require("../../../assets/charms/magnifier-silver.png") as number,
    sticker: require("../../../assets/charms/magnifier-sticker.png") as number,
    hollow: require("../../../assets/charms/magnifier-hollow.png") as number,
  },
  fingerprint: {
    gold: require("../../../assets/charms/fingerprint-gold.png") as number,
    silver: require("../../../assets/charms/fingerprint-silver.png") as number,
    sticker: require("../../../assets/charms/fingerprint-sticker.png") as number,
    hollow: require("../../../assets/charms/fingerprint-hollow.png") as number,
  },
  tag: {
    gold: require("../../../assets/charms/tag-gold.png") as number,
    silver: require("../../../assets/charms/tag-silver.png") as number,
    sticker: require("../../../assets/charms/tag-sticker.png") as number,
    hollow: require("../../../assets/charms/tag-hollow.png") as number,
  },
  moon: {
    gold: require("../../../assets/charms/moon-gold.png") as number,
    silver: require("../../../assets/charms/moon-silver.png") as number,
    sticker: require("../../../assets/charms/moon-sticker.png") as number,
    hollow: require("../../../assets/charms/moon-hollow.png") as number,
  },
  planchette: {
    gold: require("../../../assets/charms/planchette-gold.png") as number,
    silver: require("../../../assets/charms/planchette-silver.png") as number,
    sticker: require("../../../assets/charms/planchette-sticker.png") as number,
    hollow: require("../../../assets/charms/planchette-hollow.png") as number,
  },
  candle: {
    gold: require("../../../assets/charms/candle-gold.png") as number,
    silver: require("../../../assets/charms/candle-silver.png") as number,
    sticker: require("../../../assets/charms/candle-sticker.png") as number,
    hollow: require("../../../assets/charms/candle-hollow.png") as number,
  },
};

/**
 * A pin's turn (assets/charms/<kind>-<finish>-turn.png): one sheet of
 * `frames` pictures, `columns` across, each the still's own box, played at
 * `fps` like the cat's stop-motion. The last frame is the still (without its
 * shadow: it's in the air). A sticker doesn't turn.
 */
export const TURN = { frames: 10, columns: 5, rows: 2, fps: 12 } as const;
/** How long the turn plays (ms): its frames at 12 a second, the last one held. */
export const TURN_MS = Math.round(((TURN.frames - 1) * 1000) / TURN.fps);

export const TURN_ART: Record<CharmKind, Record<Exclude<Finish, "sticker">, number>> = {
  key: { gold: require("../../../assets/charms/key-gold-turn.png") as number, silver: require("../../../assets/charms/key-silver-turn.png") as number },
  fedora: { gold: require("../../../assets/charms/fedora-gold-turn.png") as number, silver: require("../../../assets/charms/fedora-silver-turn.png") as number },
  matchbook: { gold: require("../../../assets/charms/matchbook-gold-turn.png") as number, silver: require("../../../assets/charms/matchbook-silver-turn.png") as number },
  magnifier: { gold: require("../../../assets/charms/magnifier-gold-turn.png") as number, silver: require("../../../assets/charms/magnifier-silver-turn.png") as number },
  fingerprint: { gold: require("../../../assets/charms/fingerprint-gold-turn.png") as number, silver: require("../../../assets/charms/fingerprint-silver-turn.png") as number },
  tag: { gold: require("../../../assets/charms/tag-gold-turn.png") as number, silver: require("../../../assets/charms/tag-silver-turn.png") as number },
  moon: { gold: require("../../../assets/charms/moon-gold-turn.png") as number, silver: require("../../../assets/charms/moon-silver-turn.png") as number },
  planchette: { gold: require("../../../assets/charms/planchette-gold-turn.png") as number, silver: require("../../../assets/charms/planchette-silver-turn.png") as number },
  candle: { gold: require("../../../assets/charms/candle-gold-turn.png") as number, silver: require("../../../assets/charms/candle-silver-turn.png") as number },
};

/**
 * A charm, `size` across. `silhouette`: not earned yet, its hollow in the
 * board. Decorative (the caller labels it).
 */
export function Charm({ kind, finish = "gold", size, silhouette = false, testID }: {
  kind: CharmKind;
  finish?: Finish;
  size: number;
  silhouette?: boolean;
  testID?: string;
}) {
  return (
    <Image
      source={CHARM_ART[kind][silhouette ? "hollow" : finish]}
      style={{ width: size, height: size }}
      resizeMode="contain"
      fadeDuration={0}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
      testID={testID}
    />
  );
}

/** The frame of the turn a time `t` (0 at its first frame, 1 at its last) shows. */
export function turnFrame(t: number): number {
  "worklet";
  return Math.min(TURN.frames - 1, Math.max(0, Math.round(t * (TURN.frames - 1))));
}

/**
 * A gold or silver pin's turn, `size` across, showing the frame `progress`
 * (0 to 1) picks: a window onto its sheet, stepped, never blended (stop-motion).
 */
export function CharmTurn({ kind, finish, size, progress }: { kind: CharmKind; finish: Exclude<Finish, "sticker">; size: number; progress: SharedValue<number> }) {
  const sheet = useAnimatedStyle(() => {
    const f = turnFrame(progress.get());
    return { transform: [{ translateX: -(f % TURN.columns) * size }, { translateY: -Math.floor(f / TURN.columns) * size }] };
  });
  return (
    <View style={[styles.window, { width: size, height: size }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[{ width: size * TURN.columns, height: size * TURN.rows }, sheet]}>
        <Image source={TURN_ART[kind][finish]} style={{ width: size * TURN.columns, height: size * TURN.rows }} fadeDuration={0} accessible={false} />
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The cat's outfits, as the things themselves
// ---------------------------------------------------------------------------

/** assets/charms/wear-<outfit>.png (@2x, @3x); "none": a paw, just the cat. */
export const WEAR_ART: Record<AccessoryChoice, number> = {
  none: require("../../../assets/charms/wear-none.png") as number,
  collar: require("../../../assets/charms/wear-collar.png") as number,
  scarf: require("../../../assets/charms/wear-scarf.png") as number,
  specs: require("../../../assets/charms/wear-specs.png") as number,
  deerstalker: require("../../../assets/charms/wear-deerstalker.png") as number,
};

/** One of the cat's outfits (or "none": a paw), within `size`; `muted` when locked: only its shape, in `tone`. */
export function AccessoryIcon({ accessory, size, muted = false, tone = "#4A3A52" }: { accessory: AccessoryChoice; size: number; muted?: boolean; tone?: string }) {
  return (
    <Image
      source={WEAR_ART[accessory]}
      style={[{ width: size, height: size }, muted ? { tintColor: tone } : null]}
      resizeMode="contain"
      fadeDuration={0}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

/** A tiny padlock, drawn (a locked outfit). */
export function LockMark({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none" pointerEvents="none">
      <Path d="M5 7 V5.2 C5 3.4 6.3 2.2 8 2.2 C9.7 2.2 11 3.4 11 5.2 V7" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M3.6 7 H12.4 Q13.2 7 13.2 7.8 V13 Q13.2 13.8 12.4 13.8 H3.6 Q2.8 13.8 2.8 13 V7.8 Q2.8 7 3.6 7 Z" fill={color} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  window: { overflow: "hidden" },
});

export type { Accessory };
