// Static validator for schema v2 (shape, ids, references, host rules, the exit,
// the removable object, no literal answers). The simulator (simulate.ts) proves
// the dynamic properties. Returns a list of errors; empty means valid.
import { ARCHETYPES, type ArchetypeId, type HostRule } from "./archetypes.ts";
import { categoryOf, isObjectType, isPortableType, type ObjectType } from "./taxonomy.ts";
import {
  type Condition, type Effect, MODES, type ObjectDef, OVERLAYS, type RoomDefinitionV2, type RoomSecretV2,
  type Trigger, type Value,
} from "./types.ts";

const ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const SLOT_REF = /\{\{\s*([a-z0-9_]+)\s*\}\}/g;
export const slotRefs = (text: string): string[] => [...text.matchAll(SLOT_REF)].map((m) => m[1]);

const typeAllowed = (rule: HostRule | null, t: ObjectType) =>
  !!rule && ((rule.types?.includes(t) ?? false) || (rule.categories?.includes(categoryOf(t)) ?? false));

export function validateDefinition(def: RoomDefinitionV2, secret?: RoomSecretV2): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(m);
  if (def.schema_version !== 2) err("schema_version must be 2");
  if (!MODES.includes(def.mode)) err(`unknown mode ${def.mode}`);
  for (const k of ["title", "objective"] as const) if (typeof def[k] !== "string" || !def[k].trim()) err(`${k} is required`);

  const targets = new Map<string, ObjectDef | null>();   // objects and items share one id space
  const unique = (id: string, what: string, set: Set<string> | Map<string, unknown>) => {
    if (!ID.test(id)) err(`${what} id ${JSON.stringify(id)} is malformed`);
    if (set.has(id)) err(`duplicate ${what} id ${id}`);
  };

  for (const o of def.objects) {
    unique(o.id, "object", targets);
    targets.set(o.id, o);
    if (!Number.isInteger(o.photo_index) || o.photo_index < 0) err(`${o.id}: bad photo_index`);
    const b = o.box;
    if (!b || !(b.x >= 0 && b.y >= 0 && b.w > 0 && b.h > 0 && b.x + b.w <= 1 + 1e-9 && b.y + b.h <= 1 + 1e-9)) err(`${o.id}: box outside 0..1`);
    if (!o.label?.trim()) err(`${o.id}: label is required`);
    if (o.outline !== undefined && !(Array.isArray(o.outline) && o.outline.length >= 3 && o.outline.length <= 64
      && o.outline.every((p) => p && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1))) err(`${o.id}: outline must be 3-64 points inside the photo`);
    if (!isObjectType(o.type)) { err(`${o.id}: unknown type ${o.type}`); continue; }
    const expected = new Map<string, string>();
    if (o.archetype !== null) {
      const spec = ARCHETYPES[o.archetype as ArchetypeId];
      if (!spec) { err(`${o.id}: unknown archetype ${o.archetype}`); continue; }
      const variant = o.variant ?? Object.keys(spec.variants)[0];
      const v = spec.variants[variant];
      if (!v) { err(`${o.id}: unknown ${o.archetype} variant ${variant}`); continue; }
      if (!typeAllowed(v.hosts, o.type)) err(`${o.id}: a ${o.type} cannot host ${o.archetype}/${variant}`);
      for (const c of v.controls) expected.set(c.id, c.domain.kind);
      if (!!v.submit !== !!o.submit || (v.submit && o.submit && v.submit.kind !== o.submit.kind)) err(`${o.id}: submit domain does not match ${o.archetype}`);
    }
    if (o.removable) expected.set("taken", "bool");
    const got = new Map(o.controls.map((c) => [c.id, c.domain.kind]));
    if (got.size !== expected.size || [...expected].some(([k, kind]) => got.get(k) !== kind)) err(`${o.id}: controls do not match its archetype`);
    if (o.exit && o.archetype !== "Door") err(`${o.id}: the exit must be a Door`);
    if (o.archetype === "Door" && !o.exit) err(`${o.id}: a Door must be the exit`);
  }
  const exits = def.objects.filter((o) => o.exit);
  if (exits.length !== 1) err(`exactly one exit required (found ${exits.length})`);
  const exit = exits[0];
  if (exit?.hidden) err("the exit cannot be hidden");
  if (exit && def.finale?.object !== exit.id) err("finale.object must be the exit");
  if (exit && def.finale && exit.variant !== def.finale.kind) err(`finale kind ${def.finale.kind} does not match the door (${exit.variant})`);
  if (def.finale?.kind === "accusation") {
    const ids = new Set<string>();
    for (const opts of [def.finale.suspects, def.finale.motives, def.finale.methods]) {
      if (opts.length !== 3) err("an accusation has exactly 3 options per dimension");
      for (const o of opts) { unique(o.id, "option", ids); ids.add(o.id); }
    }
  }
  if (def.finale?.kind === "ritual" && exit?.submit?.kind === "sequence" && exit.submit.length !== def.finale.length) err("ritual length mismatch");
  if (def.finale?.kind === "combination" && exit?.submit?.kind === "wheels" && exit.submit.count !== def.finale.wheels) err("wheel count mismatch");

  const removable = def.objects.filter((o) => o.removable);
  if (removable.length > 1) err("at most one removable object");
  for (const o of removable) {
    if (o.exit || o.hidden) err(`${o.id}: the removable object cannot be the exit or hidden`);
    if (isObjectType(o.type) && !isPortableType(o.type)) err(`${o.id}: only a small portable object can be removable`);
  }

  for (const i of def.items) {
    unique(i.id, "item", targets);
    targets.set(i.id, null);
    if (!i.name?.trim()) err(`${i.id}: name is required`);
    if (i.archetype) {
      const v = ARCHETYPES[i.archetype]?.variants[i.variant ?? Object.keys(ARCHETYPES[i.archetype].variants)[0]];
      if (!v || v.hosts !== null) err(`${i.id}: ${i.archetype} is not an inventory archetype`);
    }
  }
  const cards = new Set<string>();
  for (const c of def.cards) {
    unique(c.id, "card", cards);
    cards.add(c.id);
    if (!c.title?.trim() || typeof c.text !== "string") err(`${c.id}: title and text are required`);
  }
  for (const i of def.items) if (i.card && !cards.has(i.card)) err(`${i.id}: unknown card ${i.card}`);

  if (secret) errors.push(...validateSecret(def, secret, targets, cards));
  return errors;
}

