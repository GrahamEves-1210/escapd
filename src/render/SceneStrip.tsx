import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { plateNumeral } from "@/game/format";
import { color, curve, radius, space } from "@/theme/tokens";
import { Text } from "@/components/Text";
import type { SceneSource } from "./SceneView";

/**
 * Contact-sheet plates in photos[] order. Switching scenes is local UI state,
 * never an action. A crimson pin marks a view that has something new in it.
 */
export function SceneStrip({ sources, index, marked, onSelect }: {
  sources: SceneSource[];
  index: number;
  marked: number[];
  onSelect: (index: number) => void;
}) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {sources.map((source, i) => {
        const selected = i === index;
        const hasMark = marked.includes(i) && !selected;
        const numeral = plateNumeral(i);
        return (
          <Pressable
            key={i}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`Plate ${numeral}, view ${i + 1} of ${sources.length}${hasMark ? ", something new" : ""}`}
            onPress={() => onSelect(i)}
            hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
            testID={`scene-${i}`}
            style={({ pressed }) => [styles.ring, selected && styles.ringSelected, pressed && styles.pressed]}
          >
            <View style={styles.thumb}>
              {/* Thumbnails may crop: they carry no hotspots. */}
              <Image source={source} style={styles.image} contentFit="cover" transition={0} />
            </View>
            <Text variant="stamp" tone={selected ? "accent" : "secondary"} align="center">{numeral}</Text>
            {hasMark ? <View style={styles.mark} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", gap: space.sm },
  ring: {
    width: 56,
    padding: 4,
    borderRadius: radius.thumbRing,
    ...curve,
    borderWidth: 1,
    borderColor: "transparent",
    gap: 3,
  },
  ringSelected: { borderColor: color.accent },
  pressed: { opacity: 0.85 },
  thumb: {
    height: 52,
    borderRadius: radius.thumb,
    ...curve,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: color.raised,
  },
  image: { flex: 1 },
  mark: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: radius.round,
    backgroundColor: color.wax,
    borderWidth: 1,
    borderColor: color.canvas,
  },
});
