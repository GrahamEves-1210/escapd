// A whole v2 room played through the hook: planned from a v1 room, every
// action of the simulator's winning path, progress saved and resumed, a wrong
// submit's cooldown, and the hint ladder.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook } from "@testing-library/react-native";
import { simulate } from "@/engine/v2";
import * as api from "@/lib/escapd-api";
import type { PuzzleDefinitionV1 } from "@/lib/puzzle-types";
import { planFromV1 } from "../adapter";
import { useRoomV2 } from "../useRoomV2";

jest.mock("@/lib/escapd-api", () => ({
  ensureSession: jest.fn(async () => ({})),
  startOrResume: jest.fn(async () => ({ puzzle_version_id: "v1" })),
  getPlayableDefinition: jest.fn(),
  isNetworkError: () => false,
}));
const mocked = api as jest.Mocked<typeof api>;

const spot = (id: string, label: string, photo: number, x: number, y: number, w = 0.2, h = 0.25) =>
  ({ id, photo_index: photo, object_label: label, shape: { type: "rect" as const, x, y, w, h } });
export const bedroom = (): PuzzleDefinitionV1 => ({
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

/** Lets the load finish (planning is synchronous and slow-ish), inside one act. */
async function loaded(hook: { current: ReturnType<typeof useRoomV2> }) {
  await act(async () => {
    for (let i = 0; i < 200 && hook.current.phase.kind === "loading"; i++) await new Promise((r) => setTimeout(r, 10));
  });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mocked.getPlayableDefinition.mockResolvedValue(bedroom());
});

describe("useRoomV2", () => {
  it("plays the planned room to its end, saving as it goes, and resumes where it was", async () => {
    const plan = planFromV1("room-1", bedroom());
    if (!plan.ok) throw new Error(plan.detail);
    const { path } = simulate(plan.definition, plan.secret);
    const { result, unmount } = await renderHook(() => useRoomV2("room-1"));
    await loaded(result);
    expect(result.current.phase.kind).toBe("ready");
    const half = Math.floor(path.length / 2);
    // One act: the hook keeps its progress in a ref, so actions in a row see each other.
    await act(async () => {
      for (const a of path.slice(0, half)) result.current.act(a);
    });
    const midway = result.current.progress!.state;
    await unmount();

    const again = await renderHook(() => useRoomV2("room-1"));
    await loaded(again.result);
    expect(again.result.current.phase.kind).toBe("ready");
    expect(again.result.current.progress!.state).toEqual(midway);
    let last = null as ReturnType<typeof again.result.current.act> | null;
    await act(async () => {
      for (const a of path.slice(half)) last = again.result.current.act(a);
    });
    expect(last!.completed).toBe(true);
    expect(last!.effects.some((e) => e.do === "complete")).toBe(true);
    expect(again.result.current.progress!.completedAt).not.toBeNull();
  });

  it("a wrong submit starts the cooldown; hints climb the next step's ladder", async () => {
    const plan = planFromV1("room-1", bedroom());
    if (!plan.ok) throw new Error(plan.detail);
    const { result } = await renderHook(() => useRoomV2("room-1"));
    await loaded(result);
    expect(result.current.phase.kind).toBe("ready");
    const exit = plan.definition.objects.find((o) => o.exit)!;
    // The door, before anything is solved: a wrong (or locked) answer, never a win.
    const wheels = plan.definition.finale.kind === "combination" ? plan.definition.finale.wheels : 3;
    let r = null as ReturnType<typeof result.current.act> | null;
    await act(async () => void (r = result.current.act({ type: "submit", object: exit.id, value: Array(wheels).fill("0") })));
    expect(r!.completed ?? false).toBe(false);
    if (r!.start_cooldown) expect(result.current.cooldown).toBeGreaterThan(0);

    const hints: string[] = [];
    await act(async () => {
      for (let i = 0; i < 4; i++) hints.push(result.current.hint()?.text ?? "");
    });
    expect(hints[0]).toBeTruthy();
    // Three rungs, then the reveal again.
    expect(hints[3]).toBe(hints[2]);
    expect(result.current.hintsUsed).toBe(3);
  });

  it("hands a room the planner can't build back to the v1 player", async () => {
    mocked.getPlayableDefinition.mockResolvedValue({ ...bedroom(), hotspots: bedroom().hotspots.slice(1, 3) });
    const { result } = await renderHook(() => useRoomV2("room-2"));
    await loaded(result);
    expect(result.current.phase.kind).toBe("fallback");
  });
});
