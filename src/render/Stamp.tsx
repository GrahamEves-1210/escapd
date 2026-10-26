// A rubber stamp in the mode's stamp colour: CONTRADICTED on a suspect card,
// CASE CLOSED and GUILTY on case closed and the accusation's reveal. A
// framed word in the heavy grotesk, tilted; the frame a little short of
// solid like ink, the word always solid so its contrast holds (11 pt
// CONTRADICTED on a card's raised fill needs all of its 4.5:1).
// A large stamp can slam down: it falls from slamFrom times its size to rest
// (opacity and scale on the UI thread), with a thud as it lands; under
// reduced motion it fades in instead. The word is the stamp's meaning, so
// it never relies on its colour.
import { useEffect } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import { trackingPad } from "@/components/noir";

const P = ref.layout.play;
const S = P.stamp;

export interface StampProps {
  text: string;
  size?: "small" | "large";
  /** Large only: fall onto the page after `delay` ms (default S.slamDelay). False: it is simply there (or fades in). */
  slam?: boolean;
  delay?: number;
  /** Called once it has landed (after the fade under reduced motion). */
  onLanded?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Stamp({ text, size = "small", slam = false, delay = S.slamDelay, onLanded, style, testID }: StampProps) {
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  const feedback = useFeedback();
  const large = size === "large";
  const animate = large && slam;
  // The whole stamp rests at full strength; only its frame is inked (below).
  const opacity = useSharedValue(animate ? 0 : 1);
  const scale = useSharedValue(animate && !reducedMotion ? S.slamFrom : 1);

  useEffect(() => {
    if (!animate) return;
    const landed = () => {
      feedback.thud();
      onLanded?.();
    };
    if (reducedMotion) {
      opacity.set(withDelay(delay, withTiming(1, { duration: motion.reducedFade }, (done) => {
        if (done) scheduleOnRN(landed);
      })));
      return;
    }
    opacity.set(withDelay(delay, withTiming(1, { duration: S.slam / 2 })));
    scale.set(withDelay(delay, withTiming(1, { duration: S.slam, easing: Easing.in(Easing.quad) }, (done) => {
      if (done) scheduleOnRN(landed);
    })));
    // Once, on mount: a stamp lands once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const motionStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ rotate: `${S.tilt}deg` }, { scale: scale.get() }],
  }));

  const type = large ? P.type.stampLarge : P.type.stamp;
  return (
    <Animated.View
      style={[styles.stamp, large ? styles.large : styles.small, motionStyle, style]}
      testID={testID}
    >
      <View
        pointerEvents="none"
        style={[styles.frame, large ? styles.frameLarge : styles.frameSmall, { borderColor: theme.stamp }]}
        testID={testID ? `${testID}-frame` : undefined}
      />
      <Text style={[type, trackingPad(type), { color: theme.stamp }]}>{text}</Text>
    </Animated.View>
  );
}

// The frame is drawn over the stamp's own box, so the padding takes the
// border's width as well: the stamp keeps the size a bordered box would have.
const styles = StyleSheet.create({
  stamp: { alignItems: "center", justifyContent: "center" },
  small: { paddingHorizontal: S.padX + S.border, paddingVertical: S.padY + S.border },
  large: { paddingHorizontal: S.padXLarge + S.borderLarge, paddingVertical: S.padYLarge + S.borderLarge },
  frame: { ...StyleSheet.absoluteFill, borderRadius: S.radius, ...ref.curve, opacity: S.opacity },
  frameSmall: { borderWidth: S.border },
  frameLarge: { borderWidth: S.borderLarge },
});
