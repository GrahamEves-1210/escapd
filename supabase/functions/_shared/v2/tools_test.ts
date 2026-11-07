// The reveal tools (UV, the lemon-juice letter, the mirror note) and where UV traces may lie.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { RECT_PADDING } from "../geometry.ts";
import { applyAction, initialState } from "./engine.ts";
import { planRoom, type PlanResult, revealTool, seededRandom } from "./planner.ts";
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
  assert(seen > 40, `${seen} traces`);
});

Deno.test("tools: UV is one tool among several: at most about a third of rooms with a lamp, per mode", () => {
  const lampRooms = [BEDROOM_WITH_DOOR, FULL_15, SPARSE_5];
  for (const mode of MODES) {
    let uv = 0, other = 0, rooms = 0;
    for (const inv of lampRooms) for (let i = 0; i < 20; i++) {
      const r = planRoom(inv, { mode, seed: `mix-${i}`, randomInt: seededRandomInt(i) });
      if (!r.ok) continue;
      rooms++;
      if (r.summary.motifs.includes("tool_reveal")) uv++;
      if (r.summary.motifs.some((m) => m === "warm_reveal" || m === "mirror_reveal")) other++;
    }
    assert(uv / rooms <= 0.4, `${mode}: UV in ${uv} of ${rooms} rooms`);
    assert(other >= rooms / 6, `${mode}: the other tools in only ${other} of ${rooms} rooms`);
  }
  // The choice is the room's, and a room with neither a lamp nor a mirror falls back to UV.
  assertEquals(revealTool([obj("desk", 0), obj("bed", 1)], seededRandom("x")), "uv");
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
