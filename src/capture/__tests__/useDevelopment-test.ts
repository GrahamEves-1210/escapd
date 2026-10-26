import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as api from "@/lib/escapd-api";
import type { GenerationJob } from "@/lib/escapd-api";
import { addPlate, clearPlates, currentTicket, removePlate } from "../roll";
import { POLL_MS, useDevelopment } from "../useDevelopment";

jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation((uri: string) => ({ arrayBuffer: async () => new TextEncoder().encode(uri).buffer })),
}));

jest.mock("@/lib/escapd-api", () => {
  class ApiError extends Error {
    code?: string;
    constructor(message: string, code?: string) {
      super(message);
      this.code = code;
    }
  }
  return {
    ApiError,
    isNetworkError: (e: unknown) => /network request failed/i.test(e instanceof Error ? e.message : ""),
    getMyAccess: jest.fn(),
    createRoom: jest.fn(),
    getRoomPhotos: jest.fn(),
    uploadRoomPhoto: jest.fn(),
    requestGeneration: jest.fn(),
    getGenerationJob: jest.fn(),
    getLatestGenerationJob: jest.fn(),
    watchGenerationJob: jest.fn(),
  };
});

const mocked = api as jest.Mocked<typeof api>;

const access = (overrides: Partial<Awaited<ReturnType<typeof api.getMyAccess>>> = {}) => ({
  user_id: "u1", is_anonymous: false, tutorial_completed: true, has_custom_rooms_entitlement: true,
  entitlement_status: "active" as const, entitlement_expires_at: null, will_renew: null, can_generate: true,
  generations_used: 0, generations_cap: 20, min_photos_per_room: 3, max_photos_per_room: 6, ...overrides,
});

const job = (overrides: Partial<GenerationJob> = {}): GenerationJob => ({
  id: "j1", room_id: "r1", owner_id: "u1", idempotency_key: "k", status: "queued", attempt_count: 0, max_attempts: 3,
  prompt_version: "v1", output_schema_version: 1, next_attempt_at: "", lease_token: null, leased_by: null,
  lease_expires_at: null, error_code: null, error_message: null, result_version_id: null, started_at: null,
  finished_at: null, created_at: "2026-10-24T00:00:00Z", updated_at: "", genre: "noir", ...overrides,
});

/** Captures the realtime listener so a test can push job updates. */
let pushJob: (job: GenerationJob) => void = () => {};
const unwatch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  clearPlates();
  for (let i = 0; i < 3; i++) addPlate({ uri: `file://plate-${i}.jpg`, width: 1200, height: 1600 });
  mocked.getMyAccess.mockResolvedValue(access());
  mocked.createRoom.mockResolvedValue({ id: "r1" } as Awaited<ReturnType<typeof api.createRoom>>);
  mocked.getRoomPhotos.mockResolvedValue([]);
  mocked.uploadRoomPhoto.mockResolvedValue({} as Awaited<ReturnType<typeof api.uploadRoomPhoto>>);
  mocked.requestGeneration.mockResolvedValue(job());
  mocked.watchGenerationJob.mockImplementation((_id, onChange) => {
    pushJob = onChange;
    return unwatch;
  });
});

