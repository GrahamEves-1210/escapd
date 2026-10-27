// TuningDial: the FM band, 88.0 to 108.0 in 0.1 steps, slid under a needle
// with a tick every whole megahertz. onSet("freq", "96.3") on release.
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useModeTheme } from "@/game/mode";
import { ref } from "@/theme/tokens";
import { Line, Readout, Stage, readoutText } from "./kit";
import { Scale } from "./Scale";
import type { MechanismProps } from "./types";

const LOW = 880;
const COUNT = 1080 - LOW + 1;

const stepOf = (v: unknown) => {
  const n = Math.round(Number(v) * 10);
  return Number.isFinite(n) ? Math.min(COUNT - 1, Math.max(0, n - LOW)) : 0;
};
export const freqOf = (step: number) => ((LOW + step) / 10).toFixed(1);

export function TuningDial({ state, onSet, busy, width }: MechanismProps) {
  const theme = useModeTheme();
  const committed = stepOf(state.freq);
  const [shown, setShown] = useState(committed);
  useEffect(() => setShown(committed), [committed]);
  const commit = useCallback((step: number) => {
    setShown(step);
    onSet("freq", freqOf(step));
  }, [onSet]);

  const panel = Math.min(width, 340);
  return (
    <Stage width={width}>
      <View style={[styles.radio, { width: panel, backgroundColor: theme.raised, borderColor: theme.rim }]}>
        <View style={styles.head}>
          <Text style={[styles.band, { color: theme.inkMuted }]}>FM</Text>
          <Readout>
            <Text style={readoutText(theme.ink)} testID="mech-freq">{freqOf(shown)}</Text>
            <Text style={[styles.band, { color: theme.inkMuted }]}>MHz</Text>
          </Readout>
        </View>
        <Scale
          count={COUNT}
          value={shown}
          spacing={9}
          majorEvery={10}
          labelEvery={20}
          label={(i) => String((LOW + i) / 10)}
          tickEvery={10}
          width={panel - 2 * ref.space.lg}
          onLive={setShown}
          onCommit={commit}
          accessibilityLabel="Tuning dial"
          valueText={(i) => `${freqOf(i)} megahertz`}
          disabled={busy}
          testID="mech-dial"
        />
      </View>
      <Line text="Slide to tune" />
    </Stage>
  );
}

const styles = StyleSheet.create({
  radio: {
    borderRadius: ref.radius.sheet,
    borderWidth: StyleSheet.hairlineWidth,
    padding: ref.space.lg,
    gap: ref.space.lg,
    marginTop: ref.space.lg,
    ...ref.curve,
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: ref.space.xs },
  band: { ...ref.type.tag },
});
