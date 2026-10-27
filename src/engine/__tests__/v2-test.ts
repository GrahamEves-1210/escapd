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
