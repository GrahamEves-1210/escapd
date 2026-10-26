// A case file on a mode screen (MODES_PROMPT.md Part 2): a panel in the
// mode's surface with its rim, the case's photo as a small treated thumbnail,
// its title and a meta line (the date, or what a tap does), and a rubber
// stamp: OPEN, IN PROGRESS, CLOSED, BUILDING or DIDN'T BUILD. One button
// with one label; the `press` haptic; pressed at ref.layout.mode.file.pressedOpacity
// and sunk to ref.motion.juice.press.panel (the kit's squash; none under reduced motion).
import { StyleSheet, Text, View } from "react-native";
import { FocusRing, SquashPressable, TreatedImage, useFocusRing, type TreatSource } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import type { Genre } from "@/lib/puzzle-types";
import { ref, type ModeTheme } from "@/theme/tokens";
import type { CaseStamp } from "./caseFiles";
import { Stamp } from "./parts";

const L = ref.layout.mode;
const F = L.file;

export interface CaseFileRowProps {
  genre: Genre;
  theme: ModeTheme;
  title: string;
  meta: string;
  /** Null while unknown: no stamp. */
  stamp: CaseStamp | null;
  /** The photo, baked in the mode's treatment; null draws an empty well. */
  thumb: { source: TreatSource; cacheKey?: string } | null;
  accessibilityLabel: string;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
  testID: string;
}

export function CaseFileRow({ genre, theme, title, meta, stamp, thumb, accessibilityLabel, busy = false, disabled = false, onPress, testID }: CaseFileRowProps) {
  const focus = useFocusRing();
  const feedback = useFeedback();
  return (
    <SquashPressable
      squash={busy ? false : ref.motion.juice.press.panel}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPressIn={busy ? undefined : feedback.press}
      onPress={busy ? undefined : onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      testID={testID}
      style={({ pressed }) => [
        styles.file,
        { backgroundColor: theme.surface, borderColor: theme.rim },
        pressed && !busy && styles.pressed,
        disabled && styles.dimmed,
      ]}
    >
      <View style={[styles.thumb, { backgroundColor: theme.raised }]}>
        {thumb ? (
          <TreatedImage
            source={thumb.source}
            genre={genre}
            cacheKey={thumb.cacheKey}
            maxEdge={F.thumbEdge}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
            accessible={false}
            testID={`${testID}-thumb`}
          />
        ) : null}
      </View>
      <View style={styles.words}>
        <Text style={[L.type.title, { color: theme.ink }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[L.type.meta, styles.meta, { color: theme.inkMuted }]}>{meta}</Text>
      </View>
      {stamp ? <Stamp theme={theme} stamp={stamp} testID={`${testID}-stamp`} /> : null}
      <FocusRing visible={focus.focused} shape="panel" radius={F.radius} />
    </SquashPressable>
  );
}

const styles = StyleSheet.create({
  file: {
    minHeight: F.minHeight,
    flexDirection: "row",
    alignItems: "center",
    gap: F.textGap,
    padding: F.pad,
    borderWidth: F.rim,
    borderRadius: F.radius,
    ...ref.curve,
  },
  pressed: { opacity: F.pressedOpacity },
  dimmed: { opacity: ref.button.disabledOpacity.pill },
  thumb: { width: F.thumb, height: F.thumb, borderRadius: F.thumbRadius, overflow: "hidden" },
  // The words wrap at large text; the thumbnail and stamp keep their size.
  words: { flex: 1 },
  meta: { marginTop: F.metaGap },
});
