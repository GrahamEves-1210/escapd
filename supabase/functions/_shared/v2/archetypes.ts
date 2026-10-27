// The archetype catalog: the reusable interactive kit. Each archetype declares
// which real objects may host it (types + required features), its controls and
// their value domains, what it can emit (teach) and accept (ask for), and the
// room-change overlays it produces. Host rules are whitelists, so absurd
// placements are impossible: no lock on a pillow, textiles only LiftUnder.
import type { ControlDef, Overlay, StateValue } from "./types.ts";
import { categoryOf, type Feature, type InventoryObject, type ObjectCategory, type ObjectType } from "./taxonomy.ts";

export type ArchetypeId =
  | "Drawer" | "LiftUnder" | "Readable" | "FrameTilt" | "ClockHands" | "TuningDial"
  | "CombinationLock" | "Light" | "Assemble" | "Decoder" | "Door";

export const SYMBOLS = ["▲", "●", "◆", "■", "★", "✚"] as const;
const ALPHABETS = {
  digits: "0123456789".split(""),
  letters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
  symbols: [...SYMBOLS] as string[],
};
export type WheelAlphabet = keyof typeof ALPHABETS;

export type ControlDomain =
  | { kind: "bool" }
  | { kind: "time" }                                    // "H:MM", hour 1-12, minute 00-55 in 5s
  | { kind: "freq" }                                    // "96.3", 88.0-108.0 in 0.1
  | { kind: "page"; max: number }                       // "47"
  | { kind: "offset"; max: number }                     // "3", cipher ring 1..max
  | { kind: "wheels"; alphabet: WheelAlphabet; count: number }  // submit: one symbol per wheel
  | { kind: "accusation" }                              // submit: [suspect, motive, method]
  | { kind: "sequence"; length: number };               // submit: ritual object ids in order

/** Canonical form of a control value or submit, or null when it is outside the domain. */
export function normalize(domain: ControlDomain, value: unknown): StateValue | null {
  switch (domain.kind) {
    case "bool":
      return typeof value === "boolean" ? value : null;
    case "time": {
      const m = typeof value === "string" ? /^(\d{1,2}):(\d{2})$/.exec(value) : null;
      if (!m) return null;
      const h = Number(m[1]), min = Number(m[2]);
      return h >= 1 && h <= 12 && min % 5 === 0 && min <= 55 ? `${h}:${m[2]}` : null;
    }
    case "freq": {
      const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
      const tenths = Math.round(n * 10);
      return Number.isFinite(n) && Math.abs(n * 10 - tenths) < 1e-6 && tenths >= 880 && tenths <= 1080 ? (tenths / 10).toFixed(1) : null;
    }
    case "page":
    case "offset": {
      const n = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
      return Number.isInteger(n) && n >= 1 && n <= domain.max ? String(n) : null;
    }
    case "wheels":
    case "accusation":
    case "sequence": {
      if (!Array.isArray(value) || !value.every((v) => typeof v === "string" && v.length > 0 && !v.includes("|"))) return null;
      const len = domain.kind === "wheels" ? domain.count : domain.kind === "accusation" ? 3 : domain.length;
      if (value.length !== len) return null;
      if (domain.kind === "wheels" && !value.every((v) => ALPHABETS[domain.alphabet].includes(v))) return null;
      return value.join("|");
    }
  }
}

/** Slot kinds a domain can take (planner binding and simulator candidates). */
export const DOMAIN_SLOT_KIND: Record<ControlDomain["kind"], string | null> = {
  bool: null, time: "time", freq: "freq", page: "page", offset: "offset",
  wheels: "code", accusation: "code", sequence: "code",
};

export interface HostRule {
  types?: ObjectType[];
  categories?: ObjectCategory[];
  anyFeature?: Feature[];        // at least one of these
  allFeatures?: Feature[];       // every one of these
}

export type Emit = "item" | "card" | "room_change" | "exit";
export type Accept = "bool" | "time" | "freq" | "page" | "offset" | "code" | "item" | "pieces";

export interface VariantSpec {
  hosts: HostRule | null;        // null: inventory-only (a prop, not a photo object)
  controls: ControlDef[];
  submit?: ControlDomain;
  initial: Record<string, StateValue>;
}

