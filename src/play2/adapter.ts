// A v2 room from a v1 one, on the device: each v1 hotspot (a real object's
// label and box) becomes a perception v2 inventory object, and the planner
// builds the room from them. No model call and no server change, so every
// existing room can be played on the new engine while generation v2 is built.
// The plan is seeded by the room's id, minted values included, so the same
// room always plans the same way and saved progress stays valid.
import {
  TYPICAL_FEATURES, planRoom, seededRandom, typeForLabel,
  type InventoryObject, type Mode, type PlanResult,
} from "@/engine/v2";
import type { PuzzleDefinitionV1 } from "@/lib/puzzle-types";

export { typeForLabel };

/** v1 hotspots as a perception v2 inventory: one object per hotspot, hidden ones included (they are real objects). */
export function inventoryFromV1(def: PuzzleDefinitionV1): InventoryObject[] {
  return def.hotspots.map((h) => {
    const type = typeForLabel(`${h.object_label} ${h.name ?? ""}`);
    const { x, y, w, h: hh } = h.shape;
    const area = w * hh;
    return {
      id: h.id,
      label: h.object_label.replace(/_/g, " "),
      type,
      features: TYPICAL_FEATURES[type] ?? [],
      box: [Math.round(y * 1000), Math.round(x * 1000), Math.round((y + hh) * 1000), Math.round((x + w) * 1000)],
      photo_index: h.photo_index,
      // Bigger reads as more prominent; v1 kept only objects worth a look, so none falls under the floor.
      salience: Math.min(1, 0.3 + Math.sqrt(area)),
      fully_visible: x > 0.01 && y > 0.01 && x + w < 0.99 && y + hh < 0.99,
    } satisfies InventoryObject;
  });
}

/** The room on the v2 engine, planned from its v1 objects and seeded by its id. */
export function planFromV1(roomId: string, def: PuzzleDefinitionV1): PlanResult {
  const mode: Mode = def.genre ?? "noir";
  const random = seededRandom(`mint:${roomId}`);
  return planRoom(inventoryFromV1(def), { mode, seed: roomId, randomInt: (max) => Math.floor(random() * max) });
}
