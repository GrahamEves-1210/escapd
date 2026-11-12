// Home's charm chip (01 · Home's header, the left slot: home is the root, so
// it's free): the hub's round chip with a little brass skeleton key on its
// jump ring (rendered: scripts/blender/props/charms_wardrobe.py), opening her
// charm board (/collection). A gold-foil dot while
// there's a charm she hasn't looked at yet. Its label says her
// title and how many charms she has. Read again on every focus.
import { useCallback, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { ALL_CHARMS, titleFor } from "@/game/collection/charms";
import { casesClosed, loadCollection, unseenCount } from "@/game/collection/store";
import { Chip } from "@/screens/hub/Chip";
import { ref, shellTheme } from "@/theme/tokens";

const C = ref.button.chip;
const PAD = (C.hit - C.size) / 2;
/** The key's height in the chip's 36 disc (a rendered thing reads smaller than a line glyph's 18). */
export const KEY = 25;
const KEY_ART = require("../../../assets/charms/chip-key.png") as number;

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
      {unseen ? <View style={[styles.dot, { backgroundColor: shellTheme.foil, borderColor: ref.color.void }]} pointerEvents="none" testID="hub-charms-new" /> : null}
    </View>
  );
}

/** A little brass skeleton key on its jump ring (the chip's glyph). Decorative: the chip is labelled. */
export function CharmGlyph() {
  return <Image source={KEY_ART} style={styles.key} resizeMode="contain" fadeDuration={0} accessible={false} />;
}

const styles = StyleSheet.create({
  // On the disc's top right, ringed in the ground.
  dot: { position: "absolute", top: PAD - 1, right: PAD - 1, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  key: { width: KEY, height: KEY },
});
