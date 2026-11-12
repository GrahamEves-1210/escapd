// The reveal tools (UV, the lemon-juice letter, the mirror note) and where UV traces may lie.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { RECT_PADDING } from "../geometry.ts";
import { applyAction, initialState } from "./engine.ts";
import { planRoom, type PlanResult, revealTool, seededRandom, TOOL_MOTIF } from "./planner.ts";
import { obj, seededRandomInt, SPARSE_5, syntheticInventory, BEDROOM_WITH_DOOR, FULL_15 } from "./test_fixtures.ts";
import { TRACE_SITES, traceSiteOk } from "./traces.ts";
import { MODES, type Mode } from "./types.ts";
import { validateDefinition } from "./validate.ts";

type Ok = Extract<PlanResult, { ok: true }>;

Deno.test("traces: each kind only where it physically goes", () => {
  for (const t of ["bed", "sofa", "bookshelf", "framed_picture", "poster", "cushion", "pillow"] as const) {
    assert(!traceSiteOk("footprints", "on", t) && !traceSiteOk("footprints", "wall", t), `footprints on a ${t}`);
  }
  assert(traceSiteOk("footprints", "floor", "rug") && traceSiteOk("footprints", "floor", "wardrobe"));
  for (const t of ["pillow", "cushion", "rug", "curtain", "potted_plant", "bed"] as const) assert(!traceSiteOk("prints", "on", t), `prints on a ${t}`);
  for (const t of ["door", "mirror", "desk", "desk_lamp", "dresser"] as const) assert(traceSiteOk("prints", "on", t), `no prints on a ${t}`);
  for (const t of ["rug", "bed", "sofa", "table"] as const) assert(traceSiteOk("stain", "on", t));
  assert(!traceSiteOk("stain", "on", "mirror") && !traceSiteOk("writing", "on", "bed") && !traceSiteOk("writing", "on", "pillow"));
  // Every listed surface is one the kind can use.
  for (const [kind, sites] of Object.entries(TRACE_SITES)) assert(Object.keys(sites).length > 0, kind);
});

Deno.test("traces: planned rooms keep every trace where it belongs, and the validator refuses one that isn't", () => {
  let seen = 0;
  for (const mode of MODES) for (let i = 0; i < 80; i++) {
    const r = planRoom(syntheticInventory(500 + i, 9 + (i % 7)), { mode, seed: `t${i}`, randomInt: seededRandomInt(i) });
    if (!r.ok) continue;
    for (const o of r.definition.objects.filter((x) => x.trace)) {
      seen++;
      const anchor = r.definition.objects.find((x) => x.id === o.trace!.anchor);
      assert(anchor, `${o.id}: its anchor isn't in the room`);
      assert(traceSiteOk(o.trace!.kind, o.trace!.surface, anchor.type), `${o.trace!.kind} ${o.trace!.surface} ${anchor.type}`);
      // "By" an object is off it: a floor or wall trace never covers its anchor.
      if (o.trace!.surface !== "on" && anchor.type !== "rug") {
        // (The anchor's box is padded for tapping: the object itself is RECT_PADDING inside it.)
        const a = { x: anchor.box.x + RECT_PADDING, y: anchor.box.y + RECT_PADDING, w: anchor.box.w - 2 * RECT_PADDING, h: anchor.box.h - 2 * RECT_PADDING }, b = o.box;
        const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)), oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
        assert(ox * oy <= 0.021 * b.w * b.h, `${o.id} sits on its anchor ${anchor.type}`);
      }
    }
    // Footprints on a bed, made by hand: refused.
    const t = r.definition.objects.find((x) => x.trace);
    if (t && i < 5) {
      const bed = { ...r.definition.objects.find((x) => x.id === t.trace!.anchor)!, type: "bed" as const, archetype: null, variant: undefined, controls: [], initial: {}, submit: undefined };
      const def = { ...r.definition, objects: r.definition.objects.map((x) => (x.id === bed.id ? bed : x.id === t.id ? { ...x, trace: { ...x.trace!, kind: "footprints" as const, surface: "on" as const } } : x)) };
      assert(validateDefinition(def).some((e) => e.includes("footprints can't be on a bed")), JSON.stringify(validateDefinition(def)));
    }
  }
  assert(seen > 10, `${seen} traces`);
});

