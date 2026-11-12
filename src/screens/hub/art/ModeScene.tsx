// A mode card's cover on home (ModeCard): a small diorama, rendered in Blender
// (scripts/blender/props/home_cards.py -> assets/home/cards/) from one camera
// in three depth layers that slide against each other inside the card's frame
// as the phone tilts (the same tilt as the window behind: parallax/useTilt):
//   back   the wall, and what hangs on it or falls across it
//   mid    the table and what stands on it (two pictures in the one layer:
//          the table, opaque, and what stands up past its far edge)
//   front  the thing nearest us, soft: it slides the other way
// - Detective Noir: a desk at night, streetlight through rain-streaked blinds,
//   a banker's lamp alight, a rocks glass, a case file, a matchbook, a fedora.
// - Crime Scene: the evidence table under the investigation board: pinned
//   photographs and red string, numbered markers, a key, a scale, the magnifier.
// - Paranormal: a seance table: a mirror holding a pale light, candles, a
//   talking board and its planchette, mist.
// The scene covers the card from its top (the table meets the wall where the
// words' plate ends, so what matters shows in the part no card covers) and is
// clipped by the card's face. Each layer has picture to spare past the card
// for its slide (cards.json: `bleed`). Without a tilt it is simply still.
import { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import type { Genre } from "@/lib/puzzle-types";
import { modeThemes } from "@/theme/tokens";
import CARDS from "../../../../assets/home/cards/cards.json";
import { ParallaxLayer } from "../parallax/ParallaxLayer";
import type { TiltValues } from "../parallax/useTilt";
import { SCENE } from "./nook";

const ART = {
  noir: {
    key: "noir",
    back: require("../../../../assets/home/cards/noir-back.jpg") as number,
    table: require("../../../../assets/home/cards/noir-table.jpg") as number,
    mid: require("../../../../assets/home/cards/noir-mid.png") as number,
    front: require("../../../../assets/home/cards/noir-front.png") as number,
  },
  crime_scene: {
    key: "crime",
    back: require("../../../../assets/home/cards/crime-back.jpg") as number,
    table: require("../../../../assets/home/cards/crime-table.jpg") as number,
    mid: require("../../../../assets/home/cards/crime-mid.png") as number,
    front: require("../../../../assets/home/cards/crime-front.png") as number,
  },
  paranormal: {
    key: "moonlit",
    back: require("../../../../assets/home/cards/moonlit-back.jpg") as number,
    table: require("../../../../assets/home/cards/moonlit-table.jpg") as number,
    mid: require("../../../../assets/home/cards/moonlit-mid.png") as number,
    front: require("../../../../assets/home/cards/moonlit-front.png") as number,
  },
} as const;
/** The depth layers, back to front, and the pictures each holds. */
const LAYERS = [
  { depth: "back", pictures: ["back"] },
  { depth: "mid", pictures: ["table", "mid"] },
  { depth: "front", pictures: ["front"] },
] as const;
type Picture = "back" | "table" | "mid" | "front";

/**
 * Where a scene's layer lies in a frame `width` x `height`: the scene's card
 * box (cards.json) scaled to cover the frame, its top on the frame's top,
 * centred across; the layer's own box inside it. Pure.
 */
export function sceneBox(genre: Genre, layer: Picture, width: number, height: number) {
  const [cw, ch] = CARDS.card;
  const k = Math.max(width / cw, height / ch);
  const [x, y, w, h] = CARDS.modes[ART[genre].key][layer];
  return { left: (width - cw * k) / 2 + x * k, top: y * k, width: w * k, height: h * k };
}

export interface ModeSceneProps {
  genre: Genre;
  /** The phone's tilt (home's); without it the scene is still. */
  tilt?: TiltValues;
  /** The frame: size, place, corners. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function ModeScene({ genre, tilt, style, testID }: ModeSceneProps) {
  const theme = modeThemes[genre];
  const [frame, setFrame] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setFrame((f) => (f && f.w === width && f.h === height ? f : { w: width, h: height }));
  };
  return (
    <View
      style={[styles.frame, { backgroundColor: theme.surface }, style]}
      onLayout={onLayout}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      {frame
        ? LAYERS.map(({ depth, pictures }) => {
            const held = pictures.map((name) => (
              <Image key={name} source={ART[genre][name]} style={[styles.layer, sceneBox(genre, name, frame.w, frame.h)]} contentFit="fill" />
            ));
            return tilt ? (
              <ParallaxLayer key={depth} tilt={tilt} depth={SCENE.depth[depth]} style={StyleSheet.absoluteFill} testID={testID ? `${testID}-${depth}` : undefined}>
                {held}
              </ParallaxLayer>
            ) : (
              <View key={depth} style={StyleSheet.absoluteFill} testID={testID ? `${testID}-${depth}` : undefined}>
                {held}
              </View>
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden" },
  layer: { position: "absolute" },
});
