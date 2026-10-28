// CombinationLock: its wheels (the submit domain: alphabet and count) and
// "Try it", which calls onSubmit(symbols). Held while busy or cooling down.
// The wheels keep what was dialled; open, they stay on it, stamped Open.
import { StyleSheet, View } from "react-native";
import { useModeTheme } from "@/game/mode";
import { ref } from "@/theme/tokens";
import { Stage } from "./kit";
import { WheelBank } from "./Wheels";
import type { MechanismProps } from "./types";

export function CombinationLock({ target, state, onSubmit, onChange, busy, cooldown, width }: MechanismProps) {
  const theme = useModeTheme();
  const domain = target.submit?.kind === "wheels" ? target.submit : { alphabet: "digits" as const, count: 3 };
  const open = state.open === true || state.locked === false;
  return (
    <Stage width={width}>
      <View style={[styles.plate, { backgroundColor: theme.raised, borderColor: theme.rim }]}>
        <WheelBank
          alphabet={domain.alphabet}
          count={domain.count}
          width={width - 2 * ref.space.lg}
          busy={busy}
          cooldown={cooldown}
          done={open}
          submitLabel="Try it"
          onSubmit={onSubmit}
          onChange={onChange}
          keep={target}
        />
      </View>
    </Stage>
  );
}

const styles = StyleSheet.create({
  plate: {
    paddingVertical: ref.space.lg,
    paddingHorizontal: ref.space.lg,
    borderRadius: ref.radius.sheet,
    borderWidth: StyleSheet.hairlineWidth,
    ...ref.curve,
  },
});
