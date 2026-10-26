import type { PuzzleDefinitionV1, SessionState } from "@/lib/puzzle-types";
import { initialState, studyPublic } from "@/test-utils/seed";
import {
  QUIET_COPY, accusePuzzle, anomalies, availableCodePuzzle, canAccuse, definitionProblem, exploreEntries, gainedItems,
  hotspotA11yLabel, hotspotById, hotspotsForScene, inventoryItems, isAnomalyFound, newlyContradicted, presence,
  presenceLabel, quietReason, scenesWithHotspots, suspectById, suspectCards, tapIntent,
} from "../selectors";

const def = studyPublic();
const start = initialState(def);
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

// The state the server returns after the cabinet opens (key used, safe revealed).
const afterCabinet: SessionState = {
  solved: ["find_key", "find_note_left", "find_note_right", "join_notes", "open_cabinet"],
  inventory: ["full_note"],
  revealed_hotspots: [...start.revealed_hotspots, "safe"],
};

describe("definitionProblem", () => {
  it("accepts the seeded tutorial", () => {
    expect(definitionProblem(def)).toBeNull();
  });

  it("rejects a newer schema and unknown kinds with a reason", () => {
    expect(definitionProblem({ ...def, schema_version: 2 })).toBe("unsupported_schema");
    const unknown = { ...def, puzzles: [...def.puzzles, { id: "x", kind: "symbol_wheel" }] } as unknown;
    expect(definitionProblem(unknown)).toBe("unknown_kind");
    expect(definitionProblem(null)).toBe("missing_definition");
  });

  it("plays a paranormal room: genre and hotspot effects are optional extras", () => {
    const haunted: PuzzleDefinitionV1 = {
      ...def,
      genre: "paranormal",
      hotspots: def.hotspots.map((h, i) => (i === 0 ? { ...h, effect: "flicker" } : h)),
    };
    expect(definitionProblem(haunted)).toBeNull();
  });

  it("plays a crime scene: its accuse step is a known kind", () => {
    const option = (id: string) => ({ id, name: id });
    const crimeScene: PuzzleDefinitionV1 = {
      ...def,
      genre: "crime_scene",
      puzzles: [...def.puzzles, {
        id: "name_the_killer", kind: "accuse", requires: ["open_safe"],
        suspects: [{ id: "s_ivy", name: "Ivy Marsh", role: "The housekeeper", alibi: "In the garden all evening." }],
        motives: [option("m_debt")], methods: [option("x_tea")],
      }],
    };
    expect(definitionProblem(crimeScene)).toBeNull();
  });

  it("refuses an accusation with nothing to pick in one of its lists", () => {
    const empty: PuzzleDefinitionV1 = {
      ...def,
      puzzles: [...def.puzzles, { id: "name_the_killer", kind: "accuse", suspects: [{ id: "s", name: "S" }], motives: [{ id: "m", name: "M" }], methods: [] }],
    };
    expect(definitionProblem(empty)).toBe("malformed");
  });

  it("rejects a hotspot pointing at a photo that does not exist", () => {
    const bad: PuzzleDefinitionV1 = { ...def, hotspots: [{ ...def.hotspots[0], photo_index: 9 }] };
    expect(definitionProblem(bad)).toBe("bad_photo_index");
  });
});

describe("hotspotsForScene", () => {
  it("never includes the hidden safe before the server reveals it", () => {
    expect(ids(hotspotsForScene(def, start, 1))).toEqual(["rug", "cabinet"]);
  });

  it("includes the safe once revealed, drawn last so the smaller rect wins", () => {
    const scene = ids(hotspotsForScene(def, afterCabinet, 1));
    expect(scene).toContain("safe");
    expect(scene[scene.length - 1]).toBe("safe");
  });

  it("only returns hotspots for the requested photo", () => {
    expect(ids(hotspotsForScene(def, start, 0))).toEqual(["bookshelf", "desk_drawer"]);
    expect(ids(hotspotsForScene(def, start, 2))).toEqual(["door"]);
  });
});

