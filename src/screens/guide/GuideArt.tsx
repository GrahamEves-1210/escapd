// The illustration band between the close button and the text block (docs/
// DESIGN.md 04, Layout: Illustration; States: Large text). The drawing floats
// alone on the black ground, as in the reference: no mount, frame or glow. On
// 393 x 852 its 240 x 266 box sits at y 266-532, 147 below the disc and 81
// above a one-line title. The text block is bottom-anchored, so growth comes
// out of the void under the drawing first, down to `clear`; then out of the
// void above it, down to `clear`; then the drawing shrinks evenly. Below
// art.minHeight it hides. Only the drawing crossfades with the step.
import { useId, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useModeTheme } from "@/game/mode";
import { ref } from "@/theme/tokens";
import { GLOW, NOTE, NOTES } from "./art/look";
import { StepArt } from "./art/StepArt";
import { FadeLayer, type StepLayer } from "./stepper";

const G = ref.layout.guide;
const ART = G.art;
const { above: ABOVE, below: BELOW, clear: CLEAR } = G.voids;

export interface ArtBox {
  visible: boolean;
  /** The art box's height / 266: the drawing scales by this. */
  scale: number;
  /** The void from the disc to the drawing. */
  above: number;
  /** The void from the drawing to the title. */
  below: number;
}

/**
 * The drawing's scale and its two voids in a band `bandHeight` tall (disc to
 * title, 494 on the base device). Null before the first layout gives the base
 * device's 147 / 266 / 81. A taller band keeps the base device's proportions.
 */
export function artBox(bandHeight: number | null): ArtBox {
  if (bandHeight === null) return { visible: true, scale: 1, above: ABOVE, below: BELOW };
  const art = Math.max(0, Math.min(ART.height, bandHeight - CLEAR * 2));
  const scale = art / ART.height;
  const free = bandHeight - art;
  let below: number;
  if (free >= ABOVE + BELOW) below = (free * BELOW) / (ABOVE + BELOW);
  // Growth comes out of the void under the drawing first, down to CLEAR.
  else below = Math.max(CLEAR, Math.min(BELOW, free - ABOVE));
  // Then out of the void above it, down to CLEAR; only then does the drawing shrink.
  const above = Math.max(CLEAR, free - below);
  return { visible: art >= ART.minHeight, scale, above, below };
}

export function GuideArt({ layers, clock }: { layers: readonly StepLayer[]; clock: SharedValue<number> }) {
  const [band, setBand] = useState<number | null>(null);
  const box = artBox(band);
  const theme = useModeTheme();
  const id = `glow${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  return (
    <View
      style={styles.band}
      onLayout={(e) => setBand(e.nativeEvent.layout.height)}
      // Decorative: the title and body carry the step, the step button's hint its number.
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="guide-art"
    >
      {box.visible ? (
        <>
          <View style={{ height: box.above }} />
          <View style={[styles.box, { width: ART.width * box.scale, height: ART.height * box.scale }]} testID="guide-art-box">
            {/* A soft pool of lamplight behind the drawing, in the theme's glow. */}
            <Svg style={styles.glow} width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none" testID="guide-art-glow">
              <Defs>
                <RadialGradient id={id} cx={0.5} cy={0.5} r={GLOW.r / 2} fx={0.5} fy={0.5}>
                  {GLOW.stops.map((s) => (
                    <Stop key={s.offset} offset={s.offset} stopColor={theme.glow} stopOpacity={s.opacity} />
                  ))}
                </RadialGradient>
              </Defs>
              <Rect x={0} y={0} width={1} height={1} fill={`url(#${id})`} />
            </Svg>
            {layers.map((layer) => (
              <FadeLayer key={layer.step} clock={clock} layer={layer} style={StyleSheet.absoluteFill}>
                <StepArt step={layer.step} width={ART.width * box.scale} height={ART.height * box.scale} />
                <Text style={[theme.hand, styles.note, { color: theme.sweet }]} testID={`guide-note-${layer.step + 1}`}>
                  {NOTES[layer.step]}
                </Text>
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
  // Takes whatever the disc and the text block leave (y 119-613 on the base
  // device), measured to size the drawing and its voids. Clipped, so the
  // base-size first frame can never overlap large text before it is measured.
  band: { flex: 1, minHeight: CLEAR, overflow: "hidden" },
  // Centred on the screen, as the reference's art box.
  box: { alignSelf: "center" },
  // The glow spills past the drawing's box on every side.
  glow: { position: "absolute", top: "-30%", left: "-60%", width: "220%", height: "160%" },
  note: {
    position: "absolute",
    top: NOTE.top,
    right: NOTE.right,
    maxWidth: NOTE.maxWidth,
    fontSize: NOTE.fontSize,
    lineHeight: NOTE.lineHeight,
    textAlign: "right",
    transform: [{ rotate: NOTE.turn }],
  },
});
