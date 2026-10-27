import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { variantSpec } from "./archetypes.ts";
import { applyAction, initialState } from "./engine.ts";
import { simulate } from "./simulate.ts";
import type { Action, ObjectDef, PlayState, RoomDefinitionV2, RoomSecretV2, Rule } from "./types.ts";
import { validateDefinition } from "./validate.ts";

// A small hand-written room that exercises every action, effect and flag.
function o(id: string, type: ObjectDef["type"], archetype: ObjectDef["archetype"], variant?: string, extra: Partial<ObjectDef> = {}): ObjectDef {
  const v = archetype ? variantSpec(archetype, variant) : null;
  return {
    id, photo_index: 0, box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, label: id, type, archetype, ...(variant ? { variant } : {}),
    controls: [...(v?.controls ?? [])], ...(v?.submit ? { submit: v.submit } : {}), initial: { ...(v?.initial ?? {}) }, ...extra,
  };
}
const hints: [string, string, string] = ["a", "b", "c"];

function room(): { def: RoomDefinitionV2; secret: RoomSecretV2 } {
  const def: RoomDefinitionV2 = {
    schema_version: 2, mode: "noir", title: "The Study", objective: "Open the door.",
    objects: [
      o("door", "door", "Door", "combination", { exit: true, submit: { kind: "wheels", alphabet: "digits", count: 3 } }),
      o("desk", "desk", "Drawer", "drawer"),
      o("clock", "wall_clock", "ClockHands", "hands"),
      o("chest", "chest", "Drawer", "compartment", { initial: { open: false, locked: true } }),
      o("pillow", "pillow", "LiftUnder", "lift"),
      o("lamp", "desk_lamp", "Light", "lamp"),
      o("poster", "poster", "FrameTilt", "tilt", { hidden: true }),
      o("book", "book", "Readable", "card"),
      o("mug", "mug", null, undefined, { removable: true, controls: [{ id: "taken", domain: { kind: "bool" } }], initial: { taken: false } }),
    ],
    items: [
      { id: "note", name: "note", kind: "prop", card: "c_note" },
      { id: "key", name: "small key", kind: "key" },
      { id: "half_a", name: "torn half", kind: "half", card: "c_half" },
      { id: "half_b", name: "torn half", kind: "half" },
      { id: "joined", name: "ticket", kind: "assembled", archetype: "Assemble", card: "c_joined" },
      { id: "wheel", name: "cipher wheel", kind: "decoder", archetype: "Decoder", controls: [{ id: "offset", domain: { kind: "offset", max: 25 } }] },
      { id: "mug_item", name: "mug", kind: "taken", card: "c_mug" },
    ],
    cards: [
      { id: "c_note", title: "Note", text: "Set the clock to {{t}}." },
      { id: "c_half", title: "Torn half", text: "Half a ticket." },
      { id: "c_joined", title: "Ticket", text: "Platform {{code}}" },
      { id: "c_book", title: "Margin", text: "Ring at {{off}}" },
      { id: "c_decoded", title: "Decoded", text: "Leo was here." },
      { id: "c_mug", title: "Mug", text: "Monogrammed L.M." },
    ],
    finale: { kind: "combination", object: "door", wheels: 3, alphabet: "digits" },
  };
  const r = (id: string, step: string, trigger: Rule["trigger"], when: Rule["when"], effects: Rule["effects"]): Rule => ({ id, step, trigger, when, effects });
  const secret: RoomSecretV2 = {
    schema_version: 2,
    slots: { t: { kind: "time", value: "11:40" }, code: { kind: "code", value: "4|7|2", text: "472" }, off: { kind: "offset", value: "3" } },
    rules: [
      r("r_desk", "s_desk", { on: "control", target: "desk", control: "open" }, [{ if: "control", target: "desk", control: "open", eq: { lit: true } }], [{ do: "grant", item: "note" }, { do: "show_card", card: "c_note" }]),
      r("r_clock", "s_clock", { on: "control", target: "clock", control: "time" }, [{ if: "control", target: "clock", control: "time", eq: { slot: "t" } }],
        [{ do: "set_state", target: "clock", key: "panel", value: true }, { do: "overlay", object: "clock", overlay: "panel_open" }, { do: "grant", item: "key" }]),
      r("r_chest", "s_chest", { on: "use", item: "key", object: "chest" }, [], [{ do: "open", object: "chest" }, { do: "consume", item: "key" }, { do: "grant", item: "half_b" }]),
      r("r_pillow", "s_pillow", { on: "control", target: "pillow", control: "lifted" }, [{ if: "control", target: "pillow", control: "lifted", eq: { lit: true } }], [{ do: "grant", item: "half_a" }, { do: "show_card", card: "c_half" }]),
      r("r_join", "s_join", { on: "combine", items: ["half_a", "half_b"] }, [],
        [{ do: "consume", item: "half_a" }, { do: "consume", item: "half_b" }, { do: "grant", item: "joined" }, { do: "show_card", card: "c_joined" }, { do: "beat", text: "He never used it." }]),
      r("r_lamp", "s_lamp", { on: "control", target: "lamp", control: "on" }, [{ if: "control", target: "lamp", control: "on", eq: { lit: true } }], [{ do: "reveal", object: "poster" }, { do: "overlay", object: "lamp", overlay: "light_on" }]),
      r("r_book", "s_book", { on: "inspect", object: "book" }, [], [{ do: "show_card", card: "c_book" }]),
      r("r_poster", "s_poster", { on: "control", target: "poster", control: "tilted" }, [{ if: "control", target: "poster", control: "tilted", eq: { lit: true } }], [{ do: "grant", item: "wheel" }]),
      r("r_decode", "s_decode", { on: "control", target: "wheel", control: "offset" }, [{ if: "control", target: "wheel", control: "offset", eq: { slot: "off" } }, { if: "solved", step: "s_book" }], [{ do: "show_card", card: "c_decoded" }]),
      r("r_take", "s_take", { on: "control", target: "mug", control: "taken" }, [{ if: "control", target: "mug", control: "taken", eq: { lit: true } }],
        [{ do: "grant", item: "mug_item" }, { do: "show_card", card: "c_mug" }, { do: "overlay", object: "mug", overlay: "object_removed" }, { do: "set_state", target: "mug", key: "removed", value: true }]),
      r("r_door", "s_door", { on: "submit", object: "door" }, [{ if: "submitted", eq: { slot: "code" } }], [{ do: "open", object: "door" }, { do: "complete" }]),
    ],
    steps: [
      ...["s_desk", "s_clock", "s_chest", "s_pillow", "s_join", "s_door"].map((id) => ({ id, title: id, thread: 0, motif: "contain" as const, requires: [], hints })),
      ...["s_lamp", "s_book", "s_poster", "s_decode", "s_take"].map((id) => ({ id, title: id, thread: null, motif: "story_fragment" as const, requires: [], hints, optional: true })),
    ],
    ending: "Case closed.",
  };
  secret.steps.find((s) => s.id === "s_clock")!.requires = ["s_desk"];
  secret.steps.find((s) => s.id === "s_chest")!.requires = ["s_clock"];
  secret.steps.find((s) => s.id === "s_join")!.requires = ["s_chest", "s_pillow"];
  secret.steps.find((s) => s.id === "s_door")!.requires = ["s_join"];
  return { def, secret };
}

