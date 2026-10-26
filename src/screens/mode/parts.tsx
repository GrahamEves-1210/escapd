// A mode's own pieces (MODES_PROMPT.md Part 2), the reference look's parts
// in the mode's palette, for its first-time intro: the camera's square back
// button, the fixed header that backs it once the content scrolls under it,
// the banner of the mode's drawn cover, and the fade above the pinned foot.
// The foot's button is the photo guide's pill (ModePill, the mode's accent).
// Every colour is the mode's theme (modeThemes), every size ref.layout.mode or
// a shared ref token.
import { useId } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { ArrowLeftIcon } from "@/components/icons";
import { FocusRing, SquashPressable, useFocusRing } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import type { Genre } from "@/lib/puzzle-types";
import { ref, type ModeTheme } from "@/theme/tokens";
import { ModeCover } from "@/screens/hub/art/ModeCover";

const L = ref.layout.mode;
const SQ = ref.button.square;
const SLOP = (SQ.hit - SQ.size) / 2;

/** The camera's 44 square (14 corners, 1 pt rim, bold 18 glyph, 48 hit) in the mode's raised, rim and ink. */
export function BackSquare({ theme, onPress, testID = "mode-back" }: { theme: ModeTheme; onPress: () => void; testID?: string }) {
  const focus = useFocusRing();
  const feedback = useFeedback();
  return (
    <SquashPressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPressIn={feedback.press}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      hitSlop={SLOP}
      testID={testID}
      style={({ pressed }) => [styles.square, { backgroundColor: theme.raised, borderColor: theme.rim }, pressed && styles.pressed]}
    >
      <ArrowLeftIcon size={ref.layout.camera.headerIcon.size} weight={ref.layout.camera.headerIcon.weight} color={theme.ink} />
      <FocusRing visible={focus.focused} shape="panel" edge={SQ.borderWidth} radius={SQ.radius} />
    </SquashPressable>
  );
}

/**
 * The scroll offset of a mode intro's content, tracked on the UI thread for its
 * header: `y` for ModeHeader, `props` for the list's Animated.ScrollView.
 */
export function useModeScroll() {
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    y.value = event.contentOffset.y;
  });
  return { y, props: { onScroll, scrollEventThrottle: L.header.throttle } };
}

/**
 * The fixed top of a mode's screens, rendered before the scrolling content so
 * Back comes first in reading and focus order (zIndex keeps it on top): the
 * back square `L.top` below the safe top, and behind it and the status bar a
 * backing in the ground that fades in as the banner scrolls away, so the name
 * and the list never run under the square or the clock. At rest the square
 * sits on the art as before. Opacity only, on the UI thread, following the
 * player's own scroll; there is no movement, so reduced motion keeps it.
 */
export function ModeHeader({
  theme,
  scrollY,
  onBack,
  backTestID,
}: {
  theme: ModeTheme;
  scrollY: SharedValue<number>;
  onBack: () => void;
  backTestID?: string;
}) {
  const insets = useSafeAreaInsets();
  const id = `head${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const H = L.header;
  const below = L.top + SQ.size + H.below;
  // The scroll at which the banner's foot reaches the backing's foot.
  const covered = L.banner - below;
  const backing = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [covered - H.fade, covered], [0, 1], Extrapolation.CLAMP),
  }));
  return (
    <View style={styles.header} pointerEvents="box-none" testID="mode-header">
      <Animated.View
        style={[styles.backing, backing]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="mode-header-backing"
      >
        <View style={{ height: insets.top + below, backgroundColor: theme.ground }} testID="mode-header-ground" />
        <View style={styles.headerShade}>
          <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id={id} x1={0} y1={0} x2={0} y2={1}>
                <Stop offset={0} stopColor={theme.ground} stopOpacity={1} />
                <Stop offset={1} stopColor={theme.ground} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={1} height={1} fill={`url(#${id})`} />
          </Svg>
        </View>
      </Animated.View>
      <View style={[styles.back, { top: insets.top + L.top }]}>
        <BackSquare theme={theme} onPress={onBack} testID={backTestID} />
      </View>
    </View>
  );
}

/**
 * The top of a mode's screens: its drawn cover (the same picture as its home
 * card) full bleed from the screen's top to `height`, fading into
 * the ground at its foot. Decorative: hidden from screen readers.
 */
export function ModeBanner({ genre, theme, height }: { genre: Genre; theme: ModeTheme; height: number }) {
  const id = `banner${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  return (
    <View
      style={[styles.banner, { height }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="mode-banner"
    >
      <ModeCover genre={genre} style={StyleSheet.absoluteFill} testID="mode-banner-art" />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} viewBox="0 0 1 1" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1={0} y1={0} x2={0} y2={1}>
            {L.bannerFade.map((s) => (
              <Stop key={s.offset} offset={s.offset} stopColor={theme.ground} stopOpacity={s.opacity} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={1} height={1} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** The fade the content scrolls under, above the pinned foot: clear to the ground. Decorative. */
export function FootShade({ theme }: { theme: ModeTheme }) {
  const id = `shade${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  return (
    <View style={styles.shade} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1={0} y1={0} x2={0} y2={1}>
            <Stop offset={0} stopColor={theme.ground} stopOpacity={0} />
            <Stop offset={1} stopColor={theme.ground} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={1} height={1} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  square: {
    width: SQ.size,
    height: SQ.size,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: SQ.borderWidth,
    borderRadius: SQ.radius,
    ...ref.curve,
  },
  pressed: { opacity: SQ.pressedOpacity },
  header: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 1 },
  backing: { position: "absolute", top: 0, left: 0, right: 0 },
  headerShade: { height: L.header.shade },
  back: { position: "absolute", left: L.edge },
  banner: { position: "absolute", top: 0, left: 0, right: 0 },
  shade: { position: "absolute", left: 0, right: 0, top: -L.foot.shade, height: L.foot.shade },
});
