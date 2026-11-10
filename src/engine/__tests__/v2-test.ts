// The app imports the shared v2 core (supabase/functions/_shared/v2) through src/engine/v2.ts.
// Plans a room and plays the simulator's winning path through the engine, as a local preview would.
import { applyAction, initialState, type InventoryObject, planRoom } from "@/engine/v2";

const inv = (type: InventoryObject["type"], photo: number, features: InventoryObject["features"]): InventoryObject => ({
  id: `${type}_${photo}`, label: type.replace(/_/g, " "), type, features, box: [200, 100 + photo * 120, 600, 200 + photo * 120],
  photo_index: photo, salience: 0.7, fully_visible: true,
});

test("plans and plays a v2 room in the app runtime", () => {
  let s = 1;
  const randomInt = (max: number) => { s = (s * 16807) % 2147483647; return s % max; };
  const room = [
    inv("door", 0, ["is_door"]), inv("desk", 1, ["has_drawers"]), inv("pillow", 2, ["can_lift"]),
    inv("poster", 3, ["wall_mounted"]), inv("desk_lamp", 1, ["light_source"]), inv("wall_clock", 4, ["has_hands", "wall_mounted"]),
  ];
  const r = planRoom(room, { mode: "noir", seed: "app", randomInt });
  if (!r.ok) throw new Error(r.detail);
  let state = initialState(r.definition);
  for (const action of r.report.path) state = applyAction(r.definition, r.secret, state, action).state;
  expect(state.completed).toBe(true);
});

test("the reveal tools play in the app runtime: a letter warmed at a lamp, a note read in a mirror", () => {
  const room = [
    inv("door", 0, ["is_door"]), inv("desk", 1, ["has_drawers"]), inv("pillow", 2, ["can_lift"]), inv("cabinet", 2, ["has_doors", "can_open"]),
    inv("desk_lamp", 1, ["light_source"]), inv("mirror", 3, ["wall_mounted", "reflective"]), inv("rug", 4, ["can_lift"]), inv("bookshelf", 4, ["has_pages"]),
  ];
  const found = new Set<string>();
  for (let i = 0; i < 600 && !(found.has("heat") && found.has("mirror")); i++) {
    let s = i + 1;
    const randomInt = (max: number) => { s = (s * 16807) % 2147483647; return s % max; };
    const r = planRoom(room, { mode: (["noir", "crime_scene", "paranormal"] as const)[i % 3], seed: `tools-${i}`, randomInt });
    if (!r.ok) continue;
    const reveals = r.definition.cards.filter((c) => c.reveal).map((c) => c.reveal!);
    if (!reveals.length) continue;
    let state = initialState(r.definition);
    const seen: string[] = [];
    for (const action of r.report.path) {
      const out = applyAction(r.definition, r.secret, state, action);
      for (const e of out.result.effects) if (e.do === "show_card") seen.push(e.card);
      state = out.state;
    }
    expect(state.completed).toBe(true);
    // The tool's card was read on the way out.
    for (const c of r.definition.cards.filter((x) => x.reveal)) expect(seen).toContain(c.id);
    reveals.forEach((k) => found.add(k));
  }
  expect(found.has("heat") && found.has("mirror")).toBe(true);
});

test("the hands-on reveals play in the app runtime: a pencil rubbing, a red lens, a fold-in page", () => {
  // A room with no lamp and no mirror: these three need nothing in it.
  const room = [
    inv("door", 0, ["is_door"]), inv("desk", 1, ["has_drawers"]), inv("pillow", 2, ["can_lift"]), inv("cabinet", 2, ["has_doors", "can_open"]),
    inv("rug", 4, ["can_lift"]), inv("bookshelf", 4, ["has_pages"]), inv("poster", 3, ["wall_mounted"]),
  ];
  const found = new Set<string>();
  let uv = 0, rooms = 0;
  for (let i = 0; i < 150; i++) {
    let s = i + 1;
    const randomInt = (max: number) => { s = (s * 16807) % 2147483647; return s % max; };
    const r = planRoom(room, { mode: (["noir", "crime_scene", "paranormal"] as const)[i % 3], seed: `hands-${i}`, randomInt });
    if (!r.ok) throw new Error(r.detail);
    rooms++;
    if (r.summary.motifs.includes("tool_reveal")) uv++;
    let state = initialState(r.definition);
    const seen: string[] = [];
    for (const action of r.report.path) {
      const out = applyAction(r.definition, r.secret, state, action);
      for (const e of out.result.effects) if (e.do === "show_card") seen.push(e.card);
      state = out.state;
    }
    expect(state.completed).toBe(true);
    for (const c of r.definition.cards.filter((x) => x.reveal)) {
      expect(seen).toContain(c.id);
      found.add(c.reveal!);
    }
  }
  expect([...found].sort()).toEqual(["fold", "lens", "rub"]);
  // UV stays rare even here, where there's no lamp or mirror to use instead.
  expect(uv / rooms).toBeLessThanOrEqual(0.27);
});
