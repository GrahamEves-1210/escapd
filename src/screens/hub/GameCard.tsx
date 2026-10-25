// A case file (docs/DESIGN.md, 01 · Game mode: Layout "Cards"; Tappable
// elements; States). A small film plate on a walnut mount, as /play mounts its
// photographs: the mount is color.surface with a 1 pt brass hairline
// (color.hairline) at radius.thumbRing; 4 in (thumbRing - thumb, so the
// corners are concentric) the plate is color.canvas with a 1 pt color.rim edge
// at radius.thumb, holding the warm line art. Under the plate, as under /play's
// plate, a brass `stamp` plate label (the tag) and the status note.
// The whole card is one button; its children are not separately focusable.
// Pressed: the mount's fill eases to color.raised and its hairline to
// color.accent over the kit's control timing, with a selection haptic on
// press-in. No scale and no opacity change on press.
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle } from "react-native-reanimated";
import { useFocusRing, usePressProgress } from "@/components/noir";
import { Text } from "@/components/Text";
import { useFeedback } from "@/game/feedback";
import { color, curve, radius, ref, space, type } from "@/theme/tokens";
import { CardArt } from "./CardArt";
import { CardNote } from "./CardNote";
import type { CardId } from "./caseStatus";

const H = ref.layout.hub;
const C = H.card;

/** The mount's ring around the plate: 18 - 14 = 4, so mount and plate corners are concentric. */
export const MOUNT_PAD = radius.thumbRing - radius.thumb;
/** A stacked card's plate: square at the card's minimum height (96 - 2 x 4 = 88), at its right end. */
const STACK_PLATE = H.stackedMinHeight - 2 * MOUNT_PAD;

/** "fan": the 122 x 209 card in the three-card fan. "stack": the upright full-width card (large text, narrow screens). */
export type CardLayout = "fan" | "stack";

/** The side of a fan card that lies under the centre card. */
export type CoveredSide = "left" | "right";

/**
 * The kit's focus ring (ref.focus: 2 pt at a 2 pt offset) as RN outline props,
 * so it follows the mount's radius.thumbRing corners with no new radius.
 */
