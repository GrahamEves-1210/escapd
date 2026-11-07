// Where a UV trace physically makes sense: each kind of trace, by the surface it lies on (on the object
// itself, on the wall beside it, on the floor by it), may only be anchored to these kinds of object.
// Footprints are on floors and rugs, never a bed or a shelf; fingerprints on hard things people touch;
// writing on walls, wood, glass and paper; stains on fabric, tables and floors. The planner places
// traces by this table and the validator refuses any trace outside it.
import type { ObjectType } from "./taxonomy.ts";
import type { TraceKind, TraceSpec } from "./types.ts";

type Surface = TraceSpec["surface"];

/** Things that stand on the floor: "the floor by the wardrobe" is a real patch of floor. */
const STANDS_ON_FLOOR: ObjectType[] = [
  "desk", "table", "coffee_table", "side_table", "nightstand", "dresser", "wardrobe", "cabinet", "sideboard", "filing_cabinet",
  "bookshelf", "bed", "sofa", "armchair", "chair", "stool", "bench", "ottoman", "tv_stand", "chest", "trunk", "suitcase", "safe",
  "door", "floor_lamp", "potted_plant", "basket", "box", "guitar", "keyboard_instrument", "drum",
];
/** Hard surfaces people take hold of or lean on: where fingers leave prints. */
const HARD_TOUCHED: ObjectType[] = [
  "door", "desk", "table", "coffee_table", "side_table", "nightstand", "dresser", "wardrobe", "cabinet", "sideboard", "filing_cabinet",
  "chest", "trunk", "safe", "box", "suitcase", "toolbox", "mirror", "framed_picture", "desk_lamp", "floor_lamp", "radio",
  "record_player", "typewriter", "telephone", "tv_stand", "bookshelf", "keyboard_instrument",
];
/** Things that stand or hang against a wall: the wall beside them is plain wall. */
const AGAINST_WALL: ObjectType[] = [
  "desk", "dresser", "wardrobe", "cabinet", "sideboard", "filing_cabinet", "bookshelf", "shelf", "bed", "sofa", "tv_stand", "nightstand",
  "chest", "door", "framed_picture", "poster", "mirror", "wall_clock", "noticeboard", "calendar", "map", "desk_lamp", "floor_lamp",
  "radio", "speaker", "record_player", "guitar", "keyboard_instrument", "curtain",
];

export const TRACE_SITES: Record<TraceKind, Partial<Record<Surface, readonly ObjectType[]>>> = {
  // Shoes walk on floors (and rugs: "on" the rug is drawn as floor).
  footprints: { floor: [...STANDS_ON_FLOOR, "rug"] },
  prints: { on: HARD_TOUCHED, wall: ["door"] },
  palm: { on: ["door", "mirror", "desk", "table", "wardrobe", "dresser", "cabinet", "chest", "sideboard"], wall: AGAINST_WALL },
  writing: {
    on: ["mirror", "door", "desk", "wardrobe", "cabinet", "dresser", "sideboard", "chest", "noticeboard", "calendar", "map", "poster", "framed_picture", "table"],
    wall: AGAINST_WALL,
  },
  // A spill soaks into cloth and wood and runs across floors.
  stain: {
    on: ["rug", "bed", "sofa", "armchair", "table", "desk", "coffee_table", "side_table", "nightstand", "curtain", "blanket", "ottoman"],
    floor: [...STANDS_ON_FLOOR, "rug"],
  },
};

/** Whether a trace of `kind` may lie on `surface` by an object of type `anchor`. */
export function traceSiteOk(kind: TraceKind, surface: Surface, anchor: ObjectType): boolean {
  return TRACE_SITES[kind]?.[surface]?.includes(anchor) ?? false;
}

/** The surfaces a kind of trace can use, in the planner's order of preference. */
export const TRACE_SURFACES: Record<TraceKind, Surface[]> = {
  prints: ["on", "wall"], palm: ["on", "wall"], writing: ["wall", "on"], stain: ["on", "floor"], footprints: ["floor"],
};
