// The casebook's doodles, drawn in the cat's inky hand: a confident line gone
// over twice (a second, thinner pass a hair off the first), round ends, never
// a ruler's edge. Stars, hearts, sparkles, a moon, a pressed flower, a paw
// print, arrows and underlines; and the little things a polaroid shows
// (a matchbook, an envelope, a ticket...). All decoration: hidden from screen
// readers. Small SVGs, drawn once.
import { memo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";
import { rand } from "./palette";

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" as const, pointerEvents: "none" as const };

/** A stroke gone over twice, like the cat's ink. */
function Ink({ d, color, width = 1.8, fill = "none" }: { d: string; color: string; width?: number; fill?: string }) {
  return (
    <>
      <Path d={d} stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" fill={fill} />
      <Path d={d} stroke={color} strokeWidth={width * 0.45} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.6} transform="translate(0.7 -0.5)" />
    </>
  );
}

interface DoodleProps {
  color: string;
  size?: number;
  /** A second colour: a fill under the ink (a star's glow, a heart's blush). */
  fill?: string;
  rotate?: number;
  style?: StyleProp<ViewStyle>;
}

function box(size: number, rotate: number | undefined, style: StyleProp<ViewStyle>) {
  return [{ width: size, height: size }, rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null, style];
}

export const Star = memo(function Star({ color, size = 22, fill, rotate, style }: DoodleProps) {
  return (
    <View style={box(size, rotate, style)} {...hidden}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Ink d="M12 2.6 L14.5 9.1 L21.4 9.3 L16 13.7 L18 20.5 L12 16.7 L6.2 20.8 L8 13.9 L2.7 9.7 L9.6 9 Z" color={color} fill={fill ?? "none"} />
      </Svg>
    </View>
  );
});

export const Heart = memo(function Heart({ color, size = 20, fill, rotate, style }: DoodleProps) {
  return (
    <View style={box(size, rotate, style)} {...hidden}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Ink d="M12 20.4 C5.2 15.6 2.6 11.6 3.6 8 C4.7 4.5 9.4 3.9 12 7.7 C14.4 3.7 19.5 4.3 20.5 8.1 C21.5 11.8 18.6 15.7 12 20.4 Z" color={color} fill={fill ?? "none"} />
      </Svg>
    </View>
  );
});

export const Sparkle = memo(function Sparkle({ color, size = 16, fill, rotate, style }: DoodleProps) {
  return (
    <View style={box(size, rotate, style)} {...hidden}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Ink d="M12 2 C12.7 8.6 15.4 11.3 22 12 C15.4 12.7 12.7 15.4 12 22 C11.3 15.4 8.6 12.7 2 12 C8.6 11.3 11.3 8.6 12 2 Z" color={color} fill={fill ?? color} width={1.4} />
      </Svg>
    </View>
  );
});

export const Moon = memo(function Moon({ color, size = 28, fill, rotate, style }: DoodleProps) {
  return (
    <View style={box(size, rotate, style)} {...hidden}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Ink d="M15.6 3 C9.6 2.6 4.6 7.4 4.9 13.3 C5.2 18.4 9.8 22 14.7 21.2 C17.6 20.8 19.8 19 21 16.6 C15.7 18.4 10.6 14.3 11.2 8.9 C11.5 6.3 13.2 4 15.6 3 Z" color={color} fill={fill ?? "none"} />
        <Path d="M8.4 13.6 C8.5 15.6 9.6 17.2 11.3 18" stroke={color} strokeWidth={0.9} strokeLinecap="round" fill="none" opacity={0.55} />
      </Svg>
    </View>
  );
});

/** A pressed flower: a lily-ish bloom on a bent stem, a leaf. */
export const PressedFlower = memo(function PressedFlower({ color, size = 44, fill, rotate, style }: DoodleProps) {
  return (
    <View style={box(size, rotate, style)} {...hidden}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Ink d="M24 44 C23 36 25 30 23.5 22" color={color} width={1.5} />
        <Ink d="M23.8 33 C18 31 15 27 15.5 23 C20 24.5 23 28 23.8 33 Z" color={color} width={1.3} fill={fill ?? "none"} />
        <G>
          {[0, 72, 144, 216, 288].map((a) => (
            <Ellipse key={a} cx={24} cy={11.5} rx={3.6} ry={7} fill={fill ?? "none"} stroke={color} strokeWidth={1.3} transform={`rotate(${a} 24 17)`} />
          ))}
        </G>
        <Circle cx={24} cy={17} r={2.2} fill={color} />
      </Svg>
    </View>
  );
});