Deno.test("tools: UV stays rare (a quarter of rooms or less), with or without a lamp or a mirror, and every tool turns up", () => {
  const bare = [obj("door", 0), obj("desk", 1), obj("bookshelf", 1), obj("rug", 2), obj("cabinet", 2), obj("pillow", 3), obj("chest", 3)];
  for (const [name, invs] of [["lamp rooms", [BEDROOM_WITH_DOOR, FULL_15, SPARSE_5]], ["rooms with no lamp or mirror", [bare]]] as const) {
    for (const mode of MODES) {
      const used = new Map<string, number>();
      let rooms = 0;
      for (const inv of invs) for (let i = 0; i < 60 / invs.length; i++) {
        const r = planRoom(inv, { mode, seed: `mix-${i}`, randomInt: seededRandomInt(i) });
        assert(r.ok, `${name} ${mode} ${i}: ${!r.ok && r.detail}`);
        rooms++;
        for (const [tool, motif] of Object.entries(TOOL_MOTIF)) if (r.summary.motifs.includes(motif)) used.set(tool, (used.get(tool) ?? 0) + 1);
      }
      assert((used.get("uv") ?? 0) / rooms <= 0.27, `${name}, ${mode}: UV in ${used.get("uv")} of ${rooms} rooms`);
      for (const tool of ["rub", "lens", "fold"]) assert((used.get(tool) ?? 0) >= 3, `${name}, ${mode}: ${tool} in ${used.get(tool) ?? 0} of ${rooms} rooms`);
    }
  }
  // A room with neither a lamp nor a mirror is never given a tool it can't host.
  for (let i = 0; i < 50; i++) assert(!["warm", "mirror", "none"].includes(revealTool([obj("desk", 0), obj("bed", 1)], seededRandom(`x${i}`))));
});

/** A room using `motif`, from a few seeds. */
function withMotif(mode: Mode, motif: string): Ok {
  for (let i = 0; i < 200; i++) {
    const r = planRoom(FULL_15, { mode, seed: `${motif}-${i}`, randomInt: seededRandomInt(i) });
    if (r.ok && r.summary.motifs.includes(motif as never)) return r;
  }
  throw new Error(`no ${mode} room with ${motif}`);
}

Deno.test("tools: the lemon-juice letter reads only at a lamp that's on; the backwards note at the mirror", () => {
  for (const mode of MODES) {
    for (const [motif, reveal] of [["warm_reveal", "heat"], ["mirror_reveal", "mirror"]] as const) {
      const { definition: def, secret } = withMotif(mode, motif);
      const step = secret.steps.find((s) => s.motif === motif)!;
      const rule = secret.rules.find((r) => r.step === step.id)!;
      assert(rule.trigger.on === "use");
      const { item, object } = rule.trigger;
      const card = rule.effects.find((e) => e.do === "show_card");
      assert(card && card.do === "show_card");
      assertEquals(def.cards.find((c) => c.id === card.card)!.reveal, reveal);
      // The found note says how it reads, and holds no value.
      const note = def.items.find((i) => i.id === item)!;
      const told = def.cards.find((c) => c.id === note.card)!;
      assert(!told.text.includes("{{") && (reveal === "heat" ? /lemon/i : /backwards|back to front/i).test(told.text), told.text);
      if (reveal === "heat") assertEquals(def.objects.find((o) => o.id === object)!.archetype, "Light");
      else assert(def.objects.find((o) => o.id === object)!.type === "mirror");
      // In hand: at the lamp while it's off, nothing; switched on, the writing.
      let state = { ...initialState(def), inventory: [item] };
      if (reveal === "heat") {
        assertEquals(applyAction(def, secret, state, { type: "use_item", item, object }).result.outcome, "nothing");
        state = applyAction(def, secret, state, { type: "set_control", target: object, control: "on", value: true }).state;
      }
      const out = applyAction(def, secret, state, { type: "use_item", item, object });
      assertEquals(out.result.outcome, "ok");
      assert(out.result.effects.some((e) => e.do === "show_card" && e.card === card.card));
      assert(!out.state.inventory.includes(item), "the note is used up");
    }
  }
});

