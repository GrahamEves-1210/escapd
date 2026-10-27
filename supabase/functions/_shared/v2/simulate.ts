// Simulator: breadth-first search over abstract player actions, using the real
// engine. The simulated player only ever enters values it has *seen* (a slot
// shown on a card it holds, or a derived slot whose sources it has all seen),
// so "solvable" means solvable by reasoning, never by guessing.
//
// Proves: solvable; no softlock (from every reachable state the exit is still
// reachable); the finale only fires once every required step is solved; every
// shown slot is on exactly one card, that card is reachable, and every rule that
// needs the slot fires only after it was seen; derived slots appear on no card.
// Reports pacing metrics from the shortest winning path.
import { DOMAIN_SLOT_KIND, normalize } from "./archetypes.ts";
import { applyAction, initialState } from "./engine.ts";
import type { Action, Condition, PlayState, RoomDefinitionV2, RoomSecretV2, StateValue } from "./types.ts";
import { slotRefs } from "./validate.ts";

export interface SimMetrics {
  requiredSteps: number;     // steps solved on the shortest winning path
  maxChain: number;          // longest dependency chain in the step graph
  revisits: number;          // objects acted on by two or more steps on the winning path
  roomChanges: number;       // required steps whose rule changes the room (an overlay)
  branching: number;         // mean productive actions available along the winning path
  states: number;            // states explored
  pathLength: number;        // actions on the winning path
}

export interface SimReport {
  ok: boolean;
  errors: string[];
  metrics: SimMetrics;
  path: Action[];
}

export interface SimOptions { maxStates?: number }

/** Slots a player knows in this state: shown on a held card, or derived from known slots. */
function knownSlots(state: PlayState, secret: RoomSecretV2, cardSlots: Map<string, string[]>): Set<string> {
  const known = new Set<string>();
  for (const c of state.cards) for (const s of cardSlots.get(c) ?? []) known.add(s);
  for (let grew = true; grew;) {
    grew = false;
    for (const [name, s] of Object.entries(secret.slots)) {
      if (!known.has(name) && s.from && s.from.every((f) => known.has(f))) { known.add(name); grew = true; }
    }
  }
  return known;
}

const condSlots = (c: Condition): string[] => ("eq" in c && "slot" in c.eq ? [c.eq.slot] : []);

