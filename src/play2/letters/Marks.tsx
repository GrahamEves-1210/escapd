// The things on and around the letters (src/play2/letters), drawn in SVG in
// the same hand: a paper clip, a lipstick blot, a rubber stamp that didn't
// take evenly, a wax seal broken in two (and whole), a pressed sprig of
// lavender, a candle's wax drips, a cat's inky paw prints, punched holes, an
// evidence envelope's string-and-button tie. Every imperfection is seeded
// (paper.ts, rng), so the same case keeps the same marks. None of them is
// read aloud: they are hidden from the screen reader.
import { useState, type ReactNode } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { alpha } from "@/theme/payoff";
import { rng } from "./paper";

/** An id for an SVG def from a seed (letters and digits only: a space or a dot breaks url(#id)). */
const svgId = (prefix: string, seed: string) => `${prefix}${seed.replace(/[^A-Za-z0-9]/g, "")}`;

const LIGHT_SHEEN = "#FFFFFF";

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" as const };

/** A mark laid at `style`'s place, never in the way of a touch, never read. */
function Mark({ style, children, width, height, rotate = 0 }: { style?: StyleProp<ViewStyle>; children: ReactNode; width: number; height: number; rotate?: number }) {
  return (
    <View pointerEvents="none" {...hidden} style={[{ width, height, transform: [{ rotate: `${rotate}deg` }] }, style]}>
      {children}
    </View>
  );
}

/** A paper clip in one bent wire, with its sheen and a little shadow. */
export function PaperClip({ color, size = 64, rotate = 0, style }: { color: string; size?: number; rotate?: number; style?: StyleProp<ViewStyle> }) {
  const d = "M8 22 V50 a4.5 4.5 0 0 0 9 0 V12 a7 7 0 0 0 -14 0 V52 a10 10 0 0 0 20 0 V20";
  return (
    <Mark style={style} width={(size * 26) / 66} height={size} rotate={rotate}>
      <Svg width="100%" height="100%" viewBox="0 0 26 66" fill="none">
        <Path d={d} transform="translate(1.2 1.8)" stroke={alpha("#000000", 0.22)} strokeWidth={2.6} strokeLinecap="round" />
        <Path d={d} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
        <Path d={d} transform="translate(-0.5 -0.4)" stroke={alpha("#FFFFFF", 0.55)} strokeWidth={0.8} strokeLinecap="round" strokeDasharray="10 7" />
      </Svg>
    </Mark>
  );
}

/** A lipstick blot: a kiss pressed on the paper, its lip creases where the colour didn't take. */
export function Kiss({ color, paper, width = 64, rotate = -8, seed, style }: { color: string; paper: string; width?: number; rotate?: number; seed: string; style?: StyleProp<ViewStyle> }) {
  const r = rng(`${seed}:kiss`);
  const upper = "M2 20 C10 11 19 5 26 10 C29 7 35 7 38 10 C45 5 54 11 62 20 C51 21 41 18.5 32 20.5 C23 18.5 13 21 2 20 Z";
  const lower = "M4 21.5 C14 23.5 24 22.5 32 23.5 C40 22.5 50 23.5 60 21.5 C54 33 43 38 32 38 C21 38 10 33 4 21.5 Z";
  const creases = Array.from({ length: 16 }, (_, i) => {
    const x = 8 + i * 3.1 + r() * 1.4;
    const upperLip = i % 2 === 0;
    const y0 = upperLip ? 11 + Math.abs(x - 32) * 0.12 + r() * 2 : 24 + r() * 2;
    const y1 = upperLip ? y0 + 4 + r() * 4 : y0 + 5 + r() * 7;
    return `M${x.toFixed(1)} ${y0.toFixed(1)} Q${(x + (r() - 0.5) * 2).toFixed(1)} ${((y0 + y1) / 2).toFixed(1)} ${(x + (r() - 0.5) * 1.5).toFixed(1)} ${y1.toFixed(1)}`;
  });
  const specks = Array.from({ length: 10 }, () => ({ x: 6 + r() * 52, y: 12 + r() * 24, r: 0.4 + r() * 0.9 }));
  return (
    <Mark style={style} width={width} height={(width * 40) / 64} rotate={rotate}>
      <Svg width="100%" height="100%" viewBox="0 0 64 40">
        <Path d={upper} fill={color} fillOpacity={0.8} />
        <Path d={lower} fill={color} fillOpacity={0.88} />
        {creases.map((c, i) => <Path key={i} d={c} stroke={paper} strokeOpacity={0.75} strokeWidth={0.75} fill="none" strokeLinecap="round" />)}
        {specks.map((s, i) => <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={paper} fillOpacity={0.8} />)}
      </Svg>
    </Mark>
  );
}

