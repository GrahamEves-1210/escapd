// Perception v2 vocabulary: the closed object taxonomy, the closed feature
// flags, and the object inventory the planner consumes. Perception describes
// objects physically; only the archetype catalog (archetypes.ts) decides what
// an object can do in a room.
import type { Box1000 } from "../geometry.ts";

export type ObjectCategory =
  | "furniture" | "storage" | "textile" | "wall" | "light" | "electronic"
  | "instrument" | "decor" | "plant" | "paper" | "door" | "other";

/** type -> [category, portable (a small thing a player could pick up)]. */
const TYPES = {
  // furniture
  desk: ["furniture", false], table: ["furniture", false], coffee_table: ["furniture", false],
  side_table: ["furniture", false], nightstand: ["furniture", false], dresser: ["furniture", false],
  wardrobe: ["furniture", false], cabinet: ["furniture", false], sideboard: ["furniture", false],
  filing_cabinet: ["furniture", false], bookshelf: ["furniture", false], shelf: ["furniture", false],
  bed: ["furniture", false], sofa: ["furniture", false], armchair: ["furniture", false],
  chair: ["furniture", false], stool: ["furniture", false], bench: ["furniture", false],
  ottoman: ["furniture", false], tv_stand: ["furniture", false],
  // storage
  chest: ["storage", false], trunk: ["storage", false], box: ["storage", true], basket: ["storage", true],
  jar: ["storage", true], suitcase: ["storage", false], safe: ["storage", false], toolbox: ["storage", true],
  bag: ["storage", true],
  // textiles
  pillow: ["textile", true], cushion: ["textile", true], rug: ["textile", false], curtain: ["textile", false],
  blanket: ["textile", false], towel: ["textile", true],
  // wall
  framed_picture: ["wall", false], poster: ["wall", false], mirror: ["wall", false],
  wall_clock: ["wall", false], noticeboard: ["wall", false], calendar: ["wall", false], map: ["wall", false],
  // light
  desk_lamp: ["light", false], floor_lamp: ["light", false], ceiling_light: ["light", false],
  string_lights: ["light", false],
  // electronic
  radio: ["electronic", false], speaker: ["electronic", false], record_player: ["electronic", false],
  typewriter: ["electronic", false], fan: ["electronic", false], telephone: ["electronic", false],
  // instruments
  guitar: ["instrument", false], keyboard_instrument: ["instrument", false], violin: ["instrument", false],
  drum: ["instrument", false],
  // decor (mostly small)
  vase: ["decor", true], candle: ["decor", true], trophy: ["decor", true], globe: ["decor", true],
  figurine: ["decor", true], alarm_clock: ["decor", true], mug: ["decor", true], bottle: ["decor", true],
  // plants
  plant_pot: ["plant", true], potted_plant: ["plant", false],
  // paper
  book: ["paper", true], book_stack: ["paper", true], notebook: ["paper", true], magazine: ["paper", true],
  // door
  door: ["door", false],
  other: ["other", false],
} as const satisfies Record<string, readonly [ObjectCategory, boolean]>;

export type ObjectType = keyof typeof TYPES;
export const OBJECT_TYPES = Object.keys(TYPES) as ObjectType[];
export const isObjectType = (v: unknown): v is ObjectType => typeof v === "string" && v in TYPES;
export const categoryOf = (t: ObjectType): ObjectCategory => TYPES[t][0];
export const isPortableType = (t: ObjectType): boolean => TYPES[t][1];

export const FEATURES = [
  "has_drawers", "has_doors", "has_hands", "has_dial", "has_strings", "has_keys",
  "can_open", "can_lift", "wall_mounted", "light_source", "reflective", "has_pages",
  "holds_items", "is_door",
] as const;
export type Feature = typeof FEATURES[number];
export const isFeature = (v: unknown): v is Feature => (FEATURES as readonly unknown[]).includes(v);

/** One real object, as perception v2 reports it (after verification and reconciliation). */
export interface InventoryObject {
  id: string;
  label: string;              // generic noun phrase, e.g. "wall clock"
  type: ObjectType;
  features: Feature[];
  box: Box1000;               // [ymin, xmin, ymax, xmax] on 0..1000
  photo_index: number;
  salience: number;           // 0..1, how prominent it is
  fully_visible: boolean;     // false when cut off at the frame edge
}

/** What perception would typically report for each type. */
export const TYPICAL_FEATURES: Partial<Record<ObjectType, Feature[]>> = {
  desk: ["has_drawers", "holds_items"], nightstand: ["has_drawers", "holds_items"], dresser: ["has_drawers"],
  wardrobe: ["has_doors", "can_open"], cabinet: ["has_doors", "can_open"], sideboard: ["has_doors", "has_drawers"],
  filing_cabinet: ["has_drawers"], bookshelf: ["has_pages", "holds_items"], chest: ["can_open", "holds_items"],
  trunk: ["can_open", "holds_items"], box: ["can_open", "can_lift", "holds_items"], suitcase: ["can_open"],
  pillow: ["can_lift"], cushion: ["can_lift"], rug: ["can_lift"], blanket: ["can_lift"], plant_pot: ["can_lift"],
  vase: ["can_lift"], book: ["has_pages", "can_lift"], book_stack: ["has_pages", "can_lift"], notebook: ["has_pages", "can_lift"],
  framed_picture: ["wall_mounted"], poster: ["wall_mounted"], mirror: ["wall_mounted", "reflective"], calendar: ["wall_mounted"],
  map: ["wall_mounted"], noticeboard: ["wall_mounted"], wall_clock: ["has_hands", "wall_mounted"], alarm_clock: ["has_hands", "can_lift"],
  desk_lamp: ["light_source"], floor_lamp: ["light_source"], string_lights: ["light_source"], radio: ["has_dial"],
  record_player: ["has_dial"], guitar: ["has_strings"], keyboard_instrument: ["has_keys"], door: ["is_door", "can_open"],
  mug: ["can_lift"], trophy: ["can_lift"], figurine: ["can_lift"], jar: ["can_open", "can_lift"], basket: ["can_lift", "holds_items"],
};

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

/** A type as a model wrote it ("Wall clock", "wall_clock"), else the type its label means. */
export function typeFromText(raw: string, label: string): ObjectType {
  const t = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return isObjectType(t) ? t : typeForLabel(`${raw} ${label}`);
}
