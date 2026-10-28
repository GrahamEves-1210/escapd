import { assert, assertEquals } from "jsr:@std/assert@1";
import { renderCard } from "./engine.ts";
import { planRoom, type PlanResult } from "./planner.ts";
import { BEDROOM_NO_DOOR, BEDROOM_WITH_DOOR, FULL_15, obj, planProblems, seededRandomInt, SPARSE_5 } from "./test_fixtures.ts";
import { MODES } from "./types.ts";

const ROOMS = { BEDROOM_WITH_DOOR, BEDROOM_NO_DOOR, SPARSE_5, FULL_15 };

for (const [name, inv] of Object.entries(ROOMS)) {
  for (const mode of MODES) {
    Deno.test(`planner: ${name} plans a valid ${mode} room`, () => {
      const r = planRoom(inv, { mode, seed: name, randomInt: seededRandomInt(7) });
      assertEquals(planProblems(r, mode), []);
    });
  }
}

Deno.test("planner: the exit is the real door when there is one", () => {
  for (const mode of MODES) {
    const r = planRoom(BEDROOM_WITH_DOOR, { mode, seed: "door" });   // crypto minting
    assert(r.ok);
    const exit = r.definition.objects.find((o) => o.exit)!;
    assertEquals([exit.type, exit.archetype, exit.variant], ["door", "Door", r.definition.finale.kind]);
  }
});

Deno.test("planner: no door falls back to the wardrobe", () => {
  for (const mode of MODES) {
    const r = planRoom(BEDROOM_NO_DOOR, { mode, seed: "nodoor", randomInt: seededRandomInt(3) });
    assert(r.ok);
    assertEquals(r.definition.objects.find((o) => o.exit)!.type, "wardrobe");
  }
});

Deno.test("planner: no door and nothing door-like fails with no_exit", () => {
  const inv = BEDROOM_NO_DOOR.filter((o) => o.type !== "wardrobe");
  const r = planRoom(inv, { mode: "noir", seed: "x" });
  assert(!r.ok && r.reason === "no_exit", JSON.stringify(r));
});

Deno.test("planner: a sparse room plans two threads; a bare one fails with too_few_objects", () => {
  for (const mode of MODES) {
    const r = planRoom(SPARSE_5, { mode, seed: "sparse", randomInt: seededRandomInt(5) });
    assert(r.ok);
    assertEquals(r.summary.threads, 2);
  }
  const bare = planRoom([obj("door", 0), obj("desk", 1), obj("bed", 2), obj("pillow", 3)], { mode: "noir", seed: "bare" });
  assert(!bare.ok && bare.reason === "too_few_objects" && bare.detail.length > 0, JSON.stringify(bare));
});

Deno.test("planner: the same seed and minting stream give the same room", () => {
  const a = planRoom(FULL_15, { mode: "noir", seed: "room-1", randomInt: seededRandomInt(11) });
  const b = planRoom(FULL_15, { mode: "noir", seed: "room-1", randomInt: seededRandomInt(11) });
  assertEquals(JSON.stringify(a), JSON.stringify(b));
});

Deno.test("planner: crime scene accusation and paranormal ritual are well formed", () => {
  const crime = planRoom(FULL_15, { mode: "crime_scene", seed: "c", randomInt: seededRandomInt(2) });
  assert(crime.ok && crime.definition.finale.kind === "accusation");
  const f = crime.definition.finale;
  // The true answers are derived (from the evidence ruling the others out), never shown.
  const answers = Object.values(crime.secret.slots).filter((s) => s.kind === "option" && s.from).map((s) => s.value);
  assertEquals(answers.length, 3);
  [f.suspects, f.motives, f.methods].forEach((opts, i) => assert(opts.some((o) => o.id === answers[i])));

  const para = planRoom(FULL_15, { mode: "paranormal", seed: "p", randomInt: seededRandomInt(2) });
  assert(para.ok && para.definition.finale.kind === "ritual");
  const ritual = Object.values(para.secret.slots).filter((s) => s.kind === "object").map((s) => s.value);
  assertEquals(new Set(ritual).size, para.definition.finale.length);
  for (const id of ritual) assert(para.definition.objects.some((o) => o.id === id && !o.exit && !o.removable), id);
});