/**
 * A rubber stamp, pressed by hand: its word in a ruled box, the ink heavier
 * on one side than the other, flecks where the rubber didn't touch.
 */
export function RubberStamp({ text, color, paper, rotate = -7, seed, type, style, testID, accessible = false }: {
  text: string;
  color: string;
  paper: string;
  rotate?: number;
  seed: string;
  type: TextStyle;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Read aloud (the stamp says something the page needs). */
  accessible?: boolean;
}) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!box || Math.abs(box.w - width) > 0.5) setBox({ w: width, h: height });
  };
  const r = rng(`${seed}:stamp`);
  const flecks = box ? Array.from({ length: Math.round((box.w * box.h) / 55) }, () => ({ x: r() * box.w, y: r() * box.h, rx: 0.4 + r() * r() * 2.2, ry: 0.3 + r() * 1 })) : [];
  const scuffs = box ? Array.from({ length: 3 }, () => { const y = r() * box.h; return `M${(r() * box.w * 0.3).toFixed(1)} ${y.toFixed(1)} L${(box.w * (0.5 + r() * 0.5)).toFixed(1)} ${(y + (r() - 0.5) * 6).toFixed(1)}`; }) : [];
  return (
    <View
      style={[styles.stamp, { borderColor: color, transform: [{ rotate: `${rotate}deg` }] }, style]}
      onLayout={onLayout}
      testID={testID}
      pointerEvents="none"
      {...(accessible ? { accessible: true, accessibilityLabel: text } : hidden)}
    >
      <View style={[styles.stampInner, { borderColor: color }]}>
        <Text style={[type, { color }]}>{text}</Text>
      </View>
      {box ? (
        <View style={StyleSheet.absoluteFill} {...hidden}>
          <Svg width={box.w} height={box.h}>
            <Defs>
              <LinearGradient id={svgId("press", seed)} x1="0" y1="0" x2="1" y2="0.3">
                <Stop offset={0} stopColor={paper} stopOpacity={0} />
                <Stop offset={0.55} stopColor={paper} stopOpacity={0.05} />
                <Stop offset={1} stopColor={paper} stopOpacity={0.5} />
              </LinearGradient>
            </Defs>
            <Rect x={-4} y={-4} width={box.w + 8} height={box.h + 8} fill={`url(#${svgId("press", seed)})`} />
            {flecks.map((k, i) => <Ellipse key={i} cx={k.x} cy={k.y} rx={k.rx} ry={k.ry} fill={paper} fillOpacity={0.85} />)}
            {scuffs.map((s, i) => <Path key={i} d={s} stroke={paper} strokeOpacity={0.6} strokeWidth={0.9} />)}
          </Svg>
        </View>
      ) : null}
    </View>
  );
}

/** A seal's irregular rim: a circle pushed out in soft bumps where the wax spread. */
function sealRim(c: number, radius: number, r: () => number): string {
  const n = 22;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = radius * (0.92 + r() * 0.14);
    return [c + Math.cos(a) * k, c + Math.sin(a) * k];
  });
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[(i + 1) % n];
    const [x0, y0] = pts[i];
    d += ` Q${x0.toFixed(1)} ${y0.toFixed(1)} ${((x0 + x1) / 2).toFixed(1)} ${((y0 + y1) / 2).toFixed(1)}`;
  }
  return `${d} Z`;
}

/** A crescent moon with a star: the seal's device. */
const crescent = (c: number, s: number) =>
  `M${c + s * 0.1} ${c - s} A${s} ${s} 0 1 0 ${c + s * 0.95} ${c + s * 0.45} A${s * 0.78} ${s * 0.78} 0 1 1 ${c + s * 0.1} ${c - s} Z`;

