// What home knows about each mode (round 6): The Study's entry, the case the
// player can go back to in each mode (from the existing API only), where
// Continue goes, the cards' labels, and the intro's flag and route.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as api from "@/lib/escapd-api";
import { hasIntro, hasSeenIntro, introKey, markIntroSeen } from "@/screens/mode/introSeen";
import { introHref } from "@/screens/mode/routes";
import { caseToContinue, continueHref, modeCardLabel, newestByGenre, noirCase, studyEntry } from "../caseStatus";
import { fetchHub, loadHub } from "../useHubData";

jest.mock("expo-router", () => ({ useFocusEffect: jest.fn() }));
jest.mock("@/lib/escapd-api", () => ({ currentSession: jest.fn(), getLatestSession: jest.fn(), listMyRooms: jest.fn() }));
jest.mock("@/tutorial/assets", () => ({ TUTORIAL_ROOM_ID: "tutorial-room" }));

const mocked = api as jest.Mocked<typeof api>;
type Room = Awaited<ReturnType<typeof api.listMyRooms>>[number];
type Session = NonNullable<Awaited<ReturnType<typeof api.getLatestSession>>>;
const room = (id: string, genre: Room["genre"], status: Room["status"]) => ({ id, genre, status }) as Room;

describe("a case to go back to", () => {
  it("is the mode's newest room while it builds, or once ready until it is completed", () => {
    expect(caseToContinue(room("q", "noir", "queued"), null)).toEqual({ kind: "build", roomId: "q" });
    expect(caseToContinue(room("g", "noir", "generating"), null)).toEqual({ kind: "build", roomId: "g" });
    // Ready and never played, in progress, or its last run abandoned ("Restart this case").
    expect(caseToContinue(room("r", "noir", "ready"), null)).toEqual({ kind: "play", roomId: "r" });
    expect(caseToContinue(room("r", "noir", "ready"), { status: "active" })).toEqual({ kind: "play", roomId: "r" });
    expect(caseToContinue(room("r", "noir", "ready"), { status: "abandoned" })).toEqual({ kind: "play", roomId: "r" });
    // Completed, failed, a draft, or no room: none.
    expect(caseToContinue(room("r", "noir", "ready"), { status: "completed" })).toBeNull();
    expect(caseToContinue(room("f", "noir", "failed"), null)).toBeNull();
    expect(caseToContinue(room("d", "noir", "draft"), null)).toBeNull();
    expect(caseToContinue(undefined, null)).toBeNull();
  });

  it("takes each mode's newest room from the newest-first list", () => {
    const rooms = [room("c2", "crime_scene", "failed"), room("n2", "noir", "ready"), room("c1", "crime_scene", "ready"), room("n1", "noir", "ready")];
    expect(newestByGenre(rooms)).toEqual({ crime_scene: rooms[0], noir: rooms[1] });
  });

  it("noir: the player's own case first, else The Study while it is part-way through", () => {
    const own = { kind: "play", roomId: "n1" } as const;
    expect(noirCase(own, "continue")).toBe(own);
    expect(noirCase(null, "continue")).toEqual({ kind: "study" });
    expect(noirCase(null, "replay")).toBeNull();
    expect(noirCase(null, "unseal")).toBeNull();
  });

  it("Continue resumes the case in the player, the build wait, or The Study", () => {
    expect(continueHref({ kind: "play", roomId: "r1" })).toEqual({ pathname: "/play/[roomId]", params: { roomId: "r1" } });
    expect(continueHref({ kind: "build", roomId: "r2" })).toEqual({ pathname: "/capture/develop", params: { roomId: "r2" } });
    expect(continueHref({ kind: "study" })).toBe("/tutorial");
  });

  it("The Study's entry, from its latest session", () => {
    expect(studyEntry(null)).toBe("unseal");
    expect(studyEntry({ status: "abandoned" })).toBe("unseal");
    expect(studyEntry({ status: "active" })).toBe("continue");
    expect(studyEntry({ status: "completed" })).toBe("replay");
  });

  it("a card's label: its name and tagline only; never a status or a count", () => {
    expect(modeCardLabel("Detective Noir", "Solve the case")).toBe("Detective Noir. Solve the case.");
    expect(modeCardLabel("Paranormal", "Face the unknown")).toBe("Paranormal. Face the unknown.");
  });
});

describe("loadHub: only existing API functions", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reads The Study's session and the sent rooms, then the latest session of each mode's newest ready room", async () => {
    mocked.currentSession.mockResolvedValue({} as never);
    mocked.listMyRooms.mockResolvedValue([
      room("n2", "noir", "ready"),
      room("p2", "paranormal", "generating"),
      room("c2", "crime_scene", "ready"),
      room("n1", "noir", "ready"),
      room("p1", "paranormal", "ready"),
    ]);
    const sessions: Record<string, Session["status"]> = { "tutorial-room": "completed", n2: "active", c2: "completed" };
    mocked.getLatestSession.mockImplementation(async (id) => (sessions[id] ? ({ status: sessions[id] } as Session) : null));
    expect(await loadHub()).toEqual({
      study: "replay",
      cases: { noir: { kind: "play", roomId: "n2" }, crime_scene: null, paranormal: { kind: "build", roomId: "p2" } },
    });
    expect(mocked.listMyRooms).toHaveBeenCalledTimes(1);
    expect(mocked.listMyRooms).toHaveBeenCalledWith();
    // The tutorial's and the two newest ready rooms' sessions; none for a building room or an older one.
    expect(mocked.getLatestSession.mock.calls.map(([id]) => id).sort()).toEqual(["c2", "n2", "tutorial-room"]);
  });

  it("noir's part-played Study is its case when the player has none of their own", async () => {
    mocked.currentSession.mockResolvedValue({} as never);
    mocked.listMyRooms.mockResolvedValue([room("n1", "noir", "failed")]);
    mocked.getLatestSession.mockImplementation(async (id) => (id === "tutorial-room" ? ({ status: "active" } as Session) : null));
    expect(await loadHub()).toEqual({ study: "continue", cases: { noir: { kind: "study" }, crime_scene: null, paranormal: null } });
  });

  it("no stored session: The Study unseals and nothing is read (no guest made just to look)", async () => {
    mocked.currentSession.mockResolvedValue(null);
    expect(await loadHub()).toEqual({ study: "unseal", cases: { noir: null, crime_scene: null, paranormal: null } });
    expect(mocked.listMyRooms).not.toHaveBeenCalled();
    expect(mocked.getLatestSession).not.toHaveBeenCalled();
  });

  it("rejects when it can't read; fetchHub turns that into nothing known", async () => {
    mocked.currentSession.mockResolvedValue({} as never);
    mocked.getLatestSession.mockResolvedValue(null);
    mocked.listMyRooms.mockRejectedValue(new Error("Network request failed"));
    await expect(loadHub()).rejects.toThrow("Network request failed");
    expect(await fetchHub()).toEqual({});
  });
});

describe("the first-time intro", () => {
  beforeEach(() => AsyncStorage.clear());

  it("has its own route, one flag per mode, and none for noir", async () => {
    expect(introHref("paranormal")).toEqual({ pathname: "/mode/intro/[genre]", params: { genre: "paranormal" } });
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