export interface ArchetypeSpec {
  id: ArchetypeId;
  variants: Record<string, VariantSpec>;   // first key is the default
  emits: Emit[];
  accepts: Accept[];
  overlays: Overlay[];
  holdsItems: boolean;                     // story props may be found inside it
  lockable?: boolean;                      // may start locked (a key opens it)
}

const bool = (id: string): ControlDef => ({ id, domain: { kind: "bool" } });
const FURNITURE_OPENABLE: ObjectType[] = [
  "desk", "nightstand", "dresser", "wardrobe", "cabinet", "sideboard", "filing_cabinet", "tv_stand",
  "chest", "trunk", "box", "suitcase", "safe", "toolbox", "side_table", "coffee_table", "bookshelf",
];
const LOCKABLE: ObjectType[] = [
  "desk", "nightstand", "dresser", "wardrobe", "cabinet", "sideboard", "filing_cabinet", "tv_stand",
  "chest", "trunk", "box", "suitcase", "safe", "toolbox",
];
/** Objects that can carry a mark, a glow or ink (tool-reveal and room-change targets). */
export const MARKABLE_CATEGORIES: ObjectCategory[] = ["furniture", "storage", "wall", "paper", "decor", "electronic", "instrument", "door"];
/** No door in the room: the most door-like exit, in preference order. */
export const DOOR_FALLBACK_TYPES: ObjectType[] = ["wardrobe", "cabinet", "sideboard"];