/**
 * A wax seal with a crescent moon pressed in it. `broken`: snapped in two
 * along a jagged crack (the letter was opened), the halves pulled apart.
 */
export function WaxSeal({ wax, light, deep, size = 64, broken = false, rotate = 0, seed, style }: {
  wax: string;
  light: string;
  deep: string;
  size?: number;
  broken?: boolean;
  rotate?: number;
  seed: string;
  style?: StyleProp<ViewStyle>;
}) {
  const r = rng(`${seed}:seal`);
  const V = 72;
  const c = V / 2;
  const rim = sealRim(c, 30, r);
  // The crack: from the top edge to the bottom, wandering.
  const xs = Array.from({ length: 7 }, (_, i) => [c - 6 + i * 2 + (r() - 0.5) * 9, (i / 6) * V] as const);
  const crack = xs.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L");
  const left = `M-2 -2 L${crack} L-2 ${V + 2} Z`;
  const right = `M${V + 2} -2 L${crack} L${V + 2} ${V + 2} Z`;
  const body = (
    <G>
      <Path d={rim} transform="translate(1.5 2.5)" fill={alpha("#000000", 0.28)} />
      <Path d={rim} fill={wax} />
      {/* The wax's pooled lip, darker where it thickened at the edge. */}
      <Path d={rim} fill="none" stroke={deep} strokeOpacity={0.55} strokeWidth={2.2} />
      {/* The seal's pressed face: a sunk disc, its raised ring lit on the upper left and shaded on the lower right. */}
      <Circle cx={c} cy={c} r={20} fill={deep} fillOpacity={0.4} />
      <Path d={`M${c - 20} ${c} A20 20 0 0 1 ${c} ${c - 20}`} stroke={light} strokeOpacity={0.85} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <Path d={`M${c + 20} ${c} A20 20 0 0 1 ${c} ${c + 20}`} stroke={deep} strokeOpacity={0.9} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <Circle cx={c} cy={c} r={16} stroke={light} strokeOpacity={0.4} strokeWidth={0.8} fill="none" />
      {/* The moon in relief: its shadow, its face, its lit edge. */}
      <Path d={crescent(c - 1, 11)} fill={deep} transform="translate(1 1.2)" />
      <Path d={crescent(c - 2, 11)} fill={wax} />
      <Path d={crescent(c - 2, 11)} fill="none" stroke={light} strokeOpacity={0.9} strokeWidth={1.1} />
      <Path d={`M${c + 10} ${c - 10} l1.2 2.8 2.8 1.2 -2.8 1.2 -1.2 2.8 -1.2 -2.8 -2.8 -1.2 2.8 -1.2 Z`} fill={light} />
      {/* Wax's sheen on its upper left. */}
      <Path d={`M${c - 25} ${c - 8} A26 26 0 0 1 ${c - 6} ${c - 27}`} stroke={LIGHT_SHEEN} strokeOpacity={0.55} strokeWidth={2.2} strokeLinecap="round" fill="none" />
    </G>
  );
  return (
    <Mark style={style} width={size} height={size} rotate={rotate}>
      <Svg width="100%" height="100%" viewBox={`-6 -6 ${V + 12} ${V + 12}`}>
        {broken ? (
          <>
            <Defs>
              <ClipPath id={svgId("sealL", seed)}><Path d={left} /></ClipPath>
              <ClipPath id={svgId("sealR", seed)}><Path d={right} /></ClipPath>
            </Defs>
            <G transform="translate(-3.5 -1) rotate(-5 36 36)"><G clipPath={`url(#${svgId("sealL", seed)})`}>{body}</G></G>
            <G transform="translate(3.5 2) rotate(4 36 36)"><G clipPath={`url(#${svgId("sealR", seed)})`}>{body}</G></G>
          </>
        ) : body}
      </Svg>
    </Mark>
  );
}

