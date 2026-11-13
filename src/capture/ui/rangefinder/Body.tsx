// The camera's body, behind every control: leather over the mode's ground
// (the Rangefinder's root colour), under the studio's light. The leather is a
// rendered grain alone, a square repeated without a seam, light on its pebbles
// and dark in its creases, so it is plum, oxblood or indigo with the mode; the
// light is one soft picture stretched over it, warm from the upper left as on
// every rendered fitting. Both are still pictures that take no touches.
import { Image as TiledImage, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { ART } from "../art";

export function Body() {
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="camera-body"
    >
      {/* React Native's own Image: the one that repeats a tile. */}
      <TiledImage source={ART.leather} resizeMode="repeat" style={styles.leather} testID="camera-leather" />
      <Image source={ART.light} style={StyleSheet.absoluteFill} contentFit="fill" accessible={false} testID="camera-light" />
    </View>
  );
}

const styles = StyleSheet.create({
  // Sized outright: an image otherwise takes its picture's own size (the tile's) on the web.
  leather: { position: "absolute", left: 0, top: 0, width: "100%", height: "100%" },
});
