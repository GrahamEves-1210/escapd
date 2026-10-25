// A game card (docs/DESIGN.md, Global tokens: Game card; 01 Layout, Tappable
// elements and States). Opaque ref.panel material, a mono tag, a mono state
// note and grayscale line art. The whole card is one button; its children are
// not separately focusable. Pressed: fill to panelPressed and border to
// hairline2 over ref.motion.control, with a selection haptic on press-in. No
// scale and no opacity change on press.
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle } from "react-native-reanimated";
import { FocusRing, NoirText, Stamp, useFocusRing, usePressProgress } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { ref } from "@/theme/tokens";
import { CardArt } from "./CardArt";
import { CardNote } from "./CardNote";
import type { CardId } from "./caseStatus";

const G = ref.gameCard;
const C = ref.layout.hub.card;
const P = ref.panel;

/** "fan": the 122 x 209 card in the three-card fan. "stack": the upright full-width card (large text, narrow screens). */
export type CardLayout = "fan" | "stack";

export interface GameCardProps {
  id: CardId;
  layout: CardLayout;
  tag: string;
  /** Null while YOUR CASE loads (the line stays blank). */
  note: string | null;
  developing?: boolean;
  noteFromShimmer?: boolean;
  /** YOUR CASE solved: the SOLVED stamp. */
  solved?: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
  /**
   * Its own state disables it (YOUR CASE: none yet, offline, try later): the
   * panel, tag and line art drop to 0.4 as one layer; the note explains why,
   * so it stays at full strength.
   */
  unavailable?: boolean;
  /** Another card is busy: the whole card at 0.4, disabled. */
  dimmed?: boolean;
  /** Its own action is running: the native indicator in the stamp band, taps ignored, focus kept. */
  busy?: boolean;
  /** YOUR CASE before its first fetch resolves: taps ignored and busy for screen readers, but not dimmed and no indicator. */
  waiting?: boolean;
  /** The fan's centre card lies over the side cards; dimmed, it keeps an opaque ground under it so they don't show through. */
  covers?: boolean;
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
  noteFromShimmer = false,
  solved = false,
  accessibilityLabel,
  accessibilityHint,
  unavailable = false,
  dimmed = false,
  busy = false,
  waiting = false,
  covers = false,
  onPress,
  onFocusChange,
  testID,
  style,
}: GameCardProps) {
  const feedback = useFeedback();
  const press = usePressProgress();
  const focus = useFocusRing({
    onFocus: () => onFocusChange?.(true),
    onBlur: () => onFocusChange?.(false),
  });
  const disabled = unavailable || dimmed;
  const ignoring = busy || waiting;
  const live = !disabled && !ignoring;

  const surfaceStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(press.progress.get(), [0, 1], [P.fill, ref.color.panelPressed]),
    borderColor: interpolateColor(press.progress.get(), [0, 1], [P.border, ref.color.hairline2]),
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

  // The native in-button indicator, in the tag colour (Loading indicators).
  const indicator = busy ? (
    <ActivityIndicator size="small" color={ref.color.meta} testID={testID ? `${testID}-busy` : undefined} />
  ) : null;

  if (layout === "fan") {
    return (
      <Pressable {...pressableProps} style={[styles.fanCard, style]}>
        {covers && dimmed ? <View style={styles.underlay} /> : null}
        <View style={[styles.fill, dimmed && styles.dim]} needsOffscreenAlphaCompositing={dimmed}>
          {/* The 0.4 layer for a card its own state disables: panel, tag and line art together. */}
          <View style={[styles.fill, unavailable && styles.dim]} needsOffscreenAlphaCompositing={unavailable}>
            <Animated.View style={[styles.surface, surfaceStyle]} />
            <NoirText variant="label" align="center" centerTracking style={styles.fanTag}>
              {tag}
            </NoirText>
            <View style={styles.fanArt}>
              <CardArt id={id} />
            </View>
          </View>
          <CardNote text={note} developing={developing} fromShimmer={noteFromShimmer} align="center" style={styles.fanNote} />
          {solved ? <Stamp label="SOLVED" style={styles.fanStamp} /> : null}
          {indicator ? <View style={styles.fanBusy}>{indicator}</View> : null}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable {...pressableProps} style={[styles.stackCard, dimmed && styles.dim, style]} needsOffscreenAlphaCompositing={dimmed}>
      <Animated.View style={[styles.surface, surfaceStyle, unavailable && styles.dim]} />
      <View style={styles.stackText}>
        <NoirText variant="label" style={unavailable && styles.dim}>
          {tag}
        </NoirText>
        <View style={styles.stackNoteRow}>
          <CardNote
            text={note}
            developing={developing}
            fromShimmer={noteFromShimmer}
            align="left"
            style={developing ? styles.grow : styles.shrink}
          />
          {indicator ? <View style={styles.stackBusy}>{indicator}</View> : null}
        </View>
        {solved ? <Stamp label="SOLVED" style={styles.stackStamp} /> : null}
      </View>
      <View style={[styles.stackArt, unavailable && styles.dim]}>
        <CardArt id={id} />
      </View>
      <FocusRing visible={focus.focused} shape="panel" />
    </Pressable>
  );
}

const NOTE_INSET = G.tagInset;
const NOTE_TOP = G.tagInset + ref.type.label.lineHeight + C.noteGap;

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
  dim: { opacity: ref.button.disabledOpacity },
  surface: {
    ...StyleSheet.absoluteFill,
    borderWidth: P.borderWidth,
    borderRadius: P.radius,
    ...ref.curve,
  },
  underlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: ref.color.ground,
    borderRadius: P.radius,
    ...ref.curve,
  },

  // Fan card, card-local: tag line box 16-32, note 38-56 (max width 90),
  // art 48 centred on y 113, stamp at the right and bottom insets, indicator
  // in the stamp band (y 170-190) centred on x 61.
  fanCard: { width: G.width, height: G.height },
  fanTag: { position: "absolute", top: G.tagInset, left: 0, right: 0 },
  fanNote: { position: "absolute", top: NOTE_TOP, left: NOTE_INSET, right: NOTE_INSET },
  fanArt: { position: "absolute", top: C.artCentreY - C.art / 2, left: (G.width - C.art) / 2 },
  fanStamp: { position: "absolute", right: ref.space.lg, bottom: ref.space.lg },
  fanBusy: {
    position: "absolute",
    top: C.busyTop,
    left: 0,
    right: 0,
    height: C.busySize,
    alignItems: "center",
    justifyContent: "center",
  },

  // Stacked card: padding 16; tag, 6, note, then the stamp 8 below, all
  // left-aligned in a text column of at most 257; the 48 art right-aligned at
  // the 16 inset (space-between, once the column hits its cap on wider
  // phones) and vertically centred. Height hugs the content, minimum 96.
  stackCard: {
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: ref.layout.hub.stackedMinHeight,
    padding: ref.space.lg,
    gap: ref.space.lg,
  },
  stackText: { flex: 1, maxWidth: ref.layout.hub.stackedTextWidth, alignSelf: "flex-start" },
  stackNoteRow: { flexDirection: "row", alignItems: "center", gap: ref.space.sm, marginTop: C.noteGap },
  grow: { flex: 1 },
  shrink: { flexShrink: 1 },
  stackBusy: { width: C.busySize, height: C.busySize, alignItems: "center", justifyContent: "center" },
  stackStamp: { marginTop: ref.space.sm },
  stackArt: { alignSelf: "center" },
});
