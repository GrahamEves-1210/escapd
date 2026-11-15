// What the room's own pictures show, for whatever draws a card or a thing away from the room's photo: the
// casebook's pages, the close-up's table, a note read up close. The player screen provides it once
// (PlayerV2), and warms the pieces it will need while she looks round the room: a photograph's print
// (cutout.ts snapshot) and each thing she can lift, cut out of its photo (cutout.ts cutout), so neither
// is ever baked in front of her.
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import type { CardDef, ItemDef, ObjectDef } from "@/engine/v2";
import type { Genre } from "@/lib/puzzle-types";
import type { SceneSource } from "@/render/SceneView";
import { bake, type Crop } from "./cutout";

export interface RoomShown {
  genre: Genre | null;
  cards: readonly CardDef[];
  objects: readonly ObjectDef[];
  items: readonly ItemDef[];
  /** A photo of the room, by index, once it is resolved. */
  photo: (index: number) => { source: SceneSource; cacheKey?: string } | null;
  /** What she has found already (items, cards): a container no longer holds those, wherever they are now. */
  found: ReadonlySet<string>;
}

const NONE: RoomShown = { genre: null, cards: [], objects: [], items: [], photo: () => null, found: new Set() };

const Shown = createContext<RoomShown>(NONE);

export function useShown(): RoomShown {
  return useContext(Shown);
}

/** A room object's crop on its photo, or null (no photo yet, or no such object). */
export function cropOf(shown: RoomShown, objectId: string | undefined): Crop | null {
  const o = objectId ? shown.objects.find((x) => x.id === objectId) : undefined;
  const p = o ? shown.photo(o.photo_index) : null;
  return o && p ? { source: p.source, cacheKey: p.cacheKey, box: o.box, ...(o.outline ? { outline: o.outline } : {}) } : null;
}

/** The card's definition (its look, what a photograph shows), by id. */
export function useCardDef(id: string): CardDef | undefined {
  const { cards } = useShown();
  return cards.find((c) => c.id === id);
}

export function ShownProvider({ value, children }: { value: RoomShown; children: ReactNode }) {
  // Warm what will be wanted: every photograph's print, and every thing that lifts, cut out.
  const wanted = useMemo(() => {
    const out: { kind: "cutout" | "snapshot"; crop: Crop }[] = [];
    for (const c of value.cards) {
      if (c.look !== "photo") continue;
      const crop = cropOf(value, c.object);
      if (crop) out.push({ kind: "snapshot", crop });
    }
    for (const o of value.objects) {
      if (o.archetype !== "LiftUnder") continue;
      const crop = cropOf(value, o.id);
      if (crop) out.push({ kind: "cutout", crop });
    }
    return out;
  }, [value]);
  useEffect(() => {
    let live = true;
    (async () => {
      for (const w of wanted) {
        if (!live) return;
        await bake(w.kind, value.genre, w.crop);
      }
    })();
    return () => {
      live = false;
    };
  }, [wanted, value.genre]);
  return <Shown.Provider value={value}>{children}</Shown.Provider>;
}