export function simulate(def: RoomDefinitionV2, secret: RoomSecretV2, opts: SimOptions = {}): SimReport {
  const maxStates = opts.maxStates ?? 50_000;
  const errors: string[] = [];
  const cardSlots = new Map(def.cards.map((c) => [c.id, slotRefs(c.text)]));

  // Which (target.control) values matter later: read by a condition of a rule that the control itself does
  // not trigger (a condition on the triggering control only filters the value just set). Others are left
  // out of the state key, so opening and closing an empty drawer doesn't multiply states.
  const relevant = new Set<string>();
  for (const r of secret.rules) {
    for (const c of r.when) {
      if (c.if === "state") relevant.add(`${c.target}.${c.key}`);
      const self = r.trigger.on === "control" && c.if === "control" && r.trigger.target === c.target && r.trigger.control === c.control;
      if (c.if === "control" && !self) relevant.add(`${c.target}.${c.control}`);
    }
  }
  const controlIds = new Map(def.objects.map((o) => [o.id, new Set(o.controls.map((c) => c.id))]));
  // Actions that can matter: they match a trigger, or set a control a condition reads.
  const triggers = new Set<string>();
  for (const r of secret.rules) {
    const t = r.trigger;
    if (t.on === "inspect") triggers.add(`i:${t.object}`);
    else if (t.on === "control") triggers.add(`c:${t.target}.${t.control}`);
    else if (t.on === "use") triggers.add(`u:${t.item}>${t.object}`);
    else if (t.on === "combine") triggers.add(`m:${[...t.items].sort().join("+")}`);
    else if (t.on === "submit") triggers.add(`s:${t.object}`);
  }

  const keyOf = (s: PlayState): string => {
    const objs = Object.keys(s.objects).sort().map((id) => {
      const ctl = controlIds.get(id)!;
      const kv = Object.entries(s.objects[id]).filter(([k]) => !ctl.has(k) || relevant.has(`${id}.${k}`)).sort(([a], [b]) => (a < b ? -1 : 1));
      return `${id}{${kv.map(([k, v]) => `${k}=${v}`).join(",")}}`;
    });
    const items = Object.keys(s.items).sort().map((id) => `${id}{${Object.entries(s.items[id]).filter(([k]) => relevant.has(`${id}.${k}`)).map(([k, v]) => `${k}=${v}`).join(",")}}`);
    return [[...s.fired].sort().join(","), [...s.inventory].sort().join(","), objs.join(";"), items.join(";"), s.completed].join("|");
  };

  const actionsFor = (s: PlayState): Action[] => {
    const known = knownSlots(s, secret, cardSlots);
    const knownValues = [...known].map((n) => secret.slots[n]);
    const out: Action[] = [];
    for (const o of def.objects) {
      const st = s.objects[o.id];
      if (st?.hidden || st?.removed) continue;
      if (triggers.has(`i:${o.id}`)) out.push({ type: "inspect", object: o.id });
      for (const c of o.controls) {
        if (!triggers.has(`c:${o.id}.${c.id}`) && !relevant.has(`${o.id}.${c.id}`)) continue;
        if (c.domain.kind === "bool") {
          for (const value of [true, false]) out.push({ type: "set_control", target: o.id, control: c.id, value });
          continue;
        }
        const kind = DOMAIN_SLOT_KIND[c.domain.kind];
        for (const v of knownValues) if (v.kind === kind && normalize(c.domain, v.value) !== null) {
          out.push({ type: "set_control", target: o.id, control: c.id, value: v.value });
        }
      }
      if (o.submit && triggers.has(`s:${o.id}`) && !st?.open) {
        for (const v of knownValues) {
          const parts = v.value.split("|");
          if (v.kind === "code" && normalize(o.submit, parts) !== null) out.push({ type: "submit", object: o.id, value: parts });
        }
      }
      for (const item of s.inventory) if (triggers.has(`u:${item}>${o.id}`)) out.push({ type: "use_item", item, object: o.id });
    }
    for (const item of def.items) {
      if (!s.inventory.includes(item.id)) continue;
      for (const c of item.controls ?? []) {
        if (!triggers.has(`c:${item.id}.${c.id}`)) continue;
        for (const v of knownValues) if (v.kind === DOMAIN_SLOT_KIND[c.domain.kind] && normalize(c.domain, v.value) !== null) {
          out.push({ type: "set_control", target: item.id, control: c.id, value: v.value });
        }
      }
    }
    const inv = [...s.inventory].sort();
    for (let i = 0; i < inv.length; i++) for (let j = i + 1; j < inv.length; j++) {
      if (triggers.has(`m:${inv[i]}+${inv[j]}`)) out.push({ type: "combine", items: [inv[i], inv[j]] });
    }
    return out;
  };

  // Forward BFS
  const start = initialState(def);
  const states: PlayState[] = [start];
  const index = new Map<string, number>([[keyOf(start), 0]]);
  const parent: { from: number; action: Action }[] = [{ from: -1, action: null as unknown as Action }];
  const edges: number[][] = [];
  const productive: number[] = [];
  const firedRule = new Map(secret.rules.map((r) => [r.id, r]));
  const required = secret.steps.filter((s) => !s.optional).map((s) => s.id);
  let truncated = false;
  const slotLeaks = new Set<string>();

  for (let i = 0; i < states.length; i++) {
    const s = states[i];
    edges[i] = [];
    productive[i] = 0;
    if (s.completed) {
      const missing = required.filter((id) => !s.solved.includes(id));
      if (missing.length) errors.push(`shortcut: the exit opens without ${missing.join(", ")}`);
      continue;
    }
    const known = knownSlots(s, secret, cardSlots);
    for (const a of actionsFor(s)) {
      const { state: n, result } = applyAction(def, secret, s, a);
      if (result.outcome !== "ok" && result.outcome !== "nothing") continue;
      const k = keyOf(n);
      let j = index.get(k);
      if (j === i) continue;
      productive[i]++;
      // Every slot a newly fired rule needs must already be known.
      for (const rid of n.fired.slice(s.fired.length)) {
        for (const c of firedRule.get(rid)!.when) for (const slot of condSlots(c)) if (!known.has(slot)) slotLeaks.add(`${rid} fired before {{${slot}}} was seen`);
      }
      if (j === undefined) {
        if (states.length >= maxStates) { truncated = true; continue; }
        j = states.length;
        states.push(n);
        index.set(k, j);
        parent.push({ from: i, action: a });
      }
      edges[i].push(j);
    }
  }
  if (truncated) errors.push(`state space exceeded ${maxStates} states`);
  errors.push(...slotLeaks);

  const wins = states.map((s, i) => (s.completed ? i : -1)).filter((i) => i >= 0);
  if (!wins.length) errors.push("unsolvable: the exit never opens");

  // Softlocks: states from which no winning state is reachable.
  const reverse: number[][] = states.map(() => []);
  edges.forEach((to, from) => to.forEach((t) => reverse[t].push(from)));
  const canWin = new Uint8Array(states.length);
  const queue = [...wins];
  for (const w of wins) canWin[w] = 1;
  while (queue.length) for (const p of reverse[queue.pop()!]) if (!canWin[p]) { canWin[p] = 1; queue.push(p); }
  if (wins.length && !truncated) {
    const stuck = states.findIndex((_, i) => !canWin[i]);
    if (stuck >= 0) errors.push(`softlock: after ${pathTo(stuck).map(describe).join(" > ") || "start"} the exit can no longer open`);
  }

  // Slot coverage: each shown slot on exactly one card, and that card reachable.
  const reachableCards = new Set(states.flatMap((s) => s.cards));
  for (const [name, slot] of Object.entries(secret.slots)) {
    if (slot.from) continue;
    const on = def.cards.filter((c) => cardSlots.get(c.id)!.includes(name));
    if (on.length !== 1) errors.push(`slot {{${name}}} is shown on ${on.length} cards (must be exactly 1)`);
    else if (!reachableCards.has(on[0].id)) errors.push(`slot {{${name}}} is on card ${on[0].id}, which is never reachable`);
  }

  function pathTo(i: number): Action[] {
    const p: Action[] = [];
    for (let k = i; parent[k].from >= 0; k = parent[k].from) p.unshift(parent[k].action);
    return p;
  }

  // Metrics from the shortest winning path (BFS order: the first win is shortest).
  const win = wins[0];
  const path = win === undefined ? [] : pathTo(win);
  const stepObject = new Map(secret.steps.map((s) => [s.id, s.object]));
  const touches = new Map<string, number>();
  let roomChanges = 0;
  let branchSum = 0;
  if (win !== undefined) {
    let k = 0;
    let s = start;
    for (const a of path) {
      branchSum += productive[k];
      const n = applyAction(def, secret, s, a).state;
      for (const rid of n.fired.slice(s.fired.length)) {
        const r = firedRule.get(rid)!;
        if (!r.step) continue;
        const obj = stepObject.get(r.step);
        if (obj) touches.set(obj, (touches.get(obj) ?? 0) + 1);
        if (r.effects.some((e) => e.do === "overlay")) roomChanges++;
      }
      s = n;
      k = index.get(keyOf(n))!;
    }
  }
  const depth = new Map<string, number>();
  const chain = (id: string, seen: Set<string> = new Set()): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (seen.has(id)) return 0;
    seen.add(id);
    const st = secret.steps.find((s) => s.id === id);
    const d = 1 + Math.max(0, ...(st?.requires ?? []).map((r) => chain(r, seen)));
    depth.set(id, d);
    return d;
  };
  const metrics: SimMetrics = {
    requiredSteps: win === undefined ? 0 : states[win].solved.filter((id) => required.includes(id)).length,
    maxChain: Math.max(0, ...secret.steps.map((s) => chain(s.id))),
    revisits: [...touches.values()].filter((n) => n >= 2).length,
    roomChanges,
    branching: path.length ? Math.round((branchSum / path.length) * 100) / 100 : 0,
    states: states.length,
    pathLength: path.length,
  };
  return { ok: errors.length === 0, errors, metrics, path };
}

function describe(a: Action): string {
  switch (a.type) {
    case "inspect": return `inspect ${a.object}`;
    case "set_control": return `set ${a.target}.${a.control}=${a.value as StateValue}`;
    case "use_item": return `use ${a.item} on ${a.object}`;
    case "combine": return `combine ${a.items.join("+")}`;
    case "submit": return `submit ${a.object}`;
  }
}
