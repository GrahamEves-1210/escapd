import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { countByGenre, modeCardLabel, studyEntry } from "@/screens/hub/caseStatus";
import { caseCount, caseHref, caseLabel, caseTitle, stampFor, studyAction, studyStamp } from "../caseFiles";
import { coverPhotos, latestSessionStatuses, signCovers } from "../caseQueries";
import { hasIntro, hasSeenIntro, introKey, markIntroSeen } from "../introSeen";
import { introHref, modeHref } from "../routes";

jest.mock("@/lib/supabase", () => ({ supabase: { from: jest.fn() } }));
jest.mock("@/lib/escapd-api", () => {
  class ApiError extends Error {
    code?: string;
    constructor(message: string, errorCode?: string) {
      super(message);
      this.code = errorCode;
    }
  }
  return { ApiError, signedPhotoUrl: jest.fn(async (path: string) => `https://signed.example/${path}`) };
});

/** A PostgREST query that records its calls and answers `rows` (or `error`). */
function query(rows: unknown[], error: { message: string; code: string } | null = null) {
  const calls: [string, ...unknown[]][] = [];
  const builder = {
    calls,
    select: (...a: unknown[]) => (calls.push(["select", ...a]), builder),
    in: (...a: unknown[]) => (calls.push(["in", ...a]), builder),
    order: (...a: unknown[]) => (calls.push(["order", ...a]), Promise.resolve({ data: error ? null : rows, error })),
  };
  jest.mocked(supabase.from).mockReturnValueOnce(builder as never);
  return builder;
}

describe("case files", () => {
  it("stamps a room from its status and latest session", () => {
    expect(stampFor({ status: "ready" }, null)).toBe("open");
    expect(stampFor({ status: "ready" }, "abandoned")).toBe("open");
    expect(stampFor({ status: "ready" }, "active")).toBe("inProgress");
    expect(stampFor({ status: "ready" }, { status: "completed" })).toBe("closed");
    expect(stampFor({ status: "queued" }, null)).toBe("building");
    expect(stampFor({ status: "generating" }, null)).toBe("building");
    expect(stampFor({ status: "failed" }, null)).toBe("failed");
    expect(stampFor({ status: "draft" }, null)).toBeNull();
  });

  it("labels, titles, counts and routes", () => {
    const label = caseLabel({ title: "The Locked Room", createdAt: "2026-10-20T18:00:00Z", stamp: "closed" });
    expect(label).toMatch(/^The Locked Room\. .+2026\. Closed\.$/);
    expect(caseLabel({ title: "Untitled case", createdAt: "nonsense", stamp: "failed" })).toBe("Untitled case. Didn't build. See why.");
    expect(caseTitle("  ")).toBe("Untitled case");
    expect(caseTitle(" The Heir ")).toBe("The Heir");
    expect([0, 1, 2].map(caseCount)).toEqual(["No cases yet", "1 case", "2 cases"]);
    expect(caseHref({ roomId: "r1", stamp: "open" })).toEqual({ pathname: "/play/[roomId]", params: { roomId: "r1" } });
    expect(caseHref({ roomId: "r1", stamp: "building" })).toEqual({ pathname: "/capture/develop", params: { roomId: "r1" } });
    expect(caseHref({ roomId: "r1", stamp: "failed" })).toEqual({ pathname: "/capture/develop", params: { roomId: "r1" } });
    expect(modeHref("noir")).toEqual({ pathname: "/mode/[genre]", params: { genre: "noir" } });
    expect(introHref("paranormal")).toEqual({ pathname: "/mode/intro/[genre]", params: { genre: "paranormal" } });
  });

  it("The Study: its stamp and what a tap does", () => {
    expect(studyStamp(null)).toBe("open");
    expect(studyStamp("active")).toBe("inProgress");
    expect(studyStamp("completed")).toBe("closed");
    expect(["open", "inProgress", "closed"].map((s) => studyAction(s as never))).toEqual(["Take the case", "Back on the case", "Reopen the case"]);
    expect(studyEntry(null)).toBe("unseal");
    expect(studyEntry({ status: "abandoned" })).toBe("unseal");
    expect(studyEntry({ status: "active" })).toBe("continue");
    expect(studyEntry({ status: "completed" })).toBe("replay");
  });

  it("home's counts and card labels", () => {
    expect(countByGenre([{ genre: "noir" }, { genre: "noir" }, { genre: "paranormal" }])).toEqual({ noir: 2, crime_scene: 0, paranormal: 1 });
    expect(modeCardLabel("Detective Noir", "Solve the case", 2)).toBe("Detective Noir. Solve the case. 2 cases");
    expect(modeCardLabel("Paranormal", "Face the unknown", undefined)).toBe("Paranormal. Face the unknown.");
  });
});