describe("tapIntent", () => {
  it("opens the keypad on the safe only once the code puzzle is available", () => {
    expect(tapIntent(def, start, "safe").kind).toBe("inspect");
    const intent = tapIntent(def, afterCabinet, "safe");
    expect(intent.kind).toBe("code");
    expect(intent.kind === "code" && intent.puzzle.id).toBe("open_safe");
  });

  it("sends inspect for everything else, including locked objects", () => {
    expect(tapIntent(def, start, "door").kind).toBe("inspect");
    expect(tapIntent(def, start, "cabinet").kind).toBe("inspect");
  });

  it("does not offer a code puzzle that is already solved", () => {
    const solved = { ...afterCabinet, solved: [...afterCabinet.solved, "open_safe"] };
    expect(availableCodePuzzle(def, solved, "safe")).toBeUndefined();
  });
});

describe("quietReason", () => {
  it("says something is missing at the locked cabinet, without naming the key", () => {
    expect(quietReason(def, start, "cabinet")).toBe("needs_item");
    expect(QUIET_COPY.needs_item).not.toMatch(/key/i);
  });

  it("says the door does not open yet before the safe is solved", () => {
    expect(quietReason(def, start, "door")).toBe("locked");
  });

  it("says nothing else is here once a spot is used up", () => {
    expect(quietReason(def, { ...start, solved: ["find_key"] }, "desk_drawer")).toBe("spent");
  });

  it("treats an object that was never part of the case as plain", () => {
    const herring: PuzzleDefinitionV1 = {
      ...def,
      hotspots: [...def.hotspots, { ...def.hotspots[0], id: "lamp", object_label: "lamp", name: undefined }],
    };
    expect(quietReason(herring, start, "lamp")).toBe("plain");
  });
});

describe("inventoryItems", () => {
  it("reads descriptions only for items the server placed in inventory", () => {
    const state = { ...start, inventory: ["brass_key"] };
    const items = inventoryItems(def, state);
    expect(items).toEqual([{ id: "brass_key", name: "Brass key", description: "Small and a little tarnished." }]);
    // The code clue lives in full_note; it must not surface before it is granted.
    expect(JSON.stringify(items)).not.toContain("0427");
  });

  it("keeps inventory order and ignores ids that are not items", () => {
    const state = { ...start, inventory: ["torn_note_right", "nope", "brass_key"] };
    expect(ids(inventoryItems(def, state))).toEqual(["torn_note_right", "brass_key"]);
  });

  it("gainedItems resolves only granted ids against the new state", () => {
    expect(gainedItems(def, afterCabinet, ["full_note"])[0].description).toContain("0427");
    expect(gainedItems(def, start, ["full_note"])).toEqual([]);
  });
});

describe("explore list and labels", () => {
  it("lists revealed hotspots in photo order and leaves the hidden safe out", () => {
    expect(exploreEntries(def, start).map((e) => e.hotspot.id)).toEqual(["desk_drawer", "bookshelf", "rug", "cabinet", "door"]);
    expect(exploreEntries(def, afterCabinet).map((e) => e.hotspot.id)).toContain("safe");
  });

  it("labels hotspots for assistive technology", () => {
    const drawer = hotspotById(def, "desk_drawer")!;
    const safe = hotspotById(def, "safe")!;
    expect(hotspotA11yLabel(def, start, drawer, { kind: "default" })).toBe("Desk drawer, inspectable");
    expect(hotspotA11yLabel(def, afterCabinet, safe, { kind: "default" })).toBe("Wall safe, enter a code");
    expect(hotspotA11yLabel(def, start, drawer, { kind: "use", itemName: "Brass key" })).toBe("Desk drawer, use Brass key here");
  });

  it("maps revealed hotspots to their photos", () => {
    expect(scenesWithHotspots(def, ["safe"])).toEqual([1]);
    expect(scenesWithHotspots(def, undefined)).toEqual([]);
  });
});

