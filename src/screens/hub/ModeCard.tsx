// One of home's three mode cards, each a book in the series (docs/ART_DIRECTION.md,
// the mystery-book core): the cover of a cozy mystery in its mode's palette,
// its drawn illustration full bleed, a hardback's darker spine down the left
// with a foil rule, a double foil frame inside the edge with foil sparkles in
// its corners, the series line ("A Moonlit Mystery") in the cover italic and
// foil over the title in the mode's display face, the tagline under it, and a
// soft light in the mode's glow on its face. Corners COVER.radius; the soft
// shadow under it is the ground's colour (HubScreen). Before the series, a solid,
// physical card in its mode's palette, not glass, dealt into home's deck
// (HubScreen, deck.ts) so the next card lies over its foot. The mode's drawn
// cover fills it (ModeCover), always: never a room photo. At its top, the part
// no card covers: the mode's name in its display face and its tagline on a
// plate of the mode's ground that fades down to clear, with a small busy
// capsule beside the tagline while the card's tap works. No status tag: the
// continue prompt says when there's a case to go back to. Paranormal adds a
// soft glow over its cover (no rule over noir's name: the user removed it). Every
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
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { FocusRing, SquashPressable, gradientLine, gradientStops, useFocusRing } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import type { Genre } from "@/lib/puzzle-types";
import { SERIES } from "@/screens/mode/copy";
import { modeThemes, ref, type ModeTheme } from "@/theme/tokens";
import { ModeCover } from "./art/ModeCover";
import { COVER, SPARK_PATH } from "./art/nook";
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
          <Glow theme={theme} genre={genre} />
          <View
            style={styles.words}
            onLayout={onWordsLayout ? (e: LayoutChangeEvent) => onWordsLayout(e.nativeEvent.layout.height) : undefined}
            testID={`${testID}-words`}
          >
            <Plate theme={theme} />
            <Text style={[styles.series, { color: theme.foil }]} testID={`${testID}-series`}>
              {SERIES[genre]}
            </Text>
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
          <Binding theme={theme} />
          <TopEdge />
          {disabled ? <View style={styles.shade} pointerEvents="none" testID={`${testID}-dim`} /> : null}
        </View>
        <FocusRing visible={focus.focused} shape="panel" radius={COVER.radius} />
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

/**
 * The cover's binding and foil (decorative): the hardback's darker spine down
 * the left with a foil rule along it, a double foil frame inside the edge, and
 * a foil sparkle in each of the frame's corners.
 */
function Binding({ theme }: { theme: ModeTheme }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="hub-card-binding">
      <View style={[styles.spine, { backgroundColor: theme.ground }]} />
      <View style={[styles.spineRule, { backgroundColor: theme.foil }]} />
      <View style={[styles.frame, { borderColor: theme.foil }]} />
      <View style={[styles.frameInner, { borderColor: theme.foil }]} />
      {CORNERS.map((corner) => (
        <View key={corner.key} style={[styles.spark, corner.style]}>
          <Svg width={COVER.fleuron * 2} height={COVER.fleuron * 2} viewBox="-1 -1 2 2">
            <Path d={SPARK_PATH} fill={theme.foil} />
          </Svg>
        </View>
      ))}
    </View>
  );
}

/** The frame's corners, where its sparkles sit (centred on the corner of the frame's line). */
const SPARK_AT = COVER.inset - COVER.fleuron;
const CORNERS = [
  { key: "tl", style: { top: SPARK_AT, left: SPARK_AT + COVER.spine } },
  { key: "tr", style: { top: SPARK_AT, right: SPARK_AT } },
  { key: "bl", style: { bottom: SPARK_AT, left: SPARK_AT + COVER.spine } },
  { key: "br", style: { bottom: SPARK_AT, right: SPARK_AT } },
] as const;

/** The soft light on the cover: a radial light in the mode's glow colour, high on the right (strongest on Moonlit's). */
function Glow({ theme, genre }: { theme: ModeTheme; genre: Genre }) {
  const id = `glow${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const glow = theme.glow;
  const strength = genre === "paranormal" ? 1 : COVER.glow;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={`hub-card-${genre}-glow`}>
      <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={id} cx={M.glow.cx} cy={M.glow.cy} r={M.glow.r} fx={M.glow.cx} fy={M.glow.cy}>
            {M.glow.stops.map((s) => (
              <Stop key={s.offset} offset={s.offset} stopColor={glow} stopOpacity={s.opacity * strength} />
            ))}
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={1} height={1} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  // No shadow cast up onto the card it covers (home's FallIn gives each card its drop shadow).
  card: { flex: 1, borderRadius: COVER.radius, ...ref.curve },
  face: {
    flex: 1,
    overflow: "hidden",
    borderRadius: COVER.radius,
    borderWidth: M.rim,
    ...ref.curve,
  },
  // Inside the foil frame, clear of the spine.
  words: { paddingTop: COVER.pad, paddingRight: COVER.pad, paddingBottom: M.pad, paddingLeft: COVER.spine + COVER.pad },
  series: { fontFamily: ref.font.coverItalic, ...COVER.series, marginBottom: COVER.series.gap },
  spine: { position: "absolute", left: 0, top: 0, bottom: 0, width: COVER.spine, opacity: COVER.spineShade },
  spineRule: { position: "absolute", left: COVER.spine, top: 0, bottom: 0, width: M.rim, opacity: COVER.spineRule },
  frame: {
    position: "absolute",
    top: COVER.inset,
    right: COVER.inset,
    bottom: COVER.inset,
    left: COVER.inset + COVER.spine,
    borderWidth: COVER.frameWidth,
    borderRadius: COVER.frameRadius,
    opacity: COVER.frameOpacity,
    ...ref.curve,
  },
  frameInner: {
    position: "absolute",
    top: COVER.inset + COVER.double,
    right: COVER.inset + COVER.double,
    bottom: COVER.inset + COVER.double,
    left: COVER.inset + COVER.double + COVER.spine,
    borderWidth: M.rim,
    borderRadius: COVER.frameRadius - COVER.double,
    opacity: COVER.doubleOpacity,
    ...ref.curve,
  },
  spark: { position: "absolute" },
  fade: { position: "absolute", left: 0, right: 0, bottom: -M.fade, height: M.fade },
  plate: { opacity: M.plate },
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
  edge: { position: "absolute", top: 0, left: COVER.radius, right: COVER.radius, height: M.rim },
  shade: { ...StyleSheet.absoluteFill, backgroundColor: ref.color.void, opacity: 1 - ref.button.disabledOpacity.pill },
});
