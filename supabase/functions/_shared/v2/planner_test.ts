import { assert, assertEquals } from "jsr:@std/assert@1";
import { applyAction, initialState, renderCard } from "./engine.ts";
import { describeObject, DURATIONS, NARROWED_DEATH, PARTIAL_ALIBIS } from "./copy.ts";
import { orderPuzzle, planRoom, type PlanResult, seededRandom } from "./planner.ts";
import { finaleLogic, simulate } from "./simulate.ts";
import { categoryOf } from "./taxonomy.ts";
import { BEDROOM_NO_DOOR, BEDROOM_WITH_DOOR, FULL_15, obj, planProblems, seededRandomInt, SPARSE_5, syntheticInventory } from "./test_fixtures.ts";
import { slotRefs, wordClashes } from "./validate.ts";
import { MODES, orderHolds } from "./types.ts";

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
      // Only an assembled item has a card (what its pieces say together), or a note that reads only with a
      // tool, whose card says how it reads (it smells of lemons; it's written backwards), never a value.
      const card = i.card ? def.cards.find((c) => c.id === i.card)! : undefined;
      // (Or a key's impression in soap: drawn from its slot, never printed.)
      if (card) assert(i.kind === "assembled" || (i.kind === "prop" && (!card.text.includes("{{") || card.look === "impression")) || i.archetype === "Balance", `${mode}: ${i.name} has a card`);
      if (i.kind === "prop") assert(card, `${mode}: a note is a card to read, not an item: ${i.name}`);
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

// ---------------------------------------------------------------------------
// The case's header, the evidence, the UV traces
// ---------------------------------------------------------------------------
Deno.test("planner: no invented case names; every case has a brief in its mode's voice", () => {
  for (const mode of MODES) for (const seed of SEEDS) {
    const { definition: def, secret } = planned(FULL_15, mode, seed);
    assert(/^Case no\. \d{5}$/.test(def.title), def.title);
    assert(def.brief && def.brief.length <= 600 && !/[0-9]/.test(def.brief), def.brief);
    const sentences = def.brief.split(/(?<=[.!?])\s+/).length;
    assert(sentences >= 2 && sentences <= 4, `${mode}: ${sentences} sentences`);
    // Crime scene: the time of death the alibis are read against is stated up front, and kept.
    if (mode === "crime_scene") for (const k of secret.keep ?? []) assert(def.brief.includes(k) && def.objective.includes(k));
  }
});

Deno.test("planner: evidence reads as documents, never a verdict; names are plain", () => {
  for (const mode of MODES) for (const inv of [FULL_15, BEDROOM_WITH_DOOR, SPARSE_5]) for (const seed of SEEDS) {
    const { definition: def, secret } = planned(inv, mode, seed);
    for (const c of def.cards) {
      const text = renderCard(c, secret);
      assert(!/ruled out|eliminated|✗/i.test(text), `${mode}: a verdict: ${text}`);
      assert(!/personal effect/i.test(`${c.title} ${text}`), c.title);
    }
    for (const n of [...def.items.map((i) => i.name), ...def.objects.map((o) => o.label)]) assert(!/personal effect/i.test(n), n);
  }
});

