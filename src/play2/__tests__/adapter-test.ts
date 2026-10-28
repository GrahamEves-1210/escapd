// v1 rooms on the v2 engine: labels to taxonomy types, hotspots to an
// inventory, and a plan that is the same every time for the same room.
import { renderCard, simulate } from "@/engine/v2";
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

  it("leaves hidden hotspots out: v2 has nothing to reveal them with, and they'd sit on their parent", () => {
    const ids = inventoryFromV1(studyPublic()).map((o) => o.id);
    expect(ids).not.toContain("safe");
    expect(ids).toEqual(expect.arrayContaining(["desk_drawer", "bookshelf", "rug", "cabinet", "door"]));
  });
});

// The rooms the web mock plays: The Study in each mode, seeded by these ids.
const STUDY_ROOMS = [
  ["noir", "11111111-1111-4111-8111-111111111111"],
  ["crime_scene", "22222222-2222-4222-8222-222222222222"],
  ["paranormal", "33333333-3333-4333-8333-333333333333"],
] as const;

describe.each(STUDY_ROOMS)("The Study played on the device (%s)", (mode, roomId) => {
  const plan = () => {
    const r = planFromV1(roomId, { ...studyPublic(), genre: mode });
    if (!r.ok) throw new Error(`${r.reason}: ${r.detail}`);
    return r;
  };

  it("plans a solvable room in the mode's voice", () => {
    const { definition, secret } = plan();
    expect(simulate(definition, secret).ok).toBe(true);
    expect(definition.mode).toBe(mode);
    expect(definition.objective).not.toMatch(/^Find the combination and open/);
    expect(secret.ending).not.toMatch(/^The lock gives\. Case closed\.$/);
  });

  it("fits each mechanism to its object, and keeps the hidden safe out of the cabinet", () => {
    const { definition } = plan();
    const byId = new Map(definition.objects.map((o) => [o.id, o]));
    expect(byId.has("safe")).toBe(false);
    const drawer = definition.objects.find((o) => o.label === "drawer");
    if (drawer?.archetype === "Drawer") expect(drawer.variant).toBe("drawer");
    expect(definition.objects.find((o) => o.type === "bookshelf")?.archetype).not.toBe("Drawer");
  });

  it("writes findings, not labels, and no card just repeats an item", () => {
    const { definition, secret } = plan();
    for (const c of definition.cards) {
      const text = renderCard(c, secret);
      expect(text).not.toMatch(/^(Code|Page|Ritual|Suspect|Motive|Method)\b[^:\n]*:/m);
      expect(text).not.toMatch(/Page in the|Half of something/);
    }
    for (const i of definition.items) {
      expect(i.name).toMatch(/^[A-Z]/);
      if (i.card) expect(i.kind).toBe("assembled");
    }
    expect(new Set(definition.items.map((i) => i.name)).size).toBe(definition.items.length);
    // A ritual line never points at the object its card was found at (a note in the drawer naming the drawer).
    for (const [name, slot] of Object.entries(secret.slots)) {
      if (slot.kind !== "object") continue;
      const card = definition.cards.find((c) => c.text.includes(`{{${name}}}`))!;
      const foundAt = secret.rules.filter((r) => r.effects.some((e) => e.do === "show_card" && e.card === card.id))
        .map((r) => (r.trigger.on === "control" ? r.trigger.target : "object" in r.trigger ? r.trigger.object : null));
      expect(foundAt).not.toContain(slot.value);
      expect(slot.text).not.toMatch(new RegExp(`\\b${definition.objects.find((o) => o.id === slot.value)!.label}\\b`, "i"));
    }
    if (definition.finale.kind === "accusation") {
      for (const o of [...definition.finale.suspects, ...definition.finale.motives, ...definition.finale.methods]) {
        expect(o.name).not.toMatch(/^(Suspect|Motive|Method) [ABC]$/);
      }
    }
  });
});