describe("batched reads", () => {
  beforeEach(() => jest.mocked(supabase.from).mockReset());

  it("reads every room's latest session in one query, newest first", async () => {
    const q = query([
      { room_id: "a", status: "active", created_at: "3" },
      { room_id: "b", status: "completed", created_at: "2" },
      { room_id: "a", status: "abandoned", created_at: "1" },
    ]);
    const latest = await latestSessionStatuses(["a", "b", "c"]);
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(supabase.from).toHaveBeenCalledWith("game_sessions");
    expect(q.calls).toEqual([
      ["select", "room_id, status, created_at"],
      ["in", "room_id", ["a", "b", "c"]],
      ["order", "created_at", { ascending: false }],
    ]);
    expect([...latest]).toEqual([
      ["a", "active"],
      ["b", "completed"],
    ]);
    // Nothing to ask: no query.
    expect((await latestSessionStatuses([])).size).toBe(0);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it("reads every room's first photo in one query, and signs them in parallel, leaving out any that fail", async () => {
    const q = query([
      { id: "p1", room_id: "a", storage_path: "u/a/1.jpg", position: 0 },
      { id: "p2", room_id: "a", storage_path: "u/a/2.jpg", position: 1 },
      { id: "p3", room_id: "b", storage_path: "u/b/1.jpg", position: 0 },
    ]);
    const covers = await coverPhotos(["a", "b"]);
    expect(supabase.from).toHaveBeenCalledWith("room_photos");
    expect(q.calls[2]).toEqual(["order", "position", { ascending: true }]);
    expect([...covers.keys()]).toEqual(["a", "b"]);
    expect(covers.get("a")?.id).toBe("p1");

    const { signedPhotoUrl } = jest.requireMock("@/lib/escapd-api") as { signedPhotoUrl: jest.Mock };
    signedPhotoUrl.mockRejectedValueOnce(new Error("Network request failed"));
    const signed = await signCovers([...covers.values()]);
    expect(signed.size).toBe(1);
  });

  it("throws the API's error when a query fails", async () => {
    query([], { message: "permission denied", code: "42501" });
    await expect(latestSessionStatuses(["a"])).rejects.toMatchObject({ message: "permission denied", code: "42501" });
  });
});

describe("the first-time intro flag", () => {
  beforeEach(() => AsyncStorage.clear());

  it("is one key per mode, and noir never has an intro", async () => {
    expect(hasIntro("noir")).toBe(false);
    expect(hasIntro("crime_scene")).toBe(true);
    expect(await hasSeenIntro("noir")).toBe(true);
    expect(await hasSeenIntro("crime_scene")).toBe(false);
    await markIntroSeen("crime_scene");
    expect(await AsyncStorage.getItem(introKey("crime_scene"))).toBe("1");
    expect(await hasSeenIntro("crime_scene")).toBe(true);
    expect(await hasSeenIntro("paranormal")).toBe(false);
  });

  it("shows the intro again when storage can't be read, and never throws", async () => {
    jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("locked"));
    expect(await hasSeenIntro("paranormal")).toBe(false);
    jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("full"));
    await expect(markIntroSeen("paranormal")).resolves.toBeUndefined();
  });
});
