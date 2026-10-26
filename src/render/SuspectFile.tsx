// A suspect's card (crime scene): the name, the role, and the alibi in
// quotes. When a clue the player holds breaks the alibi (the server lists
// the suspect in state.contradicted), the alibi is struck through and the
// card is stamped CONTRADICTED in the mode's stamp colour: the word says it,
// so it never rests on colour. The large card is the accused's, on the
// reveal and on case closed, its name in the mode's display face.
import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useModeTheme } from "@/game/mode";
import { ref } from "@/theme/tokens";
import { Stamp } from "./Stamp";

const P = ref.layout.play;

export interface SuspectFace {
  id: string;
  name: string;
  role?: string;
  alibi?: string;
  contradicted?: boolean;
}

/** One line for screen readers: "Ivy Marsh, the housekeeper. Alibi: In the garden all evening. Alibi contradicted." */
export function suspectA11yLabel(s: SuspectFace) {
  return [
    s.role ? `${s.name}, ${s.role}.` : `${s.name}.`,
    s.alibi ? `Alibi: ${s.alibi}` : null,
    s.contradicted ? "Alibi contradicted." : null,
  ].filter(Boolean).join(" ");
}

/**
 * The card's words, for a card or a radio card that draws its own frame.
 * A broken alibi's CONTRADICTED stamp sits beside the name (`stamped`), so
 * the role and the alibi keep the card's full width.
 */
export function SuspectText({ suspect, size = "row", stamped = false, testID }: {
  suspect: SuspectFace;
  size?: "row" | "large";
  stamped?: boolean;
  testID?: string;
}) {
  const theme = useModeTheme();
  const large = size === "large";
  return (
    <View style={styles.text}>
      <View style={styles.nameRow}>
        <Text style={[styles.name, large ? { ...theme.display, color: theme.ink } : [P.type.suspect, { color: theme.ink }]]} numberOfLines={large ? 2 : undefined}>
          {suspect.name}
        </Text>
        {stamped && suspect.contradicted ? (
          <Stamp text="Contradicted" style={styles.stamp} testID={testID ? `${testID}-contradicted` : undefined} />
        ) : null}
      </View>
      {suspect.role ? <Text style={[ref.type.meta, { color: theme.inkMuted }]}>{suspect.role}</Text> : null}
      {suspect.alibi ? (
        <Text
          style={[
            P.type.hint,
            styles.alibi,
            { color: suspect.contradicted ? theme.inkMuted : theme.ink },
            suspect.contradicted && styles.struck,
          ]}
        >
          {`“${suspect.alibi}”`}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * A suspect on 07's card, CONTRADICTED stamped beside the name when the
 * alibi is broken. `stamp` (GUILTY on the accused) is stamped on the card
 * under the words instead. The card is one element for screen readers, so
 * the stamp's word is hidden inside it: `stampLabel` speaks it first
 * ("Guilty. Ivy Marsh, the housekeeper. …").
 */
export function SuspectFile({ suspect, size = "row", stamp, stampLabel, style, testID }: {
  suspect: SuspectFace;
  size?: "row" | "large";
  stamp?: ReactNode;
  /** What `stamp` says, for screen readers ("Guilty"). */
  stampLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const theme = useModeTheme();
  const label = suspectA11yLabel(suspect);
  return (
    <View
      style={[styles.card, size === "large" && styles.large, { backgroundColor: theme.raised, borderColor: theme.rim }, style]}
      accessible
      accessibilityLabel={stampLabel ? `${stampLabel}. ${label}` : label}
      testID={testID}
    >
      <SuspectText suspect={suspect} size={size} stamped={!stamp} testID={testID} />
      {stamp ? <View style={styles.stampBand} pointerEvents="none">{stamp}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: P.card.pad,
    borderRadius: P.card.radius,
    borderWidth: P.hairline,
    ...ref.curve,
  },
  large: { paddingVertical: P.card.pad * 2 },
  text: { gap: ref.space.xs },
  nameRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: P.card.gap, rowGap: ref.space.xs },
  name: { flexShrink: 1 },
  stamp: { alignSelf: "center" },
  // A large stamp has its own band on the card, under the words, so the name stays readable.
  stampBand: { alignItems: "center", marginTop: P.stamp.tiltRoom },
  alibi: { marginTop: ref.space.xs },
  struck: { textDecorationLine: "line-through" },
});