export const cardRing: ViewStyle = {
  borderRadius: radius.thumbRing,
  ...curve,
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
  /** YOUR CASE solved: the SOLVED stamp. */
  solved?: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
  /**
   * Its own state disables it (YOUR CASE: none yet, offline, try later): the
   * mount, plate, line art and plate label drop to 0.4 as one layer; the note
   * explains why, so it stays at full strength.
   */
  unavailable?: boolean;
  /** Another card is busy: the whole card at 0.4, disabled. */
  dimmed?: boolean;
  /** Its own action is running: a small brass indicator on the plate, taps ignored, focus kept. */
  busy?: boolean;
  /** YOUR CASE before its first fetch resolves: taps ignored and busy for screen readers, but not dimmed and no indicator. */
  waiting?: boolean;
  /** The fan's centre card lies over the side cards; dimmed, it keeps an opaque canvas under it so they don't show through. */
  covers?: boolean;
  /** Fan side cards: the edge under the centre card. The labels, art and indicator centre on the face left exposed. */
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
  const { fontScale } = useWindowDimensions();
  const focus = useFocusRing({
    onFocus: () => onFocusChange?.(true),
    onBlur: () => onFocusChange?.(false),
  });
  const disabled = unavailable || dimmed;
  const ignoring = busy || waiting;
  const live = !disabled && !ignoring;

  const mountStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(press.progress.get(), [0, 1], [color.surface, color.raised]),
    borderColor: interpolateColor(press.progress.get(), [0, 1], [color.hairline, color.accent]),
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
          feedback.tap();
        }
      : undefined,
    onPressOut: press.onPressOut,
    onFocus: focus.onFocus,
    onBlur: focus.onBlur,
  } as const;

  // The live short-wait pattern: a small native indicator in brass.
  const indicator = busy ? (
    <ActivityIndicator size="small" color={color.accent} testID={testID ? `${testID}-busy` : undefined} />
  ) : null;

  if (layout === "fan") {
    // Bottom up: mount ring + sm, the note's caption line, xxs, the tag's stamp
    // line, sm, then the plate fills the rest (114 x 151 at the default size).
    const noteBottom = MOUNT_PAD + space.sm;
    const noteLine = type.caption.lineHeight * fontScale;
    const tagBottom = noteBottom + noteLine + space.xxs;
    const plateBottom = tagBottom + type.stamp.lineHeight * fontScale + space.sm;
    // The content column: 4 in from the mount's edge, or fan.cover in on the
    // side under the centre card, so it centres on the exposed face (x 4-94 or 28-118).
    const column = {
      left: covered === "left" ? H.fan.cover : MOUNT_PAD,
      right: covered === "right" ? H.fan.cover : MOUNT_PAD,
    };
    return (
      <Pressable {...pressableProps} style={[styles.fanCard, style]}>
        {covers && dimmed ? <View style={styles.underlay} /> : null}
        <View style={[styles.fill, dimmed && styles.dim]} needsOffscreenAlphaCompositing={dimmed}>
          {/* The 0.4 layer for a card its own state disables: mount, plate, line art and plate label together. */}
          <View style={[styles.fill, unavailable && styles.dim]} needsOffscreenAlphaCompositing={unavailable}>
            <Animated.View style={[styles.mount, mountStyle]} />
            <View style={[styles.plate, styles.fanPlate, { bottom: plateBottom }]} />
            <View style={[styles.fanArt, column, { bottom: plateBottom }]}>
              <CardArt id={id} />
            </View>
            <Text variant="stamp" tone="accent" align="center" style={[styles.fanLine, column, { bottom: tagBottom }]}>
              {tag}
            </Text>
          </View>
          <View style={[styles.fanLine, styles.noteSlot, column, { bottom: noteBottom, height: noteLine }]}>
            <CardNote text={note} developing={developing} align="center" />
          </View>
          {/* Pressed on the plate's lower right corner, sm in from its edges. */}
          {solved ? <SolvedStamp style={[styles.fanStamp, { bottom: plateBottom + space.sm }]} /> : null}
          {indicator ? <View style={[styles.fanLine, styles.centred, column, { bottom: plateBottom + space.sm }]}>{indicator}</View> : null}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable {...pressableProps} style={[styles.stackCard, dimmed && styles.dim, style]} needsOffscreenAlphaCompositing={dimmed}>
      <View style={[styles.fill, unavailable && styles.dim]} needsOffscreenAlphaCompositing={unavailable}>
        <Animated.View style={[styles.mount, mountStyle]} />
        <View style={[styles.plate, styles.stackPlate]} testID={testID ? `${testID}-plate` : undefined}>
          <CardArt id={id} />
        </View>
      </View>
      <View style={styles.stackText}>
        <Text variant="stamp" tone="accent" style={unavailable && styles.dim}>
          {tag}
        </Text>
        <View style={styles.stackNoteRow}>
          <CardNote text={note} developing={developing} align="left" style={developing ? styles.grow : styles.shrink} />
          {indicator}
        </View>
        {solved ? <SolvedStamp style={styles.stackStamp} /> : null}
      </View>
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

/** A brass case stamp: `stamp` text in accent inside a 1 pt accent border at radius.control. Never oxblood. */
function SolvedStamp({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.stamp, style]}>
      <Text variant="stamp" tone="accent">
        SOLVED
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
  dim: { opacity: ref.button.disabledOpacity },
  mount: {
    ...StyleSheet.absoluteFill,
    borderWidth: H.hairline,
    borderRadius: radius.thumbRing,
    ...curve,
  },
  plate: {
    position: "absolute",
    top: MOUNT_PAD,
    right: MOUNT_PAD,
    backgroundColor: color.canvas,
    borderWidth: H.hairline,
    borderColor: color.rim,
    borderRadius: radius.thumb,
    ...curve,
  },
  underlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: color.canvas,
    borderRadius: radius.thumbRing,
    ...curve,
  },
  stamp: {
    borderWidth: H.hairline,
    borderColor: color.accent,
    borderRadius: radius.control,
    ...curve,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  centred: { alignItems: "center" },

  // Fan card, card-local at the default text size: plate x 4-118, y 4-155;
  // tag line box y 163-177; note y 179-197; art 48 centred on the content
  // column across the plate; stamp and indicator sm above the plate's foot.
  fanCard: { width: C.width, height: C.height },
  fanPlate: { left: MOUNT_PAD },
  fanArt: { position: "absolute", top: MOUNT_PAD, alignItems: "center", justifyContent: "center" },
  fanLine: { position: "absolute" },
  noteSlot: { justifyContent: "center" },
  fanStamp: { position: "absolute", right: MOUNT_PAD + space.sm },

  // Stacked card: the walnut mount with the plate at its right end (88 wide,
  // 4 in, full height); the text column takes the rest with padding 16: plate
  // label, xxs, the note (with the indicator beside it), then the stamp sm
  // below, vertically centred. Height hugs the content, minimum 96.
  stackCard: {
    alignSelf: "stretch",
    flexDirection: "row",
    minHeight: H.stackedMinHeight,
    paddingRight: STACK_PLATE + MOUNT_PAD,
  },
  stackPlate: { bottom: MOUNT_PAD, width: STACK_PLATE, alignItems: "center", justifyContent: "center" },
  stackText: { flex: 1, justifyContent: "center", padding: space.lg },
  stackNoteRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.xxs },
  grow: { flex: 1 },
  shrink: { flexShrink: 1 },
  stackStamp: { alignSelf: "flex-start", marginTop: space.sm },
});
