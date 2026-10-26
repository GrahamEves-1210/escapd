// A rubber stamp in the mode's stamp colour: CONTRADICTED on a suspect card,
// CASE CLOSED and GUILTY on case closed and the accusation's reveal. A
// framed word in the heavy grotesk, tilted; the frame a little short of
// solid like ink, the word always solid so its contrast holds (11 pt
// CONTRADICTED on a card's raised fill needs all of its 4.5:1).
// A large stamp (or a medium one: case closed's, sized to its card) can
// slam down (slam.ts): it falls from slamFrom times its
// size, overshoots and settles, its ink spreading out from the frame as it
// hits, with the `stamp` cue (haptic and sound) on impact; under reduced
// motion it fades in instead, and the cue comes as the fade ends. The word
// is the stamp's meaning, so it never relies on its colour.
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { trackingPad } from "@/components/noir";
import { useSlam } from "./slam";

const P = ref.layout.play;
const S = P.stamp;

export interface StampProps {
  text: string;
  /** "medium": case closed's CASE CLOSED and GUILTY (a large stamp's frame, smaller type). */
  size?: "small" | "medium" | "large";
  /** Large and medium only: fall onto the page after `delay` ms (default S.slamDelay). False: it is simply there (or fades in). */
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
  const large = size !== "small";
  const animate = large && slam;
  // The whole stamp rests at full strength; only its frame is inked (below).
  const { opacity, scale, ink } = useSlam({
    enabled: animate,
    delay,
    reducedMotion,
    onLanded: () => {
      feedback.stamp();
      onLanded?.();
    },
  });

  const motionStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ rotate: `${S.tilt}deg` }, { scale: scale.get() }],
  }));

  const type = size === "large" ? P.type.stampLarge : size === "medium" ? P.type.stampMedium : P.type.stamp;
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
      {animate ? (
        // The ink spreading out from the frame as the stamp hits.
        <Animated.View
          pointerEvents="none"
          style={[styles.frame, styles.frameLarge, { borderColor: theme.stamp }, ink]}
          testID={testID ? `${testID}-ink` : undefined}
        />
      ) : null}
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
