import { StyleSheet, View } from "react-native";
import type { InventoryItem } from "@/game/selectors";
import { compartmentFor } from "@/theme/materials";
import { color, curve, radius, space } from "@/theme/tokens";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { Text } from "@/components/Text";
import { ItemIcon } from "./ItemIcon";

export interface ResultContent {
  title: string;
  /** Hotspot object_label, used to pick the compartment lining. */
  objectLabel?: string;
  eyebrow?: string;
  /** Narrative from submit_action (`message`). */
  message?: string;
  /** The hotspot's public description, for quiet results. */
  description?: string;
  /** Neutral copy for a `nothing` outcome. Never names a missing item. */
  quiet?: string;
  /** Items the server just granted (already in inventory). */
  gained: InventoryItem[];
  revealed: "none" | "here" | "elsewhere";
}

/**
 * The compartment drawer. The scene stays visible above it. Clue text is set
 * on a manila slip; item descriptions are shown only for items the server granted.
 */
export function ResultSheet({ content, onClose }: { content: ResultContent; onClose: () => void }) {
  const compartment = compartmentFor(content.objectLabel ?? content.title);
  const slip = content.message || content.description || content.quiet;
  return (
    <Sheet
      title={content.title}
      eyebrow={`EXHIBIT  //  ${content.title.toUpperCase()}`}
      onClose={onClose}
      scrim={false}
      ground={compartment.ground}
      maxHeight="58%"
      testID="result-sheet"
      footer={(
        <Button
          label={content.gained.length > 0 ? "Pocket artifact" : "Continue"}
          onPress={onClose}
          testID="result-continue"
        />
      )}
    >
      {compartment.rivets ? <Rivets /> : null}
      {slip ? (
        <View style={styles.slip}>
          {content.message ? <Text variant="slip" tone="ink">{content.message}</Text> : null}
          {content.description ? <Text variant="body" tone="ink">{content.description}</Text> : null}
          {content.quiet ? <Text variant="slip" tone="ink">{content.quiet}</Text> : null}
        </View>
      ) : null}

      {content.gained.length > 0 ? (
        <View style={styles.velvet}>
          <Text variant="stamp" tone="accent">Added to the satchel</Text>
          {content.gained.map((item) => (
            <View key={item.id} style={styles.item} accessible accessibilityLabel={`${item.name}. ${item.description ?? ""}`}>
              <View style={styles.icon}>
                <ItemIcon name={item.name} size={22} tint={color.accent} />
              </View>
              <View style={styles.itemText}>
                <Text variant="control">{item.name}</Text>
                {item.description ? <Text tone="secondary">{item.description}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {content.revealed !== "none" ? (
        <Text variant="stamp" tone={content.revealed === "here" ? "accent" : "secondary"}>
          {content.revealed === "here" ? "Something new is within reach." : "Something changed on another plate."}
        </Text>
      ) : null}
    </Sheet>
  );
}

function Rivets() {
  return (
    <View pointerEvents="none" style={styles.rivets}>
      <View style={styles.rivet} />
      <View style={styles.rivet} />
    </View>
  );
}

const styles = StyleSheet.create({
  slip: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.slip,
    ...curve,
    backgroundColor: color.manila,
  },
  velvet: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.slip,
    backgroundColor: color.velvet,
    borderWidth: 1,
    borderColor: "rgba(166, 52, 41, 0.45)",
  },
  item: { flexDirection: "row", gap: space.md, alignItems: "center" },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.control,
    backgroundColor: color.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: { flex: 1, gap: space.xxs },
  rivets: { flexDirection: "row", justifyContent: "space-between" },
  rivet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color.accent,
    borderWidth: 1,
    borderColor: color.accentPressed,
  },
});
