// The v2 engine: a deterministic rule interpreter, the single authority on what
// happens in a room. Pure (no I/O, no clock, no randomness), so the play-action
// edge function, the simulator, the validator and the app's local preview all
// run the same code. Answers live only in the secret; results carry rendered
// cards (facts the player has legitimately found) and never a slot otherwise.
import { normalize, variantSpec } from "./archetypes.ts";
import type {
  Action, ActionResult, ApplyOptions, CardDef, Condition, Effect, Id, ItemDef, ObjectDef, PlayState,
  PublicEffect, RoomDefinitionV2, RoomSecretV2, Rule, StateValue, Trigger, Value,
} from "./types.ts";

interface Index {
  objects: Map<Id, ObjectDef>;
  items: Map<Id, ItemDef>;
  cards: Map<Id, CardDef>;
}
const indexCache = new WeakMap<RoomDefinitionV2, Index>();
function indexOf(def: RoomDefinitionV2): Index {
  let ix = indexCache.get(def);
  if (!ix) {
    ix = {
      objects: new Map(def.objects.map((o) => [o.id, o])),
      items: new Map(def.items.map((i) => [i.id, i])),
      cards: new Map(def.cards.map((c) => [c.id, c])),
    };
    indexCache.set(def, ix);
  }
  return ix;
}

export function initialState(def: RoomDefinitionV2): PlayState {
  const objects: PlayState["objects"] = {};
  for (const o of def.objects) objects[o.id] = { ...o.initial, ...(o.hidden ? { hidden: true } : {}) };
  return { objects, items: {}, inventory: [], solved: [], fired: [], cards: [], seen: [], overlays: [], completed: false };
}

function cloneState(s: PlayState): PlayState {
  const objects: PlayState["objects"] = {};
  for (const k in s.objects) objects[k] = { ...s.objects[k] };
  const items: PlayState["items"] = {};
  for (const k in s.items) items[k] = { ...s.items[k] };
  return {
    objects, items, inventory: [...s.inventory], solved: [...s.solved], fired: [...s.fired], cards: [...s.cards],
    seen: [...s.seen], overlays: [...s.overlays], completed: s.completed,
  };
}

/** A card's text with its {{slots}} filled from the secret. */
export function renderCard(card: CardDef, secret: RoomSecretV2): string {
  return card.text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/g, (m, name: string) => {
    const slot = secret.slots[name];
    return slot ? slot.text ?? slot.value : m;
  });
}

const resolve = (v: Value, secret: RoomSecretV2): StateValue | undefined =>
  "slot" in v ? secret.slots[v.slot]?.value : v.lit;

function readValue(state: PlayState, target: Id, key: string): StateValue | undefined {
  return state.objects[target]?.[key] ?? state.items[target]?.[key];
}

function holds(state: PlayState, cond: Condition, secret: RoomSecretV2, submitted: string | null): boolean {
  switch (cond.if) {
    case "control":
      return readValue(state, cond.target, cond.control) === resolve(cond.eq, secret);
    case "state":
      return (readValue(state, cond.target, cond.key) ?? false) === resolve(cond.eq, secret);
    case "submitted":
      return submitted !== null && submitted === resolve(cond.eq, secret);
    case "holds":
      return state.inventory.includes(cond.item);
    case "solved":
      return state.solved.includes(cond.step);
  }
}

function triggerMatches(t: Trigger, a: Action): boolean {
  switch (t.on) {
    case "inspect": return a.type === "inspect" && a.object === t.object;
    // Looking at an object again re-checks its controls' rules: a cushion lifted before its step was
    // open still gives up what's under it once the player comes back, without lifting it twice.
    case "control":
      return (a.type === "set_control" && a.target === t.target && a.control === t.control) ||
        (a.type === "inspect" && a.object === t.target);
    case "use": return a.type === "use_item" && a.item === t.item && a.object === t.object;
    case "combine":
      return a.type === "combine" &&
        ((a.items[0] === t.items[0] && a.items[1] === t.items[1]) || (a.items[0] === t.items[1] && a.items[1] === t.items[0]));
    case "submit": return a.type === "submit" && a.object === t.object;
    case "auto": return false;
  }
}