/** A sprig of lavender, pressed flat in the letter and faded: a stem, two leaves, buds up its top half. */
export function Sprig({ flower, stem, width = 70, rotate = 0, seed, style }: { flower: string; stem: string; width?: number; rotate?: number; seed: string; style?: StyleProp<ViewStyle> }) {
  const r = rng(`${seed}:sprig`);
  // The stem: a gentle curve, bottom left to top right, in a 70 x 140 box.
  const at = (t: number) => {
    const x = 10 + 46 * t + 10 * Math.sin(t * Math.PI) * 0.6;
    const y = 136 - 128 * t;
    return [x, y] as const;
  };
  const buds = Array.from({ length: 22 }, (_, i) => {
    const t = 0.5 + (i / 22) * 0.5;
    const [x, y] = at(t);
    const side = i % 2 ? 1 : -1;
    const brown = r() < 0.2;
    return { x: x + side * (2 + r() * 2.5), y: y + (r() - 0.5) * 2, rx: 2 + r() * 1.4 - t * 0.6, ry: 3.4 + r() * 1.5 - t, a: -30 * side + (r() - 0.5) * 20, c: brown ? "#8A6A72" : flower, o: 0.6 + r() * 0.35 };
  });
  const [x0, y0] = at(0);
  const [xm, ym] = at(0.5);
  const [x1, y1] = at(1);
  return (
    <Mark style={style} width={width} height={width * 2} rotate={rotate}>
      <Svg width="100%" height="100%" viewBox="0 0 70 140">
        <Path d={`M${x0} ${y0} Q${xm - 6} ${ym + 8} ${x1} ${y1}`} stroke={stem} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        <Path d={`M${x0 + 8} ${y0 - 18} q-14 -10 -12 -30 q8 14 12 30 Z`} fill={stem} fillOpacity={0.75} />
        <Path d={`M${x0 + 14} ${y0 - 34} q16 -8 18 -28 q-10 12 -18 28 Z`} fill={stem} fillOpacity={0.6} />
        {buds.map((b, i) => (
          <Ellipse key={i} cx={b.x} cy={b.y} rx={Math.max(1.2, b.rx)} ry={Math.max(2, b.ry)} fill={b.c} fillOpacity={b.o} transform={`rotate(${b.a.toFixed(0)} ${b.x.toFixed(1)} ${b.y.toFixed(1)})`} />
        ))}
      </Svg>
    </Mark>
  );
}

/** A drop of candle wax fallen on the paper: a pale translucent splash, its rim catching the light. */
export function WaxDrop({ color, size = 30, seed, style }: { color: string; size?: number; seed: string; style?: StyleProp<ViewStyle> }) {
  const r = rng(`${seed}:drop`);
  const rim = sealRim(20, 13, r);
  const splash = Array.from({ length: 3 }, () => ({ a: r() * Math.PI * 2, d: 16 + r() * 4, s: 1 + r() * 1.6 }));
  return (
    <Mark style={style} width={size} height={size}>
      <Svg width="100%" height="100%" viewBox="0 0 40 40">
        <Path d={rim} fill={color} fillOpacity={0.72} stroke={alpha("#6A5A40", 0.25)} strokeWidth={0.8} />
        <Path d={rim} transform="translate(4 4) scale(0.8)" fill={alpha("#FFFFFF", 0.35)} />
        <Path d="M12 14 Q16 9 23 10" stroke={alpha("#FFFFFF", 0.85)} strokeWidth={1.6} strokeLinecap="round" fill="none" />
        {splash.map((k, i) => <Circle key={i} cx={20 + Math.cos(k.a) * k.d} cy={20 + Math.sin(k.a) * k.d} r={k.s} fill={color} fillOpacity={0.75} />)}
      </Svg>
    </Mark>
  );
}

/** One paw print: a pad and four toes, pointing up, in a 20 x 20 box. */
const PAW = (
  <>
    <Path d="M10 9.5 C13.8 9.5 16.6 13 16 15.8 C15.5 18.2 12.6 17.6 10 17.6 C7.4 17.6 4.5 18.2 4 15.8 C3.4 13 6.2 9.5 10 9.5 Z" />
    <Ellipse cx={3.4} cy={8.6} rx={1.9} ry={2.4} transform="rotate(-24 3.4 8.6)" />
    <Ellipse cx={7.4} cy={4.6} rx={2} ry={2.6} transform="rotate(-8 7.4 4.6)" />
    <Ellipse cx={12.6} cy={4.6} rx={2} ry={2.6} transform="rotate(8 12.6 4.6)" />
    <Ellipse cx={16.6} cy={8.6} rx={1.9} ry={2.4} transform="rotate(24 16.6 8.6)" />
  </>
);

