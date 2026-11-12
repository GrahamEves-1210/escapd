// The gadgets and reveals built ahead of the app (GADGETS): each behind its own switch, off by default.
// With a switch on: a safe's dial, a ring of keys and its impression, a rotary telephone, a music box's
// tune, a typewriter ribbon's last line, a pocket balance and three weights.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { DIAL_SIZE, KEY_CUTS, normalize, SYMBOLS } from "./archetypes.ts";
import { applyAction, initialState, orderSettled, renderCard } from "./engine.ts";
import { type Gadget, GADGETS, planRoom, type PlanResult } from "./planner.ts";
import { simulate } from "./simulate.ts";
import { BEDROOM_WITH_DOOR, FULL_15, obj, planProblems, seededRandomInt, SPARSE_5 } from "./test_fixtures.ts";
import { MODES, type Mode, type PlayState } from "./types.ts";
import { validateDefinition } from "./validate.ts";

type Ok = Extract<PlanResult, { ok: true }>;
const OFFICE = [
  obj("door", 0), obj("desk", 0, { salience: 0.9 }), obj("safe", 1, { salience: 0.7, features: ["can_open", "has_doors"] }), obj("telephone", 0, { salience: 0.6 }),
  obj("filing_cabinet", 1, { salience: 0.8 }), obj("desk_lamp", 0), obj("bookshelf", 2, { salience: 0.8 }), obj("framed_picture", 2),
  obj("rug", 3, { salience: 0.4 }), obj("cushion", 3, { salience: 0.4 }), obj("mirror", 4),
];
const ROOMS = [OFFICE, FULL_15, BEDROOM_WITH_DOOR, SPARSE_5];

/** What a planned room uses of the gadgets. */
function used(r: Ok): Gadget[] {
  const { definition: def, secret } = r;
  const out = new Set<Gadget>();
  for (const o of def.objects) {
    if (o.submit?.kind === "dial") out.add("dial");
    if (o.submit?.kind === "keys") out.add("keys");
    if (o.archetype === "Telephone" && secret.steps.some((s) => s.object === o.id)) out.add("telephone");
  }
  if (def.cards.some((c) => c.reveal === "tune")) out.add("tune");
  if (def.cards.some((c) => c.reveal === "ribbon")) out.add("ribbon");
  if (def.items.some((i) => i.archetype === "Balance")) out.add("balance");
  return [...out];
}

/** A room using `gadget`, planned with only that switch on. */
function withGadget(gadget: Gadget, mode: Mode): Ok {
  for (const inv of ROOMS) for (let i = 0; i < 60; i++) {
    const r = planRoom(inv, { mode, seed: `${gadget}-${i}`, randomInt: seededRandomInt(i), gadgets: [gadget] });
    if (r.ok && used(r).includes(gadget)) return r;
  }
  throw new Error(`no ${mode} room with the ${gadget}`);
}
const answerOf = (r: Ok, object: string) => {
  const rule = r.secret.rules.find((x) => x.trigger.on === "submit" && x.trigger.object === object)!;
  const c = rule.when.find((x) => x.if === "submitted")!;
  return r.secret.slots[(c as { eq: { slot: string } }).eq.slot];
};

Deno.test("gadgets: every switch is off by default, and a room planned without them has none", () => {
  for (const mode of MODES) for (const inv of ROOMS) for (let i = 0; i < 12; i++) {
    const r = planRoom(inv, { mode, seed: `off-${i}`, randomInt: seededRandomInt(i) });
    assert(r.ok, `${mode} ${i}`);
    assertEquals(used(r), [], `${mode} ${i}`);
    assert(!r.summary.motifs.some((m) => m === "tune_reveal" || m === "ribbon_reveal" || m === "weigh"));
    assert(!r.secret.weights && !r.definition.cards.some((c) => c.look));
  }
});

Deno.test("gadgets: with every switch on rooms still prove out, each gadget turns up, and one switch brings only its own", () => {
  const seen = new Set<Gadget>();
  for (const mode of MODES) for (const inv of ROOMS) for (let i = 0; i < 10; i++) {
    const r = planRoom(inv, { mode, seed: `on-${i}`, randomInt: seededRandomInt(i), gadgets: GADGETS });
    assertEquals(planProblems(r, mode), [], `${mode} ${i}`);
    assert(r.ok);
    for (const g of used(r)) seen.add(g);
    // Never more than one lock in a room, whatever kind it is.
    assert(r.secret.steps.filter((s) => s.motif === "contain_lock").length <= 1);
  }
  assertEquals([...seen].sort(), [...GADGETS].sort());
  for (const g of GADGETS) for (let i = 0; i < 8; i++) {
    const r = planRoom(OFFICE, { mode: MODES[i % 3], seed: `only-${g}-${i}`, randomInt: seededRandomInt(i), gadgets: [g] });
    assert(r.ok);
    for (const u of used(r)) assertEquals(u, g);
  }
});

