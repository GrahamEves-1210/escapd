// The held items' icons as components (art.ts holds the pictures): each draws
// its thing at a size. They take the same props a phosphor icon does (size,
// weight, color), so anywhere an item's icon was a glyph it can be one of
// these; the colour and weight are ignored, since the art carries its own.
// `lit`: the UV flashlight's lens is on, its beam out.
import { memo, type ComponentType } from "react";
import { Image, StyleSheet, View } from "react-native";
import { ART, type IconName } from "./art";

export interface ItemGlyphProps {
  size?: number;
  /** Accepted for a phosphor icon's call sites; the art has one weight. */
  weight?: string;
  /** Accepted for a phosphor icon's call sites; the art keeps its own colours. */
  color?: string;
  /** In use (the UV flashlight switched on): its lit picture. */
  lit?: boolean;
}

export type ItemGlyph = ComponentType<ItemGlyphProps>;

function make(name: IconName, litName?: IconName): ItemGlyph {
  const Glyph = memo(function ItemIcon({ size = 32, lit = false }: ItemGlyphProps) {
    const box = { width: size, height: size };
    return (
      <View style={box} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
        <Image source={ART[name]} style={[box, lit && litName ? styles.hidden : null]} resizeMode="contain" fadeDuration={0} />
        {/* Its lit picture is kept mounted under the unlit one, so switching on never waits on a load. */}
        {litName ? <Image source={ART[litName]} style={[box, styles.over, lit ? null : styles.hidden]} resizeMode="contain" fadeDuration={0} /> : null}
      </View>
    );
  });
  Glyph.displayName = `ItemIcon(${name})`;
  return Glyph;
}

/** The set, by what each one is. */
export const ItemIcons = {
  key: make("key"),
  note: make("note"),
  letter: make("letter"),
  tornLeft: make("tornLeft"),
  tornRight: make("tornRight"),
  taped: make("taped"),
  uvLight: make("uvLight", "uvLightOn"),
  torch: make("torch"),
  photo: make("photo"),
  ticket: make("ticket"),
  map: make("map"),
  scroll: make("scroll"),
  ring: make("ring"),
  book: make("book"),
  coin: make("coin"),
  matchbook: make("matchbook"),
  wheel: make("wheel"),
  box: make("box"),
  bottle: make("bottle"),
  watch: make("watch"),
  pencil: make("pencil"),
  lens: make("lens"),
  notepad: make("notepad"),
  printed: make("printed"),
  foldIn: make("foldIn"),
} satisfies Record<string, ItemGlyph>;

/** What an icon in the tray draws at, as a share of its tile (each picture is its thing edge to edge, less a hair for its line). */
export const ICON_FILL = 0.76;

const styles = StyleSheet.create({
  over: { position: "absolute", left: 0, top: 0 },
  hidden: { opacity: 0 },
});