export const ARCHETYPES: Record<ArchetypeId, ArchetypeSpec> = {
  Drawer: {
    id: "Drawer",
    variants: {
      drawer: { hosts: { types: FURNITURE_OPENABLE, anyFeature: ["has_drawers"] }, controls: [bool("open")], initial: { open: false, locked: false } },
      compartment: { hosts: { types: FURNITURE_OPENABLE, anyFeature: ["has_doors", "can_open", "holds_items"] }, controls: [bool("open")], initial: { open: false, locked: false } },
    },
    emits: ["item", "card"], accepts: ["bool", "item"], overlays: [], holdsItems: true, lockable: true,
  },
  LiftUnder: {
    id: "LiftUnder",
    variants: { lift: { hosts: { categories: ["textile", "decor", "plant", "paper", "storage"], allFeatures: ["can_lift"] }, controls: [bool("lifted")], initial: { lifted: false } } },
    emits: ["item", "card"], accepts: ["bool"], overlays: [], holdsItems: true,
  },
  Readable: {
    id: "Readable",
    variants: {
      card: { hosts: { types: ["book", "book_stack", "notebook", "magazine", "noticeboard", "calendar", "map", "poster"] }, controls: [], initial: {} },
      pages: { hosts: { types: ["book", "book_stack", "bookshelf", "notebook", "magazine"], allFeatures: ["has_pages"] }, controls: [{ id: "page", domain: { kind: "page", max: 300 } }], initial: { page: "1" } },
    },
    emits: ["card", "item"], accepts: ["page"], overlays: ["pinned_card"], holdsItems: true,
  },
  FrameTilt: {
    id: "FrameTilt",
    variants: { tilt: { hosts: { types: ["framed_picture", "poster", "mirror", "map", "calendar"], allFeatures: ["wall_mounted"] }, controls: [bool("tilted")], initial: { tilted: false } } },
    emits: ["item", "card"], accepts: ["bool"], overlays: [], holdsItems: true,
  },
  ClockHands: {
    id: "ClockHands",
    variants: { hands: { hosts: { types: ["wall_clock", "alarm_clock"], allFeatures: ["has_hands"] }, controls: [{ id: "time", domain: { kind: "time" } }], initial: { time: "12:00", panel: false } } },
    emits: ["item", "card", "room_change"], accepts: ["time"], overlays: ["panel_open"], holdsItems: true,
  },
  TuningDial: {
    id: "TuningDial",
    variants: { dial: { hosts: { types: ["radio", "speaker", "record_player"] }, controls: [{ id: "freq", domain: { kind: "freq" } }], initial: { freq: "88.0" } } },
    emits: ["card"], accepts: ["freq"], overlays: [], holdsItems: false,
  },
  CombinationLock: {
    id: "CombinationLock",
    variants: Object.fromEntries((["digits", "letters", "symbols"] as const).map((a) => [a, {
      hosts: { types: LOCKABLE, anyFeature: ["has_doors", "can_open", "has_drawers"] },
      controls: [], submit: { kind: "wheels", alphabet: a, count: 3 }, initial: { open: false, locked: true },
    }])),
    emits: ["item", "card"], accepts: ["code"], overlays: ["panel_open"], holdsItems: true,
  },
  Light: {
    id: "Light",
    variants: {
      lamp: { hosts: { types: ["desk_lamp", "floor_lamp", "string_lights"], allFeatures: ["light_source"] }, controls: [bool("on")], initial: { on: false } },
      uv: { hosts: { types: ["desk_lamp", "floor_lamp"], allFeatures: ["light_source"] }, controls: [bool("on")], initial: { on: false } },
      torch: { hosts: null, controls: [], initial: {} },   // the UV torch prop: used on things
    },
    emits: ["room_change", "card"], accepts: ["bool"], overlays: ["light_on", "glow_mark"], holdsItems: false,
  },
  Assemble: {
    id: "Assemble",
    variants: { pieces: { hosts: null, controls: [], initial: {} } },
    emits: ["item", "card"], accepts: ["pieces"], overlays: [], holdsItems: false,
  },
  Decoder: {
    id: "Decoder",
    variants: { wheel: { hosts: null, controls: [{ id: "offset", domain: { kind: "offset", max: 25 } }], initial: { offset: "1" } } },
    emits: ["card"], accepts: ["offset"], overlays: [], holdsItems: false,
  },
  Door: {
    id: "Door",
    variants: {
      combination: { hosts: { types: ["door", ...DOOR_FALLBACK_TYPES], anyFeature: ["is_door", "has_doors"] }, controls: [], submit: { kind: "wheels", alphabet: "digits", count: 4 }, initial: { open: false } },
      accusation: { hosts: { types: ["door", ...DOOR_FALLBACK_TYPES], anyFeature: ["is_door", "has_doors"] }, controls: [], submit: { kind: "accusation" }, initial: { open: false } },
      ritual: { hosts: { types: ["door", ...DOOR_FALLBACK_TYPES], anyFeature: ["is_door", "has_doors"] }, controls: [], submit: { kind: "sequence", length: 3 }, initial: { open: false } },
    },
    emits: ["exit"], accepts: ["code"], overlays: [], holdsItems: false,
  },
};

export const ARCHETYPE_IDS = Object.keys(ARCHETYPES) as ArchetypeId[];

export function hostMatches(rule: HostRule | null, obj: Pick<InventoryObject, "type" | "features">): boolean {
  if (!rule) return false;
  const typeOk = (rule.types?.includes(obj.type) ?? false) || (rule.categories?.includes(categoryOf(obj.type)) ?? false);
  if (!typeOk) return false;
  if (rule.anyFeature && !rule.anyFeature.some((f) => obj.features.includes(f))) return false;
  if (rule.allFeatures && !rule.allFeatures.every((f) => obj.features.includes(f))) return false;
  return true;
}

/** Every (archetype, variant) a real object can host. Door is only the exit; it is listed too. */
export function hostableArchetypes(obj: Pick<InventoryObject, "type" | "features">): { archetype: ArchetypeId; variant: string }[] {
  const out: { archetype: ArchetypeId; variant: string }[] = [];
  for (const spec of Object.values(ARCHETYPES)) {
    for (const [variant, v] of Object.entries(spec.variants)) if (hostMatches(v.hosts, obj)) out.push({ archetype: spec.id, variant });
  }
  return out;
}

export function variantSpec(archetype: ArchetypeId, variant?: string): VariantSpec {
  const spec = ARCHETYPES[archetype];
  return spec.variants[variant ?? Object.keys(spec.variants)[0]];
}

export const isMarkable = (t: ObjectType): boolean => MARKABLE_CATEGORIES.includes(categoryOf(t));
