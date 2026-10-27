// A v2 room from a v1 one, on the device: each v1 hotspot (a real object's
// label and box) becomes a perception v2 inventory object, and the planner
// builds the room from them. No model call and no server change, so every
// existing room can be played on the new engine while generation v2 is built.
// The plan is seeded by the room's id, minted values included, so the same
// room always plans the same way and saved progress stays valid.
import {
  OBJECT_TYPES, TYPICAL_FEATURES, planRoom, seededRandom,
  type InventoryObject, type Mode, type ObjectType, type PlanResult,
} from "@/engine/v2";
import type { PuzzleDefinitionV1 } from "@/lib/puzzle-types";

/** Words in a label that name a type the taxonomy spells differently. First match wins. */
const SYNONYMS: [RegExp, ObjectType][] = [
  [/\b(alarm clock|clock radio)\b/, "alarm_clock"],
  [/\bclock\b/, "wall_clock"],
  [/\b(couch|settee|loveseat)\b/, "sofa"],
  [/\b(closet|armoire)\b/, "wardrobe"],
  [/\b(cupboard|hutch)\b/, "cabinet"],
  [/\b(bedside|night stand)\b/, "nightstand"],
  [/\b(chest of drawers|drawers?)\b/, "dresser"],
  [/\b(bookcase|shelves|shelving)\b/, "bookshelf"],
  [/\b(painting|picture|photo frame|frame|artwork|canvas|print)\b/, "framed_picture"],
  [/\b(lamp|light)\b/, "desk_lamp"],
  [/\b(fairy lights)\b/, "string_lights"],
  [/\b(plant|cactus|succulent|fern)\b/, "potted_plant"],
  [/\b(pot|planter)\b/, "plant_pot"],
  [/\b(cup|teacup)\b/, "mug"],
  [/\b(stereo|turntable|vinyl)\b/, "record_player"],
  [/\b(piano|synth|keyboard)\b/, "keyboard_instrument"],
  [/\b(phone)\b/, "telephone"],
  [/\b(board)\b/, "noticeboard"],
  [/\b(journal|diary|notepad)\b/, "notebook"],
  [/\b(books)\b/, "book_stack"],
  [/\b(throw|duvet|quilt)\b/, "blanket"],
  [/\b(carpet|mat)\b/, "rug"],
  [/\b(drapes|blind)\b/, "curtain"],
  [/\b(statue|ornament|sculpture)\b/, "figurine"],
  [/\b(tv|television|media console)\b/, "tv_stand"],
  [/\b(crate|bin|container)\b/, "box"],
  [/\b(backpack|handbag|purse)\b/, "bag"],
  [/\b(doorway|entrance|exit)\b/, "door"],
];

// Longest type names first, so "coffee table" wins over "table".
const BY_NAME = [...OBJECT_TYPES]
  .filter((t) => t !== "other")
  .map((t) => [new RegExp(`\\b${t.replace(/_/g, " ")}s?\\b`), t] as const)
  .sort((a, b) => b[0].source.length - a[0].source.length);

/** The taxonomy type a free-text object label most likely means; "other" when none fits. */
export function typeForLabel(label: string): ObjectType {
  const text = label.toLowerCase().replace(/[_-]+/g, " ");
  for (const [re, type] of BY_NAME) if (re.test(text)) return type;
  for (const [re, type] of SYNONYMS) if (re.test(text)) return type;
  return "other";
}

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