Deno.test("planner: UV traces sit on the photo by a real object; the light shows them and nothing reports on them", () => {
  let rooms = 0;
  for (const mode of MODES) for (const inv of [FULL_15, BEDROOM_WITH_DOOR, SPARSE_5]) for (const seed of SEEDS) {
    const { definition: def, secret } = planned(inv, mode, seed);
    const traces = def.objects.filter((o) => o.trace);
    if (!traces.length) continue;
    rooms++;
    const torch = def.items.find((i) => i.archetype === "Light")!;
    assert(torch, `${mode}: traces but no UV flashlight`);
    for (const t of traces) {
      const b = t.box;
      assert(b.x >= 0 && b.y >= 0 && b.x + b.w <= 1 && b.y + b.h <= 1, `${t.id} off the photo`);
      if (t.trace!.surface === "floor") assert(b.y >= 0.5, `${t.id}: a floor trace in the top half`);
      if (t.trace!.surface === "wall") assert(b.y + b.h <= 0.73, `${t.id}: a wall trace on the floor`);
      const anchor = inv.find((o) => def.objects.some((d) => d.id === t.trace!.anchor && d.label === o.label));
      if (anchor) assertEquals(anchor.photo_index, t.photo_index);
      // What it shows is in the definition, for the app to draw: every kind has its attributes.
      const s = t.trace!;
      if (s.kind === "footprints") assert(s.size && s.tread, `${t.id}: footprints with no size or tread`);
      if (s.kind === "prints" || s.kind === "palm") assert(s.pattern, `${t.id}: prints with no pattern`);
      if (s.kind === "stain") assert(s.stain, `${t.id}: a stain of nothing`);
      if (s.kind === "writing") assert(s.hand, `${t.id}: writing in no hand`);
      // The light shows it, and that is all: the magnifier reads no report, before or after.
      let state = initialState(def);
      state = { ...state, inventory: [torch.id] };
      assertEquals(applyAction(def, secret, state, { type: "inspect", object: t.id }).result.outcome, "nothing");
      const lit = applyAction(def, secret, state, { type: "use_item", item: torch.id, object: t.id });
      assertEquals(lit.result.outcome, "ok");
      const glow = lit.result.effects.find((e) => e.do === "overlay" && e.object === t.id);
      assert(glow && glow.do === "overlay");
      assert(!lit.result.effects.some((e) => e.do === "beat"), `${t.id}: a beat narrates the light finding it`);
      assertEquals(applyAction(def, secret, lit.state, { type: "inspect", object: t.id }).result.outcome, "nothing");
      const logged = lit.result.effects.filter((e) => e.do === "show_card");
      if (s.kind === "writing" && !s.text) {
        // Writing that holds an answer: never in the public definition; its words come with the light,
        // and the casebook keeps exactly those words.
        assert(glow.text, `${t.id}: writing with no words`);
        assertEquals(logged.length, 1);
        const card = logged[0];
        assert(card.do === "show_card");
        assertEquals(card.text, glow.text, "the casebook keeps the wall's words, and only those");
        assert(card.do === "show_card" && !/glow|ultraviolet|UV|lifted|report/i.test(card.text), `a report: ${card.do === "show_card" && card.text}`);
      } else {
        assertEquals(logged.length, 0, `${t.id}: a ${s.kind} trace logs a card`);
        if (s.kind === "writing") assertEquals(glow.text, s.text);
      }
    }
    // Two traces on one photo never overlap.
    for (const a of traces) for (const c of traces) {
      if (a === c || a.photo_index !== c.photo_index) continue;
      const ox = Math.min(a.box.x + a.box.w, c.box.x + c.box.w) - Math.max(a.box.x, c.box.x);
      const oy = Math.min(a.box.y + a.box.h, c.box.y + c.box.h) - Math.max(a.box.y, c.box.y);
      assert(ox <= 0 || oy <= 0, `${a.id} overlaps ${c.id}`);
    }
  }
  // UV is one tool among several now: some rooms have traces, most use something else.
  assert(rooms >= 3 && rooms <= 24, `${rooms} of 54 rooms have UV traces`);
});

// ---------------------------------------------------------------------------
// Deductions: clock times from two facts, the ritual order, the accusation grid
// ---------------------------------------------------------------------------
const toMin = (v: string) => { const [h, m] = v.split(":").map(Number); return (h % 12) * 60 + m; };

