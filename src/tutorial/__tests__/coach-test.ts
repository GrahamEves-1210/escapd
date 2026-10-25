import type { SessionState } from "@/lib/puzzle-types";
import { initialState, studyPublic } from "@/test-utils/seed";
import { tutorialCoach } from "../coach";

const def = studyPublic();
const start = initialState(def);
const step = (state: SessionState, visitedScenes = [0]) => tutorialCoach({ state, visitedScenes })?.id ?? null;

describe("tutorialCoach", () => {
  it("walks the seeded solve order, advancing only on server-confirmed progress", () => {
    let state = start;
    expect(step(state)).toBe("inspect");

    state = { ...state, solved: ["find_key"], inventory: ["brass_key"] };
    expect(step(state)).toBe("shelf");

    state = { ...state, solved: [...state.solved, "find_note_left"], inventory: [...state.inventory, "torn_note_left"] };
    expect(step(state)).toBe("scenes");
    // Looking at the second view is navigation, not progress, but it completes this step.
    expect(step(state, [0, 1])).toBe("rug");

    state = { ...state, solved: [...state.solved, "find_note_right"], inventory: [...state.inventory, "torn_note_right"] };
    expect(step(state, [0, 1])).toBe("combine");

    state = { ...state, solved: [...state.solved, "join_notes"], inventory: ["brass_key", "full_note"] };
    expect(step(state, [0, 1])).toBe("use");

    state = {
      solved: [...state.solved, "open_cabinet"],
      inventory: ["full_note"],
      revealed_hotspots: [...state.revealed_hotspots, "safe"],
    };
    expect(step(state, [0, 1])).toBe("code");

    state = { ...state, solved: [...state.solved, "open_safe"] };
    expect(step(state, [0, 1])).toBe("exit");

    state = { ...state, solved: [...state.solved, "escape"] };
    expect(step(state, [0, 1, 2])).toBeNull();
  });

  it("does not ask for an item the player does not have yet", () => {
    // Out of order: notes found and joined, but the drawer was never searched.
    // The coach points back at the drawer rather than at "use the key".
    const state: SessionState = { ...start, solved: ["find_note_left", "find_note_right", "join_notes"], inventory: ["full_note"] };
    expect(step(state, [0, 1])).toBe("inspect");
  });

  it("points at hotspots that exist in the seed", () => {
    const hotspotIds = new Set(def.hotspots.map((h) => h.id));
    const states: SessionState[] = [start, { ...start, solved: ["find_key"] }];
    for (const s of states) {
      const target = tutorialCoach({ state: s, visitedScenes: [0] })?.target;
      if (target?.kind === "hotspot") {
        expect(hotspotIds.has(target.hotspotId)).toBe(true);
        expect(def.hotspots.find((h) => h.id === target.hotspotId)?.photo_index).toBe(target.photoIndex);
      }
    }
  });
});
