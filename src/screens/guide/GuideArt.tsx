// The illustration band between the header and the text block (docs/DESIGN.md
// 04, Layout: Top void, Light pool, Illustration art box, Gap; States: Large
// text). On 393 x 852 the art box sits at y 266-532 with 151 above and 88
// below. The text block is bottom-anchored, so the 88 gap under the art
// absorbs any growth: the art stays put until that gap is down to
// ref.space.xl, then the void above gives way, then the box shrinks evenly,
// keeping ref.space.xl clear above and below, with the pool radius scaling
// with it. Below a 120 high box both hide.
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { LightPool } from "@/components/noir";
import { ref } from "@/theme/tokens";
import { StepArt } from "./art/StepArt";
import { CLOSE_SLOP } from "./layout";
import { FadeLayer, type StepLayer } from "./stepper";

const ART = ref.layout.guide.art;
const CLEAR = ref.space.xl;
// The voids on the base device. The header already holds CLOSE_SLOP of the
// 151 below Close, so the band's own void above the box is 149.
const ABOVE = ART.above - CLOSE_SLOP;
const BELOW = ART.below;

export interface ArtBox {
  visible: boolean;
  width: number;
  height: number;
  /** Box height / 266: the drawing and the pool radius scale by this. */
  scale: number;
  /** The void from the header to the box. */
  above: number;
  /** The void from the box to the title. */
  below: number;
}

/**
 * The art box and its two voids for a band of `bandHeight`: from the header
 * to the title, 503 on the base device. Null before the first layout gives
 * the base device's 149 / 266 / 88. A taller band keeps the base device's
 * proportions, sharing its free height 149 : 88.
 */
export function artBox(bandHeight: number | null): ArtBox {
  if (bandHeight === null) return { visible: true, width: ART.width, height: ART.height, scale: 1, above: ABOVE, below: BELOW };
  const height = Math.max(0, Math.min(ART.height, bandHeight - CLEAR * 2));
  const scale = height / ART.height;
  const free = bandHeight - height;
  let below: number;
  if (free >= ABOVE + BELOW) below = (free * BELOW) / (ABOVE + BELOW);
  // Growth comes out of the gap under the art first, down to CLEAR.
  else below = Math.max(CLEAR, Math.min(BELOW, free - ABOVE));
  // Then out of the void above it, down to CLEAR; only then does the box shrink.
  const above = Math.max(CLEAR, free - below);
  return { visible: height >= ART.minHeight, width: ART.width * scale, height, scale, above, below };
}

export function GuideArt({ layers, clock }: { layers: readonly StepLayer[]; clock: SharedValue<number> }) {
  const [band, setBand] = useState<number | null>(null);
  const box = artBox(band);
  return (
    <View
      style={styles.band}
      onLayout={(e) => setBand(e.nativeEvent.layout.height)}
      // The pool and the drawing are decorative: the text carries the instruction.
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="guide-art"
    >
      {box.visible ? (
        <>
          <View style={{ height: box.above }} />
          <View style={[styles.box, { width: box.width, height: box.height }]}>
            {/* Static, identical on every step: it never moves or animates. */}
            <LightPool kind="object" cx={box.width / 2} cy={box.height / 2} radius={ref.light.object.radius * box.scale} />
            {layers.map((layer) => (
              <FadeLayer key={layer.step} clock={clock} layer={layer} style={StyleSheet.absoluteFill}>
                <StepArt step={layer.step} width={box.width} height={box.height} />
              </FadeLayer>
            ))}
          </View>
          <View style={{ height: box.below }} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Takes whatever the header and the text block leave: from Close's hit area
  // to the title (y 117-620 on the base device), measured to size the box and
  // its voids. Clipped, so the base-size first frame can never overlap large
  // text before the band is measured.
  band: { flex: 1, minHeight: CLEAR, overflow: "hidden" },
  box: { alignSelf: "center" },
});