Deno.test("tools: the pencil rubs the notepad and the lens reads the card, dropped either way round; the fold-in page folds on its own", () => {
  for (const mode of MODES) {
    for (const [motif, reveal] of [["rub_reveal", "rub"], ["lens_reveal", "lens"]] as const) {
      const { definition: def, secret } = withMotif(mode, motif);
      const step = secret.steps.find((s) => s.motif === motif)!;
      const rule = secret.rules.find((r) => r.step === step.id)!;
      assert(rule.trigger.on === "combine");
      const [a, b] = rule.trigger.items;
      const card = rule.effects.find((e) => e.do === "show_card");
      assert(card && card.do === "show_card");
      assertEquals(def.cards.find((c) => c.id === card.card)!.reveal, reveal);
      // Both things say how they work when found, and hold no value; they are found in two places.
      for (const id of [a, b]) {
        const told = def.cards.find((c) => c.id === def.items.find((i) => i.id === id)!.card)!;
        assert(!told.text.includes("{{") && told.text.length > 40, told.text);
      }
      const names = [a, b].map((id) => def.items.find((i) => i.id === id)!.name).sort();
      assertEquals(names, reveal === "rub" ? ["Notepad", "Soft pencil"] : ["Printed card", "Red lens"]);
      assert(step.requires.length === 2 || step.requires.length === 1, "found apart, or together in one find");
      // The last hint says the drop works either way.
      assert(/\(or the /.test(step.hints[2]), step.hints[2]);
      for (const items of [[a, b], [b, a]] as [string, string][]) {
        const out = applyAction(def, secret, { ...initialState(def), inventory: [a, b] }, { type: "combine", items });
        assertEquals(out.result.outcome, "ok");
        assert(out.result.effects.some((e) => e.do === "show_card" && e.card === card.card));
        assertEquals(out.state.inventory, []);
      }
      // One of them alone does nothing.
      assertEquals(applyAction(def, secret, { ...initialState(def), inventory: [a] }, { type: "combine", items: [a, b] }).result.outcome, "invalid");
    }
    const { definition: def, secret } = withMotif(mode, "fold_reveal");
    const step = secret.steps.find((s) => s.motif === "fold_reveal")!;
    const rule = secret.rules.find((r) => r.step === step.id)!;
    assert(rule.trigger.on === "control" && rule.trigger.control === "folded");
    const page = rule.trigger.target;
    assert(def.items.find((i) => i.id === page)!.controls?.some((c) => c.id === "folded" && c.domain.kind === "bool"));
    // In hand (granted, so its control exists), folded: the line reads and the page is used up.
    const grant = secret.rules.find((r) => r.effects.some((e) => e.do === "grant" && e.item === page))!;
    let state = initialState(def);
    state = { ...state, inventory: [page], items: { [page]: { folded: false } }, fired: [grant.id] };
    const out = applyAction(def, secret, state, { type: "set_control", target: page, control: "folded", value: true });
    assertEquals(out.result.outcome, "ok");
    const card = out.result.effects.find((e) => e.do === "show_card");
    assert(card && card.do === "show_card" && def.cards.find((c) => c.id === card.card)!.reveal === "fold");
    assert(!out.state.inventory.includes(page));
    assert(/^Tap the /.test(step.hints[2]), step.hints[2]);
  }
});
