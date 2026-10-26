// A mode's art (art.ts) filling its frame, for home's cards and the mode
// screens' banners: the player's own room baked in the mode's treatment
// (TreatedImage), or the mode's drawn cover (ModeCover) until they have
// photographed one. Decorative: hidden from accessibility.
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { TreatedImage } from "@/components/noir";
import type { Genre } from "@/lib/puzzle-types";
import { ModeCover } from "@/screens/hub/art/ModeCover";
import type { ModeArt } from "./art";

export interface ModeArtImageProps {
  genre: Genre;
  art: ModeArt;
  /** A photo is baked no larger than this on its long edge. */
  maxEdge: number;
  /** Defaults to filling the parent. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function ModeArtImage({ genre, art, maxEdge, style = StyleSheet.absoluteFill, testID }: ModeArtImageProps) {
  if (!art.own) return <ModeCover genre={genre} style={style} testID={testID} />;
  return (
    <TreatedImage
      source={art.source}
      genre={genre}
      cacheKey={art.cacheKey}
      maxEdge={maxEdge}
      contentFit="cover"
      style={style}
      accessible={false}
      testID={testID}
    />
  );
}
