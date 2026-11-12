// A key, or a bar of soap with a key pressed into it, put together from slices of its four renders
// (gadgets/keys.ts): any bitting, no new pictures.
import { memo } from "react";
import { PixelRatio, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { hidden } from "../materials";
import { Sprite } from "../sprites";
import { KEY, SOAP, keySlices, sayBitting, soapSlices, type KeySlice } from "./keys";
import { GADGET } from "./sprites";

/**
 * Slices of a picture `w` x `h` points shown `k` times its size, each a window on the render of its depth.
 * Laid out at their shown size on whole pixels (never scaled by a transform, whose soft edges would show
 * as hairlines between them), and lapped half a point: between two cuts every render is the same uncut
 * edge for more than that, so a lap shows nothing.
 */
function Sliced({ slices, sources, w, h, k = 1 }: { slices: KeySlice[]; sources: readonly number[]; w: number; h: number; k?: number }) {
  const px = (v: number) => PixelRatio.roundToNearestPixel(v * k);
  return (
    <>
      {slices.map((s, i) => {
        const left = px(s.x) - (i ? LAP : 0);
        const right = px(s.x + s.w) + (i < slices.length - 1 ? LAP : 0);
        return (
          <View key={i} style={[styles.window, { left, width: right - left, height: h * k }]}>
            <Sprite source={sources[s.depth]} w={w * k} h={h * k} style={{ position: "absolute", left: -left, top: 0 }} />
          </View>
        );
      })}
    </>
  );
}
const LAP = 0.5;

/** A brass key lying bow left, blade right, cut to `bitting`. KEY.w x KEY.h points. */
export const KeyArt = memo(function KeyArt({ bitting }: { bitting: string }) {
  return (
    <View style={styles.key} pointerEvents="none" {...hidden}>
      <Sliced slices={keySlices(bitting)} sources={GADGET.key} w={KEY.w} h={KEY.h} />
    </View>
  );
});

/**
 * A bar of soap with a key pressed into it: the clue to which key on a ring is the right one. The pressing is
 * the key's mirror image (bow right). Drawn, never written: only a screen reader is told the cuts.
 */
export const KeyImpression = memo(function KeyImpression({ bitting, width = SOAP.w, style }: { bitting: string; width?: number; style?: StyleProp<ViewStyle> }) {
  const k = width / SOAP.w;
  return (
    <View
      style={[{ width, height: SOAP.h * k }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`A bar of soap with a key pressed into it. ${sayBitting(bitting)}`}
      testID="key-impression"
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Sliced slices={soapSlices(bitting)} sources={GADGET.soap} w={SOAP.w} h={SOAP.h} k={k} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  window: { position: "absolute", top: 0, overflow: "hidden" },
  key: { width: KEY.w, height: KEY.h },
});