function validateSecret(def: RoomDefinitionV2, secret: RoomSecretV2, targets: Map<string, ObjectDef | null>, cards: Set<string>): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(m);
  const objects = new Map(def.objects.map((o) => [o.id, o]));
  const items = new Map(def.items.map((i) => [i.id, i]));
  if (secret.schema_version !== 2) err("secret schema_version must be 2");
  if (!secret.ending?.trim()) err("ending is required");

  for (const [name, s] of Object.entries(secret.slots)) {
    if (!/^[a-z0-9_]+$/.test(name)) err(`slot ${name} is malformed`);
    if (typeof s.value !== "string" || !s.value) err(`slot ${name} has no value`);
    for (const f of s.from ?? []) if (!secret.slots[f]) err(`slot ${name}: unknown source ${f}`);
  }
  for (const c of def.cards) for (const r of slotRefs(c.text)) {
    if (!secret.slots[r]) err(`${c.id}: unknown slot {{${r}}}`);
    else if (secret.slots[r].from) err(`${c.id}: derived slot {{${r}}} must never be shown`);
  }
  if (`${def.title} ${def.objective} ${def.intro ?? ""}`.includes("{{")) err("public header text cannot hold slots");

  const steps = new Set(secret.steps.map((s) => s.id));
  for (const s of secret.steps) {
    if (!ID.test(s.id)) err(`step id ${s.id} is malformed`);
    for (const r of s.requires) if (!steps.has(r)) err(`${s.id}: requires unknown step ${r}`);
    if (s.hints.length !== 3 || s.hints.some((h) => !h?.trim())) err(`${s.id}: needs 3 hint rungs`);
  }

  const control = (target: string, id: string) => {
    const o = objects.get(target);
    return (o?.controls ?? items.get(target)?.controls ?? []).find((c) => c.id === id);
  };
  const checkValue = (v: Value, where: string) => { if ("slot" in v && !secret.slots[v.slot]) err(`${where}: unknown slot ${v.slot}`); };
  const checkTrigger = (t: Trigger, where: string) => {
    switch (t.on) {
      case "inspect": if (!objects.has(t.object)) err(`${where}: unknown object ${t.object}`); break;
      case "control": if (!control(t.target, t.control)) err(`${where}: unknown control ${t.target}.${t.control}`); break;
      case "use": if (!items.has(t.item) || !objects.has(t.object)) err(`${where}: bad use trigger`); break;
      case "combine": if (!t.items.every((i) => items.has(i)) || t.items[0] === t.items[1]) err(`${where}: bad combine trigger`); break;
      case "submit": if (!objects.get(t.object)?.submit) err(`${where}: ${t.object} takes no submit`); break;
    }
  };
  const checkCond = (c: Condition, where: string) => {
    if (c.if === "control") {
      const ctl = control(c.target, c.control);
      if (!ctl) err(`${where}: unknown control ${c.target}.${c.control}`);
      else if (ctl.domain.kind !== "bool" && !("slot" in c.eq)) err(`${where}: a value condition must use a slot, not a literal`);
      checkValue(c.eq, where);
    } else if (c.if === "state") { if (!targets.has(c.target)) err(`${where}: unknown target ${c.target}`); checkValue(c.eq, where); }
    else if (c.if === "submitted") { if (!("slot" in c.eq)) err(`${where}: a submit answer must be a slot`); checkValue(c.eq, where); }
    else if (c.if === "holds") { if (!items.has(c.item)) err(`${where}: unknown item ${c.item}`); }
    else if (!steps.has(c.step)) err(`${where}: unknown step ${c.step}`);
  };
  const checkEffect = (e: Effect, where: string) => {
    if ("object" in e && !objects.has(e.object)) err(`${where}: unknown object ${e.object}`);
    if ("item" in e && !items.has(e.item)) err(`${where}: unknown item ${e.item}`);
    if (e.do === "set_state" && !targets.has(e.target)) err(`${where}: unknown target ${e.target}`);
    if (e.do === "show_card" && !cards.has(e.card)) err(`${where}: unknown card ${e.card}`);
    if (e.do === "overlay" && !OVERLAYS.includes(e.overlay)) err(`${where}: unknown overlay ${e.overlay}`);
  };

  const ruleIds = new Set<string>();
  const grantedBy = new Map<string, number>();
  let completes = 0;
  for (const r of secret.rules) {
    const where = `rule ${r.id}`;
    if (!ID.test(r.id) || ruleIds.has(r.id)) err(`${where}: malformed or duplicate id`);
    ruleIds.add(r.id);
    if (r.step && !steps.has(r.step)) err(`${where}: unknown step ${r.step}`);
    checkTrigger(r.trigger, where);
    r.when.forEach((c) => checkCond(c, where));
    r.effects.forEach((e) => checkEffect(e, where));
    const host = "object" in r.trigger ? objects.get(r.trigger.object) : r.trigger.on === "control" ? objects.get(r.trigger.target) : undefined;
    for (const e of r.effects) {
      if (e.do === "complete") {
        completes++;
        if (r.trigger.on !== "submit" || !objects.get(r.trigger.object)?.exit) err(`${where}: only a submit on the exit completes the room`);
      }
      if (e.do !== "grant") continue;
      grantedBy.set(e.item, (grantedBy.get(e.item) ?? 0) + 1);
      // Story props are always found inside a real object's archetype (or assembled from pieces).
      const item = items.get(e.item);
      const fromCombine = r.trigger.on === "combine" && item?.kind === "assembled";
      const fromTake = r.trigger.on === "control" && r.trigger.control === "taken" && host?.removable && item?.kind === "taken";
      const fromHost = r.trigger.on !== "combine" && host?.archetype && ARCHETYPES[host.archetype].holdsItems && item?.kind !== "taken";
      if (!fromCombine && !fromTake && !fromHost) err(`${where}: ${e.item} must be found inside an object that can hold it`);
    }
  }
  if (completes !== 1) err(`exactly one rule must complete the room (found ${completes})`);
  for (const i of def.items) if ((grantedBy.get(i.id) ?? 0) !== 1) err(`${i.id}: must be granted by exactly one rule`);
  for (const s of secret.steps) if (!secret.rules.some((r) => r.step === s.id)) err(`${s.id}: no rule solves it`);

  // The removable object: one take rule that removes it; nothing else refers to it afterwards.
  for (const o of def.objects.filter((x) => x.removable)) {
    const takes = secret.rules.filter((r) => r.trigger.on === "control" && r.trigger.target === o.id && r.trigger.control === "taken");
    const removes = takes.filter((r) =>
      r.effects.some((e) => e.do === "set_state" && e.target === o.id && e.key === "removed" && e.value === true) &&
      r.effects.some((e) => e.do === "overlay" && e.object === o.id && e.overlay === "object_removed") &&
      r.when.some((c) => c.if === "control" && c.target === o.id && c.control === "taken" && "lit" in c.eq && c.eq.lit === true));
    if (takes.length !== 1 || removes.length !== 1) err(`${o.id}: the removable object needs exactly one take rule that removes it`);
    const others = secret.rules.filter((r) => !takes.includes(r) && JSON.stringify([r.trigger, r.when, r.effects]).includes(`"${o.id}"`));
    if (others.length) err(`${o.id}: rules other than its take rule refer to the removable object`);
  }
  return errors;
}
