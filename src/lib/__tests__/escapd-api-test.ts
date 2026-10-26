import { ApiError, createRoom, listMyRooms, requestGeneration } from "../escapd-api";

type Result = { data: unknown; error: { message: string; code?: string } | null };

// Every call the query builder sees, in order, e.g. ["eq", "kind", "custom"].
let mockCalls: unknown[][] = [];
let mockResult: Result = { data: null, error: null };
const mockRpc = jest.fn();

/** A PostgREST builder stand-in: records each chained call and resolves to mockResult. */
function mockBuilder() {
  const builder: Record<string, unknown> = {
    then: (resolve: (r: Result) => unknown) => resolve(mockResult),
  };
  for (const method of ["select", "eq", "neq", "order", "limit"]) {
    builder[method] = (...args: unknown[]) => {
      mockCalls.push([method, ...args]);
      return builder;
    };
  }
  return builder;
}

jest.mock("../supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (table: string) => {
      mockCalls.push(["from", table]);
      return mockBuilder();
    },
  },
}));

const room = (overrides: Record<string, unknown> = {}) => ({ id: "r1", kind: "custom", status: "ready", genre: "noir", ...overrides });

beforeEach(() => {
  mockCalls = [];
  mockResult = { data: null, error: null };
  mockRpc.mockReset();
});

describe("createRoom", () => {
  it("leaves the genre out when none is given, so the server makes the room noir", async () => {
    mockRpc.mockResolvedValue({ data: room({ status: "draft" }), error: null });
    await createRoom();
    expect(mockRpc).toHaveBeenCalledWith("create_room", { p_title: null });
    expect(mockRpc.mock.calls[0][1]).not.toHaveProperty("p_genre");
  });

  it("sends the title and genre", async () => {
    mockRpc.mockResolvedValue({ data: room({ status: "draft", genre: "crime_scene" }), error: null });
    const created = await createRoom("My bedroom", "crime_scene");
    expect(mockRpc).toHaveBeenCalledWith("create_room", { p_title: "My bedroom", p_genre: "crime_scene" });
    expect(created.genre).toBe("crime_scene");
  });
});

describe("requestGeneration", () => {
  it("keeps the two-argument call when no genre is given", async () => {
    mockRpc.mockResolvedValue({ data: { id: "j1", genre: "noir" }, error: null });
    await requestGeneration("r1", "k1");
    expect(mockRpc).toHaveBeenCalledWith("request_room_generation", { p_room_id: "r1", p_idempotency_key: "k1" });
    expect(mockRpc.mock.calls[0][1]).not.toHaveProperty("p_genre");
  });

  it("sends the genre when one is given", async () => {
    mockRpc.mockResolvedValue({ data: { id: "j1", genre: "paranormal" }, error: null });
    await requestGeneration("r1", "k1", "paranormal");
    expect(mockRpc).toHaveBeenCalledWith("request_room_generation", {
      p_room_id: "r1", p_idempotency_key: "k1", p_genre: "paranormal",
    });
  });

  it("surfaces a refused genre change with its code", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "a built case keeps its genre", code: "22023" } });
    const error = await requestGeneration("r1", "k1", "crime_scene").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("22023");
  });
});

describe("listMyRooms", () => {
  it("lists custom rooms past draft, newest first, in every genre", async () => {
    mockResult = { data: [room({ id: "r2", genre: "paranormal" }), room({ id: "r1", status: "failed" })], error: null };
    const rooms = await listMyRooms();
    expect(rooms.map((r) => [r.id, r.genre])).toEqual([["r2", "paranormal"], ["r1", "noir"]]);
    expect(mockCalls).toEqual([
      ["from", "rooms"],
      ["select", "*"],
      ["eq", "kind", "custom"],
      ["neq", "status", "draft"],
      ["order", "created_at", { ascending: false }],
    ]);
  });

  it("filters to one genre", async () => {
    mockResult = { data: [room({ genre: "crime_scene" })], error: null };
    await listMyRooms({ genre: "crime_scene" });
    expect(mockCalls).toContainEqual(["eq", "genre", "crime_scene"]);
    expect(mockCalls).toContainEqual(["neq", "status", "draft"]);
  });

  it("returns an empty list when there are no rooms", async () => {
    mockResult = { data: null, error: null };
    await expect(listMyRooms()).resolves.toEqual([]);
  });

  it("throws an ApiError with the server's code", async () => {
    mockResult = { data: null, error: { message: "permission denied", code: "42501" } };
    await expect(listMyRooms({ genre: "noir" })).rejects.toMatchObject({ name: "ApiError", code: "42501" });
  });
});