describe("useDevelopment", () => {
  it("sends a guest to add an email before anything is uploaded", async () => {
    mocked.getMyAccess.mockResolvedValue(access({ is_anonymous: true, can_generate: false }));
    const { result } = await renderHook(() => useDevelopment());
    await waitFor(() => expect(result.current.stage.kind).toBe("account"));
    expect(mocked.createRoom).not.toHaveBeenCalled();
  });

  it("explains a missing entitlement", async () => {
    mocked.getMyAccess.mockResolvedValue(access({ has_custom_rooms_entitlement: false, can_generate: false }));
    const { result } = await renderHook(() => useDevelopment());
    await waitFor(() => expect(result.current.stage).toEqual({ kind: "access", reason: "entitlement" }));
  });

  it("uploads every plate in order, requests generation once, and follows the job to ready", async () => {
    const { result } = await renderHook(() => useDevelopment());
    await waitFor(() => expect(result.current.stage.kind).toBe("waiting"));
    expect(mocked.uploadRoomPhoto.mock.calls.map(([p]) => p.position)).toEqual([0, 1, 2]);
    expect(mocked.uploadRoomPhoto.mock.calls[0][0]).toMatchObject({ roomId: "r1", contentType: "image/jpeg", width: 1200, height: 1600 });
    expect(mocked.requestGeneration).toHaveBeenCalledWith("r1", currentTicket().key);

    await act(async () => pushJob(job({ status: "running" })));
    expect(result.current.stage.kind).toBe("waiting");
    await act(async () => pushJob(job({ status: "succeeded" })));
    expect(result.current.stage).toEqual({ kind: "ready", roomId: "r1" });
    expect(unwatch).toHaveBeenCalled();
  });

  it("uploads each photo with its slot as its position, so a removed photo leaves a gap", async () => {
    addPlate({ uri: "file://plate-3.jpg", width: 1200, height: 1600 });
    removePlate(1);
    const { result } = await renderHook(() => useDevelopment());
    await waitFor(() => expect(result.current.stage.kind).toBe("waiting"));
    expect(mocked.uploadRoomPhoto.mock.calls.map(([p]) => p.position)).toEqual([0, 2, 3]);
  });

  it("carries each flagged photo's reason from a newer server", async () => {
    mocked.requestGeneration.mockResolvedValue(job({
      status: "failed", error_code: "person_or_sensitive",
      error_message: "Person or private text detected in photo position(s): 0, 2. Retake those photos. Reasons: 0=person; 2=private_text.",
    }));
    const { result } = await renderHook(() => useDevelopment());
    await waitFor(() => expect(result.current.stage.kind).toBe("failed"));
    const stage = result.current.stage as Extract<typeof result.current.stage, { kind: "failed" }>;
    expect(stage.copy.flagged).toEqual([{ slot: 0, reason: "person" }, { slot: 2, reason: "private_text" }]);
  });

  it("falls back to polling when realtime stays quiet", async () => {
    jest.useFakeTimers();
    try {
      mocked.getGenerationJob.mockResolvedValue(job({ status: "succeeded" }));
      const { result } = await renderHook(() => useDevelopment());
      await waitFor(() => expect(result.current.stage.kind).toBe("waiting"));
      await act(async () => {
        jest.advanceTimersByTime(POLL_MS);
      });
      await waitFor(() => expect(result.current.stage).toEqual({ kind: "ready", roomId: "r1" }));
    } finally {
      jest.useRealTimers();
    }
  });

  it("turns a privacy failure into retake advice for the named plates", async () => {
    mocked.requestGeneration.mockResolvedValue(job({
      status: "failed", error_code: "person_or_sensitive",
      error_message: "Person or private text detected in photo position(s): 1. Retake those photos.",
    }));
    const { result } = await renderHook(() => useDevelopment());
    await waitFor(() => expect(result.current.stage.kind).toBe("failed"));
    const stage = result.current.stage as Extract<typeof result.current.stage, { kind: "failed" }>;
    expect(stage.copy).toMatchObject({ action: "retake", plates: [1] });
  });

  it("resumes a broken upload into the same room with the same idempotency key", async () => {
    mocked.uploadRoomPhoto
      .mockResolvedValueOnce({} as Awaited<ReturnType<typeof api.uploadRoomPhoto>>)
      .mockRejectedValueOnce(new TypeError("Network request failed"));
    const { result } = await renderHook(() => useDevelopment());
    await waitFor(() => expect(result.current.stage.kind).toBe("error"));
    const key = currentTicket().key;

    mocked.getRoomPhotos.mockResolvedValue([{ position: 0 }] as Awaited<ReturnType<typeof api.getRoomPhotos>>);
    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current.stage.kind).toBe("waiting"));
    expect(mocked.createRoom).toHaveBeenCalledTimes(1);
    expect(mocked.uploadRoomPhoto.mock.calls.slice(2).map(([p]) => p.position)).toEqual([1, 2]);
    expect(mocked.requestGeneration).toHaveBeenCalledWith("r1", key);
  });
});

describe("useDevelopment without plates", () => {
  it("asks for new plates instead of creating an empty room", async () => {
    clearPlates();
    const { result } = await renderHook(() => useDevelopment());
    await waitFor(() => expect(result.current.stage.kind).toBe("error"));
    expect(mocked.createRoom).not.toHaveBeenCalled();
  });
});