Deno.test("planner: threads spread across photos and the room keeps herrings", () => {
  const r = planRoom(BEDROOM_WITH_DOOR, { mode: "noir", seed: "spread", randomInt: seededRandomInt(9) });
  assert(r.ok);
  assert(r.summary.photos >= 3, `${r.summary.photos} photos`);
  const stepObjects = new Set(r.secret.steps.map((s) => s.object));
  assert(r.definition.objects.some((o) => !stepObjects.has(o.id) && !o.exit), "no herring");
});

// ---------------------------------------------------------------------------
// The planner's own words (what players read on rooms planned on the device)
// ---------------------------------------------------------------------------
const planned = (inv: typeof FULL_15, mode: (typeof MODES)[number], seed: string) => {
  const r = planRoom(inv, { mode, seed, randomInt: seededRandomInt(4) });
  assert(r.ok, JSON.stringify(r));
  return r as Extract<PlanResult, { ok: true }>;
};
const SEEDS = ["w1", "w2", "w3", "w4", "w5", "w6"];

Deno.test("planner: the accusation is a deduction: the evidence rules out all but one suspect, motive and method", () => {
  for (const inv of [FULL_15, BEDROOM_WITH_DOOR, SPARSE_5]) for (const seed of SEEDS) {
    const { definition: def, secret } = planned(inv, "crime_scene", seed);
    assert(def.finale.kind === "accusation");
    const shown = new Set(def.cards.flatMap((c) => [...c.text.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/g)].map((m) => m[1])));
    for (const opts of [def.finale.suspects, def.finale.motives, def.finale.methods]) {
      assertEquals(opts.length, 3);
      for (const o of opts) assert(!/^(Suspect|Motive|Method) [ABC]$/.test(o.name), o.name);
      assertEquals(new Set(opts.map((o) => o.name)).size, 3);
      // Exactly two of the three are named on a card (ruled out); the third is derived from those two.
      const ruledOut = Object.entries(secret.slots).filter(([n, s]) => s.kind === "option" && !s.from && shown.has(n) && opts.some((o) => o.id === s.value));
      assertEquals(new Set(ruledOut.map(([, s]) => s.value)).size, 2);
      const answer = Object.values(secret.slots).find((s) => s.kind === "option" && s.from && opts.some((o) => o.id === s.value))!;
      assert(!ruledOut.some(([, s]) => s.value === answer.value));
      assertEquals([...answer.from!].sort(), ruledOut.map(([n]) => n).sort());
    }
  }
});

Deno.test("planner: cards are findings, never labels, and never name the object a value is for", () => {
  for (const mode of MODES) for (const inv of [FULL_15, BEDROOM_WITH_DOOR, SPARSE_5]) for (const seed of SEEDS) {
    const { definition: def, secret } = planned(inv, mode, seed);
    const label = new Map(def.objects.map((o) => [o.id, o.label]));
    // Which objects each slot is for: the rules that need it (or a value derived from it).
    const usedBy = new Map<string, Set<string>>();
    const parents = (name: string): string[] => [name, ...Object.entries(secret.slots).filter(([, s]) => s.from?.includes(name)).flatMap(([n]) => parents(n))];
    for (const name of Object.keys(secret.slots)) {
      const set = new Set<string>();
      for (const p of parents(name)) for (const r of secret.rules) {
        if (!r.when.some((c) => "eq" in c && "slot" in c.eq && c.eq.slot === p)) continue;
        const t = r.trigger;
        if (t.on === "submit" || t.on === "inspect") set.add(t.object);
        if (t.on === "control" || t.on === "use") set.add(t.on === "use" ? t.object : t.target);
      }
      if (secret.slots[name].kind === "object") set.add(secret.slots[name].value);
      usedBy.set(name, set);
    }
    for (const c of def.cards) {
      const text = renderCard(c, secret);
      assert(!/^(Code|Page|Time|Frequency|Offset|Suspect|Motive|Method|Ritual|Evidence|Coded line|Cipher ring)\b[^:\n]*:/m.test(c.text), `${mode} ${seed}: a label: ${c.text}`);
      for (const [, slot] of c.text.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/g)) {
        for (const id of usedBy.get(slot) ?? []) {
          const name = label.get(id);
          if (name) assert(!new RegExp(`\\b${name}\\b`, "i").test(text), `${mode} ${seed}: "${text}" names the ${name}`);
        }
      }
      assert(!/[0-9]/.test(c.text.replace(/\{\{[^}]*\}\}/g, "")), `${mode}: digits outside a slot: ${c.text}`);
    }
  }
});

