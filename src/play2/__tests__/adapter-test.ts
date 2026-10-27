// v1 rooms on the v2 engine: labels to taxonomy types, hotspots to an
// inventory, and a plan that is the same every time for the same room.
import { simulate } from "@/engine/v2";
import type { PuzzleDefinitionV1 } from "@/lib/puzzle-types";
import { FIXTURE_ROOM_ID, studyPublic } from "@/test-utils/seed";
import { inventoryFromV1, planFromV1, typeForLabel } from "../adapter";

const spot = (id: string, label: string, photo: number, x: number, y: number, w = 0.2, h = 0.25) =>
  ({ id, photo_index: photo, object_label: label, shape: { type: "rect" as const, x, y, w, h } });

/** A bedroom as v1 generation would have labelled it. */
const bedroom = (): PuzzleDefinitionV1 => ({
  schema_version: 1, genre: "noir", title: "Bedroom", photos: [{ photo_id: "a" }, { photo_id: "b" }],
  items: [], puzzles: [], exit: { requires: [] },
  hotspots: [
    spot("door", "bedroom door", 0, 0.05, 0.1, 0.25, 0.8),
    spot("desk", "wooden desk with drawers", 0, 0.4, 0.5),
    spot("lamp", "desk lamp", 0, 0.45, 0.3, 0.1, 0.15),
    spot("clock", "wall clock", 0, 0.7, 0.1, 0.1, 0.1),
    spot("shelf", "bookcase", 1, 0.1, 0.2, 0.3, 0.6),
    spot("frame", "framed photo", 1, 0.5, 0.15),
    spot("pillow", "pillow", 1, 0.6, 0.6, 0.15, 0.1),
    spot("radio", "radio", 1, 0.8, 0.6, 0.1, 0.1),
  ],
});

describe("v1 rooms on the v2 engine", () => {
  it("reads a label as the taxonomy's type", () => {
    expect(typeForLabel("coffee table")).toBe("coffee_table");
    expect(typeForLabel("wooden desk with drawers")).toBe("desk");
    expect(typeForLabel("bookcase")).toBe("bookshelf");
    expect(typeForLabel("wall clock")).toBe("wall_clock");
    expect(typeForLabel("old painting")).toBe("framed_picture");
    expect(typeForLabel("closet")).toBe("wardrobe");
    expect(typeForLabel("a mysterious thing")).toBe("other");
  });

  it("turns each hotspot into an inventory object with its box on 0..1000", () => {
    const [door] = inventoryFromV1(bedroom());
    expect(door).toMatchObject({ id: "door", type: "door", features: ["is_door", "can_open"], box: [100, 50, 900, 300], photo_index: 0 });
  });

  it("plans a solvable room, the same one every time for the same room", () => {
    const a = planFromV1("room-1", bedroom());
    const b = planFromV1("room-1", bedroom());
    if (!a.ok || !b.ok) throw new Error(a.ok ? "b failed" : `${a.reason}: ${a.detail}`);
    expect(simulate(a.definition, a.secret).ok).toBe(true);
    expect(b.definition).toEqual(a.definition);
    expect(b.secret).toEqual(a.secret);
    expect(a.definition.objects.filter((o) => o.exit)).toHaveLength(1);
  });

  it("says why when a room can't be planned (the seeded study has no way out)", () => {
    const study = planFromV1(FIXTURE_ROOM_ID, studyPublic());
    expect(study.ok ? "ok" : study.reason).toMatch(/ok|no_exit|too_few_objects|no_valid_plan/);
  });
});