Deno.test("gadgets: a safe's dial takes three numbers written down somewhere, and nothing else", () => {
  for (const mode of MODES) {
    const r = withGadget("dial", mode);
    const { definition: def, secret } = r;
    const safe = def.objects.find((o) => o.submit?.kind === "dial")!;
    assertEquals([safe.archetype, safe.variant, safe.submit], ["CombinationLock", "dial", { kind: "dial", size: DIAL_SIZE, count: 3 }]);
    assert(["safe", "filing_cabinet", "chest", "trunk", "toolbox"].includes(safe.type), `a dial on a ${safe.type}`);
    const answer = answerOf(r, safe.id);
    const n = answer.value.split("|").map(Number);
    assertEquals(answer.text, n.join(" - "));
    assert(n.length === 3 && new Set(n).size === 3 && n.every((x) => x >= 0 && x < DIAL_SIZE));
    for (let i = 1; i < 3; i++) assert(Math.min(Math.abs(n[i] - n[i - 1]), DIAL_SIZE - Math.abs(n[i] - n[i - 1])) >= 5, answer.value);
    // The numbers are on one card, an in-world thing; the right ones open it, others don't.
    const card = def.cards.find((c) => renderCard(c, secret).includes(answer.text!))!;
    assert(card && !/\b(safe|dial|combination)\b/i.test(card.text), card?.text);
    const s = initialState(def);
    assertEquals(applyAction(def, secret, s, { type: "submit", object: safe.id, value: n.map(String) }).result.outcome, "ok");
    assertEquals(applyAction(def, secret, s, { type: "submit", object: safe.id, value: [String((n[0] + 1) % DIAL_SIZE), String(n[1]), String(n[2])] }).result.outcome, "wrong");
    assertEquals(applyAction(def, secret, s, { type: "submit", object: safe.id, value: ["40", "1", "2"] }).result.outcome, "invalid");
    assertEquals(normalize(safe.submit!, ["07", "1", "2"]), null);
  }
});

Deno.test("gadgets: a ring of five keys, and the right one's impression in soap (drawn from its cuts, never printed)", () => {
  for (const mode of MODES) {
    const r = withGadget("keys", mode);
    const { definition: def, secret } = r;
    const lock = def.objects.find((o) => o.submit?.kind === "keys")!;
    assert(lock.submit?.kind === "keys");
    const keys = lock.submit.bittings;
    const right = answerOf(r, lock.id).value;
    assertEquals(keys.length, 5);
    assertEquals(new Set(keys).size, 5);
    assert(keys.includes(right));
    for (const k of keys) {
      assert(new RegExp(`^[0-3]{${KEY_CUTS}}$`).test(k) && new Set(k).size >= 2, k);
      if (k === right) continue;
      const d = [...k].map((c, i) => Math.abs(Number(c) - Number(right[i])));
      assert(d.filter((x) => x > 0).length >= 2 && d.some((x) => x >= 2), `${k} is too like ${right}`);
    }
    // The impression: an item's card whose text is exactly the slot, marked for the app to draw.
    const card = def.cards.find((c) => c.look === "impression")!;
    assert(/^\{\{[a-z0-9_]+\}\}$/.test(card.text));
    assertEquals(renderCard(card, secret), right);
    const soap = def.items.find((i) => i.card === card.id)!;
    assert(soap && soap.kind === "prop" && /soap|wax/i.test(soap.name));
    const s = initialState(def);
    assertEquals(applyAction(def, secret, s, { type: "submit", object: lock.id, value: [right] }).result.outcome, "ok");
    assertEquals(applyAction(def, secret, s, { type: "submit", object: lock.id, value: [keys.find((k) => k !== right)!] }).result.outcome, "wrong");
    assertEquals(applyAction(def, secret, s, { type: "submit", object: lock.id, value: ["33333"] }).result.outcome, "invalid");
    // A ring with a decoy one cut off the right key is refused.
    const bad = structuredClone(def);
    const o = bad.objects.find((x) => x.id === lock.id)!;
    const decoy = keys.findIndex((k) => k !== right);
    (o.submit as { bittings: string[] }).bittings[decoy] = right.slice(0, 4) + String((Number(right[4]) + 1) % 4);
    assert(validateDefinition(bad, secret).some((e) => e.includes("key ring")));
  }
});