Deno.test("planner: found items carry no card that repeats them; paired halves differ; names are capitalised", () => {
  for (const mode of MODES) for (const inv of [FULL_15, BEDROOM_WITH_DOOR, SPARSE_5]) for (const seed of SEEDS) {
    const { definition: def } = planned(inv, mode, seed);
    for (const i of def.items) {
      assert(/^[A-Z]/.test(i.name), `${mode}: ${i.name}`);
      // Only an assembled item has a card: what its pieces say together.
      if (i.card) assertEquals(i.kind, "assembled", `${mode}: ${i.name} has a card`);
      assert(i.kind !== "prop", `${mode}: a note is a card to read, not an item: ${i.name}`);
    }
    assertEquals(new Set(def.items.map((i) => i.name)).size, def.items.length, `${mode}: duplicate item names`);
    const texts = def.cards.map((c) => `${c.title}|${c.text}`);
    assertEquals(new Set(texts).size, texts.length, `${mode}: duplicate cards`);
  }
});

Deno.test("planner: each mode has its own objective and ending", () => {
  const text = MODES.map((mode) => {
    const { definition: def, secret } = planned(FULL_15, mode, "voice");
    assert(!/^Find the combination and open/.test(def.objective));
    return `${def.objective}|${secret.ending}`;
  });
  assertEquals(new Set(text).size, 3);
});

Deno.test("planner: mechanisms fit their objects: a drawer is pulled, an open bookshelf never swings a door", () => {
  for (const mode of MODES) for (const inv of [FULL_15, BEDROOM_WITH_DOOR]) for (const seed of SEEDS) {
    const { definition: def } = planned(inv, mode, seed);
    for (const o of def.objects) {
      if (o.type === "bookshelf") assert(o.archetype !== "Drawer", `${mode}: bookshelf as ${o.archetype}/${o.variant}`);
      if (o.type === "desk" && o.archetype === "Drawer") assertEquals(o.variant, "drawer");
    }
  }
});

Deno.test("planner: the ritual describes its objects without naming them, and never points at where it was found", () => {
  for (const inv of [FULL_15, BEDROOM_WITH_DOOR, SPARSE_5]) for (const seed of SEEDS) {
    const { definition: def, secret } = planned(inv, "paranormal", seed);
    for (const [name, s] of Object.entries(secret.slots).filter(([, s]) => s.kind === "object")) {
      const obj = def.objects.find((o) => o.id === s.value)!;
      assert(!new RegExp(`\\b${obj.label}\\b`, "i").test(s.text ?? ""), `${s.text} names the ${obj.label}`);
      const card = def.cards.find((c) => c.text.includes(`{{${name}}}`))!;
      const shownAt = secret.rules.filter((r) => r.effects.some((e) => e.do === "show_card" && e.card === card.id))
        .map((r) => ("object" in r.trigger ? r.trigger.object : r.trigger.on === "control" ? r.trigger.target : null));
      assert(!shownAt.includes(obj.id), `${obj.label}'s card is found at the ${obj.label}`);
    }
  }
});

Deno.test("planner: a box mostly inside another object's is never kept as an empty herring over it", () => {
  const cabinet = obj("cabinet", 1, { box: [200, 50, 650, 350], salience: 0.9 });
  const safe = obj("safe", 1, { box: [300, 100, 450, 250], salience: 0.5 });
  const inv = [...SPARSE_5, cabinet, safe];
  for (const mode of MODES) {
    const r = planRoom(inv, { mode, seed: "nested", randomInt: seededRandomInt(6) });
    assert(r.ok);
    const used = new Set(r.secret.steps.map((s) => s.object));
    const kept = r.definition.objects.find((o) => o.id === "safe");
    if (kept) assert(used.has(kept.id) || Object.values(r.secret.slots).some((s) => s.value === kept.id), `${mode}: the safe is an empty herring`);
  }
});
