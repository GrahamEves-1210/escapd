// Readable. "card": nothing to work (what it says shows as a note in it).
// "pages": dial the page number on three digit wheels and turn straight to
// it (no thumbing page by page); onSet("page", "47").
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { Line, Stage, domainOf } from "./kit";
import { WheelBank } from "./Wheels";
import type { MechanismProps } from "./types";

export function Readable(props: MechanismProps) {
  if (props.target.variant !== "pages") return null;
  return <Pages {...props} />;
}

function Pages({ target, state, onSet, busy, width }: MechanismProps) {
  const domain = domainOf(target, "page");
  const max = domain?.kind === "page" ? domain.max : 300;
  const turn = useCallback((digits: string[]) => {
    const n = Number(digits.join(""));
    onSet("page", String(Math.min(max, Math.max(1, n || 1))));
  }, [max, onSet]);
  const at = typeof state.page === "string" ? state.page : "1";
  return (
    <Stage width={width}>
      <View style={styles.col}>
        <Line text={`Open at page ${at}`} tone="muted" testID="mech-page-at" />
        <WheelBank alphabet="digits" count={3} width={width} busy={busy} cooldown={0} done={false} submitLabel="Turn to page" onSubmit={turn} />
      </View>
    </Stage>
  );
}

const styles = StyleSheet.create({
  col: { alignItems: "center" },
});
