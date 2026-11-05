// Home's charm chip (01 · Home's header, the left slot: home is the root, so
// it's free): the hub's round chip with a little heart charm on its jump
// ring, opening her charm board (/collection). A dot in the shell's sweet
// colour while there's a charm she hasn't looked at yet. Its label says her
// title and how many charms she has. Read again on every focus.
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { router, useFocusEffect } from "expo-router";
import { ALL_CHARMS, titleFor } from "@/game/collection/charms";
import { casesClosed, loadCollection, unseenCount } from "@/game/collection/store";
import { Chip } from "@/screens/hub/Chip";
import { ref, shellTheme } from "@/theme/tokens";

const C = ref.button.chip;
const PAD = (C.hit - C.size) / 2;
const GLYPH = ref.icon.chip;

export function charmChipLabel(closed: number, kinds: number): string {
  const charms = kinds === 0 ? "no charms yet" : `${kinds} of ${ALL_CHARMS.length} charms`;
  return `Charm board. ${titleFor(closed).title}, ${charms}`;
}

export function useCharmChip(): { label: string; unseen: boolean } {
  const [state, setState] = useState({ label: charmChipLabel(0, 0), unseen: false });
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadCollection().then((c) => {
        if (cancelled) return;
        const kinds = new Set(Object.values(c.cases).map((x) => x.kind)).size;
        setState({ label: charmChipLabel(casesClosed(c), kinds), unseen: unseenCount(c) > 0 });
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );
  return state;
}

export function CharmChip({ disabled = false }: { disabled?: boolean }) {
  const { label, unseen } = useCharmChip();
  return (
    <View>
      <Chip accessibilityLabel={label} icon={<CharmGlyph />} onPress={() => router.push("/collection")} disabled={disabled} testID="hub-charms" />
      {unseen ? <View style={[styles.dot, { backgroundColor: shellTheme.sweet, borderColor: ref.color.void }]} pointerEvents="none" testID="hub-charms-new" /> : null}
    </View>
  );
}

/** A little heart charm on its jump ring, drawn in the cat's pen (the chip's 18 glyph box). */
export function CharmGlyph({ color = ref.color.textPrimary }: { color?: string }) {
  return (
    <Svg width={GLYPH} height={GLYPH} viewBox="0 0 18 18" pointerEvents="none">
      <Circle cx={9} cy={3.4} r={1.7} fill="none" stroke={color} strokeWidth={1.4} />
      <Path
        d="M9 16 C5.2 13.3 2.6 11.1 2.6 8.3 C2.6 6.6 3.9 5.3 5.5 5.3 C6.9 5.3 8.2 6.1 9 7.4 C9.8 6.1 11.1 5.3 12.5 5.3 C14.1 5.3 15.4 6.6 15.4 8.3 C15.4 11.1 12.8 13.3 9 16 Z"
        fill="none"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path d="M5.4 8.4 Q5.6 7.2 6.8 7" fill="none" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  // On the disc's top right, ringed in the ground.
  dot: { position: "absolute", top: PAD - 1, right: PAD - 1, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
});
