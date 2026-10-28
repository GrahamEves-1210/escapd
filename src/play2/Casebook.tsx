// The casebook (gameplay v2 §2 "Learn"): the objective, every card found so
// far (what the room has told the player, in the mode's voice), what they
// hold, and the hint ladder for the step they're on. A dark sheet over the
// room.
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { DarkSheet } from "@/components/noir";
import { useModeTheme } from "@/game/mode";
import { ref } from "@/theme/tokens";
import type { FoundCard } from "./InspectView";

export interface CasebookProps {
  objective: string;
  cards: FoundCard[];
  items: { id: string; name: string; examinable: boolean }[];
  hints: string[];
  /** False when there is nothing more to hint: every step done, or the current step's ladder used up. */
  canHint: boolean;
  /** Crime scene: the accusation's lists, an evidence board the player crosses options off. */
  board?: { title: string; options: { id: string; name: string }[] }[];
  struck?: string[];
  onStrike?: (id: string) => void;
  /** Objects glint in the torch's beam; off is the hard way. */
  glints: boolean;
  onGlints: (on: boolean) => void;
  onHint: () => void;
  onExamine: (itemId: string) => void;
  onRestart: () => void;
  onClose: () => void;
  /** The cat, peering over the casebook's top edge (thinking along when you ask for a hint). */
  cat?: ReactNode;
}

export function Casebook({ objective, cards, items, hints, canHint, board, struck = [], onStrike, glints, onGlints, onHint, onExamine, onRestart, onClose, cat }: CasebookProps) {
  const theme = useModeTheme();
  // Restarting wipes the case: the first tap asks, a second within a few seconds does it.
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), RESTART_CONFIRM_MS);
    return () => clearTimeout(t);
  }, [confirming]);
  const heading = [ref.type.meta, styles.heading, { color: theme.inkMuted }];
  const body = [ref.type.body, { color: theme.ink }];
  return (
    <DarkSheet title="Casebook" titleStyle="serif" meta={objective} onClose={onClose} maxHeight="80%" testID="v2-casebook" closeTestID="v2-casebook-close" peek={cat}>
      <View style={styles.section}>
        <Text style={heading}>Found</Text>
        {cards.length ? (
          cards.map((c) => (
            <View key={c.id} style={[styles.card, { backgroundColor: theme.raised, borderColor: theme.rim }]} testID={`v2-casebook-card-${c.id}`}>
              <Text style={[ref.type.headline, { color: theme.ink }]}>{c.title}</Text>
              <Text style={[ref.type.body, { color: theme.inkMuted }]}>{c.text}</Text>
            </View>
          ))
        ) : (
          <Text style={[ref.type.meta, { color: theme.inkMuted }]} testID="v2-casebook-empty">Nothing yet. Sweep the light across the room.</Text>
        )}
      </View>

      {board ? (
        <View style={styles.section} testID="v2-board">
          <Text style={heading}>Evidence board</Text>
          <Text style={[ref.type.meta, { color: theme.inkMuted }]}>Cross off what the evidence rules out.</Text>
          {board.map((list) => (
            <View key={list.title} style={styles.boardRow}>
              <Text style={[ref.type.meta, styles.boardTitle, { color: theme.inkMuted }]}>{list.title}</Text>
              <View style={styles.boardOptions}>
                {list.options.map((o) => {
                  const off = struck.includes(o.id);
                  return (
                    <Pressable
                      key={o.id}
                      onPress={() => onStrike?.(o.id)}
                      accessibilityRole="button"
                      accessibilityLabel={o.name}
                      accessibilityState={{ checked: off }}
                      accessibilityHint={off ? "Ruled out. Tap to put it back." : "Tap to rule it out."}
                      testID={`v2-board-${o.id}`}
                      style={[styles.option, { borderColor: theme.rim, backgroundColor: off ? "transparent" : theme.raised }]}
                    >
                      <Text style={[ref.type.meta, { color: off ? theme.inkMuted : theme.ink, textDecorationLine: off ? "line-through" : "none" }]}>{o.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {items.length ? (
        <View style={styles.section}>
          <Text style={heading}>Holding</Text>
          {items.map((i) => (
            <View key={i.id} style={styles.row}>
              <Text style={[body, styles.flex]}>{i.name}</Text>
              {i.examinable ? (
                <Pressable onPress={() => onExamine(i.id)} accessibilityRole="button" accessibilityLabel={`Examine ${i.name}`} hitSlop={8} testID={`v2-examine-${i.id}`}>
                  <Text style={[ref.type.body, { color: theme.stamp }]}>Examine</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={heading}>Hints</Text>
        {hints.map((h, i) => (
          <Text key={i} style={[ref.type.body, { color: theme.inkMuted }]}>{h}</Text>
        ))}
        {canHint ? (
          <Pressable onPress={onHint} accessibilityRole="button" accessibilityLabel={hints.length ? "Another hint" : "Get a hint"} testID="v2-hint" style={[styles.pill, { backgroundColor: theme.accent }]}>
            <Text style={[ref.type.headline, { color: theme.accentInk }]}>{hints.length ? "Another hint" : "Get a hint"}</Text>
          </Pressable>
        ) : hints.length ? (
          <Text style={[ref.type.meta, { color: theme.inkMuted }]} testID="v2-hints-spent">{"That's every hint for this step."}</Text>
        ) : null}
      </View>

      <View style={[styles.row, styles.section]}>
        <View style={styles.flex}>
          <Text style={body}>Glints</Text>
          <Text style={[ref.type.meta, { color: theme.inkMuted }]}>Things catch the light as you sweep. Off is harder.</Text>
        </View>
        <Switch value={glints} onValueChange={onGlints} accessibilityLabel="Glints" testID="v2-glints" />
      </View>

      <Pressable
        onPress={() => {
          if (confirming) {
            setConfirming(false);
            onRestart();
          } else setConfirming(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={confirming ? "Tap again to restart. Your progress in this case will be lost." : "Restart this case"}
        testID="v2-restart"
        style={styles.restart}
      >
        <Text style={[confirming ? ref.type.label : ref.type.meta, { color: confirming ? theme.stamp : theme.inkMuted }]}>
          {confirming ? "Tap again to restart. Progress will be lost." : "Restart this case"}
        </Text>
      </Pressable>
    </DarkSheet>
  );
}

/** How long "Tap again to restart" waits for the second tap (ms). */
const RESTART_CONFIRM_MS = 4000;

const styles = StyleSheet.create({
  section: { gap: ref.space.sm, marginBottom: ref.space.lg },
  heading: { textTransform: "uppercase", letterSpacing: 1.2 },
  card: { borderRadius: ref.radius.sheet, borderWidth: StyleSheet.hairlineWidth, padding: ref.space.lg, gap: ref.space.xs },
  boardRow: { flexDirection: "row", gap: ref.space.sm, alignItems: "flex-start" },
  boardTitle: { width: 36, paddingTop: ref.space.sm, textTransform: "uppercase" },
  boardOptions: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: ref.space.xs },
  option: { minHeight: ref.hit.min, paddingHorizontal: ref.space.sm, borderRadius: ref.radius.tag, borderWidth: StyleSheet.hairlineWidth, justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", minHeight: ref.hit.min, gap: ref.space.sm },
  flex: { flex: 1 },
  pill: { minHeight: ref.hit.min, borderRadius: ref.hit.min / 2, alignItems: "center", justifyContent: "center", marginTop: ref.space.xs },
  restart: { alignSelf: "center", minHeight: ref.hit.min, justifyContent: "center" },
});
