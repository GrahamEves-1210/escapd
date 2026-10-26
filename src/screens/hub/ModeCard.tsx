// One of home's three mode cards (MODES_PROMPT.md Part 2): a solid,
// physical panel in its mode's palette, not glass. The mode's art fills it
// (ModeArtImage): the player's own room in the mode's treatment once they
// have photographed one, else the mode's drawn cover. Over it: a small count
// capsule at the top left, and at the foot the mode's name in its display
// face and its tagline on a plate of the mode's ground that fades up from
// clear. One signature touch each, decorative and static: noir's brass rule
// over the name, crime scene's strip of police tape across the top-right
// corner (over the player's own room only: the drawn cover has its own
// tape), paranormal's soft glow. Every value is ref.layout.hub.modes or the
// mode's theme (modeThemes).
// The whole card is one button ("Detective Noir. Solve the case. 2 cases")
// with the `press` haptic on press-in and the brass focus ring round it.
// Pressed it sinks to `pressScale` with the kit's press-in squash
// (SquashPressable: eased in, sprung back); under reduced motion it stays still.
import { useId } from "react";
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { FocusRing, SquashPressable, useFocusRing } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import type { Genre } from "@/lib/puzzle-types";
import type { ModeArt } from "@/screens/mode/art";
import { ModeArtImage } from "@/screens/mode/ModeArtImage";
import { caseCount } from "@/screens/mode/caseFiles";
import { modeThemes, ref, type ModeTheme } from "@/theme/tokens";
import { modeCardLabel } from "./caseStatus";

const M = ref.layout.hub.modes;

/** Police tape's words, repeated past both ends of the strip. */
const TAPE_WORDS = Array.from({ length: M.tape.repeat }, () => "Crime scene · Do not cross").join(" · ");

export interface ModeCardProps {
  genre: Genre;
  art: ModeArt;
  /** Undefined while home's fetch runs: no count shows. */
  count: number | undefined;
  /** This card's own action is running (noir's first tap): taps are ignored, a small indicator replaces the count. */
  busy?: boolean;
  /** Another card is busy: dimmed and disabled. */
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function ModeCard({ genre, art, count, busy = false, disabled = false, onPress, style }: ModeCardProps) {
  const theme = modeThemes[genre];
  const focus = useFocusRing();
  const feedback = useFeedback();
  const testID = `hub-card-${genre}`;
  return (
    <SquashPressable
      squash={busy ? false : M.pressScale}
      accessibilityRole="button"
      accessibilityLabel={modeCardLabel(theme.name, theme.tagline, count)}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPressIn={busy ? undefined : feedback.press}
      onPress={busy ? undefined : onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      testID={testID}
      style={[styles.card, disabled && styles.dimmed, style]}
    >
      <View style={[styles.face, { backgroundColor: theme.surface, borderColor: theme.rim }]} testID={`${testID}-face`}>
        <ModeArtImage genre={genre} art={art} maxEdge={M.artEdge} testID={`${testID}-art`} />
        {genre === "paranormal" ? <Glow theme={theme} /> : null}
        {/* The drawn cover tapes its own door off: the strip is for a photo, which has none. */}
        {genre === "crime_scene" && art.own ? <Tape theme={theme} /> : null}
        <View style={styles.top}>
          {busy || count !== undefined ? (
            <View style={[styles.chip, { backgroundColor: theme.ground, borderColor: theme.rim }]} testID={`${testID}-count`}>
              {busy ? (
                <ActivityIndicator size="small" color={theme.ink} testID={`${testID}-busy`} />
              ) : (
                <Text style={[M.type.count, { color: theme.ink }]}>{caseCount(count ?? 0)}</Text>
              )}
            </View>
          ) : null}
        </View>
        <View style={styles.words}>
          <Plate theme={theme} />
          {genre === "noir" ? <View style={[styles.rule, { backgroundColor: theme.accent }]} testID={`${testID}-rule`} /> : null}
          <Text style={[theme.display, { color: theme.ink }]}>{theme.name}</Text>
          <Text style={[M.type.tagline, styles.tagline, { color: theme.ink }]}>{theme.tagline}</Text>
        </View>
      </View>
      <FocusRing visible={focus.focused} shape="panel" radius={M.radius} />
    </SquashPressable>
  );
}

/**
 * The plate behind the words: the mode's ground at M.plate, and above it a
 * fade from clear up over M.fade, so the photo melts into it with no edge.
 */
function Plate({ theme }: { theme: ModeTheme }) {
  const id = `plate${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.fade}>
        <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={id} x1={0} y1={0} x2={0} y2={1}>
              {M.fadeStops.map((s) => (
                <Stop key={s.offset} offset={s.offset} stopColor={theme.ground} stopOpacity={s.opacity} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={1} height={1} fill={`url(#${id})`} />
        </Svg>
      </View>
      <View style={[StyleSheet.absoluteFill, styles.plate, { backgroundColor: theme.ground }]} testID="hub-card-plate" />
    </View>
  );
}

/** Paranormal's soft glow: a radial light in the mode's glow colour, high on the right. */
function Glow({ theme }: { theme: ModeTheme }) {
  const id = `glow${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const glow = theme.glow ?? theme.accent;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="hub-card-paranormal-glow">
      <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={id} cx={M.glow.cx} cy={M.glow.cy} r={M.glow.r} fx={M.glow.cx} fy={M.glow.cy}>
            {M.glow.stops.map((s) => (
              <Stop key={s.offset} offset={s.offset} stopColor={glow} stopOpacity={s.opacity} />
            ))}
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={1} height={1} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** Crime scene's police tape: a thin strip in the mode's tape yellow across the top-right corner. */
function Tape({ theme }: { theme: ModeTheme }) {
  const tape = theme.detail ?? theme.accent;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.tape, { backgroundColor: tape }]}
      testID="hub-card-crime_scene-tape"
    >
      <Text numberOfLines={1} style={[M.type.tape, { color: theme.ground }]}>
        {TAPE_WORDS}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: M.minHeight, borderRadius: M.radius, ...ref.curve },
  dimmed: { opacity: ref.button.disabledOpacity.pill },
  face: {
    flex: 1,
    overflow: "hidden",
    borderRadius: M.radius,
    borderWidth: M.rim,
    ...ref.curve,
  },
  top: { flex: 1, alignItems: "flex-start", padding: M.pad },
  chip: {
    minHeight: M.type.count.lineHeight + M.chip.padY * 2 + M.rim * 2,
    justifyContent: "center",
    paddingHorizontal: M.chip.padX,
    paddingVertical: M.chip.padY,
    borderWidth: M.rim,
    borderRadius: ref.radius.round,
  },
  words: { paddingHorizontal: M.pad, paddingBottom: M.pad },
  fade: { position: "absolute", left: 0, right: 0, top: -M.fade, height: M.fade },
  plate: { opacity: M.plate },
  rule: { width: M.rule.width, height: M.rule.height, marginBottom: M.rule.gap },
  tagline: { marginTop: M.taglineGap },
  tape: {
    position: "absolute",
    width: M.tape.length,
    height: M.tape.height,
    top: M.tape.inset - M.tape.height / 2,
    right: M.tape.inset - M.tape.length / 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    transform: [{ rotate: M.tape.angle }],
  },
});
