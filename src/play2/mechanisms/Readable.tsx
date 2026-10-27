// Readable. "card": nothing to work (the inspection view shows the card).
// "pages": thumb through to a page on a scale with a tick per page, or step
// with − and +; onSet("page", "47") on release.
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useModeTheme } from "@/game/mode";
import { ref } from "@/theme/tokens";
import { Line, MechButton, Readout, Stage, domainOf, readoutText } from "./kit";
import { Scale } from "./Scale";
import type { MechanismProps } from "./types";

export function Readable(props: MechanismProps) {
  if (props.target.variant !== "pages") return null;
  return <Pages {...props} />;
}

const pageOf = (v: unknown, max: number) => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : 1;
  return Number.isInteger(n) ? Math.min(max, Math.max(1, n)) : 1;
};

function Pages({ target, state, onSet, busy, width }: MechanismProps) {
  const theme = useModeTheme();
  const domain = domainOf(target, "page");
  const max = domain?.kind === "page" ? domain.max : 300;
  const committed = pageOf(state.page, max);
  const [shown, setShown] = useState(committed - 1);
  useEffect(() => setShown(committed - 1), [committed]);

  const commit = useCallback((step: number) => {
    setShown(step);
    onSet("page", String(step + 1));
  }, [onSet]);
  const nudge = (delta: number) => {
    const next = Math.min(max - 1, Math.max(0, shown + delta));
    if (next !== shown) commit(next);
  };

  const scaleWidth = width - 2 * (ref.hit.min + ref.space.sm);
  return (
    <Stage width={width}>
      <View style={styles.book}>
        <Readout>
          <Text style={[styles.unit, { color: theme.inkMuted }]}>p.</Text>
          <Text style={readoutText(theme.ink)} testID="mech-page">{shown + 1}</Text>
        </Readout>
        <Line text={`of ${max}`} />
      </View>
      <View style={styles.row}>
        <MechButton compact tone="secondary" label="−" accessibilityLabel="Previous page" onPress={() => nudge(-1)} disabled={busy || shown === 0} />
        <Scale
          count={max}
          value={shown}
          spacing={10}
          majorEvery={10}
          labelEvery={50}
          label={(i) => String(i + 1)}
          tickEvery={1}
          width={scaleWidth}
          onLive={setShown}
          onCommit={commit}
          accessibilityLabel="Page"
          valueText={(i) => `Page ${i + 1} of ${max}`}
          disabled={busy}
          testID="mech-pages"
        />
        <MechButton compact tone="secondary" label="+" accessibilityLabel="Next page" onPress={() => nudge(1)} disabled={busy || shown === max - 1} />
      </View>
      <Line text="Thumb through the pages" />
    </Stage>
  );
}

const styles = StyleSheet.create({
  book: { alignItems: "center", paddingTop: ref.space.lg, paddingBottom: ref.space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: ref.space.sm },
  unit: { ...ref.type.label },
});