Deno.test("planner: a clock's time is worked out from a written time and a second fact, never copied", () => {
  let clocks = 0, braided = 0;
  for (const mode of MODES) for (const inv of [FULL_15, BEDROOM_WITH_DOOR, SPARSE_5]) for (const seed of [...SEEDS, "w7", "w8", "w9"]) {
    const { definition: def, secret } = planned(inv, mode, seed);
    for (const r of secret.rules) {
      const c = r.when.find((x) => x.if === "control" && x.control === "time");
      if (!c || c.if !== "control" || !("slot" in c.eq)) continue;
      clocks++;
      const target = secret.slots[c.eq.slot];
      assert(target.kind === "time" && target.from?.length, `${mode} ${seed}: the clock's time is shown on a card`);
      const base = secret.slots[target.from[0]];
      assertEquals(base.kind, "time");
      // The amount between them is written in words on the card with the base time or on the carrier card.
      const cardsWith = target.from.map((n) => def.cards.find((x) => x.text.includes(`{{${n}}}`))!);
      const words = cardsWith.map((x) => x.text).join(" ");
      const diff = Math.abs(toMin(target.value) - toMin(base.value));
      const gap = Math.min(diff, 720 - diff);
      assert(DURATIONS.some(([m, w]) => m === gap && words.includes(w)), `${mode} ${seed}: ${base.value} -> ${target.value} not explained by "${words}"`);
      // The clock step needs every card the time comes from.
      const step = secret.steps.find((s) => s.id === r.step)!;
      for (const card of cardsWith) {
        const shownBy = secret.rules.filter((x) => x.step && x.effects.some((e) => (e.do === "show_card" && e.card === card.id) ||
          (e.do === "grant" && def.items.find((i) => i.id === e.item)?.card === card.id))).map((x) => x.step!);
        const reach = (id: string, seen = new Set<string>()): boolean => shownBy.includes(id) ||
          (!seen.has(id) && (seen.add(id), secret.steps.find((s) => s.id === id)!.requires.some((q) => reach(q, seen))));
        assert(step.requires.some((q) => reach(q)), `${mode} ${seed}: the clock doesn't wait for ${card.title}`);
      }
      if (target.from.length === 2) braided++;
      if (mode === "crime_scene") for (const v of [base.value, target.value]) assert(![10, 11, 12, 1].includes(Number(v.split(":")[0])), `crime time ${v} near the death`);
    }
  }
  assert(clocks >= 10 && braided >= 3, `${clocks} clocks, ${braided} braided`);
});

Deno.test("planner: the ritual order is deduced: fragments rule places in or out, and only the answer fits them all", () => {
  for (const inv of [FULL_15, BEDROOM_WITH_DOOR, SPARSE_5]) for (const seed of SEEDS) {
    const { definition: def, secret } = planned(inv, "paranormal", seed);
    const parts = Object.values(secret.slots).filter((s) => s.kind === "object");
    assertEquals(parts.length, 3);
    assert(parts.every((s) => s.order), "every offering has an order rule");
    assert(parts.filter((s) => ["first", "last", "middle"].includes(s.order!)).length <= 1, "more than one fragment gives a place outright");
    assertEquals(finaleLogic(def, secret), []);
    for (const c of def.cards) assert(!/\b(Second|Third),/.test(c.text), `an ordinal: ${c.text}`);
  }
});

Deno.test("simulator: a finale whose evidence or fragments don't leave exactly the answer is refused", () => {
  const crime = planned(FULL_15, "crime_scene", "grid");
  const answer = Object.values(crime.secret.slots).find((s) => s.kind === "code" && s.from)!;
  const dim = answer.from![0];
  const broken = structuredClone(crime.secret);
  broken.slots[dim] = { ...broken.slots[dim], from: broken.slots[dim].from!.slice(1) };   // one suspect never ruled out
  assert(finaleLogic(crime.definition, broken).some((e) => e.startsWith("accusation")));
  const para = planned(FULL_15, "paranormal", "grid");
  const loose = structuredClone(para.secret);
  for (const s of Object.values(loose.slots)) if (s.kind === "object") s.order = "not_middle";   // many orders fit
  assert(finaleLogic(para.definition, loose).some((e) => e.startsWith("ritual")));
  assert(!simulate(para.definition, loose).ok);
});

Deno.test("planner: orderPuzzle always leaves exactly one order", () => {
  for (let i = 0; i < 200; i++) {
    const rules = orderPuzzle(3, seededRandom(`o${i}`));
    const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
    const fit = perms.filter((p) => p.every((place, k) => orderHolds(rules[k], place, 3)));
    assertEquals(fit, [[0, 1, 2]]);
  }
});

