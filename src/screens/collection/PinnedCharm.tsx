// Case closed's charm (round 7): the case's charm, pinned to the corner of
// her last page. After the rating it comes up big over the page in a soft
// halo, turns to catch the light, then swoops to the page's top-left corner
// and is pressed on: a pin pushes in with a click (`snap`), a sticker is
// smoothed down with a rustle (`paper`); a few sparkles burst, and a tiny
// hand-lettered tag says "New!" (or the finish a replay lifted it to).
// The turn (round 13) is the rendered pin's own: a gold or silver pin swings
// round through the key light to face her, ten frames at 12 a second
// (CharmArt's CharmTurn), in the air; when it's pressed on, the still takes
// its place, with its shadow on the page. A sticker doesn't turn (it's paper):
// it comes up flat and tips a little.
// Reduced motion: the still fades in where it lands, the sound and haptic kept.
import { useEffect, useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import { CHARM_INFO, FINISH_LABEL, type CharmKind, type Finish } from "@/game/collection/charms";
import type { AwardStatus } from "@/game/collection/store";
import { useFeedback } from "@/game/feedback";
import { Confetti } from "@/render/keepsake";
import { alpha, handType } from "@/theme/payoff";
import { Charm, CharmTurn, TURN_MS } from "./CharmArt";

export interface ShownCharm {
  kind: CharmKind;
  finish: Finish;
  status: AwardStatus;
}

/** The moment's beats (ms) and the charm's resting size and tilt. */
export const PIN = {
  size: 60,
  tilt: -10,
  /** Up big over the page, and how big (its art is 64 pt x3: any bigger goes soft). */
  appear: 260,
  big: 2.2,
  /** Hanging there: with `appear`, long enough for the turn (TURN_MS) and a beat face on. */
  hold: 600,
  /** The swoop to the corner. */
  swoop: 420,
  /** The press: in, back up, settle. */
  press: [70, 110, 120],
  reduced: 300,
} as const;

/** Its tag: "New!", the finish a replay lifted it to, or nothing (it was already on her board). */
export function pinTag(charm: Pick<ShownCharm, "status" | "finish">): string | null {
  if (charm.status === "new") return "New!";
  if (charm.status === "upgraded") return charm.finish === "gold" ? "Gold!" : "Silver!";
  return null;
}

export function pinLabel(charm: ShownCharm): string {
  const what = `${CHARM_INFO[charm.kind].name}, ${FINISH_LABEL[charm.finish].toLowerCase()}`;
  if (charm.status === "new") return `New charm: ${what}. Pinned to your charm board.`;
  if (charm.status === "upgraded") return `Charm upgraded: ${what}.`;
  return `Charm: ${what}. Already on your charm board.`;
}

/**
 * `delay`: ms from now until it comes up. `from`: where over the page it
 * comes up, as an offset from its resting place (the page's middle).
 */
export function PinnedCharm({ charm, delay, from, reduced, colors, tagInk, tagPaper, style, testID }: {
  charm: ShownCharm;
  delay: number;
  from: { x: number; y: number };
  reduced: boolean;
  /** The sparkles' colours. */
  colors: readonly string[];
  tagInk: string;
  tagPaper: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const feedback = useFeedback();
  const opacity = useSharedValue(0);
  const x = useSharedValue(reduced ? 0 : from.x);
  const y = useSharedValue(reduced ? 0 : from.y);
  const scale = useSharedValue(reduced ? 1 : PIN.big * 0.7);
  const sx = useSharedValue(1);
  const sticker = charm.finish === "sticker";
  // A pin turns in depth (its frames); only a sticker still tips in the plane.
  const spin = useSharedValue(reduced ? PIN.tilt : sticker ? -24 : -8);
  const turn = useSharedValue(0);
  const halo = useSharedValue(0);
  const tag = useSharedValue(0);
  const [burst, setBurst] = useState(0);
  // Pressed on: from then the still (with its shadow) stands in for the turn's last frame.
  const [landed, setLanded] = useState(reduced);
  const turns = !reduced && !sticker;

  useEffect(() => {
    const landed = () => {
      if (sticker) feedback.paper();
      else feedback.snap();
      setLanded(true);
      setBurst((n) => n + 1);
    };
    if (reduced) {
      opacity.set(withDelay(delay, withTiming(1, { duration: PIN.reduced })));
      tag.set(withDelay(delay + PIN.reduced, withTiming(1, { duration: PIN.reduced })));
      const t = setTimeout(landed, delay + PIN.reduced);
      return () => clearTimeout(t);
    }
    const out = Easing.out(Easing.back(1.6));
    const swoopAt = delay + PIN.appear + PIN.hold;
    const landAt = swoopAt + PIN.swoop;
    const [pIn, pBack, pSettle] = PIN.press;
    opacity.set(withDelay(delay, withTiming(1, { duration: 160 })));
    halo.set(withDelay(delay, withSequence(withTiming(1, { duration: PIN.appear }), withTiming(1, { duration: PIN.hold }), withTiming(0, { duration: PIN.swoop * 0.7 }))));
    // Up big, turning to catch the light while it hangs there.
    turn.set(withDelay(delay, withTiming(1, { duration: TURN_MS, easing: Easing.linear })));
    scale.set(withDelay(delay, withSequence(
      withTiming(PIN.big, { duration: PIN.appear, easing: out }),
      withTiming(PIN.big * 0.96, { duration: PIN.hold, easing: Easing.inOut(Easing.sin) }),
      // Down to the page: a little over its size, then pressed in.
      withTiming(1.12, { duration: PIN.swoop, easing: Easing.inOut(Easing.cubic) }),
      withTiming(sticker ? 1 : 0.88, { duration: pIn }),
      withTiming(1.05, { duration: pBack }),
      withTiming(1, { duration: pSettle }),
    )));
    spin.set(withDelay(delay, withSequence(
      withTiming(sticker ? 6 : 2, { duration: PIN.appear + PIN.hold * 0.5, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: PIN.hold * 0.5 }),
      withTiming(PIN.tilt - 6, { duration: PIN.swoop, easing: Easing.inOut(Easing.cubic) }),
      withTiming(PIN.tilt, { duration: pIn + pBack }),
    )));
    // A sticker is smoothed flat as it lands: it spreads, then settles.
    if (sticker) sx.set(withDelay(landAt, withSequence(withTiming(1.1, { duration: pIn }), withTiming(0.97, { duration: pBack }), withTiming(1, { duration: pSettle }))));
    x.set(withDelay(swoopAt, withTiming(0, { duration: PIN.swoop, easing: Easing.inOut(Easing.cubic) })));
    y.set(withDelay(swoopAt, withTiming(0, { duration: PIN.swoop, easing: Easing.in(Easing.quad) })));
    tag.set(withDelay(landAt + pIn + pBack, withTiming(1, { duration: 260, easing: out })));
    const t = setTimeout(landed, landAt);
    return () => clearTimeout(t);
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const body = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }, { scaleX: sx.get() }, { scaleY: 2 - sx.get() }, { rotate: `${spin.get()}deg` }],
  }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.get() * 0.9 }));
  const tagStyle = useAnimatedStyle(() => ({ opacity: tag.get(), transform: [{ scale: 0.6 + tag.get() * 0.4 }, { rotate: "-8deg" }] }));
  const label = pinTag(charm);

  return (
    <View style={[styles.spot, style]} pointerEvents="none" accessible accessibilityLabel={pinLabel(charm)} testID={testID}>
      <Animated.View style={[styles.charm, body]}>
        <Animated.View style={[styles.halo, { backgroundColor: alpha(colors[0] ?? "#FFFFFF", 0.35), boxShadow: `0px 0px 24px ${alpha(colors[0] ?? "#FFFFFF", 0.6)}` }, haloStyle]} />
        {/* The still is there from the start (under the turn, unseen) so it's ready the moment it lands. */}
        <View style={turns && !landed ? styles.unseen : null}>
          <Charm kind={charm.kind} finish={charm.finish} size={PIN.size} />
        </View>
        {turns && !landed && charm.finish !== "sticker" ? (
          <View style={styles.turn} testID={testID ? `${testID}-turn` : undefined}>
            <CharmTurn kind={charm.kind} finish={charm.finish} size={PIN.size} progress={turn} />
          </View>
        ) : null}
      </Animated.View>
      <Confetti fire={burst} colors={colors} x={PIN.size / 2} y={PIN.size / 2} reduced={reduced} />
      {label ? (
        <Animated.View style={[styles.tag, { backgroundColor: tagPaper }, tagStyle]} testID={testID ? `${testID}-tag` : undefined}>
          <Text style={[handType(15, 18), { color: tagInk }]}>{label}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  spot: { position: "absolute", width: PIN.size, height: PIN.size, zIndex: 5 },
  charm: { width: PIN.size, height: PIN.size },
  unseen: { opacity: 0 },
  turn: { position: "absolute", left: 0, top: 0 },
  halo: { position: "absolute", left: 6, top: 6, right: 6, bottom: 6, borderRadius: PIN.size },
  tag: { position: "absolute", left: 4, top: PIN.size - 8, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 6 },
});
