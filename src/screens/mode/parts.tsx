// A mode's own controls (MODES_PROMPT.md Part 2), the reference look's
// pieces in the mode's palette: the camera's square back button, the light
// table's bar in the mode's accent (with New case's Pro lock), the rubber
// stamps on case files, and the banner of the mode's art. Every colour is
// the mode's theme (modeThemes), every size ref.layout.mode or a shared ref token.
import { useId } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { LockSimpleIcon } from "phosphor-react-native/src/icons/LockSimple";
import { ArrowLeftIcon } from "@/components/icons";
import { FocusRing, TreatedImage, useFocusRing } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import type { Genre } from "@/lib/puzzle-types";
import { ref, type ModeTheme } from "@/theme/tokens";
import type { ModeArt } from "./art";
import { STAMP_WORDS, type CaseStamp } from "./caseFiles";

const L = ref.layout.mode;
const SQ = ref.button.square;
const SLOP = (SQ.hit - SQ.size) / 2;

/** The camera's 44 square (14 corners, 1 pt rim, bold 18 glyph, 48 hit) in the mode's raised, rim and ink. */
export function BackSquare({ theme, onPress, testID = "mode-back" }: { theme: ModeTheme; onPress: () => void; testID?: string }) {
  const focus = useFocusRing();
  const feedback = useFeedback();
  return (
    <Pressable
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
    </Pressable>
  );
}

/**
 * The scroll offset of a mode screen's list, tracked on the UI thread for its
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
 * The one strong action, pinned to the foot: the light table's bar in the
 * mode's accent, its label in accentInk. `locked` adds the Pro lock (a
 * LockSimple glyph and "Pro" in an outlined capsule at the right); the tap
 * still goes through (openCapture sends the player to /pro). Busy keeps full
 * strength, ignores taps and shows a small indicator in place of the lock.
 */
export function ModeBar({
  theme,
  label,
  onPress,
  locked = false,
  busy = false,
  testID,
}: {
  theme: ModeTheme;
  label: string;
  onPress: () => void;
  locked?: boolean;
  busy?: boolean;
  testID?: string;
}) {
  const focus = useFocusRing();
  const feedback = useFeedback();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={locked ? `${label}. Pro` : label}
      accessibilityHint={locked ? "Needs ESCAPD Pro." : undefined}
      accessibilityState={{ disabled: busy, busy }}
      onPressIn={busy ? undefined : feedback.press}
      onPress={busy ? undefined : onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      testID={testID}
      style={({ pressed }) => [styles.bar, { backgroundColor: theme.accent }, pressed && !busy && styles.pressed]}
    >
      <Text style={[L.type.action, styles.barLabel, { color: theme.accentInk }]}>{label}</Text>
      {busy ? (
        <View pointerEvents="none" style={styles.barSide}>
          <ActivityIndicator size="small" color={theme.accentInk} testID={testID ? `${testID}-busy` : undefined} />
        </View>
      ) : locked ? (
        <View pointerEvents="none" style={styles.barSide}>
          <View style={[styles.lock, { borderColor: theme.accentInk }]} testID={testID ? `${testID}-lock` : undefined}>
            <LockSimpleIcon size={L.bar.lock.icon} weight="bold" color={theme.accentInk} />
            <Text style={[L.type.lock, { color: theme.accentInk }]}>Pro</Text>
          </View>
        </View>
      ) : null}
      <FocusRing visible={focus.focused} shape="panel" radius={L.bar.radius} />
    </Pressable>
  );
}

/** A quiet text button in the mode's ink (Try again): 44 tall at least, the press haptic, the focus ring. */
export function TextButton({ theme, label, onPress, testID }: { theme: ModeTheme; label: string; onPress: () => void; testID?: string }) {
  const focus = useFocusRing();
  const feedback = useFeedback();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={feedback.press}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      testID={testID}
      style={({ pressed }) => [styles.text, pressed && styles.pressed]}
    >
      <Text style={[L.type.action, { color: theme.ink }]}>{label}</Text>
      <FocusRing visible={focus.focused} shape="panel" radius={L.bar.radius} />
    </Pressable>
  );
}

/** A case file's rubber stamp, in the mode's stamp colour (BUILDING in the muted ink); CLOSED is inked solid. */
export function Stamp({ theme, stamp, testID }: { theme: ModeTheme; stamp: CaseStamp; testID?: string }) {
  const solid = stamp === "closed";
  const tone = stamp === "building" ? theme.inkMuted : theme.stamp;
  return (
    <View
      style={[styles.stamp, { borderColor: tone }, solid && { backgroundColor: tone }, stamp === "building" && styles.dashed]}
      testID={testID}
    >
      <Text style={[L.stamp.type, { color: solid ? theme.surface : tone }]}>{STAMP_WORDS[stamp]}</Text>
    </View>
  );
}

/**
 * The top of a mode's screens: its art (the same photo as its home card, in
 * its treatment) full bleed from the screen's top to `height`, fading into
 * the ground at its foot. Decorative: hidden from screen readers.
 */
export function ModeBanner({ genre, theme, art, height }: { genre: Genre; theme: ModeTheme; art: ModeArt; height: number }) {
  const id = `banner${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  return (
    <View
      style={[styles.banner, { height }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="mode-banner"
    >
      <TreatedImage
        source={art.source}
        genre={genre}
        cacheKey={art.cacheKey}
        maxEdge={L.artEdge}
        contentFit="cover"
        style={StyleSheet.absoluteFill}
        accessible={false}
        testID="mode-banner-art"
      />
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

/** The fade the list scrolls under, above the pinned bar: clear to the ground. Decorative. */
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
  bar: {
    alignSelf: "stretch",
    minHeight: L.bar.height,
    alignItems: "center",
    justifyContent: "center",
    // Room for the lock on both sides, so the label stays on the axis.
    paddingHorizontal: ref.space.xxl + ref.space.xxl,
    borderRadius: L.bar.radius,
    ...ref.curve,
  },
  barLabel: { textAlign: "center" },
  barSide: { position: "absolute", top: 0, bottom: 0, right: L.bar.lock.inset, justifyContent: "center" },
  lock: {
    flexDirection: "row",
    alignItems: "center",
    gap: L.bar.lock.gap,
    paddingHorizontal: L.bar.lock.padX,
    paddingVertical: L.bar.lock.padY,
    borderWidth: L.bar.lock.border,
    borderRadius: ref.radius.round,
  },
  stamp: {
    alignSelf: "center",
    paddingHorizontal: L.stamp.padX,
    paddingVertical: L.stamp.padY,
    borderWidth: L.stamp.border,
    borderRadius: L.stamp.radius,
    transform: [{ rotate: L.stamp.angle }],
  },
  dashed: { borderStyle: "dashed" },
  text: { alignSelf: "flex-start", minHeight: ref.hit.min, justifyContent: "center" },
  banner: { position: "absolute", top: 0, left: 0, right: 0 },
  shade: { position: "absolute", left: 0, right: 0, top: -L.bar.shade, height: L.bar.shade },
});