Deno.test("planner: no card says where it was found, and the UV flashlight is never under an ornament or a plant", () => {
  for (const mode of MODES) for (const inv of [FULL_15, BEDROOM_WITH_DOOR, SPARSE_5]) for (const seed of SEEDS) {
    const { definition: def, secret } = planned(inv, mode, seed);
    for (const r of secret.rules) {
      const step = secret.steps.find((s) => s.id === r.step);
      if (!step || (step.motif !== "contain" && step.motif !== "story_fragment") || r.trigger.on !== "control") continue;
      const host = def.objects.find((o) => o.id === step.object)!;
      for (const e of r.effects) {
        if (e.do === "show_card" && !def.items.some((i) => i.card === e.card)) {
          const text = def.cards.find((c) => c.id === e.card)!.text;
          // The player lifted the cushion and saw it there: the card is the thing, not the story of finding it.
          assert(!/^(Pushed|Under the|Taped|Tucked|Slipped|Flat under|Folded small|Wedged|Inside the|In the inside|At the back|At the bottom|Behind|Hidden where)\b/.test(text), `${mode}: "${text}" narrates where it was`);
        }
        if (e.do === "grant" && def.items.find((i) => i.id === e.item)?.kind === "tool") {
          assert(!["decor", "plant"].includes(categoryOf(host.type)), `${mode}: the flashlight under the ${host.label}`);
        }
      }
    }
  }
});

Deno.test("planner: every step but a take says why it is where it is; first hints point at a kind of place", () => {
  for (const mode of MODES) for (const seed of SEEDS) {
    const { secret } = planned(FULL_15, mode, seed);
    for (const s of secret.steps) {
      if (!s.optional || s.motif !== "story_fragment" || secret.rules.some((r) => r.step === s.id && r.trigger.on === "control" && r.trigger.control !== "taken")) {
        if (!(s.optional && secret.rules.some((r) => r.step === s.id && r.trigger.on === "control" && r.trigger.control === "taken"))) assert(s.why && !/[{}]/.test(s.why), `${mode} ${s.id} ${s.motif}: no why`);
      }
      assert(s.hints[0] !== "Not everything is on the surface.", `${mode}: an empty nudge`);
    }
  }
});

Deno.test("validator: a word lock's answer that stands as a word in the room's text is refused; planned rooms never do it", () => {
  const r = planned(FULL_15, "noir", "words");
  const def = structuredClone(r.definition), secret = structuredClone(r.secret);
  secret.slots.code_x = { kind: "code", value: "I|N|K", text: "INK" };
  def.cards[0] = { ...def.cards[0], text: `${def.cards[0].text} In blue ink.` };
  assertEquals(wordClashes(def, secret), ["code_x"]);
  for (const mode of MODES) for (const inv of [FULL_15, BEDROOM_WITH_DOOR, SPARSE_5]) for (const seed of SEEDS) {
    const p = planned(inv, mode, seed);
    assertEquals(wordClashes(p.definition, p.secret), []);
  }
});

Deno.test("planner: ritual offerings are described, never named, and no two read the same", () => {
  for (let i = 0; i < 120; i++) {
    const inv = syntheticInventory(i, 8 + (i % 8));
    const r = planRoom(inv, { mode: "paranormal", seed: `ritual-${i}`, randomInt: seededRandomInt(i) });
    if (!r.ok) continue;
    const parts = Object.values(r.secret.slots).filter((s) => s.kind === "object");
    assertEquals(new Set(parts.map((s) => s.text)).size, parts.length, `room ${i}: two offerings read the same`);
    for (const s of parts) {
      const o = r.definition.objects.find((x) => x.id === s.value)!;
      assertEquals(s.text, describeObject(o.type, o.label), `room ${i}: ${o.label} is named, not described`);
      assert(!new RegExp(`\\b${o.label}\\b`, "i").test(s.text ?? ""), `room ${i}: ${s.text}`);
    }
  }
});

Deno.test("planner: one crime deduction needs two cards: an alibi until half past eleven, and a later card narrowing the time of death", () => {
  let apart = 0, rooms = 0;
  for (const inv of [FULL_15, BEDROOM_WITH_DOOR, SPARSE_5]) for (const seed of SEEDS) {
    const { definition: def, secret } = planned(inv, "crime_scene", seed);
    rooms++;
    const partial = def.cards.filter((c) => PARTIAL_ALIBIS.some((a) => c.text.includes(a.lead.split("{{s}}")[1].slice(0, 30))));
    const narrow = def.cards.filter((c) => NARROWED_DEATH.some((n) => c.text.includes(n)));
    assertEquals(partial.length, 1, `${seed}: the partial alibi`);
    assertEquals(narrow.length, 1, `${seed}: the narrowed time of death`);
    if (partial[0] !== narrow[0]) apart++;
    assertEquals(finaleLogic(def, secret), []);
    // Every card that carries the narrowing is evidence the accusation can't be made without.
    assert(slotRefs(narrow[0].text).some((n) => secret.slots[n].kind === "option"));
  }
  assert(apart >= rooms - 2, `${apart} of ${rooms} rooms keep the two facts on different cards`);
});