/**
 * A cat's walk in ink across the page: prints along `path` (points in the
 * mark's box, in order), left and right feet either side of it, each a
 * little fainter than the last as the ink on its paws runs out.
 */
export function PawPrints({ color, path, size = 14, width, height, seed, style }: {
  color: string;
  path: readonly (readonly [number, number])[];
  size?: number;
  width: number;
  height: number;
  seed: string;
  style?: StyleProp<ViewStyle>;
}) {
  const r = rng(`${seed}:paws`);
  const prints = path.map(([x, y], i) => {
    const [nx, ny] = path[Math.min(i + 1, path.length - 1)];
    const [px, py] = path[Math.max(i - 1, 0)];
    const heading = Math.atan2(ny - py, nx - px);
    const side = i % 2 ? 1 : -1;
    const ox = Math.cos(heading + Math.PI / 2) * side * size * 0.45;
    const oy = Math.sin(heading + Math.PI / 2) * side * size * 0.45;
    return { x: x + ox, y: y + oy, a: (heading * 180) / Math.PI + 90 + (r() - 0.5) * 14, o: Math.max(0.28, 0.95 - i * (0.6 / Math.max(1, path.length))) * (0.85 + r() * 0.15) };
  });
  return (
    <Mark style={style} width={width} height={height}>
      <Svg width="100%" height="100%">
        {prints.map((p, i) => (
          <G key={i} fill={color} fillOpacity={p.o} transform={`translate(${(p.x - size / 2).toFixed(1)} ${(p.y - size / 2).toFixed(1)}) rotate(${p.a.toFixed(0)} ${size / 2} ${size / 2}) scale(${size / 20})`}>
            {PAW}
          </G>
        ))}
      </Svg>
    </Mark>
  );
}

/** Two punched holes down a sheet's left margin: the desk shows through. */
export function Punched({ desk, gap = 120, style }: { desk: string; gap?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Mark style={style} width={16} height={gap + 16}>
      <Svg width="100%" height="100%">
        {[8, gap + 8].map((y) => (
          <G key={y}>
            <Circle cx={8} cy={y} r={6.5} fill={desk} />
            <Path d={`M2 ${y} A6.5 6.5 0 0 1 14 ${y}`} stroke={alpha("#000000", 0.35)} strokeWidth={1.4} fill="none" />
            <Path d={`M2.5 ${y + 1.5} A6.5 6.5 0 0 0 13.5 ${y + 1.5}`} stroke={alpha("#FFFFFF", 0.4)} strokeWidth={0.8} fill="none" />
          </G>
        ))}
      </Svg>
    </Mark>
  );
}

/** An envelope's tie: two card buttons and the string wound round them in a figure of eight. */
export function StringTie({ card, string, style }: { card: string; string: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Mark style={style} width={34} height={64}>
      <Svg width="100%" height="100%" viewBox="0 0 34 64">
        {[14, 46].map((y) => (
          <G key={y}>
            <Circle cx={17} cy={y + 1.5} r={10} fill={alpha("#000000", 0.2)} />
            <Circle cx={17} cy={y} r={10} fill={card} />
            <Circle cx={17} cy={y} r={7} stroke={alpha("#000000", 0.18)} strokeWidth={0.8} fill="none" />
            <Circle cx={17} cy={y} r={1.6} fill={alpha("#000000", 0.35)} />
          </G>
        ))}
        <Path d="M17 14 C30 22 4 38 17 46 C30 54 6 60 2 64" stroke={string} strokeWidth={1.3} fill="none" strokeLinecap="round" />
        <Path d="M17 14 C4 22 30 38 17 46" stroke={string} strokeWidth={1.3} fill="none" strokeLinecap="round" />
      </Svg>
    </Mark>
  );
}

const styles = StyleSheet.create({
  stamp: { borderWidth: 2.5, borderRadius: 4, padding: 2, alignSelf: "flex-start" },
  stampInner: { borderWidth: 1, borderRadius: 2, paddingHorizontal: 8, paddingTop: 3, paddingBottom: 2 },
});
