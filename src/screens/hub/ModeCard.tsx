// One of home's three mode cards (MODES_PROMPT.md Part 2, round 6): a solid,
// physical card in its mode's palette, not glass, dealt into home's deck
// (HubScreen, deck.ts) so the next card lies over its foot. The mode's drawn
// cover fills it (ModeCover), always: never a room photo. At its top, the part
// no card covers: the mode's name in its display face and its tagline on a
// plate of the mode's ground that fades down to clear, with a small busy
// capsule beside the tagline while the card's tap works. No status tag: the
// continue prompt says when there's a case to go back to. One signature touch
// each, decorative and static: noir's brass rule over the name and
// paranormal's soft glow (crime scene's cover tapes off its own door). Every
// value is ref.layout.hub.modes or the mode's theme (modeThemes).
// The card is turned by its deck tilt about its centre, casts a soft shadow
// up onto the card it covers, and catches a faint line of light along its top
// edge (the hub divider's white), so each card reads as its own card. The whole card is one button ("Detective
// Noir. Solve the case.") with the `press` haptic on press-in and
// the brass focus ring round it. Pressed it sinks to `pressScale` with the
// kit's press-in squash (SquashPressable: eased in, sprung back); under
// reduced motion it stays still. Dimmed while another card works: shaded,
// never see-through, so the card beneath stays hidden.
import { useId, type Ref } from "react";
import { ActivityIndicator, StyleSheet, Text, View, type HostInstance, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { FocusRing, SquashPressable, gradientLine, gradientStops, useFocusRing } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import type { Genre } from "@/lib/puzzle-types";
import { modeThemes, ref, type ModeTheme } from "@/theme/tokens";
import { ModeCover } from "./art/ModeCover";
import { modeCardLabel } from "./caseStatus";

const M = ref.layout.hub.modes;
const EDGE = M.deck.edge;

export interface ModeCardProps {
  genre: Genre;
  /** This card's own action is running: taps are ignored, a small busy capsule shows beside the tagline. */
  busy?: boolean;
  /** Another card is busy: shaded and disabled. */
  disabled?: boolean;
  onPress: () => void;
  /** The words block's height (name, tagline, tag), for the deck's spacing. */
  onWordsLayout?: (height: number) => void;
  /** The deck's place: size, overlap and tilt (HubScreen). */
  style?: StyleProp<ViewStyle>;
  /** The button, for returning screen-reader focus to it. */
  ref?: Ref<HostInstance>;
}

export function ModeCard({ genre, busy = false, disabled = false, onPress, onWordsLayout, style, ref: buttonRef }: ModeCardProps) {
  const theme = modeThemes[genre];
  const focus = useFocusRing();
  const feedback = useFeedback();
  const testID = `hub-card-${genre}`;
  return (
    <View style={style} pointerEvents="box-none" testID={`${testID}-slot`}>
      <SquashPressable
        ref={buttonRef}
        squash={busy ? false : M.pressScale}
        accessibilityRole="button"
        accessibilityLabel={modeCardLabel(theme.name, theme.tagline)}
        accessibilityState={{ disabled: disabled || busy, busy }}
        disabled={disabled || busy}
        onPressIn={busy ? undefined : feedback.press}
        onPress={busy ? undefined : onPress}
        onFocus={focus.onFocus}
        onBlur={focus.onBlur}
        testID={testID}
        style={[styles.card, { backgroundColor: theme.surface }]}
      >
        <View style={[styles.face, { backgroundColor: theme.surface, borderColor: theme.rim }]} testID={`${testID}-face`}>
          <ModeCover genre={genre} style={StyleSheet.absoluteFill} testID={`${testID}-art`} />
          {genre === "paranormal" ? <Glow theme={theme} /> : null}
          <View
            style={styles.words}
            onLayout={onWordsLayout ? (e: LayoutChangeEvent) => onWordsLayout(e.nativeEvent.layout.height) : undefined}
            testID={`${testID}-words`}
          >
            <Plate theme={theme} />
            {genre === "noir" ? <View style={[styles.rule, { backgroundColor: theme.accent }]} testID={`${testID}-rule`} /> : null}
            <Text style={[theme.display, { color: theme.ink }]}>{theme.name}</Text>
            <View style={styles.line}>
              <Text style={[M.type.tagline, styles.tagline, { color: theme.ink }]}>{theme.tagline}</Text>
              {busy ? (
                <View style={[styles.tag, { backgroundColor: theme.ground, borderColor: theme.rim }]} testID={`${testID}-tag`}>
                  <ActivityIndicator size="small" color={theme.ink} testID={`${testID}-busy`} />
                </View>
              ) : null}
            </View>
          </View>
          <TopEdge />
          {disabled ? <View style={styles.shade} pointerEvents="none" testID={`${testID}-dim`} /> : null}
        </View>
        <FocusRing visible={focus.focused} shape="panel" radius={M.radius} />
      </SquashPressable>
    </View>
  );
}

/**
 * The plate behind the words: the mode's ground at M.plate from the card's
 * top to the words' foot, and below it a fade down to clear over M.fade, so
 * the cover melts into it with no edge.
 */
function Plate({ theme }: { theme: ModeTheme }) {
  const id = `plate${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[StyleSheet.absoluteFill, styles.plate, { backgroundColor: theme.ground }]} testID="hub-card-plate" />
      <View style={styles.fade}>
        <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
          <Defs>
            {/* Offsets run up from the fade's foot (clear) to the plate's edge (M.plate). */}
            <LinearGradient id={id} x1={0} y1={1} x2={0} y2={0}>
              {M.fadeStops.map((s) => (
                <Stop key={s.offset} offset={s.offset} stopColor={theme.ground} stopOpacity={s.opacity} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={1} height={1} fill={`url(#${id})`} />
        </Svg>
      </View>
    </View>
  );
}

/** Light catching the card's top edge, inside its rim: the hub divider's faint white line, so each card reads as a separate card where it lies over the one above. */
function TopEdge() {
  const id = `edge${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  return (
    <View style={styles.edge} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="hub-card-edge">
      <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} {...gradientLine(EDGE.angle)}>
            {gradientStops(EDGE.stops)}
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={1} height={1} fill={`url(#${id})`} />
      </Svg>
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

const styles = StyleSheet.create({
  // The shadow sits on the card (no clipping here), cast up onto the card it covers.
  card: { flex: 1, borderRadius: M.radius, boxShadow: M.deck.shadow, ...ref.curve },
  face: {
    flex: 1,
    overflow: "hidden",
    borderRadius: M.radius,
    borderWidth: M.rim,
    ...ref.curve,
  },
  words: { padding: M.pad },
  fade: { position: "absolute", left: 0, right: 0, bottom: -M.fade, height: M.fade },
  plate: { opacity: M.plate },
  rule: { width: M.rule.width, height: M.rule.height, marginBottom: M.rule.gap },
  // The tagline and the busy capsule share a line; at large text the capsule wraps under it.
  line: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: M.tag.gap, rowGap: M.taglineGap, marginTop: M.taglineGap },
  tagline: { flexShrink: 1 },
  tag: {
    minHeight: M.type.tag.lineHeight + M.tag.padY * 2 + M.rim * 2,
    justifyContent: "center",
    paddingHorizontal: M.tag.padX,
    paddingVertical: M.tag.padY,
    borderWidth: M.rim,
    borderRadius: ref.radius.round,
  },
  edge: { position: "absolute", top: 0, left: M.radius, right: M.radius, height: M.rim },
  shade: { ...StyleSheet.absoluteFill, backgroundColor: ref.color.void, opacity: 1 - ref.button.disabledOpacity.pill },
});
