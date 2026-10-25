// How you play (docs/DESIGN.md, 01 · Layout: How you play sheet; Tappable
// elements; States). The live Sheet, built as /play's Case options: the walnut
// drawer with grain, brass inner rule and handle, the utility title in
// `sectionTitle` and the live Close, over color.sheetScrim. It rises with
// motion.sheetSpring and leaves with a 200 ms slide (both cross-fade over
// motion.reducedFade under reduced motion), moves screen-reader focus to its
// title once it has risen, scrolls past 64 % of the screen, and traps
// VoiceOver (accessibilityViewIsModal).
// Inside: the Show interactives row (a React Native Switch with the brass
// track, as in Case options) and the guide replay as a brass secondary pill.
// Render it conditionally: it animates in on mount and out on unmount.
import { StyleSheet, Switch, View } from "react-native";
import { PillButton } from "@/components/noir";
import { Sheet } from "@/components/Sheet";
import { Text } from "@/components/Text";
import { usePreferences } from "@/game/preferences";
import { color, space } from "@/theme/tokens";

export interface HowYouPlaySheetProps {
  /** Close, scrim and Android back. Focus returns to the How you play button once the sheet has left. */
  onClose: () => void;
  /** "How to photograph a room": closes the sheet, then opens the guide in replay mode. */
  onGuide: () => void;
}

export function HowYouPlaySheet({ onClose, onGuide }: HowYouPlaySheetProps) {
  const { hotspotAssist, setHotspotAssist } = usePreferences();
  return (
    <Sheet title="How you play" titleStyle="utility" onClose={onClose} testID="hub-sheet">
      <View style={styles.row}>
        <View style={styles.rowText}>
          {/* The switch carries this label, so screen readers don't hear it twice. */}
          <Text variant="control" accessibilityElementsHidden importantForAccessibility="no">
            Show interactives
          </Text>
          <Text variant="caption" tone="secondary">
            Keep the marks on objects you can use visible.
          </Text>
        </View>
        <Switch
          value={hotspotAssist}
          onValueChange={setHotspotAssist}
          accessibilityLabel="Show interactives"
          trackColor={{ true: color.accent, false: color.hairline }}
          thumbColor={color.text}
          testID="hub-show-interactives"
        />
      </View>
      <PillButton label="How to photograph a room" scheme="brass" variant="secondary" onPress={onGuide} testID="hub-guide-replay" />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  // Case options' row: the text column wraps at large text; the switch keeps its size.
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  rowText: { flex: 1, gap: space.xxs },
});
