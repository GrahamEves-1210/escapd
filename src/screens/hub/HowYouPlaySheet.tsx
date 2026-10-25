// How you play (docs/DESIGN.md, 01 Layout: How you play sheet; Tappable
// elements; States). A ref.panel sheet over a scrim, built here rather than
// with the live Sheet: top corners radius 6, hairline top edge, no handle,
// the bottom running off the screen. Rises with motion.sheetSpring and leaves
// with the live Sheet's 200 ms slide; the scrim fades over ref.motion.control.
// Reduced motion: the sheet fades in and out over motion.reducedFade.
// Render it conditionally: it animates in on mount and out on unmount.
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeOut, ReduceMotion, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { XIcon } from "@/components/icons";
import { IconButton, NoirText, Panel, PillButton, Rule, Segment, toEasing, type NoirTextRef } from "@/components/noir";
import { usePreferences } from "@/game/preferences";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref, z } from "@/theme/tokens";

const H = ref.layout.hub;
const S = H.segment;

// Close's hitSlop (44 to 48). A touch outside a parent's bounds never reaches
// its children, so the header row carries the slop inside its own box.
const SLOP = (ref.hit.comfortable - ref.button.icon.size) / 2;

const SCRIM_IN = FadeIn.duration(ref.motion.control.duration).easing(toEasing(ref.motion.control.easing)).reduceMotion(ReduceMotion.Never);
const SCRIM_OUT = FadeOut.duration(ref.motion.control.duration).easing(toEasing(ref.motion.control.easing)).reduceMotion(ReduceMotion.Never);

const ASSIST = [
  { value: "off", label: "OFF" },
  { value: "on", label: "ON" },
] as const;

export interface HowYouPlaySheetProps {
  /** Close, scrim and Android back. Focus returns to the How you play button. */
  onClose: () => void;
  /** "How to photograph a room": closes the sheet, then opens the guide in replay mode. */
  onGuide: () => void;
  /**
   * Runs once the sheet has finished leaving and its modal layer is gone, so
   * focus can move behind it (VoiceOver ignores a move outside a modal layer).
   */
  onExited?: () => void;
}

export function HowYouPlaySheet({ onClose, onGuide, onExited }: HowYouPlaySheetProps) {
  const { reducedMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { hotspotAssist, setHotspotAssist } = usePreferences();
  const titleRef = useRef<NoirTextRef>(null);
  const [arrived, setArrived] = useState(false);

  const entering = useMemo(() => {
    // Runs on the UI thread when the rise (or the reduced-motion fade) ends.
    const settled = () => {
      "worklet";
      scheduleOnRN(setArrived, true);
    };
    const base = reducedMotion
      ? FadeIn.duration(motion.reducedFade)
      : SlideInDown.springify()
          .damping(motion.sheetSpring.damping)
          .stiffness(motion.sheetSpring.stiffness)
          .mass(motion.sheetSpring.mass);
    return base.reduceMotion(ReduceMotion.Never).withCallback(settled);
  }, [reducedMotion]);

  const exiting = useMemo(() => {
    // The dock leaves last (the 200 ms slide or the 140 ms reduced fade,
    // against the scrim's 120). Reanimated keeps the whole removed layer until
    // then, marks the dock done before this runs, and flushes the layer's
    // removal later in the same UI frame, so it is gone by the time onExited
    // runs on the JS thread.
    const gone = (finished: boolean) => {
      "worklet";
      if (finished && onExited) scheduleOnRN(onExited);
    };
    const base = reducedMotion ? FadeOut.duration(motion.reducedFade) : SlideOutDown.duration(H.sheetExit);
    return base.reduceMotion(ReduceMotion.Never).withCallback(gone);
  }, [reducedMotion, onExited]);

  // Opening the sheet moves screen-reader focus to its title once it has arrived.
  useEffect(() => {
    const title = titleRef.current;
    if (arrived && title) AccessibilityInfo.sendAccessibilityEvent(title, "focus");
  }, [arrived]);

  return (
    // Trapped: VoiceOver ignores everything outside this layer (Android hides the screen behind).
    <View style={styles.layer} pointerEvents="box-none" accessibilityViewIsModal>
      <Animated.View entering={SCRIM_IN} exiting={SCRIM_OUT} style={styles.scrim}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
          importantForAccessibility="no"
          focusable={false}
          testID="hub-sheet-scrim"
        />
      </Animated.View>
      <Animated.View entering={entering} exiting={exiting} style={styles.dock} testID="hub-sheet">
        <Panel variant="sheet" style={{ maxHeight: height * H.sheetMaxHeight }}>
          <ScrollView
            bounces={false}
            style={styles.scroll}
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + ref.space.lg }]}
          >
            <View style={styles.header}>
              <NoirText ref={titleRef} variant="title" accessibilityRole="header" style={styles.title}>
                How you play
              </NoirText>
              <IconButton icon={XIcon} accessibilityLabel="Close" onPress={onClose} testID="hub-sheet-close" />
            </View>
            <View style={styles.row}>
              <View style={styles.rowText}>
                {/* The switch carries this label, so screen readers don't hear it twice. */}
                <NoirText variant="headline" accessibilityElementsHidden importantForAccessibility="no">
                  Show interactives
                </NoirText>
                <NoirText variant="meta">Keep the marks on objects you can use visible.</NoirText>
              </View>
              <Segment
                mode="switch"
                options={ASSIST}
                value={hotspotAssist ? "on" : "off"}
                onChange={(value) => setHotspotAssist(value === "on")}
                accessibilityLabel="Show interactives"
                optionWidth={S.option}
                thumbInset={S.thumbInset}
                thumbGap={S.thumbGap}
                testID="hub-show-interactives"
              />
            </View>
            <Rule style={styles.rule} />
            <PillButton label="How to photograph a room" variant="secondary" onPress={onGuide} testID="hub-guide-replay" />
          </ScrollView>
        </Panel>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, zIndex: z.sheet },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: ref.color.scrim },
  dock: { position: "absolute", left: 0, right: 0, bottom: 0 },
  // Rows wrap at large text; past 64 % of the screen the sheet scrolls.
  scroll: { flexGrow: 0 },
  // Sheet top + 12 to the header row (the 1 pt top hairline sits inside it),
  // then 16, the row, 12, the rule, 12, the button, and 16 + the safe bottom.
  // The header row reaches SLOP past Close on the top, bottom and right, so
  // Close's full 48 x 48 (x 327-375, y 601-649) lies inside it. The 12 and 16
  // around it shrink by SLOP: title 611-639, Close 603-647, row from 663.
  content: { paddingHorizontal: ref.space.edge, paddingTop: ref.space.md - ref.border.hairline - SLOP },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: ref.space.lg,
    minHeight: ref.hit.min,
    paddingVertical: SLOP,
    marginRight: -SLOP,
    paddingRight: SLOP,
  },
  title: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: ref.space.lg, marginTop: ref.space.lg - SLOP },
  rowText: { flex: 1, gap: ref.space.xs },
  rule: { marginVertical: ref.space.md },
});
