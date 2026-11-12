// TuningDial: the FM band, 88.0 to 108.0 in 0.1 steps, slid under a needle
// with a tick every whole megahertz. onSet("freq", "96.3") on release.
//
// The wireless: a rendered walnut cabinet (sprites.tsx) with a brass-rimmed
// window the lit dial slides in, a cloth grille (the mode's colour, drawn live
// behind the cabinet's brass bars), the frequency on an engraved plate, and a
// knurled knob, its own picture, that turns as the band slides.
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { ref } from "@/theme/tokens";
import { Line, Stage } from "./kit";
import { useGradId, useMaterials, type Materials } from "./materials";
import { ART, Sprite } from "./sprites";
import { Scale } from "./Scale";
import type { MechanismProps } from "./types";

const LOW = 880;
const COUNT = 1080 - LOW + 1;
/** The cabinet as rendered (mech_radio.py): its size, its padding, the knob's box; and the speaker's place in it. */
const CABINET = { w: 340, h: 196, pad: 14, knob: 62 };
const GRILLE = { x: 14, y: 104, w: 152, h: 78 };

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

  // The cabinet is laid out at the size it was rendered (340 across) and, on a narrower screen, shrunk whole.
  const k = Math.min(width, CABINET.w) / CABINET.w;
  const inner = CABINET.w - 2 * CABINET.pad;
  return (
    <Stage width={width}>
      <View style={{ width: CABINET.w * k, height: CABINET.h * k, marginTop: ref.space.xs }}>
        <View style={[styles.radio, { width: CABINET.w, height: CABINET.h, transform: [{ scale: k }] }]}>
          {/* The speaker's cloth, then the cabinet over it (clear between the grille's bars, and where the dial goes). */}
          <View style={styles.cloth} pointerEvents="none"><Cloth w={GRILLE.w} h={GRILLE.h} mat={mat} /></View>
          <Sprite source={ART.radioCabinet} w={CABINET.w} h={CABINET.h} style={styles.fill} />
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
            <View style={{ width: GRILLE.w, height: GRILLE.h }} />
            {/* The frequency, engraved on its plate. */}
            <View style={styles.plate}>
              <Text style={styles.band}>FM</Text>
              <Text style={styles.freq} testID="mech-freq">{freqOf(shown)}</Text>
              <Text style={styles.band}>MHz</Text>
            </View>
            <View style={{ width: CABINET.knob, height: CABINET.knob }} pointerEvents="none">
              <Animated.View style={[StyleSheet.absoluteFill, knobStyle]}>
                <Sprite source={ART.radioKnob} w={CABINET.knob} h={CABINET.knob} />
              </Animated.View>
            </View>
          </View>
        </View>
      </View>
      <Line text="Slide the dial to tune" />
    </Stage>
  );
}

/** The speaker's cloth: woven, in the mode's colour, dark toward its top where the cabinet shades it. */
const Cloth = memo(function Cloth({ w, h, mat }: { w: number; h: number; mat: Materials }) {
  const shade = useGradId()("gs");
  const art = useMemo(() => {
    let weave = "";
    for (let y = 5; y < h - 3; y += 4) weave += `M4 ${y}H${w - 4}`;
    let warp = "";
    for (let x = 6; x < w - 4; x += 4) warp += `M${x} 4V${h - 4}`;
    return { weave, warp };
  }, [w, h]);
  return (
    <Svg width={w} height={h}>
      <Defs>
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
    </Svg>
  );
});

const styles = StyleSheet.create({
  radio: { padding: CABINET.pad, gap: ref.space.plate, transformOrigin: "left top" },
  fill: { position: "absolute", left: 0, top: 0 },
  cloth: { position: "absolute", left: GRILLE.x, top: GRILLE.y },
  lower: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  plate: { width: 82, height: 44, alignItems: "center", justifyContent: "center" },
  // Engraved: dark in the cut, a line of light on its lower lip.
  freq: {
    ...ref.type.counter, fontSize: 22, lineHeight: 24, letterSpacing: 0.5, color: "#2A1A0C", fontVariant: ["tabular-nums"],
    textShadowColor: "rgba(255, 244, 214, 0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0,
  },
  band: { fontSize: 9, lineHeight: 10, letterSpacing: 1.6, fontWeight: "700", color: "#3D2A12" },
});
