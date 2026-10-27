// A whole v2 room played through the hook. Local mode: planned from a v1 room,
// every action of the simulator's winning path, progress saved and resumed, a
// wrong submit's cooldown, and the hint ladder. Server mode: a v2 room, each
// request sent to play-action (mocked here by the same `play()` over a stored
// session), one at a time, with a conflict retried once after a load.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook } from "@testing-library/react-native";
import { play, simulate, type PlayRequest, type RoomDefinitionV2, type RoomSecretV2 } from "@/engine/v2";
import * as api from "@/lib/escapd-api";
import type { PuzzleDefinitionV1 } from "@/lib/puzzle-types";
import { planFromV1 } from "../adapter";
import { useRoomV2 } from "../useRoomV2";

jest.mock("@/lib/escapd-api", () => ({
  ensureSession: jest.fn(async () => ({})),
  startOrResume: jest.fn(async () => ({ id: "s1", puzzle_version_id: "v1" })),
  abandonSession: jest.fn(async () => ({})),
  getPlayableDefinition: jest.fn(),
  playActionV2: jest.fn(),
  isNetworkError: (e: unknown) => /network/i.test(String((e as Error)?.message ?? e)),
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
    expect(result.current.mode).toBe("local");
    expect(result.current.scene!.photos).toEqual([{ photo_id: "a" }, { photo_id: "b" }]);
    // One act: the hook keeps its progress in a ref, so actions in a row see each other.
    await act(async () => {
      for (const a of path.slice(0, half)) await result.current.act(a);
    });
    const midway = result.current.state;
    await unmount();

    const again = await renderHook(() => useRoomV2("room-1"));
    await loaded(again.result);
    expect(again.result.current.phase.kind).toBe("ready");
    expect(again.result.current.state).toEqual(midway);
    let last = null as Awaited<ReturnType<typeof again.result.current.act>>;
    await act(async () => {
      for (const a of path.slice(half)) last = await again.result.current.act(a);
    });
    expect(last!.completed).toBe(true);
    expect(last!.effects.some((e) => e.do === "complete")).toBe(true);
    expect(again.result.current.completed).toBe(true);
    expect(again.result.current.ending).toBe(plan.secret.ending);
    expect(again.result.current.canHint).toBe(false);
    // Cards come back rendered: no {{slot}} left.
    expect(again.result.current.cards.length).toBeGreaterThan(0);
    expect(again.result.current.cards.every((c) => !c.text.includes("{{"))).toBe(true);
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
    let r = null as Awaited<ReturnType<typeof result.current.act>>;
    await act(async () => void (r = await result.current.act({ type: "submit", object: exit.id, value: Array(wheels).fill("0") })));
    expect(r!.completed ?? false).toBe(false);
    if (r!.start_cooldown) expect(result.current.cooldown).toBeGreaterThan(0);

    const hints: string[] = [];
    await act(async () => {
      for (let i = 0; i < 4; i++) hints.push((await result.current.hint())?.text ?? "");
    });
    expect(hints[0]).toBeTruthy();
    // Three rungs, then the reveal again.
    expect(hints[3]).toBe(hints[2]);
    expect(result.current.hintsUsed).toBe(3);
    expect(result.current.hints).toEqual(hints.slice(0, 3));
  });

  it("restarts a local room from the top, and resumes a save in the first shape", async () => {
    const plan = planFromV1("room-1", bedroom());
    if (!plan.ok) throw new Error(plan.detail);
    const { path } = simulate(plan.definition, plan.secret);
    const { result, unmount } = await renderHook(() => useRoomV2("room-1"));
    await loaded(result);
    const fresh = result.current.state;
    await act(async () => {
      for (const a of path.slice(0, 3)) await result.current.act(a);
      await result.current.hint();
    });
    expect(result.current.state).not.toEqual(fresh);
    let ok = false;
    await act(async () => void (ok = await result.current.restart()));
    expect(ok).toBe(true);
    expect(result.current.state).toEqual(fresh);
    expect(result.current.hints).toEqual([]);
    await unmount();

    // The first save shape: { state, hints, wrong, startedAt, completedAt }.
    const step = plan.secret.steps.find((s) => !s.optional && s.requires.length === 0)!;
    await AsyncStorage.setItem("escapd.v2.play.room-1", JSON.stringify({ state: fresh, hints: { [step.id]: 2 }, wrong: 0, startedAt: 1, completedAt: null }));
    const again = await renderHook(() => useRoomV2("room-1"));
    await loaded(again.result);
    expect(again.result.current.phase.kind).toBe("ready");
    expect(again.result.current.hintsUsed).toBe(2);
  });

  it("hands a room the planner can't build back to the v1 player", async () => {
    mocked.getPlayableDefinition.mockResolvedValue({ ...bedroom(), hotspots: bedroom().hotspots.slice(1, 3) });
    const { result } = await renderHook(() => useRoomV2("room-2"));
    await loaded(result);
    expect(result.current.phase.kind).toBe("fallback");
  });
});

/** A server for one session: play-action runs `play()` over the stored state, as the edge function does. */
function server(def: RoomDefinitionV2, secret: RoomSecretV2) {
  const store = { state: null as unknown, lockedUntil: null as number | null, calls: [] as PlayRequest[] };
  mocked.playActionV2.mockImplementation(async (_id: string, body: PlayRequest = {}) => {
    store.calls.push(body);
    const { response, save } = play(def, secret, store.state, body, Date.now(), store.lockedUntil);
    if (save) {
      store.state = save.state;
      store.lockedUntil = save.lockedUntil;
    }
    return response;
  });
  return store;
}

