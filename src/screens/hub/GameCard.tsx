// A game card (docs/DESIGN.md, 01 · Game mode: Layout "Cards"; Tappable
// elements; States), in Opal's card style: dark glass (CardGlass) with a
// fading 1 pt rim, a label pill near the top, ESCAPD's state line under it,
// and the hero line icon in the mint-to-aqua gradient a little below the
// middle. YOUR CASE, once solved, carries a SOLVED pill below its icon.
// The whole card is one button; its children are not separately focusable.
// Pressed: white glassFill eases in over the card and it settles to 0.97
// (no scale under reduced motion), over motion.control, with the `press`
// haptic (a light impact) on press-in.
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import Animated, { interpolate, useAnimatedStyle } from "react-native-reanimated";
import { useFocusRing, usePressProgress } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { CardArt } from "./CardArt";
import { CardGlass } from "./CardGlass";
import { CardNote } from "./CardNote";
import type { CardId } from "./caseStatus";
import { CARD_RADIUS, TAG_TOP, coveredWidth } from "./layout";
import { TagPill } from "./TagPill";

const H = ref.layout.hub;
const C = H.card;
const ICON = C.icon;
// The middles of a fan card's three blocks (card-local y): the tag pill with
// its state line, the icon, and the SOLVED pill.
const HEAD_MID = TAG_TOP + (ref.button.gameCard.tagHeight + C.noteGap + ref.type.meta.lineHeight) / 2;
const ICON_MID = C.height * C.iconCentre;
const SOLVED_MID = C.height * C.solvedCentre;

/** "fan": the 122 x 209 card in the three-card fan. "stack": the upright full-width card (large text, narrow screens, short screens). */
export type CardLayout = "fan" | "stack";

/** The side of a fan card that lies under the centre card. */
export type CoveredSide = "left" | "right";

/**
 * The kit's focus ring (ref.focus: 2 pt brass at a 2 pt offset) as RN outline
 * props, so it follows the card's own continuous corners.
 */
export const cardRing: ViewStyle = {
  borderRadius: CARD_RADIUS,
  ...ref.curve,
  outlineStyle: "solid",
  outlineWidth: ref.focus.width,
  outlineOffset: ref.focus.offset,
  outlineColor: ref.focus.color,
};

export interface GameCardProps {
  id: CardId;
  layout: CardLayout;
  tag: string;
  /** Null while YOUR CASE loads (the line stays blank). */
  note: string | null;
  developing?: boolean;
  /** YOUR CASE solved: the SOLVED pill. */
  solved?: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
  /**
   * Its own state disables it (YOUR CASE: none yet, offline, try later): the
   * glass, the pills and the icon drop to 0.45 as one layer; the state line
   * explains why, so it stays at full strength.
   */
  unavailable?: boolean;
  /** Another card is busy: the whole card at 0.45, disabled. */
  dimmed?: boolean;
  /** Its own action is running: the state line becomes a small indicator, taps ignored, focus kept. */
  busy?: boolean;
  /** YOUR CASE before its first fetch resolves: taps ignored and busy for screen readers, but not dimmed and no indicator. */
  waiting?: boolean;
  /** The fan's centre card lies over the side cards; dimmed, it keeps an opaque void under it so they don't show through. */
  covers?: boolean;
  /** Fan side cards: the edge under the centre card. Each block centres on the face left exposed at its own height. */
  covered?: CoveredSide;
  onPress: () => void;
  /** Fan cards report focus so the deck draws the ring above the stack instead. */
  onFocusChange?: (focused: boolean) => void;
  testID?: string;
  /** Position, and the fan's rotation. */
  style?: StyleProp<ViewStyle>;
}

