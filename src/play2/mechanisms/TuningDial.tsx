// TuningDial: the FM band, 88.0 to 108.0 in 0.1 steps, slid under a needle
// with a tick every whole megahertz. onSet("freq", "96.3") on release.
//
// Drawn as the wireless: a walnut cabinet, the lit dial across it, a cloth
// grille behind brass bars, the frequency on an engraved plate, and a knurled
// knob that turns as the band slides.
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { ref } from "@/theme/tokens";
import { Line, Stage } from "./kit";
import { BRASS, BrassGradient, INK, Ink, Wood, inkRect, useGradId, useMaterials, type Materials } from "./materials";
import { Scale } from "./Scale";
import type { MechanismProps } from "./types";

const LOW = 880;
const COUNT = 1080 - LOW + 1;
/** The cabinet's height, its padding, the grille's height and the knob's size. */
const CABINET = { h: 196, pad: 14, grille: 78, knob: 62 };

const stepOf = (v: unknown) => {
  const n = Math.round(Number(v) * 10);
  return Number.isFinite(n) ? Math.min(COUNT - 1, Math.max(0, n - LOW)) : 0;
};
export const freqOf = (step: number) => ((LOW + step) / 10).toFixed(1);

export function TuningDial({ state, onSet, busy, width }: MechanismProps) {
  const mat = useMaterials();
  const committed = stepOf(state.freq);
  const [shown, setShown] = useState(committed);
  useEffect(() => setShown(committed), [committed]);
  const commit = useCallback((step: number) => {
    setShown(step);
    onSet("freq", freqOf(step));
  }, [onSet]);
  // Where the band stands, shared with the knob.
  const position = useSharedValue(committed);
  const knobStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${position.get() * 7.2}deg` }] }));

  const panel = Math.min(width, 340);
  const inner = panel - 2 * CABINET.pad;
  const grilleW = inner - CABINET.knob - 98;
  return (
    <Stage width={width}>
      <View style={[styles.radio, { width: panel, height: CABINET.h }]}>
        <Wood w={panel} h={CABINET.h} seed={131} tone={mat.wood} r={16} style={StyleSheet.absoluteFill} />
        <Scale
          count={COUNT}
          value={shown}
          spacing={9}
          majorEvery={10}
          labelEvery={20}
          label={(i) => String((LOW + i) / 10)}
          tickEvery={10}
          width={inner}
          onLive={setShown}
          onCommit={commit}
          accessibilityLabel="Tuning dial"
          valueText={(i) => `${freqOf(i)} megahertz`}
          disabled={busy}
          testID="mech-dial"
          position={position}
        />
        <View style={styles.lower}>
          <Grille w={grilleW} h={CABINET.grille} mat={mat} />
          {/* The frequency, engraved on its plate. */}
          <View style={styles.plate}>
            <Plate />
            <Text style={styles.band}>FM</Text>
            <Text style={styles.freq} testID="mech-freq">{freqOf(shown)}</Text>
            <Text style={styles.band}>MHz</Text>
          </View>
          <View style={{ width: CABINET.knob, height: CABINET.knob }} pointerEvents="none">
            <KnobBase size={CABINET.knob} />
            <Animated.View style={[StyleSheet.absoluteFill, knobStyle]}>
              <KnobCap size={CABINET.knob} />
            </Animated.View>
          </View>
        </View>
      </View>
      <Line text="Slide the dial to tune" />
    </Stage>
  );
}

/** The speaker: woven cloth in the mode's colour behind three brass bars. */
const Grille = memo(function Grille({ w, h, mat }: { w: number; h: number; mat: Materials }) {
  const g = useGradId();
  const [bar, shade] = [g("gb"), g("gs")];
  const art = useMemo(() => {
    let weave = "";
    for (let y = 5; y < h - 3; y += 4) weave += `M4 ${y}H${w - 4}`;
    let warp = "";
    for (let x = 6; x < w - 4; x += 4) warp += `M${x} 4V${h - 4}`;
    return { weave, warp, edge: inkRect(1, 1, w - 2, h - 2, 9, 149, 0.5) };
  }, [w, h]);
  return (
    <Svg width={w} height={h}>
      <Defs>
        <BrassGradient id={bar.id} vertical />
        <LinearGradient id={shade.id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000000" stopOpacity={0.6} />
          <Stop offset="0.3" stopColor="#000000" stopOpacity={0.1} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0.3} />
        </LinearGradient>
      </Defs>
      <Rect x={1} y={1} width={w - 2} height={h - 2} rx={9} fill={mat.cloth.mid} />
      <Path d={art.weave} stroke={mat.cloth.deep} strokeOpacity={0.8} strokeWidth={1.4} />
      <Path d={art.warp} stroke={mat.cloth.light} strokeOpacity={0.3} strokeWidth={1} />
      <Rect x={1} y={1} width={w - 2} height={h - 2} rx={9} fill={shade.url} />
      {[0.26, 0.5, 0.74].map((f) => (
        <Rect key={f} x={3} y={h * f - 3} width={w - 6} height={6} rx={3} fill={bar.url} stroke={INK} strokeWidth={1.2} />
      ))}
      <Ink d={art.edge} w={2} />
    </Svg>
  );
});

/** A small brass plate, a pin at each end. */
const Plate = memo(function Plate() {
  const g = useGradId()("pl");
  return (
    <View style={[StyleSheet.absoluteFill, styles.plateFace]} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={g.id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={BRASS.sheen} />
            <Stop offset="0.2" stopColor={BRASS.light} />
            <Stop offset="1" stopColor={BRASS.shade} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={g.url} />
      </Svg>
    </View>
  );
});

/** Under the knob: its shadow on the wood and the brass collar it turns in. */
const KnobBase = memo(function KnobBase({ size }: { size: number }) {
  const c = size / 2;
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Circle cx={c + 2} cy={c + 4} r={c - 4} fill="#000000" fillOpacity={0.4} />
      <Circle cx={c} cy={c} r={c - 2} fill={BRASS.shade} stroke={INK} strokeWidth={1.6} />
    </Svg>
  );
});

/** The knob itself (it turns): a knurled rim, a domed face, a pointer line. */
const KnobCap = memo(function KnobCap({ size }: { size: number }) {
  const g = useGradId()("kc");
  const c = size / 2, r = c - 6;
  const knurl = useMemo(() => {
    let d = "";
    for (let i = 0; i < 36; i++) {
      const a = (i * 10 * Math.PI) / 180;
      d += `M${(c + Math.sin(a) * (r - 5)).toFixed(1)} ${(c - Math.cos(a) * (r - 5)).toFixed(1)}L${(c + Math.sin(a) * r).toFixed(1)} ${(c - Math.cos(a) * r).toFixed(1)}`;
    }
    return d;
  }, [c, r]);
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={g.id} cx="38%" cy="32%" rx="75%" ry="75%">
          <Stop offset="0" stopColor="#6A5B52" />
          <Stop offset="0.5" stopColor="#3A2F2B" />
          <Stop offset="1" stopColor="#1B1513" />
        </RadialGradient>
      </Defs>
      <Circle cx={c} cy={c} r={r} fill={g.url} stroke={INK} strokeWidth={1.8} />
      <Path d={knurl} stroke="#000000" strokeOpacity={0.55} strokeWidth={1.4} />
      <Circle cx={c} cy={c} r={r - 6} fill="none" stroke={BRASS.mid} strokeWidth={1.4} />
      <Path d={`M${c} ${c - r + 8}V${c - 5}`} stroke={BRASS.sheen} strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
});

const styles = StyleSheet.create({
  radio: { marginTop: ref.space.xs, padding: CABINET.pad, gap: ref.space.plate },
  lower: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  plate: { minWidth: 82, height: 44, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  plateFace: { borderRadius: 5, borderWidth: 1.6, borderColor: INK, overflow: "hidden" },
  // Engraved: dark in the cut, a line of light on its lower lip.
  freq: {
    ...ref.type.counter, fontSize: 22, lineHeight: 24, letterSpacing: 0.5, color: "#2A1A0C", fontVariant: ["tabular-nums"],
    textShadowColor: "rgba(255, 244, 214, 0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0,
  },
  band: { fontSize: 9, lineHeight: 10, letterSpacing: 1.6, fontWeight: "700", color: "#3D2A12" },
});
