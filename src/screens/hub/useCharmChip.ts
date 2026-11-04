// Home's charm chip: its label (her title and how many charms) and whether
// there's a charm she hasn't seen on her board yet, read on every focus.
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ALL_CHARMS, titleFor } from "@/game/collection/charms";
import { casesClosed, loadCollection, unseenCount } from "@/game/collection/store";

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