function play(actions: Action[], opts = {}) {
  const { def, secret } = room();
  let state = initialState(def);
  const results = actions.map((a) => {
    const r = applyAction(def, secret, state, a, opts);
    state = r.state;
    return r.result;
  });
  return { state, results, def, secret };
}

const WIN: Action[] = [
  { type: "set_control", target: "desk", control: "open", value: true },
  { type: "set_control", target: "clock", control: "time", value: "11:40" },
  { type: "use_item", item: "key", object: "chest" },
  { type: "set_control", target: "pillow", control: "lifted", value: true },
  { type: "combine", items: ["half_b", "half_a"] },
  { type: "submit", object: "door", value: ["4", "7", "2"] },
];

Deno.test("the hand-written room validates and simulates", () => {
  const { def, secret } = room();
  assertEquals(validateDefinition(def, secret), []);
  const rep = simulate(def, secret);
  assertEquals(rep.errors, []);
  assertEquals(rep.metrics.requiredSteps, 6);
  assertEquals(rep.metrics.maxChain, 5);
  assertEquals(rep.path.length, 6);
});

Deno.test("set_control opens, grants and renders the card; a repeat is idempotent", () => {
  const { def, secret } = room();
  const s0 = initialState(def);
  const a: Action = { type: "set_control", target: "desk", control: "open", value: true };
  const { state: s1, result } = applyAction(def, secret, s0, a);
  assertEquals(result.outcome, "ok");
  assertEquals(s1.inventory, ["note"]);
  assertEquals(result.effects.find((e) => e.do === "show_card"), { do: "show_card", card: "c_note", title: "Note", text: "Set the clock to 11:40." });
  assert(result.effects.some((e) => e.do === "solved" && e.step === "s_desk"));
  const again = applyAction(def, secret, s1, a);
  assertEquals(again.result, { outcome: "nothing", effects: [] });
  assertEquals(again.state, s1);
  assertEquals(s0, initialState(def), "applyAction never mutates its input");
});

