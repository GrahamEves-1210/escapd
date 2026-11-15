// What a planned room shows publicly (shown.ts): what each photograph depicts, what each container holds.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { planRoom } from "./planner.ts";
import { applyAction, initialState } from "./engine.ts";
import { BEDROOM_WITH_DOOR, FULL_15, SPARSE_5, seededRandomInt } from "./test_fixtures.ts";
import { MODES } from "./types.ts";

const ROOMS = [FULL_15, BEDROOM_WITH_DOOR, SPARSE_5];

Deno.test("shown: every photograph shows a room object, and its text is only what's on its back", () => {
  let photos = 0;
  for (const mode of MODES) for (const inv of ROOMS) for (let i = 0; i < 16; i++) {
    const r = planRoom(inv, { mode, seed: `photo-${i}`, randomInt: seededRandomInt(i) });
    if (!r.ok) continue;
    const def = r.definition;
    for (const c of def.cards.filter((x) => x.look === "photo")) {
      photos++;
      const o = def.objects.find((x) => x.id === c.object);
      assert(o && !o.trace, `${mode} ${i}: ${c.id} shows ${c.object}`);
      assert(!/photograph|face down|on the back/i.test(c.text), c.text);
    }
  }
  assert(photos > 0, "no photograph in any room");
});

Deno.test("shown: what a container holds is exactly what opening it gives", () => {
  let held = 0;
  for (const mode of MODES) for (const inv of ROOMS) for (let i = 0; i < 10; i++) {
    const r = planRoom(inv, { mode, seed: `holds-${i}`, randomInt: seededRandomInt(i) });
    if (!r.ok) continue;
    const { definition: def, secret } = r;
    for (const o of def.objects.filter((x) => x.holds)) {
      held++;
      const control = { Drawer: "open", LiftUnder: "lifted", FrameTilt: "tilted" }[o.archetype as string]!;
      assert(control && o.initial.locked !== true, `${o.id} ${o.archetype}`);
      const out = applyAction(def, secret, initialState(def), { type: "set_control", target: o.id, control, value: true });
      const items = out.result.effects.flatMap((e) => (e.do === "grant" ? [e.item] : []));
      assertEquals(items, o.holds!.items, `${mode} ${i} ${o.id}`);
      for (const c of o.holds!.cards) assert(out.result.effects.some((e) => e.do === "show_card" && e.card === c), `${o.id}: ${c}`);
    }
  }
  assert(held > 0, "no container holds anything");
});
