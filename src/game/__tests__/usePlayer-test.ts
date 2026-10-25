import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as api from "@/lib/escapd-api";
import type { ActionResult, SessionState } from "@/lib/puzzle-types";
import { initialState, sessionRow, studyPublic } from "@/test-utils/seed";
import { usePlayer } from "../usePlayer";

jest.mock("@/lib/escapd-api", () => {
  class ApiError extends Error {
    code?: string;
    constructor(message: string, errorCode?: string) {
      super(message);
      this.code = errorCode;
    }
  }
  return {
    ApiError,
    isNetworkError: (e: unknown) => /network request failed/i.test(e instanceof Error ? e.message : ""),
    ensureSession: jest.fn().mockResolvedValue({}),
    startOrResume: jest.fn(),
    getPlayableDefinition: jest.fn(),
    submitAction: jest.fn(),
    abandonSession: jest.fn(),
  };
});

const mocked = api as jest.Mocked<typeof api>;
const def = studyPublic();
const start = initialState(def);
const session = sessionRow(def);

beforeEach(() => {
  jest.clearAllMocks();
  mocked.startOrResume.mockResolvedValue(session);
  mocked.getPlayableDefinition.mockResolvedValue(def);
});

async function ready() {
  const hook = await renderHook(() => usePlayer("r1"));
  await waitFor(() => expect(hook.result.current.phase.kind).toBe("ready"));
  return hook;
}

describe("usePlayer", () => {
  it("loads the session's own version and its server state", async () => {
    const { result } = await ready();
    expect(mocked.getPlayableDefinition).toHaveBeenCalledWith("v1");
    expect(result.current.state).toEqual(start);
  });

  it("replaces state wholesale with the server's state on solved", async () => {
    const { result } = await ready();
    // Deliberately not what a local reducer would compute: the client must not care.
    const serverState: SessionState = { solved: ["find_key"], inventory: ["brass_key"], revealed_hotspots: ["door"] };
    mocked.submitAction.mockResolvedValue({ outcome: "solved", state: serverState, gained_items: ["brass_key"] });
    await act(async () => {
      await result.current.send({ type: "inspect", hotspot_id: "desk_drawer" });
    });
    expect(result.current.state).toEqual(serverState);
  });

  it("never changes state on wrong, nothing, or invalid", async () => {
    const { result } = await ready();
    for (const outcome of ["wrong", "nothing", "invalid"] as const) {
      mocked.submitAction.mockResolvedValue({ outcome, message: "x" } as ActionResult);
      await act(async () => {
        const sent = await result.current.send({ type: "solve", puzzle_id: "open_safe", answer: "0000" });
        expect(sent).toEqual({ kind: "result", result: { outcome, message: "x" } });
      });
      expect(result.current.state).toEqual(start);
    }
  });

  it("sends one action at a time; a double tap is dropped, not queued", async () => {
    const { result } = await ready();
    let resolve!: (r: ActionResult) => void;
    mocked.submitAction.mockReturnValue(new Promise((r) => (resolve = r)));
    let first!: Promise<unknown>;
    let second!: unknown;
    await act(async () => {
      first = result.current.send({ type: "inspect", hotspot_id: "rug" });
      second = await result.current.send({ type: "inspect", hotspot_id: "rug" });
    });
    expect(second).toEqual({ kind: "busy" });
    await act(async () => {
      resolve({ outcome: "nothing" });
      await first;
    });
    expect(mocked.submitAction).toHaveBeenCalledTimes(1);
  });

  it("keeps state on a network failure and retries the exact same action", async () => {
    const { result } = await ready();
    mocked.submitAction.mockRejectedValueOnce(new TypeError("Network request failed"));
    await act(async () => {
      expect(await result.current.send({ type: "solve", puzzle_id: "open_safe", answer: "0427" }))
        .toEqual({ kind: "failed", offline: true });
    });
    expect(result.current.failed?.offline).toBe(true);
    expect(result.current.state).toEqual(start);

    mocked.submitAction.mockResolvedValueOnce({ outcome: "invalid" });
    await act(async () => {
      await result.current.retry();
    });
    expect(mocked.submitAction).toHaveBeenLastCalledWith("s1", { type: "solve", puzzle_id: "open_safe", answer: "0427" });
    expect(result.current.failed).toBeNull();
  });

  it("refuses to render a definition from a newer schema", async () => {
    mocked.getPlayableDefinition.mockResolvedValue({ ...def, schema_version: 2 } as unknown as typeof def);
    const { result } = await renderHook(() => usePlayer("r1"));
    await waitFor(() => expect(result.current.phase).toEqual({ kind: "error", error: { kind: "unsupported", reason: "unsupported_schema" } }));
  });

  it("classifies load failures", async () => {
    mocked.startOrResume.mockRejectedValueOnce(new TypeError("Network request failed"));
    const offline = await renderHook(() => usePlayer("r1"));
    await waitFor(() => expect(offline.result.current.phase).toEqual({ kind: "error", error: { kind: "offline" } }));

    mocked.startOrResume.mockRejectedValueOnce(new api.ApiError("room not found", "P0002"));
    const missing = await renderHook(() => usePlayer("r1"));
    await waitFor(() => expect(missing.result.current.phase).toEqual({ kind: "error", error: { kind: "not_found" } }));
  });
});
