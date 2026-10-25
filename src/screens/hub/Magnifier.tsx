// The painted brass reading glass, 01's hero object (docs/DESIGN.md, Global
// tokens: Tilt; Images: Painted magnifying glass; 01 Tappable elements:
// Magnifying glass). The one pointer effect: press and drag and it leans
// toward the finger (+/-16 deg) with a glint on its lens; let go and it
// settles flat. Decorative: no action, hidden from screen readers, not
// focusable. A still image under reduced motion.
import { useCallback, useEffect, useId } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, ClipPath, Defs, G, RadialGradient, Rect, Stop } from "react-native-svg";
import { timingFor } from "@/components/noir";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";

// The 1024 master: the 96 pt set is too small for a 128 pt box (128 @3x needs 384 px).
const GLASS = require("../../../assets/brand/magnifier-1024.png");

const T = ref.motion.tilt;
const H = ref.layout.hub;
const SIZE = H.glass;
const HALF = 1 / 2;
// The glass inside the brass rim, in box pt: (78.6, 42.4) r 32.3.
const LENS = { cx: SIZE * H.lens.x, cy: SIZE * H.lens.y, r: SIZE * H.lens.r };

const FOLLOW = timingFor(T.follow);
const RETURN = timingFor(T.return);
// The glare token sets no curve: ease-out, as ref.motion.control does.
const GLARE = timingFor({ duration: T.glare.fade, easing: ref.motion.control.easing });

const AnimatedRadialGradient = Animated.createAnimatedComponent(RadialGradient);

export interface MagnifierProps {
  /** False while the How you play sheet is open (its scrim covers the glass anyway). */
  enabled: boolean;
}

export function Magnifier({ enabled }: MagnifierProps) {
  const { reducedMotion } = useTheme();
  const rx = useSharedValue(0);
  const ry = useSharedValue(0);
  const glare = useSharedValue(0);
  const gx = useSharedValue(LENS.cx);
  const gy = useSharedValue(LENS.cy);
  const id = useId().replace(/[^A-Za-z0-9]/g, "");

  // Flat and without glare at once, with no animation.
  const settleNow = useCallback(() => {
    cancelAnimation(rx);
    cancelAnimation(ry);
    cancelAnimation(glare);
    rx.set(0);
    ry.set(0);
    glare.set(0);
  }, [rx, ry, glare]);

  // Reduced motion turning on mid-drag sets the glass flat with no animation.
  useEffect(() => {
    if (reducedMotion) settleNow();
  }, [reducedMotion, settleNow]);

  // A card navigating away (the screen loses focus) leaves the glass flat, glare cleared.
  useFocusEffect(useCallback(() => settleNow, [settleNow]));

  const lean = (x: number, y: number) => {
    "worklet";
    // Local to the wrapper, clamped: a drag that leaves the box holds the edge value.
    const px = Math.min(Math.max(x / SIZE, 0), 1);
    const py = Math.min(Math.max(y / SIZE, 0), 1);
    // The side under the finger dips away; the top tips away near the top.
    ry.set(withTiming((px - HALF) * T.max, FOLLOW));
    rx.set(withTiming((HALF - py) * T.max, FOLLOW));
    // The glare centre follows the finger directly.
    gx.set(px * SIZE);
    gy.set(py * SIZE);
  };

  const pan = usePanGesture({
    enabled: enabled && !reducedMotion,
    minDistance: 0,
    maxPointers: 1,
    shouldCancelWhenOutside: false,
    onBegin: (e) => {
      "worklet";
      lean(e.x, e.y);
      glare.set(withTiming(T.glare.opacity, GLARE));
    },
    onUpdate: (e) => {
      "worklet";
      lean(e.x, e.y);
    },
    // Release or cancel: ease flat over the return curve; the glare fades where it is.
    onFinalize: () => {
      "worklet";
      rx.set(withTiming(0, RETURN));
      ry.set(withTiming(0, RETURN));
      glare.set(withTiming(0, GLARE));
    },
  });

  // Perspective goes first, in the view's own transform (RN has no parent perspective).
  const tiltStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: T.perspective }, { rotateX: `${rx.get()}deg` }, { rotateY: `${ry.get()}deg` }],
  }));
  const glareStyle = useAnimatedStyle(() => ({ opacity: glare.get() }));

  return (
    <GestureDetector gesture={pan}>
      {/* The drag surface: the art box, never transformed, so the glass can't slide out from under the finger. */}
      <View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        focusable={false}
        testID="hub-glass"
        style={[styles.box, styles.centred]}
      >
        <Animated.View style={[styles.box, tiltStyle]}>
          <Image source={GLASS} contentFit="contain" style={styles.box} accessible={false} />
          {reducedMotion ? null : (
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, glareStyle]}>
              <Svg width={SIZE} height={SIZE}>
                <Defs>
                  <ClipPath id={`lens${id}`}>
                    <Circle cx={LENS.cx} cy={LENS.cy} r={LENS.r} />
                  </ClipPath>
                  {T.glare.layers.map((layer, i) => (
                    <GlareGradient key={layer.radius} id={`glare${id}${i}`} layer={layer} gx={gx} gy={gy} />
                  ))}
                </Defs>
                {/* Light on glass only: the brass rim, the handle and the ground get none. */}
                <G clipPath={`url(#lens${id})`}>
                  {T.glare.layers.map((layer, i) => (
                    <Rect key={layer.radius} x={0} y={0} width={SIZE} height={SIZE} fill={`url(#glare${id}${i})`} />
                  ))}
                </G>
              </Svg>
            </Animated.View>
          )}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

type GlareLayer = (typeof T.glare.layers)[number];

/** One white radial layer (plain alpha, no blend), centred under the finger in box coordinates. */
function GlareGradient({ id, layer, gx, gy }: { id: string; layer: GlareLayer; gx: SharedValue<number>; gy: SharedValue<number> }) {
  const centre = useAnimatedProps(() => ({ cx: gx.get(), cy: gy.get(), fx: gx.get(), fy: gy.get() }));
  return (
    <AnimatedRadialGradient
      id={id}
      gradientUnits="userSpaceOnUse"
      r={layer.radius}
      cx={LENS.cx}
      cy={LENS.cy}
      fx={LENS.cx}
      fy={LENS.cy}
      animatedProps={centre}
    >
      {layer.opacities.map((opacity, i) => (
        // Opacity must be its own prop: react-native-svg drops the alpha of an rgba colour.
        <Stop key={layer.offsets[i]} offset={layer.offsets[i]} stopColor={T.glare.color} stopOpacity={opacity} />
      ))}
    </AnimatedRadialGradient>
  );
}

const styles = StyleSheet.create({
  box: { width: SIZE, height: SIZE },
  // Centred on the screen's axis in its column.
  centred: { alignSelf: "center" },
});
