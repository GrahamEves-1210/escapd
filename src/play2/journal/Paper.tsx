// Paper things for the casebook, her annotated reading journal: torn scraps
// and notes, washi tape, a deckled page edge, a bookmark ribbon, sticky tabs,
// and the ornamental rule (a fleuron) between chapters. Drawn with small SVGs
// that stretch to whatever they edge, so nothing needs measuring.
import { memo, useId, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { rand } from "./palette";

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" as const, pointerEvents: "none" as const };

/** A torn edge as a strip `height` tall, filled `color`, its teeth pointing up (top) or down (bottom). */
export const TornEdge = memo(function TornEdge({ color, side, seed, height = 6, teeth = 34 }: { color: string; side: "top" | "bottom"; seed: string; height?: number; teeth?: number }) {
  const pts: string[] = [];
  for (let i = 0; i <= teeth; i++) {
    const x = (100 * i) / teeth;
    const y = (i % 2 ? 0.15 : 0.55) * height + rand(seed, i) * 0.35 * height;
    pts.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  const d = `M0 ${height} L${pts.join(" L")} L100 ${height} Z`;
  return (
    <View style={[styles.edge, { height }, side === "bottom" && styles.flip]} {...hidden}>
      <Svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
        <Path d={d} fill={color} />
      </Svg>
    </View>
  );
});

export interface ScrapProps {
  color: string;
  seed: string;
  /** Which edges are torn (the rest are cut straight). */
  torn?: { top?: boolean; bottom?: boolean };
  /** Degrees. */
  rotate?: number;
  /** Ruled lines across the scrap (a notebook page), in this colour. */
  ruled?: string;
  /** A soft shadow tinted by the mode's ground. */
  shadow?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
  /** Laid over the scrap (tape, a clip), outside its padding. */
  overlay?: ReactNode;
  testID?: string;
}

/** A piece of paper: torn or cut edges, maybe ruled, a soft shadow, a slight tilt. */
export function Scrap({ color, seed, torn = {}, rotate = 0, ruled, shadow, style, contentStyle, children, overlay, testID }: ScrapProps) {
  return (
    <View style={[rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null, shadow ? softShadow(shadow) : null, style]} testID={testID}>
      {torn.top ? <TornEdge color={color} side="top" seed={`${seed}t`} /> : null}
      <View style={[styles.body, { backgroundColor: color }, !torn.top && styles.cutTop, !torn.bottom && styles.cutBottom, contentStyle]}>
        {ruled ? <Rules color={ruled} /> : null}
        {children}
      </View>
      {torn.bottom ? <TornEdge color={color} side="bottom" seed={`${seed}b`} /> : null}
      {overlay}
    </View>
  );
}

/** A soft shadow coloured by the ground (never black), as the art direction asks. */
export function softShadow(color: string): ViewStyle {
  return { shadowColor: color, shadowOpacity: 0.32, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } };
}

/** Faint ruled lines every `gap` points, behind a scrap's writing. */
export const Rules = memo(function Rules({ color, gap = 24, top = 30 }: { color: string; gap?: number; top?: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.rules, { paddingTop: top }]} {...hidden}>
      {Array.from({ length: 80 }, (_, i) => (
        <View key={i} style={[styles.rule, { backgroundColor: color, marginBottom: gap - 1 }]} />
      ))}
    </View>
  );
});

export type TapeStyle = "stripes" | "dots" | "plain";

/** A strip of washi tape, its ends torn, a little see-through. */
export const Tape = memo(function Tape({ color, width = 70, height = 20, rotate = 0, pattern = "stripes", style }: { color: string; width?: number; height?: number; rotate?: number; pattern?: TapeStyle; style?: StyleProp<ViewStyle> }) {
  // Torn ends: a zigzag down the left, back up the right.
  const left = Array.from({ length: 6 }, (_, i) => `${i % 2 ? 2.4 : 0} ${(height * i) / 5}`);
  const right = Array.from({ length: 6 }, (_, i) => `${width - (i % 2 ? 2.4 : 0)} ${(height * (5 - i)) / 5}`);
  const d = `M${left.join(" L")} L${right.join(" L")} Z`;
  return (
    <View style={[{ width, height }, rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null, style]} {...hidden}>
      <Svg width={width} height={height}>
        <Path d={d} fill={color} opacity={0.82} />
        {pattern === "stripes"
          ? Array.from({ length: Math.ceil(width / 9) }, (_, i) => (
            <Path key={i} d={`M${i * 9 + 2} ${height} L${i * 9 + 9} 0`} stroke="rgba(255,255,255,0.45)" strokeWidth={2.4} />
          ))
          : pattern === "dots"
            ? Array.from({ length: Math.floor(width / 10) }, (_, i) => (
              <Circle key={i} cx={6 + i * 10} cy={i % 2 ? height * 0.32 : height * 0.68} r={1.7} fill="rgba(255,255,255,0.7)" />
            ))
            : null}
        <Path d={`M3 1.5 L${width - 3} 1.5`} stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
      </Svg>
    </View>
  );
});

