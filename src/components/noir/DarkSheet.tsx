// The reference look's dark bottom sheet, generalised from the hub's How you
// play sheet (docs/DESIGN.md, 01 · How you play sheet), so every dark sheet is
// one sheet: fill the mode's surface (ref.color.ground in the shell), top corners ref.radius.bottomSheet 40 (the camera's)
// (continuous), a 1 pt ref.color.rim along its top and sides, over a black
// 55 % scrim (or a clear one, so the scene stays visible). The header is the
// title on the 24 gutter, an optional grey meta line under it, and Close as
// 01's round chip (36 disc, diagonal 1 pt specular ring, Phosphor X at 18)
// 16 from the sheet's top and right edges. Content scrolls; an optional
// footer stays pinned under it. It shares the hub sheet's timings
// (ref.layout.hub.sheet): it slides up on ref.motion.sheetRise and away on ref.motion.sheetFall
// (cross-fades over motion.reducedFade under reduced motion),
// moves screen-reader focus to its title once it has risen, and traps
// VoiceOver (accessibilityViewIsModal). Tapping the scrim closes it.
// Render it conditionally: it animates in on mount.
// Closing: Close, the scrim and anything inside that asks through
// useSheetClose() (or a function `footer`'s `close`) slide the sheet away
// while it is still mounted, and call `onClose` only once it is gone (once,
// from the slide's end on the UI thread through scheduleOnRN, or from a JS
// fallback ref.layout.hub.sheet.closeSlack ms after it should have ended). A
// sheet that only animated out on unmount lost its stacking on the way down
// (the removed view no longer sorts by its zIndex), so the tray and the
// header drew over it. A caller that unmounts it directly (a sheet swapped
// for another) still gets the old exit animation.
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type DimensionValue, type HostInstance } from "react-native";
import Animated, { FadeIn, FadeOut, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient } from "react-native-svg";
import { XIcon } from "phosphor-react-native/src/icons/X";
import { useTheme } from "@/theme/ThemeProvider";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { motion, ref, z } from "@/theme/tokens";
import { sheetEntering, sheetExiting, toEasing } from "./motion";
import { FocusRing, useFocusRing } from "./focus";
import { SquashPressable } from "./squash";
import { gradientStops } from "./gradient";

const H = ref.layout.hub;
const S = H.sheet;
const C = ref.button.chip;
const MID = C.size / 2;
const CHIP_PAD = (C.hit - C.size) / 2;
// Close's disc centred on the corner's centre of curvature: 40 - 18 = 22 in from the top and right.
const CLOSE_INSET = ref.radius.bottomSheet - C.size / 2;

export interface DarkSheetProps {
  title: string;
  /**
   * "headline" (system Semibold 17, a utility sheet), "serif" (Roboto Serif
   * 17, 02's title: a narrative moment) or "display" (the mode's own display
   * face, its `theme.display`: a mode's name, as home's continue prompt).
   */
  titleStyle?: "headline" | "serif" | "display";
  /** A grey ref.type.meta line under the title. */
  meta?: string;
  /** Called once the sheet has slid away (or at once if it is unmounted first). */
  onClose: () => void;
  children: ReactNode;
  /** Pinned under the scrolling content. A function gets `close`, which slides the sheet away, then calls onClose. */
  footer?: ReactNode | ((close: () => void) => ReactNode);
  /** Default true: black 55 %. False keeps the screen behind visible (the scrim still closes the sheet). */
  scrim?: boolean;
  /** Default the hub sheet's 64 %. */
  maxHeight?: DimensionValue;
  testID?: string;
  closeTestID?: string;
  /** Default true. False holds the content still (a picker inside is being dragged). */
  scrollEnabled?: boolean;
  /** Something peering over the sheet's top edge (the game's cat), riding up with it. */
  peek?: ReactNode;
}

const TITLE = { headline: ref.type.headline, serif: ref.type.serifTitle, display: null } as const;

const SheetClose = createContext<(() => void) | null>(null);

/** Inside a DarkSheet: closes it as its Close does (slides away, then onClose). Outside one: null. */
export function useSheetClose() {
  return useContext(SheetClose);
}

