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
