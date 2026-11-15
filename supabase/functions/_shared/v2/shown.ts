// What the public definition shows of things the player will see anyway, worked out from the rules once a
// room is planned (and again on a stored room, which may be older than these fields):
//   - what a photograph shows: the room object its writing is for (the lock or the clock its code sets),
//     else the thing it was found in. The app prints a crop of the player's own photo round that object.
//   - what a container holds when opening it is all it takes (a drawer pulled, a cushion lifted, a frame
//     tilted): laid there by the app before the first touch, so it shows the moment the thing moves.
// Neither gives an answer away: a photo of the safe says nothing of its code, and what lies under a
// cushion is seen the instant it's lifted.
import type { CardDef, Effect, Id, ObjectDef, RoomDefinitionV2, RoomSecretV2, Rule, Value } from "./types.ts";

/** The control that opens a container archetype (planner CONTAINER_CONTROL). */
const OPENED_BY: Record<string, string> = { Drawer: "open", LiftUnder: "lifted", FrameTilt: "tilted" };

const refs = (text: string): string[] => [...text.matchAll(/\{\{([a-z0-9_]+)\}\}/g)].map((m) => m[1]);

/** The room object a rule is worked at (never an item, never a trace). */
function placeOf(r: Rule, objects: Map<Id, ObjectDef>): Id | null {
  const t = r.trigger;
  const id = t.on === "control" ? t.target : t.on === "submit" || t.on === "inspect" ? t.object : t.on === "use" ? t.object : null;
  const o = id ? objects.get(id) : undefined;
  return o && !o.trace ? o.id : null;
}

/** Every slot a value takes part in: itself, and each derived slot made from it (a code from its halves). */
function feeds(slot: string, secret: RoomSecretV2): Set<string> {
  const out = new Set([slot]);
  for (let grew = true; grew;) {
    grew = false;
    for (const [name, s] of Object.entries(secret.slots)) {
      if (!out.has(name) && s.from?.some((f) => out.has(f))) {
        out.add(name);
        grew = true;
      }
    }
  }
  return out;
}

const usesSlot = (v: Value, in_: Set<string>) => "slot" in v && in_.has(v.slot);

/** The object a photograph shows: where its writing is used, else where it was found; null when neither is in the room. */
export function photographed(card: CardDef, def: RoomDefinitionV2, secret: RoomSecretV2): Id | null {
  const objects = new Map(def.objects.map((o) => [o.id, o]));
  const slots = new Set(refs(card.text).flatMap((s) => [...feeds(s, secret)]));
  if (slots.size) {
    for (const r of secret.rules) {
      const used = r.when.some((c) => (c.if === "control" || c.if === "state" || c.if === "submitted") && usesSlot(c.eq, slots));
      const at = used ? placeOf(r, objects) : null;
      if (at) return at;
    }
  }
  const shows = (e: Effect) => (e.do === "show_card" && e.card === card.id) || (e.do === "grant" && def.items.find((i) => i.id === e.item)?.card === card.id);
  for (const r of secret.rules) {
    const at = r.effects.some(shows) ? placeOf(r, objects) : null;
    if (at) return at;
  }
  return null;
}

/** What a container holds when opening it is all it takes; null when it holds nothing that way. */
export function heldIn(o: ObjectDef, def: RoomDefinitionV2, secret: RoomSecretV2): ObjectDef["holds"] | null {
  const control = o.archetype ? OPENED_BY[o.archetype] : undefined;
  if (!control || o.initial.locked === true) return null;
  const items: Id[] = [], cards: Id[] = [];
  const itemCards = new Set(def.items.flatMap((i) => (i.card ? [i.card] : [])));
  for (const r of secret.rules) {
    const t = r.trigger;
    if (t.on !== "control" || t.target !== o.id || t.control !== control) continue;
    // Only "opened, nothing else": a rule waiting on anything more would show its find too early.
    const plain = r.when.length === 1 && r.when[0].if === "control" && r.when[0].target === o.id && r.when[0].control === control &&
      "lit" in r.when[0].eq && r.when[0].eq.lit === true;
    if (!plain) continue;
    for (const e of r.effects) {
      if (e.do === "grant") items.push(e.item);
      // An item's own card comes with the item (read when it's examined), never lying beside it.
      if (e.do === "show_card" && !itemCards.has(e.card)) cards.push(e.card);
    }
  }
  return items.length || cards.length ? { items, cards } : null;
}

/** The definition with what photographs show and what containers hold filled in (fields already set are kept). */
export function withShown(def: RoomDefinitionV2, secret: RoomSecretV2): RoomDefinitionV2 {
  return {
    ...def,
    objects: def.objects.map((o) => {
      if (o.holds) return o;
      const holds = heldIn(o, def, secret);
      return holds ? { ...o, holds } : o;
    }),
    cards: def.cards.map((c) => {
      if (c.look !== "photo" || c.object) return c;
      const object = photographed(c, def, secret);
      return object ? { ...c, object } : c;
    }),
  };
}