Deno.test("gadgets: a rotary telephone answers the number found elsewhere, and only that", () => {
  for (const mode of MODES) {
    const { definition: def, secret } = withGadget("telephone", mode);
    const phone = def.objects.find((o) => o.archetype === "Telephone")!;
    assertEquals([phone.variant, phone.controls, phone.initial.number], ["rotary", [{ id: "number", domain: { kind: "phone", length: 4 } }], ""]);
    const rule = secret.rules.find((x) => x.trigger.on === "control" && x.trigger.target === phone.id)!;
    const slot = secret.slots[(rule.when[0] as { eq: { slot: string } }).eq.slot];
    assertEquals(slot.kind, "phone");
    assert(/^[1-9]\d{3}$/.test(slot.value), slot.value);
    assert(def.cards.some((c) => renderCard(c, secret).includes(slot.value) && !/telephone/i.test(c.title)), "the number is on no card");
    const s = initialState(def);
    const right = applyAction(def, secret, s, { type: "set_control", target: phone.id, control: "number", value: slot.value });
    assertEquals(right.result.outcome, "ok");
    assert(right.result.effects.some((e) => e.do === "show_card"));
    const other = String((Number(slot.value) % 9000) + 1000 === Number(slot.value) ? 1234 : (Number(slot.value) % 9000) + 1000);
    assertEquals(applyAction(def, secret, s, { type: "set_control", target: phone.id, control: "number", value: other }).result.outcome, "nothing");
    assertEquals(applyAction(def, secret, s, { type: "set_control", target: phone.id, control: "number", value: "12" }).result.outcome, "invalid");
  }
});

