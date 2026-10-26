// Crime scene's Suspects (docs/DESIGN.md, Modes · Crime scene): the kit's
// dark sheet with the three suspects (name, role, alibi; CONTRADICTED once a
// clue breaks one), then the motives and the methods in play, and the
// Accuse button. Accuse is enabled once the accusation's evidence steps are
// solved (selectors.canAccuse); until then a line says what's missing,
// without naming it.
import { StyleSheet, Text, View } from "react-native";
import type { AccuseOption } from "@/lib/puzzle-types";
import type { SuspectCard } from "@/game/selectors";
import { useModeTheme } from "@/game/mode";
import { DarkSheet } from "@/components/noir";
import { ref } from "@/theme/tokens";
import { ModePill } from "@/capture/ui/ModePill";
import { Card } from "./parts";
import { SuspectFile } from "./SuspectFile";

const P = ref.layout.play;

export function contradictedLine(count: number, total: number) {
  if (count === 0) return "No alibis broken yet.";
  return count === 1 ? `1 of ${total} alibis broken` : `${count} of ${total} alibis broken`;
}

export function SuspectsSheet({ suspects, motives, methods, canAccuse, onAccuse, onClose }: {
  suspects: SuspectCard[];
  motives: AccuseOption[];
  methods: AccuseOption[];
  canAccuse: boolean;
  onAccuse: () => void;
  onClose: () => void;
}) {
  const theme = useModeTheme();
  const broken = suspects.filter((s) => s.contradicted).length;
  return (
    <DarkSheet
      title="Suspects"
      meta={contradictedLine(broken, suspects.length)}
      onClose={onClose}
      maxHeight="90%"
      testID="suspects-sheet"
      footer={(
        <View style={styles.footer}>
          <ModePill
            variant="ghost"
            label="Accuse"
            onPress={onAccuse}
            disabled={!canAccuse}
            accessibilityHint={canAccuse ? "Name the suspect, the motive and the method." : undefined}
            testID="suspects-accuse"
          />
          {!canAccuse ? (
            <Text style={[P.type.hint, styles.center, { color: theme.inkMuted }]} testID="suspects-locked">
              Not enough evidence yet. Keep searching.
            </Text>
          ) : null}
        </View>
      )}
    >
      <View style={styles.list}>
        {suspects.map((s) => <SuspectFile key={s.id} suspect={s} testID={`suspect-${s.id}`} />)}
      </View>
      <OptionList title="Motives" options={motives} testID="motives" />
      <OptionList title="Methods" options={methods} testID="methods" />
    </DarkSheet>
  );
}

function OptionList({ title, options, testID }: { title: string; options: AccuseOption[]; testID: string }) {
  const theme = useModeTheme();
  return (
    <View style={styles.section} testID={testID}>
      <Text style={[P.type.section, { color: theme.ink }]} accessibilityRole="header">{title}</Text>
      <Card style={styles.options}>
        {options.map((o, i) => (
          <View key={o.id} style={[styles.option, i > 0 && [styles.divided, { borderTopColor: theme.rim }]]}>
            <Text style={[P.type.body, { color: theme.ink }]}>{o.name}</Text>
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: P.accuse.rowGap },
  section: { gap: P.card.gap },
  options: { paddingVertical: 0 },
  option: { paddingVertical: P.card.padY },
  divided: { borderTopWidth: P.hairline },
  footer: { gap: ref.space.sm },
  center: { textAlign: "center" },
});