/** A foil sheen as an SVG gradient fill (decoration only). */
function FoilGradient({ id, foil }: { id: string; foil: readonly [string, string, string] }) {
  return (
    <Defs>
      <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={foil[1]} />
        <Stop offset="0.45" stopColor={foil[0]} />
        <Stop offset="0.6" stopColor={foil[1]} />
        <Stop offset="1" stopColor={foil[2]} />
      </LinearGradient>
    </Defs>
  );
}

/** An ornamental rule: two hairlines and a foil fleuron (a heart-leaf between curls) in the middle. */
export const Fleuron = memo(function Fleuron({ foil, ink, width = 200, style }: { foil: readonly [string, string, string]; ink: string; width?: number; style?: StyleProp<ViewStyle> }) {
  const id = `foil${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const mid = width / 2;
  return (
    <View style={[{ width, height: 22, alignSelf: "center" }, style]} {...hidden}>
      <Svg width={width} height={22}>
        <FoilGradient id={id} foil={foil} />
        <Path d={`M4 11 L${mid - 30} 11 M${mid + 30} 11 L${width - 4} 11`} stroke={ink} strokeWidth={0.8} opacity={0.45} />
        <Path d={`M${mid - 26} 11 C${mid - 22} 4 ${mid - 14} 5 ${mid - 15} 10 C${mid - 16} 13 ${mid - 20} 12 ${mid - 19} 9`} stroke={`url(#${id})`} strokeWidth={1.5} fill="none" strokeLinecap="round" />
        <Path d={`M${mid + 26} 11 C${mid + 22} 4 ${mid + 14} 5 ${mid + 15} 10 C${mid + 16} 13 ${mid + 20} 12 ${mid + 19} 9`} stroke={`url(#${id})`} strokeWidth={1.5} fill="none" strokeLinecap="round" />
        <Path
          d={`M${mid} 18.5 C${mid - 7} 14 ${mid - 9} 9 ${mid - 6} 5.5 C${mid - 3.5} 3 ${mid - 0.8} 4.5 ${mid} 7 C${mid + 0.8} 4.5 ${mid + 3.5} 3 ${mid + 6} 5.5 C${mid + 9} 9 ${mid + 7} 14 ${mid} 18.5 Z`}
          fill={`url(#${id})`}
          stroke={foil[2]}
          strokeWidth={0.6}
        />
        <Circle cx={mid - 11} cy={11} r={1.3} fill={`url(#${id})`} />
        <Circle cx={mid + 11} cy={11} r={1.3} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
});

/** A satin bookmark ribbon hanging from the page's top edge, its end cut in a V. */
export const Ribbon = memo(function Ribbon({ color, length = 92, width = 18, style }: { color: string; length?: number; width?: number; style?: StyleProp<ViewStyle> }) {
  const notch = width * 0.55;
  return (
    <View style={[{ width, height: length }, style]} {...hidden}>
      <Svg width={width} height={length}>
        <Path d={`M0 0 L${width} 0 L${width} ${length} L${width / 2} ${length - notch} L0 ${length} Z`} fill={color} />
        <Path d={`M${width * 0.28} 0 L${width * 0.28} ${length - notch * 0.7}`} stroke="rgba(255,255,255,0.22)" strokeWidth={1.4} />
        <Path d={`M0 0 L${width} 0 L${width} 7 L0 7 Z`} fill="rgba(0,0,0,0.18)" />
      </Svg>
    </View>
  );
});

/** A sticky tab peeking out past the page's right edge (a chapter's marker). */
export const StickyTab = memo(function StickyTab({ color, top, style }: { color: string; top: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.tab, { top, backgroundColor: color }, style]} {...hidden}>
      <View style={styles.tabShine} />
    </View>
  );
});

const styles = StyleSheet.create({
  edge: { width: "100%" },
  flip: { transform: [{ scaleY: -1 }] },
  body: { overflow: "hidden" },
  cutTop: { borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  cutBottom: { borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  rules: { overflow: "hidden" },
  rule: { height: 1, marginHorizontal: 0 },
  tab: { position: "absolute", right: -14, width: 24, height: 30, borderTopRightRadius: 5, borderBottomRightRadius: 5, opacity: 0.92 },
  tabShine: { position: "absolute", left: 0, right: 0, top: 4, height: 3, backgroundColor: "rgba(255,255,255,0.35)" },
});