describe("crime scene: the accusation and the suspects", () => {
  // The Study with an accusation that needs the key and the left half of the note.
  const crime: PuzzleDefinitionV1 = {
    ...def,
    genre: "crime_scene",
    puzzles: [...def.puzzles, {
      id: "name_the_killer", kind: "accuse", requires: ["find_key", "find_note_left"],
      suspects: [
        { id: "s_ivy", name: "Ivy Marsh", role: "The housekeeper", alibi: "In the garden all evening." },
        { id: "s_tobias", name: "Tobias Reed", role: "The business partner", alibi: "On the late train home." },
      ],
      motives: [{ id: "m_debt", name: "A debt" }],
      methods: [{ id: "x_tea", name: "Poison in the tea" }],
    }],
  };

  it("finds the accusation, and opens it only once every evidence step is solved", () => {
    expect(accusePuzzle(crime)?.id).toBe("name_the_killer");
    expect(accusePuzzle(def)).toBeUndefined();
    expect(canAccuse(crime, start)).toBe(false);
    expect(canAccuse(crime, { ...start, solved: ["find_key"] })).toBe(false);
    expect(canAccuse(crime, { ...start, solved: ["find_key", "find_note_left"] })).toBe(true);
    // Solved: the accusation is over.
    expect(canAccuse(crime, { ...start, solved: ["find_key", "find_note_left", "name_the_killer"] })).toBe(false);
    expect(canAccuse(def, start)).toBe(false);
  });

  it("marks suspects contradicted only when the server lists them, and tolerates an older state without the list", () => {
    expect(suspectCards(crime, start).map((s) => [s.id, s.contradicted])).toEqual([["s_ivy", false], ["s_tobias", false]]);
    const broken = { ...start, contradicted: ["s_tobias"] };
    expect(suspectCards(crime, broken).find((s) => s.id === "s_tobias")).toMatchObject({
      name: "Tobias Reed", role: "The business partner", alibi: "On the late train home.", contradicted: true,
    });
    expect(newlyContradicted(crime, start, broken).map((s) => s.name)).toEqual(["Tobias Reed"]);
    expect(newlyContradicted(crime, broken, broken)).toEqual([]);
    expect(suspectById(crime, "s_ivy")?.name).toBe("Ivy Marsh");
    expect(suspectById(crime, undefined)).toBeUndefined();
  });

  it("opens the Accuse screen from a case-board hotspot, and labels it", () => {
    const board: PuzzleDefinitionV1 = {
      ...crime,
      puzzles: crime.puzzles.map((p) => (p.kind === "accuse" ? { ...p, hotspot_id: "door" } : p)),
    };
    const ready = { ...start, solved: ["find_key", "find_note_left"] };
    expect(tapIntent(board, start, "door").kind).toBe("inspect");
    expect(tapIntent(board, ready, "door").kind).toBe("accuse");
    expect(hotspotA11yLabel(board, ready, hotspotById(board, "door")!, { kind: "default" })).toBe("Door, make your accusation");
    // The usual accusation has no hotspot: taps everywhere still inspect.
    expect(tapIntent(crime, ready, "door").kind).toBe("inspect");
  });
});

describe("paranormal: the presence", () => {
  const haunted: PuzzleDefinitionV1 = {
    ...def,
    genre: "paranormal",
    hotspots: def.hotspots.map((h) => ({ ...h, effect: ({ desk_drawer: "flicker", cabinet: "moved", safe: "whisper" } as const)[h.id as "desk_drawer"] })),
  };

  it("counts effect hotspots as anomalies, hidden ones included", () => {
    expect(anomalies(haunted).map((h) => h.id).sort()).toEqual(["cabinet", "desk_drawer", "safe"]);
    expect(presence(haunted, start)).toEqual({ found: 0, total: 3 });
    expect(presence(def, start)).toEqual({ found: 0, total: 0 });
  });

  it("finds an anomaly when a step on it is solved, or when the hidden one is revealed", () => {
    const drawer = hotspotById(haunted, "desk_drawer")!;
    expect(isAnomalyFound(haunted, start, drawer)).toBe(false);
    expect(isAnomalyFound(haunted, { ...start, solved: ["find_key"] }, drawer)).toBe(true);
    // The cabinet's step is a use_item; the safe was hidden until the cabinet opened.
    expect(presence(haunted, afterCabinet)).toEqual({ found: 3, total: 3 });
    expect(presenceLabel({ found: 2, total: 5 })).toBe("The presence: 2 of 5");
  });
});