/** The cat's paw print. */
export const Paw = memo(function Paw({ color, size = 22, rotate, style }: DoodleProps) {
  return (
    <View style={box(size, rotate, style)} {...hidden}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 12.4 C8.6 12.4 5.8 15.4 6.2 18 C6.5 20.2 8.8 20.6 10.4 19.9 C11.4 19.5 12.6 19.5 13.6 19.9 C15.2 20.6 17.5 20.2 17.8 18 C18.2 15.4 15.4 12.4 12 12.4 Z" fill={color} />
        <Ellipse cx={5.2} cy={10.6} rx={2} ry={2.6} fill={color} transform="rotate(-24 5.2 10.6)" />
        <Ellipse cx={9.2} cy={6.6} rx={2.1} ry={2.8} fill={color} transform="rotate(-8 9.2 6.6)" />
        <Ellipse cx={14.8} cy={6.6} rx={2.1} ry={2.8} fill={color} transform="rotate(8 14.8 6.6)" />
        <Ellipse cx={18.8} cy={10.6} rx={2} ry={2.6} fill={color} transform="rotate(24 18.8 10.6)" />
      </Svg>
    </View>
  );
});

/** A curly arrow pointing right (flip it with scaleX -1). */
export const Arrow = memo(function Arrow({ color, size = 44, rotate, style }: DoodleProps) {
  return (
    <View style={[{ width: size, height: size / 2 }, rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null, style]} {...hidden}>
      <Svg width={size} height={size / 2} viewBox="0 0 48 24">
        <Ink d="M3 18 C10 20 14 8 9.5 6.5 C5.5 5.4 6.5 14 16 15.5 C25 17 34 14 43 9" color={color} width={1.6} />
        <Ink d="M36.5 5.8 L43.4 8.8 L38.2 14.4" color={color} width={1.6} />
      </Svg>
    </View>
  );
});

/** A hand-drawn underline across `width`: a wave, gone over twice. */
export const Underline = memo(function Underline({ color, width, seed = "u", height = 8, style }: { color: string; width: number; seed?: string; height?: number; style?: StyleProp<ViewStyle> }) {
  const n = Math.max(3, Math.round(width / 26));
  let d = `M2 ${height / 2 + 1}`;
  for (let i = 1; i <= n; i++) {
    const x = 2 + ((width - 4) * i) / n;
    const y = height / 2 + (rand(seed, i) - 0.5) * (height - 3);
    d += ` Q ${x - (width - 4) / n / 2} ${i % 2 ? 1.5 : height - 1.5} ${x} ${y}`;
  }
  return (
    <View style={[{ width, height }, style]} {...hidden}>
      <Svg width={width} height={height}>
        <Ink d={d} color={color} width={1.8} />
      </Svg>
    </View>
  );
});

/** A marker scribble struck through a box (stretches to its parent). */
export const Strike = memo(function Strike({ color, seed }: { color: string; seed: string }) {
  const a = 30 + rand(seed, 1) * 25;
  const b = 50 + rand(seed, 2) * 25;
  return (
    <View style={StyleSheet.absoluteFill} {...hidden}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Path d={`M2 ${a + 8} C30 ${a + 2} 62 ${b - 6} 98 ${b - 10}`} stroke={color} strokeWidth={3.4} vectorEffect="non-scaling-stroke" strokeLinecap="round" fill="none" opacity={0.9} />
        <Path d={`M95 ${b - 2} C66 ${b} 34 ${a + 14} 6 ${a + 18}`} stroke={color} strokeWidth={2.2} vectorEffect="non-scaling-stroke" strokeLinecap="round" fill="none" opacity={0.75} />
      </Svg>
    </View>
  );
});

/** A round-headed push pin. */
export const Pin = memo(function Pin({ color, size = 18, style }: { color: string; size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width: size, height: size }, style]} {...hidden}>
      <Svg width={size} height={size} viewBox="0 0 20 20">
        <Ellipse cx={11.5} cy={13} rx={6} ry={4} fill="rgba(0,0,0,0.18)" />
        <Circle cx={10} cy={9} r={6.4} fill={color} />
        <Circle cx={8} cy={7} r={2} fill="rgba(255,255,255,0.65)" />
        <Circle cx={10} cy={9} r={6.4} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={0.8} />
      </Svg>
    </View>
  );
});