export function GameCard({
  id,
  layout,
  tag,
  note,
  developing = false,
  solved = false,
  accessibilityLabel,
  accessibilityHint,
  unavailable = false,
  dimmed = false,
  busy = false,
  waiting = false,
  covers = false,
  covered,
  onPress,
  onFocusChange,
  testID,
  style,
}: GameCardProps) {
  const feedback = useFeedback();
  const press = usePressProgress();
  const { reducedMotion } = useTheme();
  const { fontScale } = useWindowDimensions();
  const focus = useFocusRing({
    onFocus: () => onFocusChange?.(true),
    onBlur: () => onFocusChange?.(false),
  });
  const disabled = unavailable || dimmed;
  const ignoring = busy || waiting;
  const live = !disabled && !ignoring;

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reducedMotion ? 1 : interpolate(press.progress.get(), [0, 1], [1, C.pressScale]) }],
  }));

  const pressableProps = {
    testID,
    accessibilityRole: "button",
    accessibilityLabel,
    accessibilityHint,
    accessibilityState: { disabled: disabled || ignoring, busy: ignoring },
    // Pressable copies its own `disabled` over accessibilityState.disabled, so
    // it is passed only when true: a busy card still reads as disabled and keeps focus.
    disabled: disabled || undefined,
    onPress: live ? onPress : undefined,
    onPressIn: live
      ? () => {
          press.onPressIn();
          feedback.press();
        }
      : undefined,
    onPressOut: press.onPressOut,
    onFocus: focus.onFocus,
    onBlur: focus.onBlur,
  } as const;

  // A block's box, inset on the covered side by the strip the centre card hides at the block's middle.
  const exposed = (v: number): ViewStyle | null =>
    covered === "left" ? { left: coveredWidth(v) } : covered === "right" ? { right: coveredWidth(v) } : null;

  // The state line, or while the card's own action runs, a small native indicator in its place.
  const noteLine = { height: ref.type.meta.lineHeight * fontScale };
  const state = (align: "center" | "left") =>
    busy ? (
      <View style={[noteLine, styles.indicator, align === "left" && styles.start]}>
        <ActivityIndicator size="small" color={ref.color.textLabel} testID={testID ? `${testID}-busy` : undefined} />
      </View>
    ) : (
      <CardNote text={note} developing={developing} align={align} />
    );

  if (layout === "fan") {
    return (
      <Pressable {...pressableProps} style={[styles.fanCard, style]}>
        {covers && dimmed ? <View style={styles.underlay} /> : null}
        <Animated.View style={[styles.fill, pressStyle]}>
          <View style={[styles.fill, dimmed && styles.dim]} needsOffscreenAlphaCompositing={dimmed}>
            {/* The 0.45 layer for a card its own state disables: glass, pills and icon together. */}
            <View style={[styles.fill, unavailable && styles.dim]} needsOffscreenAlphaCompositing={unavailable}>
              <CardGlass radius={CARD_RADIUS} pressed={press.progress} covers={covers} covered={covered} />
              <View style={[styles.fanIcon, exposed(ICON_MID)]}>
                <CardArt id={id} size={ICON} />
              </View>
              {solved ? (
                <View style={[styles.fanSolved, exposed(SOLVED_MID)]}>
                  <TagPill label="SOLVED" />
                </View>
              ) : null}
            </View>
            {/* Tag pill, then the state line 6 below it. */}
            <View style={[styles.fanHead, exposed(HEAD_MID)]}>
              <TagPill label={tag} style={unavailable && styles.dim} />
              <View style={styles.fanNote}>{state("center")}</View>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    );
  }

  return (
    <Pressable {...pressableProps} style={[styles.stackCard, dimmed && styles.dim, style]} needsOffscreenAlphaCompositing={dimmed}>
      <Animated.View style={[styles.stackBody, pressStyle]}>
        <View style={[styles.fill, unavailable && styles.dim]} needsOffscreenAlphaCompositing={unavailable}>
          <CardGlass radius={CARD_RADIUS} pressed={press.progress} />
        </View>
        <View style={styles.stackText}>
          <TagPill label={tag} style={unavailable && styles.dim} />
          <View style={styles.stackNote}>{state("left")}</View>
          {solved ? <TagPill label="SOLVED" style={styles.stackSolved} /> : null}
        </View>
        <View style={unavailable && styles.dim}>
          <CardArt id={id} size={ref.icon.heroMin} />
        </View>
      </Animated.View>
      {focus.focused ? (
        <View
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.fill, cardRing]}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
  dim: { opacity: ref.button.disabledOpacity.pill },
  underlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: ref.color.void,
    borderRadius: CARD_RADIUS,
    ...ref.curve,
  },
  indicator: { alignItems: "center", justifyContent: "center" },
  start: { alignItems: "flex-start" },

  // Fan card, card-local (140 x 320): tag pill y 24-50, state line 56-72, the
  // 64 icon centred at 54 % of the height (y 172.8), SOLVED centred at 74 % (y 236.8).
  // Each centred across the card, or on a side card across the exposed face.
  fanCard: { width: C.width, height: C.height },
  fanHead: { position: "absolute", top: TAG_TOP, left: 0, right: 0, alignItems: "center" },
  fanNote: { alignSelf: "stretch", marginTop: C.noteGap },
  fanIcon: { position: "absolute", left: 0, right: 0, top: C.height * C.iconCentre - ICON / 2, alignItems: "center" },
  fanSolved: {
    position: "absolute",
    left: 0,
    right: 0,
    top: C.height * C.solvedCentre - ref.button.gameCard.tagHeight / 2,
    alignItems: "center",
  },

  // Stacked card: Opal's glass at its own height, the tag pill and the state
  // line left-aligned at lg 16, the icon right-aligned at lg 16 and centred;
  // lg 16 below the last line. Height hugs the content, minimum 96. No tilt.
  stackCard: { alignSelf: "stretch", minHeight: H.stackedMinHeight },
  stackBody: { flex: 1, flexDirection: "row", alignItems: "center", padding: ref.space.lg, gap: ref.space.lg },
  stackText: { flex: 1, alignItems: "flex-start" },
  stackNote: { alignSelf: "stretch", marginTop: C.noteGap },
  stackSolved: { marginTop: ref.space.sm },
});
