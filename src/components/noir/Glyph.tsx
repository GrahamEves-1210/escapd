// A Phosphor glyph whose colour changes over time. Phosphor icons take a plain
// colour string, so the change is drawn as stacked copies of the same glyph,
// each in one token colour, with the upper copies' opacity eased by shared
// values. A copy at opacity p over the one beneath blends the two colours by
// p, which is what interpolateColor would give.
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import type { NoirIcon } from "./types";

export interface GlyphLayerSpec {
  color: string;
  /** 0 to 1. */
  opacity: SharedValue<number>;
}

function GlyphLayer({ icon: Icon, size, color, opacity }: { icon: NoirIcon; size: number } & GlyphLayerSpec) {
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View pointerEvents="none" style={[styles.layer, style]}>
      <Icon size={size} color={color} weight="regular" />
    </Animated.View>
  );
}

/** `base` is always drawn; each layer above it fades in by its own value. */
export function GlyphStack({ icon: Icon, size, base, layers }: { icon: NoirIcon; size: number; base: string; layers: readonly GlyphLayerSpec[] }) {
  return (
    <View pointerEvents="none" style={{ width: size, height: size }}>
      <Icon size={size} color={base} weight="regular" />
      {layers.map((layer, i) => (
        <GlyphLayer key={i} icon={Icon} size={size} color={layer.color} opacity={layer.opacity} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
});