// ---------------------------------------------------------------------------
// Show, never tell: no beats, no reports, no narration; evidence that is compared
// ---------------------------------------------------------------------------
Deno.test("planner: nothing narrates what the player just watched: no beats, and writing that came to light is only the writing", () => {
  for (const mode of MODES) for (const inv of [FULL_15, BEDROOM_WITH_DOOR, SPARSE_5]) for (const seed of [...SEEDS, "w7", "w8", "w9", "w10"]) {
    const { definition: def, secret } = planned(inv, mode, seed);
    for (const r of secret.rules) assert(!r.effects.some((e) => e.do === "beat"), `${mode} ${seed}: ${r.id} has a beat`);
    // A card the player brought to light themselves (warmed, mirrored, rubbed, through the lens, folded) holds
    // only what is written: its slots as they're written, nothing about how it appeared.
    // (Crime evidence is documents, whose own words may be anything: "the glass by the bed".)
    for (const c of def.cards.filter((x) => x.reveal && mode !== "crime_scene")) {
      assert(!/\b(held|warmed|browns?|creeps?|glass|mirror|graphite|pencil|lens|gel|filter|folded|comes? up|stand out)\b/i.test(c.text.replace(/\{\{[^}]*\}\}/g, "")), `${mode}: "${c.text}" narrates`);
    }
    for (const c of def.cards) {
      const text = renderCard(c, secret);
      assert(!/\b(rules? out|which means|this means|use it on|for the (clock|door|lock)|you can't|would (show|bring)|too generous)\b/i.test(text), `${mode}: "${text}" interprets or instructs`);
    }
  }
});

Deno.test("planner: in a crime room with the UV light, one suspect is ruled out by setting a drawn trace beside a document", () => {
  let seen = 0;
  const kinds = new Set<string>();
  for (let i = 0; i < 400 && (seen < 12 || kinds.size < 3); i++) {
    const r = planRoom(i % 2 ? FULL_15 : BEDROOM_WITH_DOOR, { mode: "crime_scene", seed: `versus-${i}`, randomInt: seededRandomInt(i) });
    assert(r.ok, `${i}`);
    const { definition: def, secret, report } = r;
    const matched = Object.entries(secret.slots).filter(([, s]) => s.match);
    if (!matched.length) continue;
    seen++;
    assertEquals(matched.length, 1);
    const [name, slot] = matched[0];
    const trace = def.objects.find((o) => o.id === slot.match!.trace)!;
    kinds.add(trace.trace!.kind);
    // The trace shows one thing; the document says another, in every attribute it states; and no card says so.
    for (const [k, v] of Object.entries(slot.match!.shows)) assert(trace.trace![k as "size"] !== undefined && trace.trace![k as "size"] !== v, `${k}: ${v}`);
    const doc = def.cards.find((c) => c.text.includes(`{{${name}}}`))!;
    for (const w of slot.match!.words) assert(renderCard(doc, secret).includes(w), `"${w}" isn't on the ${doc.title}`);
    for (const c of def.cards) assert(!/\b(match|differ|can't have|could not have|too (big|small)|not (hers|his|theirs))/i.test(renderCard(c, secret)), c.text);
    assertEquals(finaleLogic(def, secret), []);
    // The simulated player lights the trace before accusing: the document alone rules nobody out.
    const lit = report.path.findIndex((a) => a.type === "use_item" && a.object === trace.id);
    const accused = report.path.findIndex((a) => a.type === "submit" && a.object === def.finale.object);
    assert(lit >= 0 && lit < accused, "the accusation doesn't wait for the trace");
    // A trace that agrees with the document rules nobody out: refused.
    const same = structuredClone(def);
    Object.assign(same.objects.find((o) => o.id === trace.id)!.trace!, slot.match!.shows);
    assert(finaleLogic(same, secret).some((e) => e.includes("doesn't differ")));
    // A wall threat's words hold no answer, so they are public; its hand is what is compared.
    if (trace.trace!.kind === "writing") assert(trace.trace!.text && trace.trace!.hand);
  }
  assert(seen >= 12 && kinds.size === 3, `${seen} rooms, kinds ${[...kinds]}`);
});