describe("useRoomV2 on the server (a v2 room)", () => {
  const plan = planFromV1("room-3", bedroom());
  if (!plan.ok) throw new Error(plan.detail);
  const def: RoomDefinitionV2 = { ...plan.definition, photos: [{ photo_id: "a" }, { photo_id: "b" }] };

  beforeEach(() => {
    mocked.playActionV2.mockReset();
    mocked.getPlayableDefinition.mockResolvedValue(def);
  });

  it("loads with a play-action load, then sends actions and hints", async () => {
    const store = server(def, plan.secret);
    const { path } = simulate(plan.definition, plan.secret);
    const { result } = await renderHook(() => useRoomV2("room-3"));
    await loaded(result);
    expect(result.current.phase.kind).toBe("ready");
    expect(result.current.mode).toBe("server");
    expect(result.current.scene!.photos).toEqual(def.photos);
    expect(store.calls).toEqual([{}]);
    expect(mocked.playActionV2).toHaveBeenCalledWith("s1", {});

    let r = null as Awaited<ReturnType<typeof result.current.act>>;
    await act(async () => void (r = await result.current.act(path[0])));
    expect(r).not.toBeNull();
    expect(mocked.playActionV2).toHaveBeenLastCalledWith("s1", { action: path[0] });
    expect(result.current.busy).toBe(false);

    let h = null as Awaited<ReturnType<typeof result.current.hint>>;
    await act(async () => void (h = await result.current.hint()));
    expect(h!.rung).toBe(1);
    expect(result.current.hints).toEqual([h!.text]);

    await act(async () => {
      for (const a of path.slice(1)) await result.current.act(a);
    });
    expect(result.current.completed).toBe(true);
    expect(result.current.ending).toBe(plan.secret.ending);
  });

  it("ignores a second action while one is in flight", async () => {
    server(def, plan.secret);
    const { result } = await renderHook(() => useRoomV2("room-3"));
    await loaded(result);
    const real = mocked.playActionV2.getMockImplementation()!;
    let release!: () => void;
    mocked.playActionV2.mockImplementationOnce(async (id, body) => {
      await new Promise<void>((r) => (release = r));
      return real(id, body);
    });
    const obj = def.objects[0].id;
    let first!: Promise<unknown>;
    let second = undefined as Awaited<ReturnType<typeof result.current.act>> | undefined;
    await act(async () => {
      first = result.current.act({ type: "inspect", object: obj });
      await Promise.resolve();
    });
    expect(result.current.busy).toBe(true);
    await act(async () => void (second = await result.current.act({ type: "inspect", object: obj })));
    expect(second).toBeNull();
    await act(async () => {
      release();
      await first;
    });
    expect(result.current.busy).toBe(false);
    expect(mocked.playActionV2).toHaveBeenCalledTimes(2); // the load and the first action
  });

  it("retries once after a load when another request saved first", async () => {
    const store = server(def, plan.secret);
    const { result } = await renderHook(() => useRoomV2("room-3"));
    await loaded(result);
    mocked.playActionV2.mockImplementationOnce(async () => {
      throw Object.assign(new Error("Another request saved first"), { code: "conflict" });
    });
    const action = { type: "inspect" as const, object: def.objects[0].id };
    let r = null as Awaited<ReturnType<typeof result.current.act>>;
    await act(async () => void (r = await result.current.act(action)));
    expect(r).not.toBeNull();
    // The failed send, a load, the send again.
    expect(mocked.playActionV2.mock.calls.slice(1).map((c) => c[1])).toEqual([{ action }, {}, { action }]);
    expect(store.calls.length).toBe(3); // the load, the catch-up load, the action (the conflict never reached play)
    expect(result.current.error).toBeNull();
  });

  it("returns null and notes the failure when a request doesn't go through", async () => {
    server(def, plan.secret);
    const { result } = await renderHook(() => useRoomV2("room-3"));
    await loaded(result);
    mocked.playActionV2.mockRejectedValueOnce(new Error("Network request failed"));
    let r = undefined as Awaited<ReturnType<typeof result.current.act>> | undefined;
    await act(async () => void (r = await result.current.act({ type: "inspect", object: def.objects[0].id })));
    expect(r).toBeNull();
    expect(result.current.error).toEqual({ offline: true, seq: 1 });
    expect(result.current.busy).toBe(false);
  });

  it("restarts by leaving the session and starting a new one", async () => {
    server(def, plan.secret);
    const { result } = await renderHook(() => useRoomV2("room-3"));
    await loaded(result);
    mocked.startOrResume.mockResolvedValueOnce({ id: "s2", puzzle_version_id: "v1" } as Awaited<ReturnType<typeof api.startOrResume>>);
    let ok = false;
    await act(async () => void (ok = await result.current.restart()));
    expect(ok).toBe(true);
    expect(mocked.abandonSession).toHaveBeenCalledWith("s1");
    await loaded(result);
    expect(result.current.phase.kind).toBe("ready");
    expect(mocked.playActionV2).toHaveBeenLastCalledWith("s2", {});
  });
});