Deno.test("gadgets: a music box's tune is four marks, the order of a four-wheel lock; a ribbon keeps one typed line", () => {
  for (const mode of MODES) {
    const r = withGadget("tune", mode);
    const { definition: def, secret } = r;
    const card = def.cards.find((c) => c.reveal === "tune")!;
    assert(/^\{\{[a-z0-9_]+\}\}$/.test(card.text));
    const run = renderCard(card, secret).split(" ");
    assertEquals(run.length, 4);
    assert(run.every((m) => (SYMBOLS as readonly string[]).includes(m)), run.join(" "));
    const lock = def.objects.find((o) => o.archetype === "CombinationLock")!;
    assertEquals(lock.submit, { kind: "wheels", alphabet: "symbols", count: 4 });
    assertEquals(answerOf(r, lock.id).value, run.join("|"));
    const box = def.items.find((i) => i.controls?.some((c) => c.id === "cranked"))!;
    const grant = secret.rules.find((x) => x.effects.some((e) => e.do === "grant" && e.item === box.id))!;
    const held: PlayState = { ...initialState(def), inventory: [box.id], items: { [box.id]: { cranked: false } }, fired: [grant.id] };
    const played = applyAction(def, secret, held, { type: "set_control", target: box.id, control: "cranked", value: true });
    assert(played.result.effects.some((e) => e.do === "show_card" && e.card === card.id));
    assertEquals(applyAction(def, secret, played.state, { type: "submit", object: lock.id, value: run }).result.outcome, "ok");

    const rb = withGadget("ribbon", mode);
    const line = rb.definition.cards.find((c) => c.reveal === "ribbon")!;
    assert(!line.text.includes("\n") && (line.text.match(/\{\{/g) ?? []).length === 1, line.text);
    const spool = rb.definition.items.find((i) => i.controls?.some((c) => c.id === "pulled"))!;
    assert(spool && /ribbon/i.test(spool.name));
  }
});

Deno.test("gadgets: a balance shows which pan dips, never a number; the order is known once the weighings settle it", () => {
  assert(orderSettled(["a", "b", "c"], new Set(["a+b", "b+c"]), { a: 3, b: 2, c: 1 }));
  assert(!orderSettled(["a", "b", "c"], new Set(["a+b", "a+c"]), { a: 3, b: 2, c: 1 }));
  assert(orderSettled(["a", "b", "c"], new Set(["a+b", "a+c", "b+c"]), { a: 3, b: 2, c: 1 }));
  for (const mode of MODES) {
    const r = withGadget("balance", mode);
    const { definition: def, secret, report } = r;
    const balance = def.items.find((i) => i.archetype === "Balance")!;
    const pans = balance.controls!.find((c) => c.id === "pans")!;
    assert(pans.domain.kind === "pans");
    const [a, b, c] = pans.domain.of;
    const w = secret.weights!;
    // What they weigh is the secret's alone.
    const publicText = JSON.stringify(def);
    assert(!/"weights"/.test(publicText));
    const lock = def.objects.find((o) => o.archetype === "CombinationLock")!;
    const code = answerOf(r, lock.id);
    assert(code.weigh === balance.id);
    for (const card of def.cards) assert(!renderCard(card, secret).includes(code.text!), `the order is printed: ${card.text}`);
    // The marks on the weights, heaviest first, are the lock's order.
    const marks = [a, b, c].sort((x, y) => w[y] - w[x]).map((id) => def.items.find((i) => i.id === id)!.name.split(" ").pop()!);
    assertEquals(code.value, marks.join("|"));
    // Weighing: the beam dips to the heavier side; two weighings through the middle weight settle it.
    const held: PlayState = { ...initialState(def), inventory: [balance.id, a, b, c], items: { [balance.id]: { pans: "" } } };
    const [hi, mid, lo] = [a, b, c].sort((x, y) => w[y] - w[x]);
    const one = applyAction(def, secret, held, { type: "set_control", target: balance.id, control: "pans", value: `${lo}|${hi}` });
    assertEquals(one.result.effects, [{ do: "set_state", target: balance.id, key: "tilt", value: "right" }]);
    assert(!one.state.items[balance.id].settled);
    const two = applyAction(def, secret, one.state, { type: "set_control", target: balance.id, control: "pans", value: `${hi}|${mid}` });
    assertEquals(two.state.items[balance.id].tilt, "left");
    assert(!two.state.items[balance.id].settled, "hi over lo and hi over mid don't order mid and lo");
    const three = applyAction(def, secret, two.state, { type: "set_control", target: balance.id, control: "pans", value: `${mid}|${lo}` });
    assertEquals(three.state.items[balance.id].settled, true);
    assert(three.result.effects.some((e) => e.do === "solved"));
    // A weight not in hand can't be weighed; the same weight can't be on both pans.
    assertEquals(applyAction(def, secret, { ...held, inventory: [balance.id, a] }, { type: "set_control", target: balance.id, control: "pans", value: `${a}|${b}` }).result.reason, "not_held");
    assertEquals(applyAction(def, secret, held, { type: "set_control", target: balance.id, control: "pans", value: `${a}|${a}` }).result.outcome, "invalid");
    // The simulated player weighs before entering the lock's order.
    const weighed = report.path.findIndex((x) => x.type === "set_control" && x.control === "pans");
    const entered = report.path.findIndex((x) => x.type === "submit" && x.object === lock.id);
    assert(weighed >= 0 && weighed < entered);
    assert(simulate(def, secret).ok);
  }
});

Deno.test("gadgets: perception can report a safe and a landline telephone; a mobile stays out", async () => {
  const { isDeniedV2 } = await import("./perceive.ts");
  const { typeForLabel, TYPICAL_FEATURES } = await import("./taxonomy.ts");
  const { hostableArchetypes } = await import("./archetypes.ts");
  assertEquals(typeForLabel("steel strongbox"), "safe");
  assertEquals(typeForLabel("rotary telephone"), "telephone");
  assert(!isDeniedV2("rotary telephone", "telephone") && !isDeniedV2("black desk phone", "telephone"));
  assert(isDeniedV2("mobile phone", "telephone") && isDeniedV2("smartphone", "telephone"));
  const safe = hostableArchetypes({ type: "safe", features: TYPICAL_FEATURES.safe ?? [] });
  assert(safe.some((h) => h.archetype === "CombinationLock" && h.variant === "dial"));
  assert(hostableArchetypes({ type: "telephone", features: [] }).some((h) => h.archetype === "Telephone"));
  // A desk never has a safe's dial.
  assert(!hostableArchetypes({ type: "desk", features: ["has_drawers"] }).some((h) => h.variant === "dial"));
});