Deno.test("continuous controls: a wrong value is nothing, the right one fires, malformed is invalid", () => {
  const { results, state } = play([
    { type: "set_control", target: "clock", control: "time", value: "11:45" },
    { type: "set_control", target: "clock", control: "time", value: "13:00" },
    { type: "set_control", target: "clock", control: "time", value: "11:40" },
  ]);
  assertEquals(results.map((r) => r.outcome), ["nothing", "invalid", "ok"]);
  assertEquals(results[1].reason, "bad_value");
  assertEquals(state.objects.clock, { time: "11:40", panel: true });
  assert(state.overlays.some((x) => x.object === "clock" && x.overlay === "panel_open"));
  assert(state.inventory.includes("key"));
});

Deno.test("a locked container stays shut; the key opens it and is consumed", () => {
  const { results, state } = play([
    { type: "set_control", target: "chest", control: "open", value: true },
    { type: "use_item", item: "key", object: "chest" },
    { type: "set_control", target: "desk", control: "open", value: true },
    { type: "use_item", item: "note", object: "chest" },
    { type: "set_control", target: "clock", control: "time", value: "11:40" },
    { type: "use_item", item: "key", object: "chest" },
  ]);
  assertEquals(results.map((r) => r.outcome), ["locked", "invalid", "ok", "nothing", "ok", "ok"]);
  assertEquals(results[1].reason, "not_held");
  assertEquals(state.objects.chest.open, true);
  assertEquals(state.objects.chest.locked, false);
  assert(!state.inventory.includes("key") && state.inventory.includes("half_b"));
});

Deno.test("combine is unordered, consumes both pieces and grants the assembled item", () => {
  const { results, state } = play(WIN.slice(0, 5));
  const r = results[4];
  assertEquals(r.outcome, "ok");
  assertEquals(state.inventory.sort(), ["joined", "note"]);
  assert(r.effects.some((e) => e.do === "show_card" && e.text === "Platform 472"));
  assert(r.effects.some((e) => e.do === "beat"));
  assertEquals(play([{ type: "combine", items: ["half_a", "half_a"] }]).results[0].reason, "not_held");
});

Deno.test("wrong submit: no state change, cooldown hook, no answer in the result", () => {
  const { def, secret } = room();
  const s = initialState(def);
  const { state, result } = applyAction(def, secret, s, { type: "submit", object: "door", value: ["1", "2", "3"] });
  assertEquals(result, { outcome: "wrong", effects: [], start_cooldown: true });
  assertEquals(state, s);
  for (const leak of ["472", "4|7|2", "11:40"]) assert(!JSON.stringify(result).includes(leak));
  const cool = applyAction(def, secret, s, { type: "submit", object: "door", value: ["4", "7", "2"] }, { cooldownActive: true });
  assertEquals(cool.result, { outcome: "invalid", reason: "cooldown", effects: [] });
  assertEquals(applyAction(def, secret, s, { type: "submit", object: "door", value: ["4", "7"] }).result.reason, "bad_value");
  assertEquals(applyAction(def, secret, s, { type: "submit", object: "desk", value: ["4"] }).result.reason, "not_a_lock");
});

Deno.test("hidden objects appear with a reveal; item controls need the item held", () => {
  const { results, state } = play([
    { type: "inspect", object: "poster" },
    { type: "set_control", target: "wheel", control: "offset", value: 3 },
    { type: "set_control", target: "lamp", control: "on", value: true },
    { type: "set_control", target: "poster", control: "tilted", value: true },
    { type: "set_control", target: "wheel", control: "offset", value: 3 },
    { type: "inspect", object: "book" },
    { type: "set_control", target: "wheel", control: "offset", value: 3 },
  ]);
  assertEquals(results.map((r) => r.outcome), ["invalid", "invalid", "ok", "ok", "nothing", "ok", "ok"]);
  assertEquals([results[0].reason, results[1].reason], ["hidden", "not_held"]);
  assertEquals(state.items.wheel, { offset: "3" });
  assert(state.solved.includes("s_decode"));
});

Deno.test("the removable object is taken once and then gone", () => {
  const { results, state } = play([
    { type: "set_control", target: "mug", control: "taken", value: true },
    { type: "inspect", object: "mug" },
  ]);
  assertEquals(results[0].outcome, "ok");
  assert(results[0].effects.some((e) => e.do === "overlay" && e.overlay === "object_removed"));
  assertEquals(results[1], { outcome: "invalid", reason: "removed", effects: [] });
  assert(state.inventory.includes("mug_item"));
});

Deno.test("the right submit completes with the ending; then the room is closed; replay is deterministic", () => {
  const a = play(WIN);
  const last = a.results.at(-1)!;
  assertEquals(last.outcome, "ok");
  assertEquals(last.completed, true);
  assert(last.effects.some((e) => e.do === "complete" && e.ending === "Case closed."));
  const after = applyAction(a.def, a.secret, a.state, { type: "inspect", object: "desk" });
  assertEquals(after.result.reason, "completed");
  assertEquals(JSON.stringify(play(WIN).state), JSON.stringify(a.state));
});