export function DarkSheet({
  title,
  titleStyle = "headline",
  meta,
  onClose,
  children,
  footer,
  scrim = true,
  maxHeight = S.maxHeight,
  testID,
  closeTestID,
  scrollEnabled = true,
  peek,
}: DarkSheetProps) {
  const { reducedMotion } = useTheme();
  // Inside a mode the sheet takes that mode's panel, edge and ink colours; in the shell these are today's ref colours.
  const theme = useModeTheme();
  const insets = useSafeAreaInsets();
  const titleRef = useRef<HostInstance>(null);
  const { height: windowHeight } = useWindowDimensions();

  // Closing: 0 open, 1 gone. The sheet slides down by the window's height (as SlideOutDown does) and the scrim fades.
  const gone = useSharedValue(0);
  const [closing, setClosing] = useState(false);
  // Set once the slide starts, so a second press doesn't start it again.
  const started = useSharedValue(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  // A sheet unmounted mid-slide (its caller reopened or swapped it) never calls onClose late.
  const mounted = useRef(true);
  // onClose runs once per close: from the slide's end, or from the fallback if that never reports.
  const finished = useRef(false);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    mounted.current = false;
    if (fallback.current) clearTimeout(fallback.current);
  }, []);
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    if (fallback.current) clearTimeout(fallback.current);
    fallback.current = null;
    if (mounted.current) onCloseRef.current();
  }, []);
  const close = useCallback(() => {
    if (started.get()) return;
    started.set(true);
    setClosing(true);
    const fall = ref.motion.sheetFall;
    const timing = reducedMotion
      ? { duration: motion.reducedFade, reduceMotion: ReduceMotion.Never }
      : { duration: fall.duration, easing: toEasing(fall.easing), reduceMotion: ReduceMotion.Never };
    gone.set(withTiming(1, timing, (done) => {
      if (done) scheduleOnRN(finish);
    }));
    // Should the slide be cut short or never report, the sheet still closes (it already lets touches through).
    fallback.current = setTimeout(finish, timing.duration + S.closeSlack);
  }, [gone, started, reducedMotion, finish]);
  const scrimFade = useAnimatedStyle(() => ({ opacity: 1 - gone.get() }));
  const slide = useAnimatedStyle(() => (reducedMotion
    ? { opacity: 1 - gone.get() }
    : { transform: [{ translateY: gone.get() * windowHeight }] }));

  // Screen-reader focus to the title once the sheet has risen.
  useEffect(() => {
    const t = setTimeout(
      () => {
        // The web has no sendAccessibilityEvent. Presentation only: a failure here must never reach the screen.
        if (!titleRef.current || Platform.OS === "web") return;
        try {
          AccessibilityInfo.sendAccessibilityEvent(titleRef.current, "focus");
        } catch {}
      },
      reducedMotion ? S.titleFocusReduced : S.titleFocus,
    );
    return () => clearTimeout(t);
  }, [reducedMotion]);

  const entering = sheetEntering(reducedMotion);
  // Once it has slid away itself there is nothing left to animate on unmount.
  const exiting = closing ? undefined : sheetExiting(reducedMotion);

  return (
    <SheetClose.Provider value={close}>
    <View style={styles.layer} pointerEvents={closing ? "none" : "box-none"}>
      <Animated.View style={[StyleSheet.absoluteFill, scrimFade]} pointerEvents="box-none">
        <Animated.View
          entering={FadeIn.duration(reducedMotion ? motion.reducedFade : S.scrimIn)}
          exiting={closing ? undefined : FadeOut.duration(reducedMotion ? motion.reducedFade : S.scrimOut)}
          style={[StyleSheet.absoluteFill, scrim && styles.scrim]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessible={false} importantForAccessibility="no" />
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.slot, slide]} pointerEvents="box-none">
      {/* Above the sheet (which clips its own content), sliding with it. */}
      {peek ? <View style={styles.peek} pointerEvents="none">{peek}</View> : null}
      <Animated.View
        entering={entering}
        exiting={exiting}
        accessibilityViewIsModal
        testID={testID}
        style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.rim, maxHeight, paddingBottom: insets.bottom + ref.space.lg }]}
      >
        <View style={styles.header}>
          <View style={styles.titleColumn}>
            <Text ref={titleRef} accessibilityRole="header" style={[TITLE[titleStyle] ?? theme.display, { color: theme.ink }]}>
              {title}
            </Text>
            {meta ? <Text style={[styles.meta, { color: theme.inkMuted }]}>{meta}</Text> : null}
          </View>
          <CloseChip onPress={close} testID={closeTestID} />
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} bounces={false} scrollEnabled={scrollEnabled}>
          {children}
        </ScrollView>
        {footer ? <View style={styles.footer}><SheetFooter footer={footer} /></View> : null}
      </Animated.View>
      </Animated.View>
    </View>
    </SheetClose.Provider>
  );
}