function applyEffect(e: Effect, state: PlayState, def: RoomDefinitionV2, secret: RoomSecretV2, out: PublicEffect[]): void {
  const ix = indexOf(def);
  switch (e.do) {
    case "open":
    case "close":
      state.objects[e.object] = { ...state.objects[e.object], open: e.do === "open", ...(e.do === "open" ? { locked: false } : {}) };
      break;
    case "reveal":
      state.objects[e.object] = { ...state.objects[e.object], hidden: false };
      break;
    case "grant": {
      if (state.inventory.includes(e.item)) return;
      state.inventory.push(e.item);
      const item = ix.items.get(e.item);
      if (item?.controls?.length) {
        const init = item.archetype ? variantSpec(item.archetype, item.variant).initial : {};
        state.items[e.item] = Object.fromEntries(item.controls.map((c) => [c.id, init[c.id] ?? (c.domain.kind === "bool" ? false : "")]));
      }
      break;
    }
    case "consume":
      if (!state.inventory.includes(e.item)) return;
      state.inventory = state.inventory.filter((i) => i !== e.item);
      delete state.items[e.item];
      break;
    case "set_state":
      if (state.objects[e.target]) state.objects[e.target] = { ...state.objects[e.target], [e.key]: e.value };
      else if (state.items[e.target]) state.items[e.target] = { ...state.items[e.target], [e.key]: e.value };
      break;
    case "show_card": {
      const card = ix.cards.get(e.card);
      if (!card) return;
      if (!state.cards.includes(e.card)) state.cards.push(e.card);
      out.push({ do: "show_card", card: card.id, title: card.title, text: renderCard(card, secret) });
      return;
    }
    case "overlay": {
      const mark = e.text ? renderCard({ id: "", title: "", text: e.text }, secret) : undefined;
      if (!state.overlays.some((o) => o.object === e.object && o.overlay === e.overlay)) {
        state.overlays.push({ object: e.object, overlay: e.overlay, ...(mark ? { mark } : {}) });
      }
      // The client gets the writing rendered, never the slot reference.
      out.push({ do: "overlay", object: e.object, overlay: e.overlay, ...(mark ? { text: mark } : {}) });
      return;
    }
    case "complete":
      state.completed = true;
      out.push({ do: "complete", ending: secret.ending });
      return;
    case "beat":
      break;
  }
  out.push(e as PublicEffect);
}

function fire(rule: Rule, state: PlayState, def: RoomDefinitionV2, secret: RoomSecretV2, out: PublicEffect[]): void {
  state.fired.push(rule.id);
  for (const e of rule.effects) applyEffect(e, state, def, secret, out);
  if (rule.step && !state.solved.includes(rule.step)) {
    state.solved.push(rule.step);
    out.push({ do: "solved", step: rule.step });
  }
}

/** Fires every unfired rule the action triggers, then auto rules to a fixpoint. Returns how many fired. */
function runRules(action: Action | null, submitted: string | null, state: PlayState, def: RoomDefinitionV2, secret: RoomSecretV2, out: PublicEffect[]): number {
  let n = 0;
  if (action) {
    for (const r of secret.rules) {
      if (state.fired.includes(r.id) || !triggerMatches(r.trigger, action)) continue;
      if (r.when.every((c) => holds(state, c, secret, submitted))) { fire(r, state, def, secret, out); n++; }
    }
  }
  for (let changed = true; changed;) {
    changed = false;
    for (const r of secret.rules) {
      if (r.trigger.on !== "auto" || state.fired.includes(r.id)) continue;
      if (r.when.every((c) => holds(state, c, secret, null))) { fire(r, state, def, secret, out); n++; changed = true; }
    }
  }
  return n;
}