Deno.test("inspect records the look; unknown objects are invalid", () => {
  const { results, state } = play([{ type: "inspect", object: "desk" }, { type: "inspect", object: "sofa" }]);
  assertEquals(results.map((r) => r.outcome), ["nothing", "invalid"]);
  assertEquals((state as PlayState).seen, ["desk"]);
});

Deno.test("the public definition holds no answer", () => {
  const { def } = room();
  const json = JSON.stringify(def);
  for (const v of ["11:40", "472", "4|7|2"]) assert(!json.includes(v), v);
  assertStringIncludes(json, "{{t}}");
});

// ---------------------------------------------------------------------------
// Static validator
// ---------------------------------------------------------------------------
Deno.test("validator catches shape, host, exit, removable, leak and prop-placement errors", () => {
  const cases: [string, (d: RoomDefinitionV2, s: RoomSecretV2) => void][] = [
    ["exactly one exit", (d) => { d.objects[0].exit = false; d.objects[0].archetype = null; d.objects[0].controls = []; delete d.objects[0].submit; }],
    ["cannot host CombinationLock", (d) => { Object.assign(d.objects[4], { archetype: "CombinationLock", variant: "digits", controls: [], submit: { kind: "wheels", alphabet: "digits", count: 3 } }); }],
    ["at most one removable", (d) => { Object.assign(d.objects[7], { removable: true, controls: [{ id: "taken", domain: { kind: "bool" } }] }); }],
    ["only a small portable object", (d) => { Object.assign(d.objects[1], { removable: true, controls: [...d.objects[1].controls, { id: "taken", domain: { kind: "bool" } }] }); d.objects[8].removable = false; d.objects[8].controls = []; }],
    ["must be a slot", (_, s) => { s.rules.at(-1)!.when = [{ if: "submitted", eq: { lit: "4|7|2" } }]; }],
    ["must be found inside", (_, s) => { s.rules.find((r) => r.id === "r_lamp")!.effects.push({ do: "grant", item: "note" }); }],
    ["granted by exactly one rule", (_, s) => { s.rules.find((r) => r.id === "r_pillow")!.effects.push({ do: "grant", item: "note" }); }],
    ["unknown slot", (d) => { d.cards[0].text = "{{nope}}"; }],
    ["derived slot", (d, s) => { s.slots.code.from = ["t"]; void d; }],
    ["controls do not match", (d) => { d.objects[2].controls = []; }],
    ["duplicate object id", (d) => { d.objects[2].id = "desk"; }],
    ["needs exactly one take rule", (_, s) => { s.rules = s.rules.filter((r) => r.id !== "r_take"); s.steps = s.steps.filter((x) => x.id !== "s_take"); s.rules.find((r) => r.id === "r_desk")!.effects.length = 0; }],
  ];
  for (const [expect, mutate] of cases) {
    const { def, secret } = room();
    mutate(def, secret);
    const errors = validateDefinition(def, secret);
    assert(errors.some((e) => e.includes(expect)), `${expect}: ${JSON.stringify(errors)}`);
  }
});

// ---------------------------------------------------------------------------
// Simulator
// ---------------------------------------------------------------------------
Deno.test("simulator finds softlocks, shortcuts, unsolvable rooms and doubly shown slots", () => {
  const softlock = room();
  // The key also fits the desk, where it is used up: the chest can then never open.
  softlock.secret.rules.push({ id: "r_waste", trigger: { on: "use", item: "key", object: "desk" }, when: [], effects: [{ do: "consume", item: "key" }] });
  assert(simulate(softlock.def, softlock.secret).errors.some((e) => e.startsWith("softlock")));

  const shortcut = room();
  shortcut.def.cards.find((c) => c.id === "c_book")!.text = "Ring at {{off}}; the door is {{code}}";
  shortcut.def.cards.find((c) => c.id === "c_joined")!.text = "Platform";
  const sc = simulate(shortcut.def, shortcut.secret).errors;
  assert(sc.some((e) => e.startsWith("shortcut")), JSON.stringify(sc));

  const broken = room();
  broken.secret.rules = broken.secret.rules.filter((r) => r.id !== "r_join");
  assert(simulate(broken.def, broken.secret).errors.some((e) => e.startsWith("unsolvable")));

  const twice = room();
  twice.def.cards.find((c) => c.id === "c_book")!.text += " {{t}}";
  assert(simulate(twice.def, twice.secret).errors.some((e) => e.includes("{{t}} is shown on 2 cards")));
});