/** A paperclip over a page's edge. */
export const Paperclip = memo(function Paperclip({ color, size = 34, rotate, style }: DoodleProps) {
  return (
    <View style={[{ width: size * 0.5, height: size }, rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null, style]} {...hidden}>
      <Svg width={size * 0.5} height={size} viewBox="0 0 16 32">
        <Path d="M5 9 V24 A3.2 3.2 0 0 0 11.4 24 V6.5 A4.4 4.4 0 0 0 2.6 6.5 V23" stroke={color} strokeWidth={1.7} strokeLinecap="round" fill="none" />
      </Svg>
    </View>
  );
});

// ---------------------------------------------------------------------------
// What a polaroid shows: the thing a card was found on, drawn small.
// ---------------------------------------------------------------------------

export type Subject = "matchbook" | "envelope" | "ticket" | "napkin" | "notepad" | "book" | "drawing" | "card" | "bag" | "flame" | "photo" | "radio" | "bulb" | "dial" | "suspect" | "motive" | "method";

const SUBJECTS: Record<Subject, (c: string, f: string) => React.ReactNode> = {
  matchbook: (c, f) => (
    <>
      <Ink d="M12 14 L36 14 L36 38 L12 38 Z" color={c} />
      <Ink d="M12 22 L36 22" color={c} width={1.3} />
      {[16, 21, 26, 31].map((x) => <Ink key={x} d={`M${x} 14 L${x} 6`} color={c} width={1.4} />)}
      {[16, 21, 26, 31].map((x) => <Circle key={x} cx={x} cy={5.5} r={1.8} fill={f} />)}
      <Ink d="M17 31 C20 28 24 33 30 29" color={c} width={1.2} />
    </>
  ),
  envelope: (c) => (
    <>
      <Ink d="M8 14 L40 14 L40 36 L8 36 Z" color={c} />
      <Ink d="M8 14 L24 27 L40 14" color={c} />
      <Ink d="M8 36 L20 25 M40 36 L28 25" color={c} width={1.2} />
    </>
  ),
  ticket: (c) => (
    <>
      <Ink d="M8 15 L40 15 L40 21 C37.5 21.5 37.5 26.5 40 27 L40 33 L8 33 L8 27 C10.5 26.5 10.5 21.5 8 21 Z" color={c} />
      <Ink d="M30 16 L30 32" color={c} width={1} />
      <Ink d="M13 21 L25 21 M13 25 L23 25 M13 29 L20 29" color={c} width={1.2} />
    </>
  ),
  napkin: (c, f) => (
    <>
      <Ink d="M9 12 L38 9 L40 37 L11 39 Z" color={c} />
      <Ink d="M10 25 L39 23" color={c} width={0.9} />
      <Ink d="M30 13 C33 12 35 14 34 16 C32 18 29 16 30 13 Z" color={f} fill={f} width={1} />
      <Ink d="M15 30 C19 28 24 32 30 29" color={c} width={1.2} />
    </>
  ),
  notepad: (c) => (
    <>
      <Ink d="M11 9 L37 9 L37 40 L11 40 Z" color={c} />
      {[15, 19, 23, 27, 31].map((x) => <Circle key={x} cx={x + 2} cy={9} r={1.4} fill="none" stroke={c} strokeWidth={1} />)}
      <Ink d="M15 18 L33 18 M15 23 L31 23 M15 28 L33 28 M15 33 L26 33" color={c} width={1.1} />
    </>
  ),
  book: (c) => (
    <>
      <Ink d="M24 14 C19 11 13 11 7 13 L7 37 C13 35 19 35 24 38 C29 35 35 35 41 37 L41 13 C35 11 29 11 24 14 Z" color={c} />
      <Ink d="M24 14 L24 38" color={c} width={1.2} />
      <Ink d="M11 19 L20 18 M11 23 L20 22 M28 18 L37 19 M28 22 L37 23" color={c} width={1} />
    </>
  ),
  drawing: (c, f) => (
    <>
      <Ink d="M12 38 L12 24 L22 15 L32 24 L32 38 Z" color={c} />
      <Ink d="M19 38 L19 30 L25 30 L25 38" color={c} width={1.3} />
      <Circle cx={37} cy={11} r={4.5} fill={f} />
      <Ink d="M37 3 L37 5 M44 11 L46 11 M42 6 L43.5 4.5 M31.5 6 L30 4.5" color={f} width={1.3} />
      <Ink d="M6 41 C14 39 30 42 43 40" color={c} width={1.3} />
    </>
  ),
  card: (c, f) => (
    <>
      <Ink d="M14 8 L34 8 L34 40 L14 40 Z" color={c} />
      <Circle cx={24} cy={19} r={5.5} fill="none" stroke={f} strokeWidth={1.4} />
      <Ink d="M24 26 L24 35 M20 30 L28 30" color={c} width={1.3} />
    </>
  ),
  bag: (c) => (
    <>
      <Ink d="M10 12 L38 12 L38 40 L10 40 Z" color={c} />
      <Ink d="M10 17 L38 17" color={c} width={1.1} />
      <Ink d="M15 24 L33 24 M15 29 L27 29" color={c} width={1.1} />
      <Rect x={14} y={32} width={20} height={4} fill="none" stroke={c} strokeWidth={0.9} />
    </>
  ),
  flame: (c, f) => (
    <>
      <Ink d="M10 14 L38 14 L37 40 L11 39 Z" color={c} />
      <Ink d="M10 14 C14 10 17 16 21 11 C25 7 28 14 32 10 C35 8 37 12 38 14" color={f} width={1.4} />
      <Ink d="M15 24 L33 24 M15 29 L30 29" color={c} width={1.1} />
    </>
  ),
  photo: (c) => (
    <>
      <Ink d="M9 12 L39 12 L39 36 L9 36 Z" color={c} />
      <Ink d="M11 33 L20 23 L26 29 L30 25 L37 33" color={c} width={1.3} />
      <Circle cx={31} cy={18} r={2.6} fill="none" stroke={c} strokeWidth={1.3} />
    </>
  ),
  radio: (c) => (
    <>
      <Ink d="M8 18 L40 18 L40 38 L8 38 Z" color={c} />
      <Ink d="M14 18 L32 8" color={c} width={1.3} />
      <Circle cx={18} cy={28} r={5} fill="none" stroke={c} strokeWidth={1.4} />
      <Ink d="M28 24 L35 24 M28 28 L35 28 M28 32 L35 32" color={c} width={1.1} />
    </>
  ),
  bulb: (c, f) => (
    <>
      <Ink d="M24 8 C16 8 12 14 13.5 20 C14.5 24 18 26 18.5 31 L29.5 31 C30 26 33.5 24 34.5 20 C36 14 32 8 24 8 Z" color={c} fill="none" />
      <Ink d="M19 35 L29 35 M20 39 L28 39" color={c} width={1.4} />
      <Ink d="M6 18 L9 18 M39 18 L42 18 M10 7 L12 9 M38 7 L36 9" color={f} width={1.4} />
    </>
  ),
  dial: (c) => (
    <>
      <Circle cx={24} cy={24} r={14} fill="none" stroke={c} strokeWidth={1.8} />
      <Circle cx={24} cy={24} r={8} fill="none" stroke={c} strokeWidth={1.2} />
      <Ink d="M24 6 L24 10 M42 24 L38 24 M24 42 L24 38 M6 24 L10 24" color={c} width={1.3} />
    </>
  ),
  suspect: (c) => (
    <>
      <Ink d="M24 9 C19 9 16.5 13 17 17 C17.5 21.5 20.5 24 24 24 C27.5 24 30.5 21.5 31 17 C31.5 13 29 9 24 9 Z" color={c} />
      <Ink d="M10 41 C11 32 17 27.5 24 27.5 C31 27.5 37 32 38 41" color={c} />
      <Ink d="M21.5 15.5 C22.5 13 26 12.5 27.5 14.5" color={c} width={1} />
    </>
  ),
  motive: (c, f) => (
    <>
      <Ink d="M24 39 C14 32 9.5 26 11 20 C12.5 14.5 19.5 13.5 24 19.5 C28.5 13.5 35.5 14.5 37 20 C38.5 26 34 32 24 39 Z" color={c} fill="none" />
      <Ink d="M24 22 C22.5 24 25.5 25 24 27.5 M24 30.5 L24 31" color={f} width={1.6} />
    </>
  ),
  method: (c) => (
    <>
      <Ink d="M8 34 L22 20 M26 16 L40 8" color={c} />
      <Circle cx={24} cy={18} r={4} fill="none" stroke={c} strokeWidth={1.6} />
      <Ink d="M12 41 L36 41" color={c} width={1.2} />
      <Ink d="M30 30 L33 33 M33 30 L30 33" color={c} width={1.3} />
    </>
  ),
};

/** One of the polaroid subjects, at `size`, in chalk `color` with a touch of `accent`. */
export const SubjectDoodle = memo(function SubjectDoodle({ subject, color, accent, size = 48 }: { subject: Subject; color: string; accent: string; size?: number }) {
  return (
    <View style={{ width: size, height: size }} {...hidden}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        {SUBJECTS[subject](color, accent)}
      </Svg>
    </View>
  );
});
