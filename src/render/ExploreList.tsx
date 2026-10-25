import { StyleSheet, View } from "react-native";
import type { ExploreEntry } from "@/game/selectors";
import { color, radius, space } from "@/theme/tokens";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { Text } from "@/components/Text";

export type ExploreAction = "inspect" | "code" | "use";

/**
 * "Explore as list": the screen-reader and motor-access alternative to
 * spatial tapping. Lists only revealed hotspots, grouped by view.
 */
export function ExploreList({ entries, sceneCount, useItemName, onAction, onClose }: {
  entries: ExploreEntry[];
  sceneCount: number;
  /** Set while one item is selected (Use mode). */
  useItemName?: string;
  onAction: (entry: ExploreEntry, action: ExploreAction) => void;
  onClose: () => void;
}) {
  const scenes = Array.from({ length: sceneCount }, (_, i) => i).filter((i) => entries.some((e) => e.photoIndex === i));
  return (
    <Sheet title="Explore as list" titleStyle="utility" onClose={onClose} maxHeight="80%" testID="explore-list">
      {useItemName ? <Text variant="caption" tone="accent">Using {useItemName}</Text> : null}
      {scenes.map((scene) => (
        <View key={scene} style={styles.group}>
          <Text variant="caption" tone="secondary" accessibilityRole="header">View {scene + 1}</Text>
          {entries.filter((e) => e.photoIndex === scene).map((entry) => (
            <View key={entry.hotspot.id} style={styles.row}>
              <View style={styles.rowText}>
                <Text variant="control">{entry.name}</Text>
                {entry.hotspot.description ? <Text variant="caption" tone="secondary">{entry.hotspot.description}</Text> : null}
              </View>
              <View style={styles.actions}>
                {useItemName ? (
                  <Button
                    label="Use here"
                    variant="secondary"
                    accessibilityLabel={`Use ${useItemName} on ${entry.name}`}
                    onPress={() => onAction(entry, "use")}
                  />
                ) : entry.intent.kind === "code" ? (
                  <Button
                    label="Enter code"
                    variant="secondary"
                    accessibilityLabel={`Enter a code at ${entry.name}`}
                    onPress={() => onAction(entry, "code")}
                  />
                ) : (
                  <Button
                    label="Inspect"
                    variant="secondary"
                    accessibilityLabel={`Inspect ${entry.name}`}
                    onPress={() => onAction(entry, "inspect")}
                  />
                )}
              </View>
            </View>
          ))}
        </View>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.control,
    backgroundColor: color.raised,
  },
  rowText: { flex: 1, gap: space.xxs },
  actions: { flexDirection: "row", gap: space.xs },
});
