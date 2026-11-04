// The held items' icons as components (art.ts holds the drawings): each draws
// its sticker at a size, in the set's own warm palette. They take the same
// props a phosphor icon does (size, weight, color), so anywhere an item's icon
// was a glyph it can be one of these; the colour and weight are ignored, since
// the art carries its own. `lit`: the UV flashlight's lens is on, its beam out.
import { memo, type ComponentType, type ReactNode } from "react";
import { View } from "react-native";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";
import { ART, INK, LINE, type IconName, type Shape } from "./art";

export interface ItemGlyphProps {
  size?: number;
  /** Accepted for a phosphor icon's call sites; the art has one weight. */
  weight?: string;
  /** Accepted for a phosphor icon's call sites; the art keeps its own colours. */
  color?: string;
  /** In use (the UV flashlight switched on): its lit drawing. */
  lit?: boolean;
}

export type ItemGlyph = ComponentType<ItemGlyphProps>;

type Paint = { fill?: string; stroke?: string; strokeWidth?: number; opacity?: number; strokeDasharray?: string; transform?: string };

function shapeEl(s: Exclude<Shape, { t: "g" }>, key: string, paint: Paint) {
  const p = {
    fill: paint.fill ?? "none",
    stroke: paint.stroke,
    strokeWidth: paint.strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeDasharray: paint.strokeDasharray,
    opacity: paint.opacity,
    transform: paint.transform,
  };
  switch (s.t) {
    case "path": return <Path key={key} {...p} d={s.d} fillRule={s.evenodd ? "evenodd" : "nonzero"} />;
    case "circle": return <Circle key={key} {...p} cx={s.cx} cy={s.cy} r={s.r} />;
    case "ellipse": return <Ellipse key={key} {...p} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} />;
    case "rect": return <Rect key={key} {...p} x={s.x} y={s.y} width={s.width} height={s.height} rx={s.rx ?? 0} />;
  }
}

/** One shape: its fill (and plain stroke), then the ink line over it, gone over twice like the cat's. */
function draw(s: Shape, key: string): ReactNode {
  if (s.t === "g") {
    return <G key={key} transform={s.transform} opacity={s.o}>{s.children.map((c, i) => draw(c, `${key}.${i}`))}</G>;
  }
  const out = [shapeEl(s, `${key}f`, { fill: s.fill, stroke: s.stroke, strokeWidth: s.stroke ? s.w ?? 1.1 : undefined, opacity: s.o, strokeDasharray: s.dash })];
  if (s.ink) {
    const w = s.w ?? LINE;
    out.push(shapeEl(s, `${key}i`, { stroke: INK, strokeWidth: w }));
    out.push(shapeEl(s, `${key}j`, { stroke: INK, strokeWidth: w * 0.45, opacity: 0.55, transform: "translate(0.6 -0.4)" }));
  }
  return out;
}

function make(name: IconName, litName?: IconName): ItemGlyph {
  const Glyph = memo(function ItemIcon({ size = 32, lit = false }: ItemGlyphProps) {
    const shapes = ART[lit && litName ? litName : name];
    return (
      <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
        <Svg width={size} height={size} viewBox="0 0 48 48">
          {shapes.map((s, i) => draw(s, String(i)))}
        </Svg>
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
} satisfies Record<string, ItemGlyph>;

/** What an icon in the tray draws at, as a share of its tile (the art leaves its own margin in its grid). */
export const ICON_FILL = 0.8;
