// The illustration band between the header and the text block (docs/DESIGN.md
// 04, Layout: Mount, Inner plate, Plate label; States: Large text). Each
// step's drawing sits on a film plate, SceneView's Kodachrome mount: walnut
// (color.surface) with a 1 pt brass hairline at radius.mount, 6 of walnut
// around an inner plate of color.canvas at radius.image with a 1 pt color.rim
// edge, and the brass plate label under the plate. On 393 x 852 the mount is
// 278 x 386 at y 178-564, 67 below the header and 56 above the title. The
// text block is bottom-anchored, so the 56 under the mount absorbs any growth
// first, down to space.xl; then the void above gives way, down to space.xl;
// then the plate shrinks evenly, the drawing with it. Below a 160 high plate
// the whole mount hides. The mount itself never moves or animates: only the
// drawing and the plate label crossfade with the step.
import { useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { Text } from "@/components/Text";
import { color, curve, radius, ref, space, type as typeScale } from "@/theme/tokens";
import { StepArt } from "./art/StepArt";
import { STEPS, plateLabel } from "./copy";
import { FadeLayer, type StepLayer } from "./stepper";

const G = ref.layout.guide;
const ART = G.art;
const PLATE = G.plate;
const CLEAR = space.xl;
const ABOVE = G.voids.above;
const BELOW = G.voids.below;
// The mount's edge and walnut padding, on each side of the plate.
const RIM = G.hairline + G.mount.pad;
// Mono type: the label with the most characters is the widest, and sizes the slot.
const LONGEST_LABEL = STEPS.map((_, step) => plateLabel(step)).reduce((a, b) => (b.length > a.length ? b : a));

/** The mount's height beyond its plate: edges, padding, the label gap and a label `label` tall (34 at 14). */
export function mountChrome(label: number): number {
  return RIM * 2 + G.mount.labelGap + label;
}

export interface ArtBox {
  visible: boolean;
  /** The inner plate. */
  plateWidth: number;
  plateHeight: number;
  /** Plate height / 352: the drawing scales by this. */
  scale: number;
  /** The void from the header to the mount. */
  above: number;
  /** The void from the mount to the title. */
  below: number;
}

/**
 * The plate and the two voids for a band of `bandHeight` (header to title,
 * 509 on the base device) with a plate label `label` tall. Null before the
 * first layout gives the base device's 67 / 352 / 56. A taller band keeps
 * the base device's proportions, sharing its free height 67 : 56.
 */
export function artBox(bandHeight: number | null, label: number): ArtBox {
  if (bandHeight === null) {
    return { visible: true, plateWidth: PLATE.width, plateHeight: PLATE.height, scale: 1, above: ABOVE, below: BELOW };
  }
  const chrome = mountChrome(label);
  const mount = Math.max(0, Math.min(PLATE.height + chrome, bandHeight - CLEAR * 2));
  const plateHeight = Math.max(0, mount - chrome);
  const scale = plateHeight / PLATE.height;
  const free = bandHeight - mount;
  let below: number;
  if (free >= ABOVE + BELOW) below = (free * BELOW) / (ABOVE + BELOW);
  // Growth comes out of the gap under the mount first, down to CLEAR.
  else below = Math.max(CLEAR, Math.min(BELOW, free - ABOVE));
  // Then out of the void above it, down to CLEAR; only then does the plate shrink.
  const above = Math.max(CLEAR, free - below);
  return { visible: plateHeight >= PLATE.minHeight, plateWidth: PLATE.width * scale, plateHeight, scale, above, below };
}

export function GuideArt({ layers, clock }: { layers: readonly StepLayer[]; clock: SharedValue<number> }) {
  const { fontScale } = useWindowDimensions();
  const [band, setBand] = useState<number | null>(null);
  // The label slot as laid out; until then, one stamp line at the player's text size.
  const [label, setLabel] = useState<number | null>(null);
  const box = artBox(band, label ?? typeScale.stamp.lineHeight * fontScale);
  return (
    <View
      style={styles.band}
      onLayout={(e) => setBand(e.nativeEvent.layout.height)}
      // The mount, the drawing and the plate label are decorative: the stamp and the text carry the step.
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="guide-art"
    >
      {box.visible ? (
        <>
          <View style={{ height: box.above }} />
          <View style={[styles.mount, { width: box.plateWidth + RIM * 2 }]} testID="guide-mount">
            <View style={[styles.plate, { width: box.plateWidth, height: box.plateHeight }]} testID="guide-plate">
              {layers.map((layer) => (
                <FadeLayer key={layer.step} clock={clock} layer={layer} style={styles.artLayer}>
                  <StepArt step={layer.step} width={ART.width * box.scale} height={ART.height * box.scale} />
                </FadeLayer>
              ))}
              <View style={styles.rim} />
            </View>
            <View style={styles.labelSlot} onLayout={(e) => setLabel(e.nativeEvent.layout.height)}>
              {/* Holds the slot at the widest label's height, so no step's label moves the mount. */}
              <Text variant="stamp" align="center" style={styles.sizer}>
                {LONGEST_LABEL}
              </Text>
              {layers.map((layer) => (
                <FadeLayer key={layer.step} clock={clock} layer={layer} style={styles.labelLayer}>
                  <Text variant="stamp" tone="accent" align="center">
                    {plateLabel(layer.step)}
                  </Text>
                </FadeLayer>
              ))}
            </View>
          </View>
          <View style={{ height: box.below }} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Takes whatever the header and the text block leave: from the header (Close's
  // slop included) to the title, y 111-620 on the base device, measured to size
  // the plate and its voids. Clipped, so the base-size first frame can never
  // overlap large text before the band is measured.
  band: { flex: 1, minHeight: CLEAR, overflow: "hidden" },
  // Width = plate + 2 x (1 edge + 6 walnut); its height follows the plate and the label.
  mount: {
    alignSelf: "center",
    padding: G.mount.pad,
    borderRadius: radius.mount,
    ...curve,
    backgroundColor: color.surface,
    borderWidth: G.hairline,
    borderColor: color.hairline,
  },
  plate: {
    borderRadius: radius.image,
    ...curve,
    overflow: "hidden",
    backgroundColor: color.canvas,
  },
  // The drawing, centred in the plate (12 clear at the sides, 43 above and below at full size).
  artLayer: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  // The plate's 1 pt rim, over the drawing, as the light table's tiles and SceneView's plate.
  rim: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.image,
    ...curve,
    borderWidth: G.hairline,
    borderColor: color.rim,
  },
  labelSlot: { marginTop: G.mount.labelGap },
  sizer: { opacity: 0 },
  labelLayer: { position: "absolute", top: 0, left: 0, right: 0 },
});