/** A footer, given the sheet's close when it is a function (read from the sheet's context). */
function SheetFooter({ footer }: { footer: NonNullable<DarkSheetProps["footer"]> }) {
  const close = useSheetClose();
  return <>{typeof footer === "function" ? footer(close ?? (() => {})) : footer}</>;
}

/** 01's round chip as Close: a 36 ground disc with the diagonal specular ring, in a 48 hit box. */
function CloseChip({ onPress, testID }: { onPress: () => void; testID?: string }) {
  const focus = useFocusRing();
  const feedback = useFeedback();
  const theme = useModeTheme();
  const id = `sheetchip${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  return (
    <SquashPressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      onPressIn={feedback.press}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      testID={testID}
      style={({ pressed }) => [styles.chipHit, pressed && styles.chipPressed]}
    >
      <View style={[styles.chip, { backgroundColor: theme.surface }]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Svg width={C.size} height={C.size}>
            <Defs>
              <LinearGradient id={id} x1={1} y1={0} x2={0} y2={1}>
                {gradientStops(H.chipRing)}
              </LinearGradient>
            </Defs>
            <Circle cx={MID} cy={MID} r={MID - C.ringWidth / 2} fill="none" stroke={`url(#${id})`} strokeWidth={C.ringWidth} />
          </Svg>
        </View>
        <XIcon size={ref.icon.chip} weight="regular" color={theme.ink} />
        <FocusRing visible={focus.focused} shape="pill" />
      </View>
    </SquashPressable>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, zIndex: z.sheet },
  scrim: { backgroundColor: S.scrim },
  // The sheet's slot: the whole layer, the sheet at its foot (its maxHeight is a share of the layer).
  slot: { ...StyleSheet.absoluteFill, justifyContent: "flex-end" },
  peek: { alignSelf: "flex-start", marginLeft: ref.space.xl },
  sheet: {
    borderTopLeftRadius: ref.radius.bottomSheet,
    borderTopRightRadius: ref.radius.bottomSheet,
    ...ref.curve,
    borderTopWidth: H.hairline,
    borderLeftWidth: H.hairline,
    borderRightWidth: H.hairline,
    overflow: "hidden",
  },
  // The title on the 24 gutter; Close's disc sits concentric with the sheet's 40 pt corner (CLOSE_INSET from the top and right edges).
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: CLOSE_INSET - CHIP_PAD,
    paddingLeft: ref.space.xl,
    paddingRight: CLOSE_INSET - CHIP_PAD,
    gap: ref.space.sm,
  },
  titleColumn: { flex: 1, gap: ref.space.xs },
  meta: ref.type.meta,
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: ref.space.xl, paddingTop: ref.space.sm, paddingBottom: ref.space.sm, gap: ref.space.xl },
  footer: { paddingHorizontal: ref.space.xl, paddingTop: ref.space.lg, gap: ref.space.sm },
  chipHit: { width: C.hit, height: C.hit, alignItems: "center", justifyContent: "center" },
  chip: {
    width: C.size,
    height: C.size,
    borderRadius: C.radius,
    alignItems: "center",
    justifyContent: "center",
  },
  chipPressed: { opacity: C.pressedOpacity },
});
