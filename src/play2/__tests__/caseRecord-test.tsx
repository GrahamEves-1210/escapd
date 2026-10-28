// How a v2 game went, for case closed (caseRecord.ts): a room planned on the
// device played through useRoomV2, with a hint and a wrong accusation, to its
// end; the count kept across a resume and started again with the room; the
// accusation that held, found again from the plan; the case's own title.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook } from "@testing-library/react-native";
import { simulate, type Action } from "@/engine/v2";
import * as api from "@/lib/escapd-api";
import type { PuzzleDefinitionV1 } from "@/lib/puzzle-types";
import { planFromV1 } from "../adapter";
import { solvedAccusation, useCaseRecord } from "../caseRecord";
import { useRoomV2 } from "../useRoomV2";

jest.mock("@/lib/escapd-api", () => ({
  ensureSession: jest.fn(async () => ({})),
  startOrResume: jest.fn(async () => ({ id: "s1", puzzle_version_id: "v1" })),
  abandonSession: jest.fn(async () => ({})),
  getPlayableDefinition: jest.fn(),
  playActionV2: jest.fn(),
  isNetworkError: () => false,
}));
const mocked = api as jest.Mocked<typeof api>;

const spot = (id: string, label: string, photo: number, x: number, y: number, w = 0.2, h = 0.25) =>
  ({ id, photo_index: photo, object_label: label, shape: { type: "rect" as const, x, y, w, h } });
const study = (): PuzzleDefinitionV1 => ({
  schema_version: 1, genre: "crime_scene", title: "The Poisoned Study", photos: [{ photo_id: "a" }, { photo_id: "b" }],
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
const ROOM = "room-cr";

function useGame() {
  const v2 = useRoomV2(ROOM);
  const record = useCaseRecord(ROOM, v2);
  return { v2, record };
}
type Game = ReturnType<typeof useGame>;

async function loaded(hook: { current: Game }) {
  await act(async () => {
    for (let i = 0; i < 200 && hook.current.v2.phase.kind === "loading"; i++) await new Promise((r) => setTimeout(r, 10));
    await new Promise((r) => setTimeout(r, 10));
  });
}

let clock = Date.now();
beforeEach(async () => {
  await AsyncStorage.clear();
  mocked.getPlayableDefinition.mockResolvedValue(study());
  clock = Date.now();
  jest.spyOn(Date, "now").mockImplementation(() => clock);
});
afterEach(() => {
  jest.restoreAllMocks();
});

function planned() {
  const plan = planFromV1(ROOM, study());
  if (!plan.ok) throw new Error(plan.detail);
  return plan;
}

describe("solvedAccusation", () => {
  it("names the suspect, motive and method the door's rule takes: the simulator's winning accusation", () => {
    const plan = planned();
    const { path } = simulate(plan.definition, plan.secret);
    const last = path[path.length - 1] as Extract<Action, { type: "submit" }>;
    const found = solvedAccusation(plan.definition, plan.secret);
    expect([found?.who.id, found?.why?.id, found?.how?.id]).toEqual(last.value);
    expect(found?.who.name).toBeTruthy();
  });
});

describe("useCaseRecord", () => {
  it("counts the hints, the wrong answers and the time played, and hands case closed the case", async () => {
    const plan = planned();
    const { path } = simulate(plan.definition, plan.secret);
    const right = solvedAccusation(plan.definition, plan.secret)!;
    const finale = plan.definition.finale as Extract<typeof plan.definition.finale, { kind: "accusation" }>;
    const wrongSuspect = finale.suspects.find((s) => s.id !== right.who.id)!;

    const { result } = await renderHook(useGame);
    await loaded(result);
    expect(result.current.v2.phase.kind).toBe("ready");

    await act(async () => {
      await result.current.v2.hint();
    });
    // A wrong accusation at the door: its cooldown starts, and it counts.
    clock += 30_000;
    await act(async () => {
      await result.current.v2.act({ type: "submit", object: finale.object, value: [wrongSuspect.id, right.why!.id, right.how!.id] });
    });
    expect(result.current.v2.cooldown).toBeGreaterThan(0);
    clock += 60_000;
    for (const action of path) {
      await act(async () => {
        await result.current.v2.act(action);
      });
      clock += 1_000;
    }
    expect(result.current.v2.completed).toBe(true);
    // Time stands still once the case is closed.
    clock += 600_000;
    const done = result.current.record.finish();
    expect(done.stats.hints).toBe(1);
    expect(done.stats.wrong).toBe(1);
    expect(done.stats.ms).toBe(90_000 + path.length * 1_000 - 1_000);
    expect(done.title).toBe("The Poisoned Study");
    expect(done.genre).toBe("crime_scene");
    expect(done.accusation).toEqual(right);
    expect(done.photoRef).toEqual({ photo_id: "a" });
  });

  it("keeps the count when the game is left and resumed, and starts it again with the room", async () => {
    const plan = planned();
    const finale = plan.definition.finale as Extract<typeof plan.definition.finale, { kind: "accusation" }>;
    const right = solvedAccusation(plan.definition, plan.secret)!;
    const wrong = [finale.suspects.find((s) => s.id !== right.who.id)!.id, right.why!.id, right.how!.id];

    const first = await renderHook(useGame);
    await loaded(first.result);
    await act(async () => {
      await first.result.current.v2.hint();
    });
    await act(async () => {
      await first.result.current.v2.act({ type: "submit", object: finale.object, value: wrong });
    });
    clock += 20_000;
    await first.unmount();

    clock += 3_600_000; // away for an hour: not play time
    const second = await renderHook(useGame);
    await loaded(second.result);
    clock += 5_000;
    expect(second.result.current.record.finish().stats).toEqual({ hints: 1, wrong: 1, ms: 25_000 });

    // Start again from the top: the count starts again.
    await act(async () => {
      await second.result.current.v2.restart();
    });
    clock += 2_000;
    expect(second.result.current.record.finish().stats).toEqual({ hints: 0, wrong: 0, ms: 2_000 });
  });
});