const invalid = (state: PlayState, reason: string) => ({ state, result: { outcome: "invalid", reason, effects: [] } as ActionResult });

/** Why an object cannot be acted on, or null. */
function objectBlock(state: PlayState, def: RoomDefinitionV2, id: Id): string | null {
  if (!indexOf(def).objects.has(id)) return "unknown_object";
  const s = state.objects[id];
  if (s?.hidden) return "hidden";
  if (s?.removed) return "removed";
  return null;
}

export function applyAction(
  def: RoomDefinitionV2, secret: RoomSecretV2, state: PlayState, action: Action, opts: ApplyOptions = {},
): { state: PlayState; result: ActionResult } {
  if (state.completed) return invalid(state, "completed");
  const ix = indexOf(def);
  const next = cloneState(state);
  const out: PublicEffect[] = [];
  let submitted: string | null = null;
  let changed = false;
  let normalized: Action = action;

  switch (action.type) {
    case "inspect": {
      const block = objectBlock(state, def, action.object);
      if (block) return invalid(state, block);
      if (!next.seen.includes(action.object)) { next.seen.push(action.object); changed = true; }
      break;
    }
    case "set_control": {
      const obj = ix.objects.get(action.target);
      const item = ix.items.get(action.target);
      if (obj) {
        const block = objectBlock(state, def, obj.id);
        if (block) return invalid(state, block);
      } else if (!item) return invalid(state, "unknown_object");
      else if (!state.inventory.includes(item.id)) return invalid(state, "not_held");
      const control = (obj?.controls ?? item?.controls ?? []).find((c) => c.id === action.control);
      if (!control) return invalid(state, "unknown_control");
      const value = normalize(control.domain, action.value);
      if (value === null) return invalid(state, "bad_value");
      const bucket = obj ? next.objects : next.items;
      // Archetype logic: a locked container does not open.
      if (obj && action.control === "open" && value === true && bucket[obj.id]?.locked) {
        return { state, result: { outcome: "locked", effects: [] } };
      }
      changed = bucket[action.target][action.control] !== value;
      bucket[action.target] = { ...bucket[action.target], [action.control]: value };
      normalized = { ...action, value };
      break;
    }
    case "use_item": {
      if (!state.inventory.includes(action.item)) return invalid(state, "not_held");
      const block = objectBlock(state, def, action.object);
      if (block) return invalid(state, block);
      break;
    }
    case "combine": {
      const [a, b] = action.items;
      if (a === b || !state.inventory.includes(a) || !state.inventory.includes(b)) return invalid(state, "not_held");
      break;
    }
    case "submit": {
      const block = objectBlock(state, def, action.object);
      if (block) return invalid(state, block);
      const obj = ix.objects.get(action.object)!;
      if (!obj.submit) return invalid(state, "not_a_lock");
      if (state.objects[obj.id]?.open) return invalid(state, "already_open");
      if (opts.cooldownActive) return invalid(state, "cooldown");
      const value = normalize(obj.submit, action.value);
      if (value === null) return invalid(state, "bad_value");
      if (obj.submit.kind === "accusation" && def.finale.kind === "accusation") {
        const f = def.finale;
        const ok = [f.suspects, f.motives, f.methods].every((opts, i) => opts.some((o) => o.id === action.value[i]));
        if (!ok) return invalid(state, "bad_value");
      }
      if (obj.submit.kind === "sequence" && !action.value.every((id) => ix.objects.has(id))) return invalid(state, "bad_value");
      submitted = value as string;
      break;
    }
  }

  const fired = runRules(normalized, submitted, next, def, secret, out);
  if (action.type === "submit" && fired === 0) {
    return { state, result: { outcome: "wrong", effects: [], start_cooldown: true } };
  }
  if (fired === 0) return { state: changed ? next : state, result: { outcome: "nothing", effects: [] } };
  return { state: next, result: { outcome: "ok", effects: out, ...(next.completed ? { completed: true } : {}) } };
}
